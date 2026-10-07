/* =====================================================
   GESTIONTEC MEDICAL — Panel del proveedor (solo super admin)

     GET   /superadmin/consultorios            lista con totales (sin datos de pacientes)
     POST  /superadmin/consultorios            crea consultorio + su primer administrador
     PUT   /superadmin/consultorios/:id        renombra
     PATCH /superadmin/consultorios/:id/estado suspende / reactiva
     POST  /superadmin/consultorios/:id/entrar token de soporte (queda auditado)
     GET   /superadmin/actividad               últimas acciones registradas
===================================================== */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../database/connection");
const verificarToken = require("../middleware/authMiddleware");
const { requerirRol, invalidarCache } = require("../middleware/authMiddleware");
const { emailValido } = require("../services/recordatorios/utils");

const router = express.Router();

router.use(verificarToken, requerirRol("superadmin"));

const LARGO_MIN_PASSWORD = 10;
const LARGO_MAX_PASSWORD = 100;


function limpiar(valor, max) {

    if (valor === undefined || valor === null) {
        return null;
    }

    const texto = String(valor).trim();

    if (texto.length > max) {
        const error = new Error(`El texto supera los ${max} caracteres.`);
        error.usuario = true;
        throw error;
    }

    return texto || null;
}

function fallo(res, error, contexto) {

    if (error.usuario) {
        return res.status(400).json({ mensaje: error.message });
    }

    console.error(`Error en panel de proveedor (${contexto}):`, error);

    return res.status(500).json({ mensaje: "Error interno del servidor" });
}

async function registrar(usuarioId, consultorioId, accion, detalle = null) {

    try {

        await pool.query(
            `
            INSERT INTO auditoria (usuario_id, consultorio_id, accion, detalle)
            VALUES ($1, $2, $3, $4)
            `,
            [usuarioId, consultorioId, accion, detalle]
        );

    } catch (error) {

        console.error("No se pudo registrar la auditoría:", error.message);
    }
}

function idValido(valor) {

    const id = Number(valor);

    return Number.isInteger(id) && id > 0 ? id : null;
}


/* =====================================================
   LISTA
===================================================== */

router.get("/consultorios", async (req, res) => {

    try {

        const { rows } = await pool.query(
            `
            SELECT
                c.id,
                c.nombre,
                c.activo,
                c.creado_en,
                (
                    SELECT u.email
                    FROM usuarios u
                    WHERE u.consultorio_id = c.id AND u.rol = 'administrador'
                    ORDER BY u.id
                    LIMIT 1
                ) AS administrador,
                (
                    SELECT COUNT(*)::int FROM usuarios u
                    WHERE u.consultorio_id = c.id AND u.activo AND u.rol <> 'superadmin'
                ) AS usuarios,
                (
                    SELECT COUNT(*)::int FROM pacientes p
                    WHERE p.consultorio_id = c.id AND p.activo
                ) AS pacientes,
                (
                    SELECT COUNT(*)::int FROM turnos t
                    WHERE t.consultorio_id = c.id
                ) AS turnos,
                (
                    SELECT MAX(t.created_at) FROM turnos t
                    WHERE t.consultorio_id = c.id
                ) AS ultimo_turno
            FROM consultorios c
            ORDER BY c.activo DESC, c.nombre
            `
        );

        res.json({
            consultorios: rows,
            miConsultorio: req.usuario.consultorioId
        });

    } catch (error) {

        fallo(res, error, "listar");
    }
});


/* =====================================================
   ALTA
===================================================== */

