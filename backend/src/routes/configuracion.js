/* =====================================================
   QUIROGEST — Configuración del consultorio

   Cualquier usuario:
     GET  /configuracion/consultorio
     PUT  /configuracion/mi-cuenta
     PUT  /configuracion/mi-cuenta/password

   Solo administrador (o super admin):
     PUT  /configuracion/consultorio
     GET/PUT /configuracion/recordatorios
     GET/POST /configuracion/usuarios
     PUT  /configuracion/usuarios/:id
     POST /configuracion/usuarios/:id/password
===================================================== */

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../database/connection");
const verificarToken = require("../middleware/authMiddleware");
const { requerirRol, invalidarCache } = require("../middleware/authMiddleware");
const recordatorios = require("../services/recordatorios");
const { emailValido } = require("../services/recordatorios/utils");

const router = express.Router();

const soloAdmin = requerirRol("administrador", "superadmin");

const HORAS_PERMITIDAS = [2, 4, 12, 24, 48, 72];
const LARGO_MIN_PASSWORD = 10;
const LARGO_MAX_PASSWORD = 100;


function texto(valor, max) {

    if (valor === undefined || valor === null) {
        return null;
    }

    const limpio = String(valor).trim();

    if (limpio.length > max) {
        throw new ErrorDeUsuario(`El texto supera los ${max} caracteres.`);
    }

    return limpio || null;
}

class ErrorDeUsuario extends Error {}

function manejar(res, error, contexto) {

    if (error instanceof ErrorDeUsuario) {
        return res.status(400).json({ mensaje: error.message });
    }

    console.error(`Error en configuración (${contexto}):`, error);

    return res.status(500).json({ mensaje: "Error interno del servidor" });
}

function validarPassword(password) {

    if (typeof password !== "string" || password.length < LARGO_MIN_PASSWORD) {
        throw new ErrorDeUsuario(
            `La contraseña debe tener al menos ${LARGO_MIN_PASSWORD} caracteres.`
        );
    }

    if (password.length > LARGO_MAX_PASSWORD) {
        throw new ErrorDeUsuario("La contraseña es demasiado larga.");
    }
}


/* =====================================================
   CONSULTORIO
===================================================== */

router.get("/consultorio", verificarToken, async (req, res) => {

    try {

        const { rows } = await pool.query(
            `
            SELECT id, nombre, direccion, telefono, email, logo
            FROM consultorios
            WHERE id = $1
            `,
            [req.usuario.consultorioId]
        );

        res.json({ consultorio: rows[0] });

    } catch (error) {

        manejar(res, error, "consultorio");
    }
});


router.put("/consultorio", verificarToken, soloAdmin, async (req, res) => {

    try {

        const nombre = texto(req.body.nombre, 150);

        if (!nombre) {
            throw new ErrorDeUsuario("El nombre del consultorio es obligatorio.");
        }

        const direccion = texto(req.body.direccion, 250);
        const telefono = texto(req.body.telefono, 50);
        const email = texto(req.body.email, 150);

        if (email && !emailValido(email)) {
            throw new ErrorDeUsuario("El correo del consultorio no es válido.");
        }

        // logo: undefined = no tocar, null/"" = quitar, data URL = reemplazar
        let logo;

        if (req.body.logo !== undefined) {

            if (!req.body.logo) {

                logo = null;

            } else {

                const valor = String(req.body.logo);

                if (
                    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)
                ) {
                    throw new ErrorDeUsuario("El logo debe ser una imagen PNG, JPG o WebP.");
                }

                if (valor.length > 400000) {
                    throw new ErrorDeUsuario("El logo es demasiado pesado (máximo 300 KB).");
                }

                logo = valor;
            }
        }

        const { rows } = await pool.query(
            `
            UPDATE consultorios
            SET nombre = $2,
                direccion = $3,
                telefono = $4,
                email = $5,
                logo = CASE WHEN $6::boolean THEN $7 ELSE logo END
            WHERE id = $1
            RETURNING id, nombre, direccion, telefono, email, logo
            `,
            [
                req.usuario.consultorioId,
                nombre,
                direccion,
                telefono,
                email,
                logo !== undefined,
                logo === undefined ? null : logo
            ]
        );

        res.json({
            mensaje: "Datos del consultorio guardados.",
            consultorio: rows[0]
        });

    } catch (error) {

        manejar(res, error, "guardar consultorio");
    }
});


/* =====================================================
   RECORDATORIOS
===================================================== */

