const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../database/connection");

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
            SELECT id, email, password_hash
            FROM usuarios
            WHERE email = $1
            `,
            [email]
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

        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        res.json({
            mensaje: "Login correcto",
            token
        });

    } catch (error) {

        console.error("Error en login:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
});

module.exports = router;