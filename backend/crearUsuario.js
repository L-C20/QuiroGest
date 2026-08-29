require("dotenv").config();

const bcrypt = require("bcrypt");
const pool = require("./src/database/connection");

async function crearUsuario() {
    try {
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        const passwordHash = await bcrypt.hash(password, 12);

        await pool.query(
            `
            INSERT INTO usuarios (email, password_hash)
            VALUES ($1, $2)
            `,
            [email, passwordHash]
        );

        console.log("Usuario creado correctamente");

    } catch (error) {

        console.error("Error creando usuario:", error.message);

    } finally {

        await pool.end();

    }
}

crearUsuario();