const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../database/connection");
const verificarToken = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                mensaje: "Email y contraseña son obligatorios"
            });
        }

        const resultado = await pool.query(
            `
            SELECT
                u.id,
                u.email,
                u.nombre,
                u.password_hash,
                u.rol,
                u.activo,
                u.consultorio_id,
                c.nombre AS consultorio_nombre,
                c.activo AS consultorio_activo
            FROM usuarios u
            LEFT JOIN consultorios c ON c.id = u.consultorio_id
            WHERE LOWER(u.email) = LOWER($1)
            `,
            [String(email).trim()]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                mensaje: "Credenciales incorrectas"
            });
        }

        const usuario = resultado.rows[0];

        const passwordCorrecta = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                mensaje: "Credenciales incorrectas"
            });
        }

        // los estados se informan recién con la contraseña correcta

        if (!usuario.activo) {
            return res.status(403).json({
                mensaje: "Tu usuario está desactivado. Consultá con el administrador."
            });
        }

        if (usuario.rol !== "superadmin" && !usuario.consultorio_activo) {
            return res.status(403).json({
                mensaje: "La cuenta del consultorio está suspendida. Contactá a tu proveedor."
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol,
                consultorioId: usuario.consultorio_id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.json({
            mensaje: "Login correcto",
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol
            },
            consultorio: {
                id: usuario.consultorio_id,
                nombre: usuario.consultorio_nombre
            }
        });

    } catch (error) {

        console.error("Error en login:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
});


/* Datos de la sesión actual (para mostrar nombre, rol y consultorio) */

router.get("/me", verificarToken, async (req, res) => {

    try {

        const resultado = await pool.query(
            `
            SELECT
                u.id,
                u.email,
                u.nombre,
                u.rol,
                c.id AS consultorio_id,
                c.nombre AS consultorio_nombre,
                c.logo AS consultorio_logo
            FROM usuarios u
            INNER JOIN consultorios c ON c.id = $2
            WHERE u.id = $1
            `,
            [req.usuario.id, req.usuario.consultorioId]
        );

        const fila = resultado.rows[0];

        if (!fila) {
            return res.status(401).json({
                mensaje: "Sesión inválida"
            });
        }

        res.json({
            usuario: {
                id: fila.id,
                email: fila.email,
                nombre: fila.nombre,
                rol: fila.rol
            },
            consultorio: {
                id: fila.consultorio_id,
                nombre: fila.consultorio_nombre,
                logo: fila.consultorio_logo
            }
        });

    } catch (error) {

        console.error("Error en /auth/me:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
});

module.exports = router;
