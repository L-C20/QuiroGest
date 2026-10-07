const jwt = require("jsonwebtoken");

const pool = require("../database/connection");

/*
 * Verifica el token y que la cuenta siga vigente.
 *
 * - El usuario debe existir y estar activo.
 * - Su consultorio debe estar activo (si no, está suspendido).
 * - req.usuario = { id, email, rol, consultorioId }
 *   El rol sale de la base de datos, no del token, así un cambio
 *   de rol o una baja se aplican enseguida.
 *
 * Para no consultar la base en cada request, el estado se guarda
 * 30 segundos en memoria (se puede forzar con invalidarCache).
 */

const VIGENCIA_CACHE_MS = 30 * 1000;

const cache = new Map();


function invalidarCache(usuarioId) {

    if (usuarioId === undefined) {
        cache.clear();
    } else {
        cache.delete(Number(usuarioId));
    }
}


async function estadoDeCuenta(usuarioId) {

    const guardado = cache.get(usuarioId);

    if (guardado && Date.now() - guardado.hora < VIGENCIA_CACHE_MS) {
        return guardado.datos;
    }

    const { rows } = await pool.query(
        `
        SELECT
            u.id,
            u.email,
            u.rol,
            u.activo,
            u.consultorio_id,
            u.sesion_valida_desde,
            c.activo AS consultorio_activo
        FROM usuarios u
        LEFT JOIN consultorios c ON c.id = u.consultorio_id
        WHERE u.id = $1
        `,
        [usuarioId]
    );

    const datos = rows[0] || null;

    cache.set(usuarioId, { hora: Date.now(), datos });

    return datos;
}


async function verificarToken(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                mensaje: "Token requerido"
            });
        }

        const partes = authHeader.split(" ");

        if (partes.length !== 2 || partes[0] !== "Bearer") {
            return res.status(401).json({
                mensaje: "Formato de token inválido"
            });
        }

        let datosToken;

        try {

            datosToken = jwt.verify(partes[1], process.env.JWT_SECRET);

        } catch (error) {

            return res.status(401).json({
                mensaje: "Token inválido o expirado"
            });
        }

        // tokens emitidos antes del multi-consultorio: volver a iniciar sesión
        if (!datosToken.id || !datosToken.consultorioId) {
            return res.status(401).json({
                mensaje: "Sesión vencida. Iniciá sesión nuevamente."
            });
        }

        const cuenta = await estadoDeCuenta(datosToken.id);

        if (!cuenta || !cuenta.activo) {
            return res.status(401).json({
                mensaje: "Usuario inexistente o desactivado"
            });
        }

        // un usuario común solo opera en su propio consultorio
        // (el super admin puede entrar a otro con un token especial)
        if (
            cuenta.rol !== "superadmin" &&
            Number(datosToken.consultorioId) !== Number(cuenta.consultorio_id)
        ) {
            return res.status(401).json({
                mensaje: "Sesión inválida"
            });
        }

        // un cambio de contraseña cierra las sesiones abiertas antes de ese momento
        if (
            cuenta.sesion_valida_desde &&
            datosToken.iat < Math.floor(new Date(cuenta.sesion_valida_desde).getTime() / 1000)
        ) {
            return res.status(401).json({
                mensaje: "Sesión vencida. Iniciá sesión nuevamente."
            });
        }

        const consultorioId = Number(datosToken.consultorioId);

        if (cuenta.rol !== "superadmin" && !cuenta.consultorio_activo) {
            return res.status(403).json({
                mensaje: "La cuenta del consultorio está suspendida. Contactá a tu proveedor."
            });
        }

        req.usuario = {
            id: cuenta.id,
            email: cuenta.email,
            rol: cuenta.rol,
            consultorioId
        };

        next();

    } catch (error) {

        console.error("Error verificando token:", error);

        return res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
}


/* Permite el paso solo a ciertos roles: requerirRol("superadmin", "administrador") */

function requerirRol(...roles) {

    return function (req, res, next) {

        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return res.status(403).json({
                mensaje: "No tenés permisos para realizar esta acción"
            });
        }

        next();
    };
}


module.exports = verificarToken;
module.exports.requerirRol = requerirRol;
module.exports.invalidarCache = invalidarCache;