router.get("/recordatorios", verificarToken, soloAdmin, async (req, res) => {

    try {

        const { rows } = await pool.query(
            `
            SELECT recordatorios_activo, recordatorio_horas, recordatorio_texto
            FROM consultorios
            WHERE id = $1
            `,
            [req.usuario.consultorioId]
        );

        const global = recordatorios.estadoConfiguracion();

        res.json({
            activo: rows[0].recordatorios_activo,
            horas_antes: rows[0].recordatorio_horas,
            texto: rows[0].recordatorio_texto,
            opciones_horas: HORAS_PERMITIDAS,
            servicio: {
                habilitado: global.habilitado,
                canales: global.canales
            }
        });

    } catch (error) {

        manejar(res, error, "leer recordatorios");
    }
});


router.put("/recordatorios", verificarToken, soloAdmin, async (req, res) => {

    try {

        const activo = req.body.activo === true || req.body.activo === "true";

        const horas = Number(req.body.horas_antes);

        if (!HORAS_PERMITIDAS.includes(horas)) {
            throw new ErrorDeUsuario("Las horas de anticipación no son válidas.");
        }

        const textoPersonalizado = texto(req.body.texto, 600);

        const { rows } = await pool.query(
            `
            UPDATE consultorios
            SET recordatorios_activo = $2,
                recordatorio_horas = $3,
                recordatorio_texto = $4
            WHERE id = $1
            RETURNING recordatorios_activo, recordatorio_horas, recordatorio_texto
            `,
            [req.usuario.consultorioId, activo, horas, textoPersonalizado]
        );

        res.json({
            mensaje: "Configuración de recordatorios guardada.",
            activo: rows[0].recordatorios_activo,
            horas_antes: rows[0].recordatorio_horas,
            texto: rows[0].recordatorio_texto
        });

    } catch (error) {

        manejar(res, error, "guardar recordatorios");
    }
});


/* =====================================================
   USUARIOS DEL CONSULTORIO
===================================================== */

/*
 * El super admin no aparece para los clientes: para ellos no existe.
 * Y un cliente nunca puede modificar a un super admin.
 */
function filtroVisible(req) {

    return req.usuario.rol === "superadmin"
        ? ""
        : "AND rol <> 'superadmin'";
}


router.get("/usuarios", verificarToken, soloAdmin, async (req, res) => {

    try {

        const { rows } = await pool.query(
            `
            SELECT id, email, nombre, rol, activo, created_at
            FROM usuarios
            WHERE consultorio_id = $1
            ${filtroVisible(req)}
            ORDER BY activo DESC, nombre NULLS LAST, email
            `,
            [req.usuario.consultorioId]
        );

        res.json({ usuarios: rows, yo: req.usuario.id });

    } catch (error) {

        manejar(res, error, "listar usuarios");
    }
});


router.post("/usuarios", verificarToken, soloAdmin, async (req, res) => {

    try {

        const email = texto(req.body.email, 150);
        const nombre = texto(req.body.nombre, 150);
        const rol = req.body.rol || "usuario";

        if (!email || !emailValido(email)) {
            throw new ErrorDeUsuario("Ingresá un correo electrónico válido.");
        }

        if (!["usuario", "administrador"].includes(rol)) {
            throw new ErrorDeUsuario("El rol no es válido.");
        }

        validarPassword(req.body.password);

        const hash = await bcrypt.hash(req.body.password, 12);

        const { rows } = await pool.query(
            `
            INSERT INTO usuarios (email, nombre, password_hash, rol, consultorio_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, nombre, rol, activo, created_at
            `,
            [email, nombre, hash, rol, req.usuario.consultorioId]
        );

        res.status(201).json({
            mensaje: "Usuario creado correctamente.",
            usuario: rows[0]
        });

    } catch (error) {

        if (error.code === "23505") {
            return res.status(409).json({
                mensaje: "Ya existe un usuario con ese correo."
            });
        }

        manejar(res, error, "crear usuario");
    }
});


/* Busca un usuario modificable por quien hace el pedido */
async function usuarioGestionable(req, id) {

    const { rows } = await pool.query(
        `
        SELECT id, email, rol, activo
        FROM usuarios
        WHERE id = $1
          AND consultorio_id = $2
          ${filtroVisible(req)}
        `,
        [id, req.usuario.consultorioId]
    );

    return rows[0] || null;
}


