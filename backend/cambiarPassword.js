require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./src/database/connection");

async function cambiarPassword() {

    const email = "lucaslobianco78@gmail.com";
    const nuevaPassword = "Lucas2026!";

    try {

        const hash = await bcrypt.hash(nuevaPassword, 10);

        const resultado = await pool.query(
            `
            UPDATE usuarios
            SET password_hash = $1
            WHERE email = $2
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

        console.error("Error cambiando contraseña:", error);

    } finally {

        await pool.end();

    }
}

cambiarPassword();