router.post("/consultorios", async (req, res) => {

    const client = await pool.connect();

    try {

        const nombre = limpiar(req.body.nombre, 150);
        const email = limpiar(req.body.email, 150);
        const nombreAdmin = limpiar(req.body.nombreAdmin, 150);
        const password = req.body.password;

        if (!nombre) {
            return res.status(400).json({ mensaje: "El nombre del consultorio es obligatorio." });
        }

        if (!email || !emailValido(email)) {
            return res.status(400).json({ mensaje: "Ingresá un correo válido para el administrador." });
        }

        if (typeof password !== "string" || password.length < LARGO_MIN_PASSWORD) {
            return res.status(400).json({
                mensaje: `La contraseña debe tener al menos ${LARGO_MIN_PASSWORD} caracteres.`
            });
        }

        if (password.length > LARGO_MAX_PASSWORD) {
            return res.status(400).json({ mensaje: "La contraseña es demasiado larga." });
        }

        const hash = await bcrypt.hash(password, 12);

        await client.query("BEGIN");

        const { rows: [consultorio] } = await client.query(
            "INSERT INTO consultorios (nombre) VALUES ($1) RETURNING id, nombre, activo, creado_en",
            [nombre]
        );

        await client.query(
            `
            INSERT INTO usuarios (email, nombre, password_hash, rol, consultorio_id)
            VALUES ($1, $2, $3, 'administrador', $4)
            `,
            [email, nombreAdmin, hash, consultorio.id]
        );

        await client.query("COMMIT");

        await registrar(req.usuario.id, consultorio.id, "crear_consultorio", nombre);

        res.status(201).json({
            mensaje: "Consultorio creado correctamente.",
            consultorio
        });

    } catch (error) {

        await client.query("ROLLBACK").catch(() => {});

        if (error.code === "23505") {
            return res.status(409).json({
                mensaje: "Ya existe un usuario con ese correo."
            });
        }

        fallo(res, error, "crear");

    } finally {

        client.release();
    }
});


/* =====================================================
   RENOMBRAR
===================================================== */

router.put("/consultorios/:id", async (req, res) => {

    try {

        const id = idValido(req.params.id);

        const nombre = limpiar(req.body.nombre, 150);

        if (!id || !nombre) {
            return res.status(400).json({ mensaje: "Datos inválidos." });
        }

        const { rows } = await pool.query(
            "UPDATE consultorios SET nombre = $2 WHERE id = $1 RETURNING id, nombre",
            [id, nombre]
        );

        if (rows.length === 0) {
            return res.status(404).json({ mensaje: "Consultorio no encontrado." });
        }

        await registrar(req.usuario.id, id, "renombrar_consultorio", nombre);

        res.json({ mensaje: "Consultorio actualizado.", consultorio: rows[0] });

    } catch (error) {

        fallo(res, error, "renombrar");
    }
});


/* =====================================================
   SUSPENDER / REACTIVAR
===================================================== */

router.patch("/consultorios/:id/estado", async (req, res) => {

    try {

        const id = idValido(req.params.id);

        if (!id || typeof req.body.activo !== "boolean") {
            return res.status(400).json({ mensaje: "Datos inválidos." });
        }

        const { rows } = await pool.query(
            "UPDATE consultorios SET activo = $2 WHERE id = $1 RETURNING id, nombre, activo",
            [id, req.body.activo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ mensaje: "Consultorio no encontrado." });
        }

        invalidarCache();

        await registrar(
            req.usuario.id,
            id,
            req.body.activo ? "reactivar_consultorio" : "suspender_consultorio",
            rows[0].nombre
        );

        res.json({
            mensaje: req.body.activo ? "Consultorio reactivado." : "Consultorio suspendido.",
            consultorio: rows[0]
        });

    } catch (error) {

        fallo(res, error, "estado");
    }
});


/* =====================================================
   ENTRAR COMO SOPORTE
===================================================== */

router.post("/consultorios/:id/entrar", async (req, res) => {

    try {

        const id = idValido(req.params.id);

        if (!id) {
            return res.status(400).json({ mensaje: "Datos inválidos." });
        }

        const { rows } = await pool.query(
            "SELECT id, nombre FROM consultorios WHERE id = $1",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ mensaje: "Consultorio no encontrado." });
        }

        await registrar(req.usuario.id, id, "entrar_consultorio", rows[0].nombre);

        // sesión de soporte: corta (2 horas) y acotada a ese consultorio
        const token = jwt.sign(
            {
                id: req.usuario.id,
                email: req.usuario.email,
                rol: "superadmin",
                consultorioId: id,
                soporte: true
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({ token, consultorio: rows[0] });

    } catch (error) {

        fallo(res, error, "entrar");
    }
});


/* =====================================================
   ACTIVIDAD
===================================================== */

router.get("/actividad", async (req, res) => {

    try {

        const { rows } = await pool.query(
            `
            SELECT
                a.id,
                a.accion,
                a.detalle,
                a.creado_en,
                c.nombre AS consultorio,
                u.email AS usuario
            FROM auditoria a
            LEFT JOIN consultorios c ON c.id = a.consultorio_id
            LEFT JOIN usuarios u ON u.id = a.usuario_id
            ORDER BY a.creado_en DESC
            LIMIT 40
            `
        );

        res.json({ actividad: rows });

    } catch (error) {

        fallo(res, error, "actividad");
    }
});


module.exports = router;