router.put("/usuarios/:id", verificarToken, soloAdmin, async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {
            throw new ErrorDeUsuario("Usuario inválido.");
        }

        const objetivo = await usuarioGestionable(req, id);

        if (!objetivo) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        const nombre = texto(req.body.nombre, 150);

        let rol = objetivo.rol;
        let activo = objetivo.activo;

        if (req.body.rol !== undefined) {

            if (!["usuario", "administrador"].includes(req.body.rol)) {
                throw new ErrorDeUsuario("El rol no es válido.");
            }

            rol = req.body.rol;
        }

        if (req.body.activo !== undefined) {
            activo = req.body.activo === true || req.body.activo === "true";
        }

        // nadie se quita permisos ni se desactiva a sí mismo
        if (id === req.usuario.id && (rol !== objetivo.rol || activo !== objetivo.activo)) {
            throw new ErrorDeUsuario(
                "No podés cambiar tu propio rol ni desactivarte. Pedíselo a otro administrador."
            );
        }

        // un super admin conserva su rol (se cambia solo desde el panel del proveedor)
        if (objetivo.rol === "superadmin") {
            rol = "superadmin";
        }

        const { rows } = await pool.query(
            `
            UPDATE usuarios
            SET nombre = $3,
                rol = $4,
                activo = $5
            WHERE id = $1
              AND consultorio_id = $2
            RETURNING id, email, nombre, rol, activo, created_at
            `,
            [id, req.usuario.consultorioId, nombre, rol, activo]
        );

        invalidarCache(id);

        res.json({
            mensaje: "Usuario actualizado.",
            usuario: rows[0]
        });

    } catch (error) {

        manejar(res, error, "editar usuario");
    }
});


router.post("/usuarios/:id/password", verificarToken, soloAdmin, async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isInteger(id)) {
            throw new ErrorDeUsuario("Usuario inválido.");
        }

        validarPassword(req.body.password);

        const objetivo = await usuarioGestionable(req, id);

        if (!objetivo) {
            return res.status(404).json({ mensaje: "Usuario no encontrado." });
        }

        const hash = await bcrypt.hash(req.body.password, 12);

        await pool.query(
            `
            UPDATE usuarios
            SET password_hash = $3,
                sesion_valida_desde = NOW()
            WHERE id = $1
              AND consultorio_id = $2
            `,
            [id, req.usuario.consultorioId, hash]
        );

        invalidarCache(id);

        res.json({ mensaje: "Contraseña actualizada. Se cerraron sus sesiones abiertas." });

    } catch (error) {

        manejar(res, error, "cambiar contraseña de usuario");
    }
});


/* =====================================================
   MI CUENTA
===================================================== */

router.put("/mi-cuenta", verificarToken, async (req, res) => {

    try {

        const nombre = texto(req.body.nombre, 150);

        const { rows } = await pool.query(
            `
            UPDATE usuarios
            SET nombre = $2
            WHERE id = $1
            RETURNING id, email, nombre, rol
            `,
            [req.usuario.id, nombre]
        );

        res.json({
            mensaje: "Datos guardados.",
            usuario: rows[0]
        });

    } catch (error) {

        manejar(res, error, "guardar mi cuenta");
    }
});


router.put("/mi-cuenta/password", verificarToken, async (req, res) => {

    try {

        const { actual, nueva } = req.body;

        if (!actual) {
            throw new ErrorDeUsuario("Ingresá tu contraseña actual.");
        }

        validarPassword(nueva);

        if (nueva === actual) {
            throw new ErrorDeUsuario("La nueva contraseña debe ser distinta de la actual.");
        }

        const { rows } = await pool.query(
            "SELECT password_hash FROM usuarios WHERE id = $1",
            [req.usuario.id]
        );

        const correcta = rows[0] &&
            await bcrypt.compare(String(actual), rows[0].password_hash);

        if (!correcta) {
            return res.status(400).json({
                mensaje: "La contraseña actual no es correcta."
            });
        }

        const hash = await bcrypt.hash(nueva, 12);

        await pool.query(
            `
            UPDATE usuarios
            SET password_hash = $2,
                sesion_valida_desde = NOW()
            WHERE id = $1
            `,
            [req.usuario.id, hash]
        );

        invalidarCache(req.usuario.id);

        // las demás sesiones se cierran; esta continúa con un token nuevo
        const token = jwt.sign(
            {
                id: req.usuario.id,
                email: req.usuario.email,
                rol: req.usuario.rol,
                consultorioId: req.usuario.consultorioId
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({ mensaje: "Contraseña actualizada.", token });

    } catch (error) {

        manejar(res, error, "cambiar mi contraseña");
    }
});


module.exports = router;
