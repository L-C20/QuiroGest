const express = require("express");

const verificarToken = require("../middleware/authMiddleware");
const pool = require("../database/connection");

const router = express.Router();

/* duración en minutos: vacía = 30; válida entre 5 y 480 */
function validarDuracion(valor) {

    if (valor === undefined || valor === null || valor === "") {
        return 30;
    }

    const n = Number(valor);

    return Number.isInteger(n) && n >= 5 && n <= 480 ? n : null;
}

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^\d{2}:\d{2}(:\d{2})?$/;


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

        const duracion = validarDuracion(req.body.duracion_min);

        if (duracion === null) {
            return res.status(400).json({ mensaje: "Duración inválida" });
        }


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
                AND consultorio_id = $2
                AND activo = true
                `,
                [paciente_id, req.usuario.consultorioId]
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
                    observaciones,
                    consultorio_id,
                    duracion_min
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'pendiente',
                    $4,
                    $5,
                    $6
                )
                RETURNING *
                `,
                [
                    paciente_id,
                    fecha,
                    hora,
                    observaciones || null,
                    req.usuario.consultorioId,
                    duracion
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

        const { fecha, desde, hasta, estado, q } = req.query;


        /* BÚSQUEDA AVANZADA: texto, estado y/o rango de fechas */

        if (!fecha && (desde || hasta || estado || q)) {

            const estadosValidos = [
                "pendiente",
                "confirmado",
                "atendido",
                "cancelado"
            ];

            const fechaValida = /^\d{4}-\d{2}-\d{2}$/;

            if (
                (desde && !fechaValida.test(desde)) ||
                (hasta && !fechaValida.test(hasta))
            ) {
                return res.status(400).json({
                    mensaje: "Formato de fecha inválido"
                });
            }

            if (estado && !estadosValidos.includes(estado)) {
                return res.status(400).json({
                    mensaje: "Estado inválido"
                });
            }

            const condiciones = ["t.consultorio_id = $1"];
            const valores = [req.usuario.consultorioId];

            if (desde) {
                valores.push(desde);
                condiciones.push(`t.fecha >= $${valores.length}`);
            }

            if (hasta) {
                valores.push(hasta);
                condiciones.push(`t.fecha <= $${valores.length}`);
            }

            if (estado) {
                valores.push(estado);
                condiciones.push(`t.estado = $${valores.length}`);
            }

            if (q && q.trim()) {
                valores.push(`%${q.trim()}%`);
                const i = valores.length;
                condiciones.push(
                    `(p.nombre ILIKE $${i}
                      OR p.apellido ILIKE $${i}
                      OR (p.apellido || ' ' || p.nombre) ILIKE $${i}
                      OR (p.nombre || ' ' || p.apellido) ILIKE $${i}
                      OR p.dni ILIKE $${i}
                      OR CAST(p.numero_identificacion AS TEXT) ILIKE $${i})`
                );
            }

            const busqueda = await pool.query(
                `
                SELECT
                    t.id,
                    to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
                    to_char(t.hora, 'HH24:MI') AS hora,
                    t.estado,
                    t.observaciones,
                    t.duracion_min,

                    p.id AS paciente_id,
                    p.numero_identificacion,
                    p.nombre,
                    p.apellido,
                    p.dni,

                    EXISTS (
                        SELECT 1
                        FROM pagos pg
                        WHERE pg.turno_id = t.id
                        AND pg.estado = 'pagado'
                    ) AS pago_registrado

                FROM turnos t

                INNER JOIN pacientes p
                    ON p.id = t.paciente_id

                ${condiciones.length ? "WHERE " + condiciones.join(" AND ") : ""}

                ORDER BY t.fecha DESC, t.hora ASC

                LIMIT 300
                `,
                valores
            );

            return res.json({
                turnos: busqueda.rows
            });

        }


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
            t.duracion_min,

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
          AND t.consultorio_id = $2

        ORDER BY t.hora ASC
        `,
        [fecha, req.usuario.consultorioId]
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
                    t.duracion_min,

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
                AND t.consultorio_id = $2
                `,
                [id, req.usuario.consultorioId]
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

        const duracion = validarDuracion(req.body.duracion_min);

        if (duracion === null) {
            return res.status(400).json({ mensaje: "Duración inválida" });
        }


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
                    observaciones = $4,
                    duracion_min = COALESCE($7, duracion_min)

                WHERE id = $5
                AND consultorio_id = $6

                RETURNING *
                `,
                [
                    fecha,
                    hora,
                    estado,
                    observaciones || null,
                    id,
                    req.usuario.consultorioId,
                    req.body.duracion_min === undefined || req.body.duracion_min === "" ? null : duracion
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
                AND consultorio_id = $3

                RETURNING *
                `,
                [
                    estado,
                    id,
                    req.usuario.consultorioId
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

/* =================================================
   MOVER TURNO (arrastrar en la agenda)
================================================= */

router.patch("/:id/mover", verificarToken, async (req, res) => {

    try {

        const { fecha, hora } = req.body;

        if (!FORMATO_FECHA.test(fecha || "") || !FORMATO_HORA.test(hora || "")) {
            return res.status(400).json({ mensaje: "Fecha u hora inválida" });
        }

        const resultado = await pool.query(
            `
            UPDATE turnos
            SET fecha = $1, hora = $2
            WHERE id = $3
            AND consultorio_id = $4
            RETURNING id, fecha, hora, estado, duracion_min
            `,
            [fecha, hora, req.params.id, req.usuario.consultorioId]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ mensaje: "Turno no encontrado" });
        }

        res.json({ mensaje: "Turno movido", turno: resultado.rows[0] });

    } catch (error) {

        console.error("Error moviendo turno:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});

module.exports = router;