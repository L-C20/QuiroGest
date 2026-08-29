const express = require("express");

const verificarToken = require("../middleware/authMiddleware");
const pool = require("../database/connection");

const router = express.Router();


/* =================================================
   CREAR TURNO
================================================= */

router.post("/", verificarToken, async (req, res) => {

    try {

        const {
            paciente_id,
            fecha,
            hora,
            observaciones
        } = req.body;


        /* ==========================================
           VALIDAR CAMPOS OBLIGATORIOS
        ========================================== */

        if (
            !paciente_id ||
            !fecha ||
            !hora
        ) {

            return res.status(400).json({

                mensaje:
                    "Paciente, fecha y hora son obligatorios"

            });

        }


        /* ==========================================
           VERIFICAR PACIENTE
        ========================================== */

        const paciente =
            await pool.query(
                `
                SELECT id
                FROM pacientes
                WHERE id = $1
                AND activo = true
                `,
                [paciente_id]
            );


        if (paciente.rows.length === 0) {

            return res.status(404).json({

                mensaje:
                    "Paciente no encontrado o inactivo"

            });

        }


        /* ==========================================
           CREAR TURNO
        ========================================== */

        const resultado =
            await pool.query(
                `
                INSERT INTO turnos
                (
                    paciente_id,
                    fecha,
                    hora,
                    estado,
                    observaciones
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'pendiente',
                    $4
                )
                RETURNING *
                `,
                [
                    paciente_id,
                    fecha,
                    hora,
                    observaciones || null
                ]
            );


        res.status(201).json({

            mensaje:
                "Turno creado correctamente",

            turno:
                resultado.rows[0]

        });


    } catch (error) {

        console.error(
            "Error creando turno:",
            error
        );

        res.status(500).json({

            mensaje:
                "Error interno del servidor"

        });

    }

});


/* =================================================
   OBTENER TURNOS POR FECHA
================================================= */

router.get("/", verificarToken, async (req, res) => {

    try {

        const { fecha } = req.query;


        if (!fecha) {

            return res.status(400).json({

                mensaje:
                    "La fecha es obligatoria"

            });

        }


        const resultado =
    await pool.query(
        `
        SELECT
            t.id,
            t.fecha,
            t.hora,
            t.estado,
            t.observaciones,

            p.id AS paciente_id,
            p.numero_identificacion,
            p.nombre,
            p.apellido,
            p.dni,

            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM pagos pg
                    WHERE pg.turno_id = t.id
                    AND pg.estado = 'pagado'
                )
                THEN true
                ELSE false
            END AS pago_registrado

        FROM turnos t

        INNER JOIN pacientes p
            ON p.id = t.paciente_id

        WHERE t.fecha = $1

        ORDER BY t.hora ASC
        `,
        [fecha]
    );

    console.log(
    "TURNOS DESDE POSTGRES:",
    resultado.rows
);

        res.json({

            turnos:
                resultado.rows

        });


    } catch (error) {

        console.error(
            "Error obteniendo turnos:",
            error
        );

        res.status(500).json({

            mensaje:
                "Error interno del servidor"

        });

    }

});


/* =================================================
   OBTENER TURNO POR ID
================================================= */

router.get("/:id", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;


        const resultado =
            await pool.query(
                `
                SELECT
                    t.id,
                    t.fecha,
                    t.hora,
                    t.estado,
                    t.observaciones,

                    p.id AS paciente_id,
                    p.numero_identificacion,
                    p.nombre,
                    p.apellido,
                    p.dni,
                    p.telefono,
                    p.email

                FROM turnos t

                INNER JOIN pacientes p
                    ON p.id = t.paciente_id

                WHERE t.id = $1
                `,
                [id]
            );


        if (resultado.rows.length === 0) {

            return res.status(404).json({

                mensaje:
                    "Turno no encontrado"

            });

        }


        res.json({

            turno:
                resultado.rows[0]

        });


    } catch (error) {

        console.error(
            "Error obteniendo turno:",
            error
        );

        res.status(500).json({

            mensaje:
                "Error interno del servidor"

        });

    }

});


/* =================================================
   EDITAR TURNO
================================================= */

router.put("/:id", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;

        const {
            fecha,
            hora,
            estado,
            observaciones
        } = req.body;


        /* ==========================================
           VALIDAR CAMPOS
        ========================================== */

        if (
            !fecha ||
            !hora ||
            !estado
        ) {

            return res.status(400).json({

                mensaje:
                    "Fecha, hora y estado son obligatorios"

            });

        }


        /* ==========================================
           ESTADOS PERMITIDOS
        ========================================== */

        const estadosPermitidos = [
            "pendiente",
            "confirmado",
            "atendido",
            "cancelado"
        ];


        if (
            !estadosPermitidos.includes(estado)
        ) {

            return res.status(400).json({

                mensaje:
                    "Estado de turno no válido"

            });

        }


        /* ==========================================
           ACTUALIZAR TURNO
        ========================================== */

        const resultado =
            await pool.query(
                `
                UPDATE turnos

                SET
                    fecha = $1,
                    hora = $2,
                    estado = $3,
                    observaciones = $4

                WHERE id = $5

                RETURNING *
                `,
                [
                    fecha,
                    hora,
                    estado,
                    observaciones || null,
                    id
                ]
            );


        /* ==========================================
           TURNO NO ENCONTRADO
        ========================================== */

        if (
            resultado.rows.length === 0
        ) {

            return res.status(404).json({

                mensaje:
                    "Turno no encontrado"

            });

        }


        /* ==========================================
           RESPUESTA
        ========================================== */

        res.json({

            mensaje:
                "Turno actualizado correctamente",

            turno:
                resultado.rows[0]

        });


    } catch (error) {

        console.error(
            "Error actualizando turno:",
            error
        );

        res.status(500).json({

            mensaje:
                "Error interno del servidor"

        });

    }

});

/* =================================================
   CAMBIAR ESTADO DEL TURNO
================================================= */

router.patch("/:id/estado", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;

        const { estado } = req.body;


        /* ==========================================
           VALIDAR ESTADO
        ========================================== */

        const estadosPermitidos = [
            "pendiente",
            "confirmado",
            "atendido",
            "cancelado"
        ];


        if (!estado) {

            return res.status(400).json({

                mensaje:
                    "El estado es obligatorio"

            });

        }


        if (!estadosPermitidos.includes(estado)) {

            return res.status(400).json({

                mensaje:
                    "Estado de turno no válido"

            });

        }


        /* ==========================================
           ACTUALIZAR ESTADO
        ========================================== */

        const resultado =
            await pool.query(
                `
                UPDATE turnos

                SET
                    estado = $1

                WHERE id = $2

                RETURNING *
                `,
                [
                    estado,
                    id
                ]
            );


        /* ==========================================
           TURNO NO ENCONTRADO
        ========================================== */

        if (resultado.rows.length === 0) {

            return res.status(404).json({

                mensaje:
                    "Turno no encontrado"

            });

        }


        /* ==========================================
           RESPUESTA
        ========================================== */

        res.json({

            mensaje:
                "Estado actualizado correctamente",

            turno:
                resultado.rows[0]

        });


    } catch (error) {

        console.error(
            "Error cambiando estado del turno:",
            error
        );

        res.status(500).json({

            mensaje:
                "Error interno del servidor"

        });

    }

});

module.exports = router;