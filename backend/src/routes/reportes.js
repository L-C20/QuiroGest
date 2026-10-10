const express = require("express");

const pool = require("../database/connection");

const router = express.Router();

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;
const DIAS_INACTIVIDAD = 60;

function fechaValida(valor) {

    if (typeof valor !== "string" || !FECHA.test(valor)) {
        return false;
    }

    const d = new Date(valor + "T00:00:00Z");

    return !isNaN(d) && d.toISOString().slice(0, 10) === valor;
}

function sumarDias(fecha, n) {

    const d = new Date(fecha + "T00:00:00Z");

    d.setUTCDate(d.getUTCDate() + n);

    return d.toISOString().slice(0, 10);
}

/* Todo el cálculo vive acá: el consultorio sale siempre del token. */

async function resumenDe(cid, desde, hasta) {

    const [turnos, ingresos, nuevos] = await Promise.all([

        pool.query(
            `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE estado = 'atendido')::int AS atendidos,
                COUNT(*) FILTER (WHERE estado = 'cancelado')::int AS cancelados,
                COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
                COUNT(*) FILTER (WHERE estado = 'confirmado')::int AS confirmados,
                COUNT(DISTINCT paciente_id)::int AS pacientes
            FROM turnos
            WHERE consultorio_id = $1 AND fecha BETWEEN $2 AND $3
            `,
            [cid, desde, hasta]
        ),

        pool.query(
            `
            SELECT
                COALESCE(SUM(monto), 0)::float AS total,
                COUNT(*)::int AS cantidad
            FROM pagos
            WHERE consultorio_id = $1
              AND estado = 'pagado'
              AND fecha_pago::date BETWEEN $2 AND $3
            `,
            [cid, desde, hasta]
        ),

        pool.query(
            `
            SELECT COUNT(*)::int AS n
            FROM pacientes
            WHERE consultorio_id = $1 AND created_at::date BETWEEN $2 AND $3
            `,
            [cid, desde, hasta]
        )
    ]);

    const t = turnos.rows[0];
    const i = ingresos.rows[0];

    return {
        turnos: t.total,
        atendidos: t.atendidos,
        cancelados: t.cancelados,
        pendientes: t.pendientes,
        confirmados: t.confirmados,
        pacientes_atendidos: t.pacientes,
        pacientes_nuevos: nuevos.rows[0].n,
        ingresos: i.total,
        pagos: i.cantidad,
        ticket_promedio: i.cantidad ? i.total / i.cantidad : 0,
        tasa_cancelacion: t.total ? t.cancelados / t.total : 0
    };
}

router.get("/", async (req, res) => {

    try {

        const { desde, hasta } = req.query;

        if (!fechaValida(desde) || !fechaValida(hasta) || hasta < desde) {
            return res.status(400).json({ mensaje: "Rango de fechas inválido" });
        }

        const cantidad = (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1;

        if (cantidad > MAX_DIAS) {
            return res.status(400).json({ mensaje: `El rango máximo es de ${MAX_DIAS} días` });
        }

        const cid = req.usuario.consultorioId;

        /* período anterior de igual duración, para comparar */
        const anteriorHasta = sumarDias(desde, -1);
        const anteriorDesde = sumarDias(desde, -cantidad);

        const [actual, anterior, porDia, ingresosDia, porMetodo, porHora, porSemana, inactivos, activos] =
            await Promise.all([

                resumenDe(cid, desde, hasta),
                resumenDe(cid, anteriorDesde, anteriorHasta),

                pool.query(
                    `
                    SELECT
                        to_char(fecha, 'YYYY-MM-DD') AS fecha,
                        COUNT(*)::int AS turnos,
                        COUNT(*) FILTER (WHERE estado = 'atendido')::int AS atendidos,
                        COUNT(*) FILTER (WHERE estado = 'cancelado')::int AS cancelados
                    FROM turnos
                    WHERE consultorio_id = $1 AND fecha BETWEEN $2 AND $3
                    GROUP BY fecha
                    ORDER BY fecha
                    `,
                    [cid, desde, hasta]
                ),

                pool.query(
                    `
                    SELECT
                        to_char(fecha_pago::date, 'YYYY-MM-DD') AS fecha,
                        SUM(monto)::float AS total
                    FROM pagos
                    WHERE consultorio_id = $1 AND estado = 'pagado'
                      AND fecha_pago::date BETWEEN $2 AND $3
                    GROUP BY fecha_pago::date
                    ORDER BY 1
                    `,
                    [cid, desde, hasta]
                ),

                pool.query(
                    `
                    SELECT
                        COALESCE(NULLIF(TRIM(metodo_pago), ''), 'Sin especificar') AS metodo,
                        SUM(monto)::float AS total,
                        COUNT(*)::int AS cantidad
                    FROM pagos
                    WHERE consultorio_id = $1 AND estado = 'pagado'
                      AND fecha_pago::date BETWEEN $2 AND $3
                    GROUP BY 1
                    ORDER BY total DESC
                    `,
                    [cid, desde, hasta]
                ),

                pool.query(
                    `
                    SELECT EXTRACT(HOUR FROM hora)::int AS hora, COUNT(*)::int AS turnos
                    FROM turnos
                    WHERE consultorio_id = $1 AND fecha BETWEEN $2 AND $3
                      AND estado <> 'cancelado'
                    GROUP BY 1
                    ORDER BY 1
                    `,
                    [cid, desde, hasta]
                ),

                /* 0 = lunes … 6 = domingo */
                pool.query(
                    `
                    SELECT ((EXTRACT(DOW FROM fecha)::int + 6) % 7) AS dia, COUNT(*)::int AS turnos
                    FROM turnos
                    WHERE consultorio_id = $1 AND fecha BETWEEN $2 AND $3
                      AND estado <> 'cancelado'
                    GROUP BY 1
                    ORDER BY 1
                    `,
                    [cid, desde, hasta]
                ),

                /* pacientes que vinieron alguna vez, no tienen turno futuro y hace tiempo que no vienen */
                pool.query(
                    `
                    SELECT
                        p.id,
                        p.nombre,
                        p.apellido,
                        to_char(MAX(t.fecha), 'YYYY-MM-DD') AS ultimo_turno,
                        (CURRENT_DATE - MAX(t.fecha))::int AS dias
                    FROM pacientes p
                    INNER JOIN turnos t
                        ON t.paciente_id = p.id AND t.consultorio_id = p.consultorio_id
                    WHERE p.consultorio_id = $1
                      AND p.activo = true
                      AND t.estado <> 'cancelado'
                    GROUP BY p.id, p.nombre, p.apellido
                    HAVING MAX(t.fecha) < CURRENT_DATE - $2::int
                    ORDER BY MAX(t.fecha) DESC
                    LIMIT 15
                    `,
                    [cid, DIAS_INACTIVIDAD]
                ),

                pool.query(
                    "SELECT COUNT(*)::int AS n FROM pacientes WHERE consultorio_id = $1 AND activo = true",
                    [cid]
                )
            ]);

        res.json({
            rango: { desde, hasta, dias: cantidad },
            anterior: { desde: anteriorDesde, hasta: anteriorHasta },
            actual,
            previo: anterior,
            pacientes_activos: activos.rows[0].n,
            por_dia: porDia.rows,
            ingresos_por_dia: ingresosDia.rows,
            por_metodo: porMetodo.rows,
            por_hora: porHora.rows,
            por_dia_semana: porSemana.rows,
            inactivos: { dias: DIAS_INACTIVIDAD, pacientes: inactivos.rows }
        });

    } catch (error) {

        console.error("Error generando reportes:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

module.exports = router;
