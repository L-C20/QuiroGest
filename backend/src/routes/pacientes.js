const express = require("express");

const verificarToken = require("../middleware/authMiddleware");
const pool = require("../database/connection");

const router = express.Router();

// Obtener todos los pacientes
router.get("/", verificarToken, async (req, res) => {

    try {

        const resultado = await pool.query(
            `
            SELECT
                id,
                numero_identificacion,
                nombre,
                apellido,
                dni,
                telefono,
                email,
                created_at,
                activo
            FROM pacientes
            WHERE consultorio_id = $1
            ORDER BY apellido ASC, nombre ASC
            `,
            [req.usuario.consultorioId]
        );

        res.json({
            pacientes: resultado.rows
        });

    } catch (error) {

        console.error("Error obteniendo pacientes:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });

    }

});
// Obtener un paciente por ID
router.get("/:id", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;

        const resultado = await pool.query(
            `
            SELECT
                id,
                numero_identificacion,
                nombre,
                apellido,
                dni,
                telefono,
                email,
                activo,
                created_at
            FROM pacientes
            WHERE id = $1
              AND consultorio_id = $2
            `,
            [id, req.usuario.consultorioId]
        );

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: "Paciente no encontrado"
            });

        }

        res.json({
            paciente: resultado.rows[0]
        });

    } catch (error) {

        console.error("Error obteniendo paciente:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });

    }

});
// Editar paciente
router.put("/:id", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;

        const {
            numero_identificacion,
            nombre,
            apellido,
            dni,
            telefono,
            email
        } = req.body;


        // Validar campos obligatorios

        if (!numero_identificacion || !nombre || !apellido) {

            return res.status(400).json({
                mensaje: "Número de identificación, nombre y apellido son obligatorios"
            });

        }


        // Actualizar paciente

        const resultado = await pool.query(
            `
            UPDATE pacientes
            SET
                numero_identificacion = $1,
                nombre = $2,
                apellido = $3,
                dni = $4,
                telefono = $5,
                email = $6
            WHERE id = $7
              AND consultorio_id = $8
            RETURNING *
            `,
            [
                numero_identificacion,
                nombre,
                apellido,
                dni || null,
                telefono || null,
                email || null,
                id,
                req.usuario.consultorioId
            ]
        );


        // Paciente inexistente

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: "Paciente no encontrado"
            });

        }


        res.json({
            mensaje: "Paciente actualizado correctamente",
            paciente: resultado.rows[0]
        });


    } catch (error) {

        console.error("Error actualizando paciente:", error);

        if (error.code === "23505") {

            return res.status(409).json({
                mensaje:
                    "Ya existe otro paciente con ese DNI o número de identificación."
            });

        }

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });

    }

});

// Crear paciente
router.post("/", verificarToken, async (req, res) => {

    try {

        const {
            numero_identificacion,
            nombre,
            apellido,
            dni,
            telefono,
            email
        } = req.body;


        // Validar campos obligatorios

        if (!numero_identificacion || !nombre || !apellido) {

            return res.status(400).json({
                mensaje: "Número de identificación, nombre y apellido son obligatorios"
            });

        }


        // Crear paciente

        const resultado = await pool.query(
            `
            INSERT INTO pacientes
            (
                numero_identificacion,
                nombre,
                apellido,
                dni,
                telefono,
                email,
                consultorio_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                numero_identificacion,
                nombre,
                apellido,
                dni || null,
                telefono || null,
                email || null,
                req.usuario.consultorioId
            ]
        );


        res.status(201).json({
            mensaje: "Paciente creado correctamente",
            paciente: resultado.rows[0]
        });


   } catch (error) {

    console.error("Error creando paciente:", error);


    /* =============================================
       DNI DUPLICADO
    ============================================= */

    if (
        error.code === "23505" &&
        error.constraint === "pacientes_consultorio_dni_key"
    ) {

        return res.status(409).json({
            mensaje:
                "Ya existe un paciente registrado con ese DNI."
        });

    }

    if (
        error.code === "23505" &&
        error.constraint === "pacientes_consultorio_numero_key"
    ) {

        return res.status(409).json({
            mensaje:
                "Ya existe un paciente con ese número de identificación."
        });

    }


    /* =============================================
       OTRO ERROR
    ============================================= */

    res.status(500).json({
        mensaje:
            "Error interno del servidor"
    });

}

});

// Dar de baja un paciente
router.delete("/:id", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;


        const resultado = await pool.query(
            `
            UPDATE pacientes
            SET activo = false
            WHERE id = $1
              AND consultorio_id = $2
            RETURNING *
            `,
            [id, req.usuario.consultorioId]
        );


        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: "Paciente no encontrado"
            });

        }


        res.json({
            mensaje: "Paciente dado de baja correctamente",
            paciente: resultado.rows[0]
        });


    } catch (error) {

        console.error("Error dando de baja al paciente:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });

    }

});

// Reactivar paciente
router.patch("/:id/reactivar", verificarToken, async (req, res) => {

    try {

        const { id } = req.params;

        const resultado = await pool.query(
            `
            UPDATE pacientes
            SET activo = true
            WHERE id = $1
              AND consultorio_id = $2
            RETURNING *
            `,
            [id, req.usuario.consultorioId]
        );

        if (resultado.rows.length === 0) {

            return res.status(404).json({
                mensaje: "Paciente no encontrado"
            });

        }

        res.json({
            mensaje: "Paciente reactivado correctamente",
            paciente: resultado.rows[0]
        });

    } catch (error) {

        console.error("Error reactivando paciente:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });

    }

});

module.exports = router;