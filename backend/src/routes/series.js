const express = require("express");

const pool = require("../database/connection");

const router = express.Router();

const MAX_TURNOS = 52;
const MAX_DIAS = 400;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function fechaValida(valor) {

    if (typeof valor !== "string" || !FECHA.test(valor)) {
        return false;
    }

    const d = new Date(valor + "T00:00:00Z");

    return !isNaN(d) && d.toISOString().slice(0, 10) === valor;
}

function validarDuracion(valor) {

    if (valor === undefined || valor === null || valor === "") {
        return 30;
    }

    const n = Number(valor);

    return Number.isInteger(n) && n >= 5 && n <= 480 ? n : null;
}

const aMinutos = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));


/* =================================================
   CREAR UNA SERIE DE TURNOS
   El cliente calcula las fechas; acá se valida todo
   y se crean juntas o ninguna.
================================================= */

router.post("/", async (req, res) => {

    const cid = req.usuario.consultorioId;

    try {

        const { paciente_id, hora, observaciones } = req.body;
        const fechas = req.body.fechas;
        const conflictos = req.body.conflictos;

        if (!paciente_id || !HORA.test(hora || "")) {
            return res.status(400).json({ mensaje: "Paciente y hora son obligatorios" });
        }

        const duracion = validarDuracion(req.body.duracion_min);

        if (duracion === null) {
            return res.status(400).json({ mensaje: "Duración inválida" });
        }

        if (conflictos !== undefined && conflictos !== "omitir" && conflictos !== "incluir") {
            return res.status(400).json({ mensaje: "Opción de conflictos inválida" });
        }

        if (!Array.isArray(fechas) || fechas.length < 2 || fechas.length > MAX_TURNOS) {
            return res.status(400).json({ mensaje: `Una serie tiene entre 2 y ${MAX_TURNOS} turnos` });
        }

        if (!fechas.every(fechaValida) || new Set(fechas).size !== fechas.length) {
            return res.status(400).json({ mensaje: "Fechas inválidas o repetidas" });
        }

        const ordenadas = [...fechas].sort();
        const primera = ordenadas[0];
        const ultima = ordenadas[ordenadas.length - 1];

        if ((Date.parse(ultima) - Date.parse(primera)) / 86400000 > MAX_DIAS) {
            return res.status(400).json({ mensaje: "La serie no puede durar más de 13 meses" });
        }

        const paciente = await pool.query(
            "SELECT id FROM pacientes WHERE id = $1 AND consultorio_id = $2 AND activo = true",
            [paciente_id, cid]
        );

        if (paciente.rows.length === 0) {
            return res.status(404).json({ mensaje: "Paciente no encontrado o inactivo" });
        }

        /* choques con turnos existentes o bloqueos */
        const [turnos, bloqueos] = await Promise.all([

            pool.query(
                `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha,
                        to_char(hora, 'HH24:MI') AS hora,
                        duracion_min
                 FROM turnos
                 WHERE consultorio_id = $1
                   AND fecha BETWEEN $2 AND $3
                   AND estado <> 'cancelado'`,
                [cid, primera, ultima]
            ),

            pool.query(
                `SELECT to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
                        to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
                        to_char(hora_desde, 'HH24:MI') AS hora_desde,
                        to_char(hora_hasta, 'HH24:MI') AS hora_hasta,
                        motivo
                 FROM bloqueos
                 WHERE consultorio_id = $1
                   AND fecha_desde <= $3
                   AND fecha_hasta >= $2`,
                [cid, primera, ultima]
            )
        ]);

        const ini = aMinutos(hora);
        const fin = ini + duracion;

        const choques = [];

        ordenadas.forEach(fecha => {

            const otros = turnos.rows.filter(t =>
                t.fecha === fecha &&
                aMinutos(t.hora) < fin &&
                aMinutos(t.hora) + t.duracion_min > ini
            );

            const bloqueo = bloqueos.rows.find(b =>
                b.fecha_desde <= fecha &&
                b.fecha_hasta >= fecha &&
                (b.hora_desde === null || (aMinutos(b.hora_desde) < fin && aMinutos(b.hora_hasta) > ini))
            );

            if (otros.length || bloqueo) {
                choques.push({
                    fecha,
                    motivo: bloqueo ? `Horario bloqueado${bloqueo.motivo ? " (" + bloqueo.motivo + ")" : ""}` : "Ya hay un turno en ese horario"
                });
            }
        });

        if (choques.length && conflictos === undefined) {
            return res.status(409).json({
                mensaje: `${choques.length} de ${ordenadas.length} fechas tienen conflicto`,
                conflictos: choques
            });
        }

        const omitidas = conflictos === "omitir" ? new Set(choques.map(c => c.fecha)) : new Set();
        const aCrear = ordenadas.filter(f => !omitidas.has(f));

        if (aCrear.length === 0) {
            return res.status(400).json({ mensaje: "Todas las fechas tienen conflicto" });
        }

        const descripcion = (req.body.descripcion || "").toString().trim().slice(0, 200) || null;
        const cliente = await pool.connect();

        try {

            await cliente.query("BEGIN");

            const serie = await cliente.query(
                "INSERT INTO series_turnos (consultorio_id, paciente_id, descripcion) VALUES ($1, $2, $3) RETURNING id",
                [cid, paciente_id, descripcion]
            );

            const serieId = serie.rows[0].id;
            const creados = [];

            for (const fecha of aCrear) {

                const r = await cliente.query(
                    `INSERT INTO turnos
                        (paciente_id, fecha, hora, estado, observaciones, consultorio_id, duracion_min, serie_id)
                     VALUES ($1, $2, $3, 'pendiente', $4, $5, $6, $7)
                     RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS fecha`,
                    [paciente_id, fecha, hora, observaciones || null, cid, duracion, serieId]
                );

                creados.push(r.rows[0]);
            }

            await cliente.query("COMMIT");

            res.status(201).json({
                mensaje: "Serie creada",
                serie_id: serieId,
                creados: creados.length,
                omitidos: ordenadas.length - creados.length,
                turnos: creados
            });

        } catch (error) {

            await cliente.query("ROLLBACK");

            throw error;

        } finally {

            cliente.release();
        }

    } catch (error) {

        console.error("Error creando serie de turnos:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});


/* =================================================
   DEL TURNO ELEGIDO EN ADELANTE
   (solo los que siguen pendientes o confirmados)
================================================= */

async function turnoDeLaSerie(req, res) {

    const serieId = Number(req.params.id);
    const turnoId = Number(req.body.turno_id);

    if (!Number.isInteger(serieId) || !Number.isInteger(turnoId)) {
        res.status(400).json({ mensaje: "Datos inválidos" });
        return null;
    }

    const r = await pool.query(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha
         FROM turnos
         WHERE id = $1 AND serie_id = $2 AND consultorio_id = $3`,
        [turnoId, serieId, req.usuario.consultorioId]
    );

    if (r.rows.length === 0) {
        res.status(404).json({ mensaje: "Turno no encontrado en esa serie" });
        return null;
    }

    return { serieId, fecha: r.rows[0].fecha };
}

router.post("/:id/cancelar-siguientes", async (req, res) => {

    try {

        const base = await turnoDeLaSerie(req, res);

        if (!base) return;

        const r = await pool.query(
            `UPDATE turnos
             SET estado = 'cancelado'
             WHERE serie_id = $1
               AND consultorio_id = $2
               AND fecha >= $3
               AND estado IN ('pendiente', 'confirmado')
             RETURNING id`,
            [base.serieId, req.usuario.consultorioId, base.fecha]
        );

        res.json({ mensaje: "Turnos cancelados", cancelados: r.rows.length });

    } catch (error) {

        console.error("Error cancelando serie:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

router.patch("/:id/siguientes", async (req, res) => {

    try {

        const { hora } = req.body;
        const duracion = validarDuracion(req.body.duracion_min);

        if (!HORA.test(hora || "") || duracion === null) {
            return res.status(400).json({ mensaje: "Hora o duración inválida" });
        }

        const base = await turnoDeLaSerie(req, res);

        if (!base) return;

        const r = await pool.query(
            `UPDATE turnos
             SET hora = $1, duracion_min = $2
             WHERE serie_id = $3
               AND consultorio_id = $4
               AND fecha > $5
               AND estado IN ('pendiente', 'confirmado')
             RETURNING id`,
            [hora, duracion, base.serieId, req.usuario.consultorioId, base.fecha]
        );

        res.json({ mensaje: "Turnos actualizados", actualizados: r.rows.length });

    } catch (error) {

        console.error("Error actualizando serie:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

module.exports = router;
