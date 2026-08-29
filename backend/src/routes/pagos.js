const express = require("express");
const router = express.Router();

const pool = require("../database/connection");


/* =====================================================
   REGISTRAR PAGO
===================================================== */

router.post("/", async (req, res) => {

    try {

        const {
            turno_id,
            monto,
            metodo_pago,
            observaciones
        } = req.body;


        /* =============================================
           VALIDAR DATOS
        ============================================= */

        if (!turno_id || !monto || !metodo_pago) {

            return res.status(400).json({
                mensaje: "Faltan datos obligatorios."
            });

        }


        /* =============================================
           REGISTRAR PAGO
        ============================================= */

        const resultado = await pool.query(
            `
            INSERT INTO pagos
            (
                turno_id,
                monto,
                metodo_pago,
                estado,
                fecha_pago,
                observaciones
            )
            VALUES
            (
                $1,
                $2,
                $3,
                'pagado',
                CURRENT_TIMESTAMP,
                $4
            )
            RETURNING *
            `,
            [
                turno_id,
                monto,
                metodo_pago,
                observaciones || null
            ]
        );


        /* =============================================
           RESPUESTA
        ============================================= */

        res.status(201).json({

            mensaje:
                "Pago registrado correctamente.",

            pago:
                resultado.rows[0]

        });


    } catch (error) {

        console.error(
            "Error registrando pago:",
            error
        );


        res.status(500).json({

            mensaje:
                "Error al registrar el pago."

        });

    }

});

/* =====================================================
   OBTENER TODOS LOS PAGOS
===================================================== */

router.get("/", async (req, res) => {

    try {

        const resultado =
            await pool.query(
                `
                SELECT

                    pg.id,
                    pg.turno_id,
                    pg.monto,
                    pg.metodo_pago,
                    pg.estado,
                    pg.fecha_pago,
                    pg.observaciones,

                    t.fecha AS fecha_turno,
                    t.hora AS hora_turno,

                    p.nombre,
                    p.apellido,
                    p.numero_identificacion

                FROM pagos pg

                INNER JOIN turnos t
                    ON t.id = pg.turno_id

                INNER JOIN pacientes p
                    ON p.id = t.paciente_id

                ORDER BY
                    pg.fecha_pago DESC
                `
            );


        res.json({

            pagos:
                resultado.rows

        });


    } catch (error) {

        console.error(
            "Error obteniendo pagos:",
            error
        );


        res.status(500).json({

            mensaje:
                "Error al obtener los pagos."

        });

    }

});

/* =====================================================
   OBTENER PAGO DE UN TURNO
===================================================== */

router.get("/turno/:turno_id", async (req, res) => {

    try {

        const { turno_id } = req.params;


        const resultado =
            await pool.query(
                `
                SELECT
                    pg.id,
                    pg.turno_id,
                    pg.monto,
                    pg.metodo_pago,
                    pg.estado,
                    pg.fecha_pago,
                    pg.observaciones,

                    p.nombre,
                    p.apellido,
                    p.numero_identificacion

                FROM pagos pg

                INNER JOIN turnos t
                    ON t.id = pg.turno_id

                INNER JOIN pacientes p
                    ON p.id = t.paciente_id

                WHERE pg.turno_id = $1
                AND pg.estado = 'pagado'

                ORDER BY pg.fecha_pago DESC

                LIMIT 1
                `,
                [turno_id]
            );


        if (resultado.rows.length === 0) {

            return res.status(404).json({

                mensaje:
                    "No se encontró un pago registrado para este turno."

            });

        }


        res.json({

            pago:
                resultado.rows[0]

        });


    } catch (error) {

        console.error(
            "Error obteniendo pago:",
            error
        );


        res.status(500).json({

            mensaje:
                "Error al obtener el pago."

        });

    }

});

/* =====================================================
   HISTORIAL DE PAGOS DE UN PACIENTE
===================================================== */

router.get("/paciente/:paciente_id", async (req, res) => {

    try {

        const { paciente_id } = req.params;


        /* =============================================
           OBTENER PAGOS
        ============================================= */

        const resultado =
            await pool.query(
                `
                SELECT

                    pg.id,
                    pg.turno_id,
                    pg.monto,
                    pg.metodo_pago,
                    pg.estado,
                    pg.fecha_pago,
                    pg.observaciones,

                    t.fecha AS fecha_turno,
                    t.hora AS hora_turno

                FROM pagos pg

                INNER JOIN turnos t
                    ON t.id = pg.turno_id

                WHERE t.paciente_id = $1

                ORDER BY
                    pg.fecha_pago DESC
                `,
                [paciente_id]
            );


        /* =============================================
           RESPUESTA
        ============================================= */

        res.json({

            pagos:
                resultado.rows

        });


    } catch (error) {

        console.error(
            "Error obteniendo historial de pagos:",
            error
        );


        res.status(500).json({

            mensaje:
                "Error al obtener el historial de pagos."

        });

    }

});
console.log("RUTAS DE PAGOS CARGADAS");

module.exports = router;