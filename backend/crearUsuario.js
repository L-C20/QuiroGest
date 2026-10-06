/*
 * Crea un usuario.
 *
 * Uso:
 *   ADMIN_EMAIL=a@b.com ADMIN_PASSWORD='clave-larga' [ROL=administrador] [CONSULTORIO_ID=1] node crearUsuario.js
 *
 * ROL: superadmin | administrador | usuario   (por defecto: administrador)
 * CONSULTORIO_ID: por defecto el primer consultorio.
 */

require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./src/database/connection");

async function crearUsuario() {
    try {
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;
        const rol = process.env.ROL || "administrador";

        if (!email || !password) {
            throw new Error("Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD.");
        }

        if (password.length < 10) {
            throw new Error("La contraseña debe tener al menos 10 caracteres.");
        }

        if (!["superadmin", "administrador", "usuario"].includes(rol)) {
            throw new Error("ROL inválido.");
        }

        const consultorioId =
            process.env.CONSULTORIO_ID ||
            (await pool.query("SELECT MIN(id) AS id FROM consultorios")).rows[0].id;

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            `
            INSERT INTO usuarios (email, password_hash, rol, consultorio_id)
            VALUES ($1, $2, $3, $4)
            `,
            [email, passwordHash, rol, consultorioId]
        );

        console.log(`Usuario creado correctamente (${rol}, consultorio ${consultorioId}).`);

    } catch (error) {

        console.error("Error creando usuario:", error.message);
        process.exitCode = 1;

    } finally {

        await pool.end();

    }
}

crearUsuario();
