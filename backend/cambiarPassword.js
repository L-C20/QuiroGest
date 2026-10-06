/*
 * Cambia la contraseña de un usuario.
 *
 * Uso (la contraseña NO se escribe en el código ni queda en git):
 *   USER_EMAIL=alguien@correo.com NEW_PASSWORD='la-nueva-clave' node cambiarPassword.js
 */

require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./src/database/connection");

async function cambiarPassword() {

    const email = process.env.USER_EMAIL;
    const nuevaPassword = process.env.NEW_PASSWORD;

    if (!email || !nuevaPassword) {
        console.error("Faltan USER_EMAIL y/o NEW_PASSWORD.");
        process.exitCode = 1;
        return;
    }

    if (nuevaPassword.length < 10) {
        console.error("La contraseña debe tener al menos 10 caracteres.");
        process.exitCode = 1;
        return;
    }

    try {

        const hash = await bcrypt.hash(nuevaPassword, 12);

        const resultado = await pool.query(
            `
            UPDATE usuarios
            SET password_hash = $1
            WHERE LOWER(email) = LOWER($2)
            RETURNING id, email
            `,
            [hash, email]
        );

        if (resultado.rows.length === 0) {

            console.log("No se encontró el usuario.");

        } else {

            console.log("Contraseña actualizada correctamente.");
            console.log(resultado.rows[0]);

        }

    } catch (error) {

        console.error("Error cambiando contraseña:", error.message);
        process.exitCode = 1;

    } finally {

        await pool.end();

    }
}

cambiarPassword();
