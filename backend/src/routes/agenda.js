const express = require("express");

const pool = require("../database/connection");
const { requerirRol } = require("../middleware/authMiddleware");

const router = express.Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DIAS = 42;

const soloAdmin = requerirRol("administrador", "superadmin");

function dias(desde, hasta) {
    return (Date.parse(hasta) - Date.parse(desde)) / 86400000;
}

/* Fechas reales (rechaza 2026-02-31) */
function fechaValida(valor) {

    if (typeof valor !== "string" || !FECHA.test(valor)) {
        return false;
    }

    const d = new Date(valor + "T00:00:00Z");

    return !isNaN(d) && d.toISOString().slice(0, 10) === valor;
}


/* =================================================
   AGENDA DE UN RANGO: configuración + turnos + bloqueos
================================================= */

router.get("/", async (req, res) => {

    try {

        const { desde, hasta } = req.query;

        if (!fechaValida(desde) || !fechaValida(hasta) || hasta < desde) {
            return res.status(400).json({ mensaje: "Rango de fechas inválido" });
        }

        if (dias(desde, hasta) > MAX_DIAS) {
            return res.status(400).json({ mensaje: `El rango máximo es de ${MAX_DIAS} días` });
        }

        const cid = req.usuario.consultorioId;

        const [config, turnos, bloqueos] = await Promise.all([

            pool.query(
                `SELECT agenda_hora_inicio AS hora_inicio,
                        agenda_hora_fin AS hora_fin,
                        agenda_intervalo AS intervalo
                 FROM consultorios WHERE id = $1`,
                [cid]
            ),

            pool.query(
                `
                SELECT
                    t.id,
                    to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
                    to_char(t.hora, 'HH24:MI') AS hora,
                    t.duracion_min,
                    t.estado,
                    t.observaciones,
                    p.id AS paciente_id,
                    p.nombre,
                    p.apellido,
                    p.dni,
                    (pg.id IS NOT NULL) AS pago_registrado,
                    pg.monto::float AS pago_monto,
                    pg.metodo_pago AS pago_metodo
                FROM turnos t
                INNER JOIN pacientes p ON p.id = t.paciente_id
                LEFT JOIN LATERAL (
                    SELECT id, monto, metodo_pago
                    FROM pagos
                    WHERE turno_id = t.id AND estado = 'pagado' AND consultorio_id = t.consultorio_id
                    ORDER BY fecha_pago DESC
                    LIMIT 1
                ) pg ON true
                WHERE t.consultorio_id = $1
                  AND t.fecha BETWEEN $2 AND $3
                ORDER BY t.fecha, t.hora
                `,
                [cid, desde, hasta]
            ),

            pool.query(
                `
                SELECT
                    id,
                    to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
                    to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
                    to_char(hora_desde, 'HH24:MI') AS hora_desde,
                    to_char(hora_hasta, 'HH24:MI') AS hora_hasta,
                    motivo
                FROM bloqueos
                WHERE consultorio_id = $1
                  AND fecha_desde <= $3
                  AND fecha_hasta >= $2
                ORDER BY fecha_desde, hora_desde NULLS FIRST
                `,
                [cid, desde, hasta]
            )
        ]);

        res.json({
            config: config.rows[0] || { hora_inicio: 8, hora_fin: 20, intervalo: 30 },
            turnos: turnos.rows,
            bloqueos: bloqueos.rows
        });

    } catch (error) {

        console.error("Error obteniendo agenda:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});


/* =================================================
   HORARIO DE ATENCIÓN (administrador)
================================================= */

router.put("/config", soloAdmin, async (req, res) => {

    try {

        const inicio = Number(req.body.hora_inicio);
        const fin = Number(req.body.hora_fin);
        const intervalo = Number(req.body.intervalo);

        if (
            !Number.isInteger(inicio) || !Number.isInteger(fin) ||
            inicio < 0 || fin > 24 || fin <= inicio
        ) {
            return res.status(400).json({ mensaje: "Horario inválido" });
        }

        if (![10, 15, 20, 30, 45, 60].includes(intervalo)) {
            return res.status(400).json({ mensaje: "Intervalo inválido" });
        }

        const r = await pool.query(
            `UPDATE consultorios
             SET agenda_hora_inicio = $1, agenda_hora_fin = $2, agenda_intervalo = $3
             WHERE id = $4
             RETURNING agenda_hora_inicio AS hora_inicio, agenda_hora_fin AS hora_fin, agenda_intervalo AS intervalo`,
            [inicio, fin, intervalo, req.usuario.consultorioId]
        );

        res.json({ mensaje: "Horario guardado", config: r.rows[0] });

    } catch (error) {

        console.error("Error guardando horario de agenda:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});


/* =================================================
   BLOQUEOS (vacaciones, feriados, horas no disponibles)
================================================= */

router.post("/bloqueos", async (req, res) => {

    try {

        const { fecha_desde, fecha_hasta } = req.body;
        const horaDesde = req.body.hora_desde || null;
        const horaHasta = req.body.hora_hasta || null;
        const motivo = (req.body.motivo || "").toString().trim().slice(0, 120) || null;

        if (!fechaValida(fecha_desde) || !fechaValida(fecha_hasta) || fecha_hasta < fecha_desde) {
            return res.status(400).json({ mensaje: "Fechas inválidas" });
        }

        if (dias(fecha_desde, fecha_hasta) > 366) {
            return res.status(400).json({ mensaje: "Un bloqueo no puede superar un año" });
        }

        if ((horaDesde === null) !== (horaHasta === null)) {
            return res.status(400).json({ mensaje: "Indicá hora de inicio y de fin, o ninguna para todo el día" });
        }

        if (horaDesde !== null) {

            if (!HORA.test(horaDesde) || !HORA.test(horaHasta) || horaHasta <= horaDesde) {
                return res.status(400).json({ mensaje: "Horas inválidas" });
            }
        }

        const r = await pool.query(
            `
            INSERT INTO bloqueos (consultorio_id, fecha_desde, fecha_hasta, hora_desde, hora_hasta, motivo)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
                to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
                to_char(hora_desde, 'HH24:MI') AS hora_desde,
                to_char(hora_hasta, 'HH24:MI') AS hora_hasta,
                motivo
            `,
            [req.usuario.consultorioId, fecha_desde, fecha_hasta, horaDesde, horaHasta, motivo]
        );

        res.status(201).json({ mensaje: "Bloqueo creado", bloqueo: r.rows[0] });

    } catch (error) {

        console.error("Error creando bloqueo:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

router.delete("/bloqueos/:id", async (req, res) => {

    try {

        const r = await pool.query(
            "DELETE FROM bloqueos WHERE id = $1 AND consultorio_id = $2 RETURNING id",
            [req.params.id, req.usuario.consultorioId]
        );

        if (r.rows.length === 0) {
            return res.status(404).json({ mensaje: "Bloqueo no encontrado" });
        }

        res.json({ mensaje: "Bloqueo eliminado" });

    } catch (error) {

        console.error("Error eliminando bloqueo:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

module.exports = router;
