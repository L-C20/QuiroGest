/* =====================================================
   GESTIONTEC MEDICAL — Respaldos de la base de datos

   Respaldo completo, comprimido y cifrado (AES-256-GCM), que se puede
   restaurar desde cero en cualquier base vacía.

   Requisitos para que funcionen los respaldos automáticos:
     BACKUP_ENCRYPTION_KEY  clave de cifrado (node generarClaveRespaldo.js)
     BACKUP_S3_*            almacenamiento externo (ver almacenamiento.js)

   Opcionales:
     BACKUP_HOUR            hora local a partir de la cual se hace el respaldo
                            diario (por defecto 3)
     BACKUP_TZ              zona horaria (por defecto America/Argentina/Buenos_Aires)
     BACKUP_KEEP_DAILY / BACKUP_KEEP_WEEKLY / BACKUP_KEEP_MONTHLY
                            cuántos conservar (por defecto 7 / 4 / 12)

   La clave de cifrado se debe guardar TAMBIÉN fuera de Railway (por ejemplo
   en un gestor de contraseñas): sin ella los respaldos no se pueden abrir.
===================================================== */

const pool = require("../../database/connection");
const cifrado = require("./cifrado");
const volcado = require("./volcado");
const almacenamiento = require("./almacenamiento");
const { calcularBorrados } = require("./retencion");

const CLAVE_CANDADO = 727002;
const INTERVALO_REVISION_MS = 15 * 60 * 1000;
const ESPERA_TRAS_ERROR_MS = 2 * 60 * 60 * 1000;

const PATRON_ARCHIVO = /gestiontec-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.gtbak$/;


class ErrorDeConfiguracion extends Error {}


function numero(valor, porDefecto) {

    const n = Number(valor);

    return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

function opciones() {

    return {
        hora: numero(process.env.BACKUP_HOUR, 3),
        zona: process.env.BACKUP_TZ || process.env.REMINDER_TZ || "America/Argentina/Buenos_Aires",
        diarios: numero(process.env.BACKUP_KEEP_DAILY, 7),
        semanales: numero(process.env.BACKUP_KEEP_WEEKLY, 4),
        mensuales: numero(process.env.BACKUP_KEEP_MONTHLY, 12)
    };
}


function estado() {

    const o = opciones();

    let claveConfigurada = false;
    let errorClave = null;

    try {

        claveConfigurada = Boolean(cifrado.obtenerClave());

    } catch (error) {

        errorClave = error.message;
    }

    const almacenamientoConfigurado = almacenamiento.configurado();

    return {
        claveConfigurada,
        errorClave,
        almacenamientoConfigurado,
        automatico: claveConfigurada && almacenamientoConfigurado,
        hora: o.hora,
        zona: o.zona,
        retencion: {
            diarios: o.diarios,
            semanales: o.semanales,
            mensuales: o.mensuales
        }
    };
}


function nombreArchivo(fecha = new Date()) {

    const p = n => String(n).padStart(2, "0");

    return (
        `gestiontec-${fecha.getUTCFullYear()}${p(fecha.getUTCMonth() + 1)}${p(fecha.getUTCDate())}` +
        `-${p(fecha.getUTCHours())}${p(fecha.getUTCMinutes())}${p(fecha.getUTCSeconds())}.gtbak`
    );
}


function fechaDeArchivo(clave) {

    const m = PATRON_ARCHIVO.exec(clave);

    return m
        ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
        : null;
}


/* Fecha y hora locales en la zona del consultorio. */
function partesLocales(fecha, zona) {

    const partes = new Intl.DateTimeFormat("en-CA", {
        timeZone: zona,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23"
    }).formatToParts(fecha);

    const valor = tipo => partes.find(p => p.type === tipo).value;

    return {
        fecha: `${valor("year")}-${valor("month")}-${valor("day")}`,
        hora: Number(valor("hour"))
    };
}


async function registrar({ tipo, destino, estadoFinal, archivo, bytes, filas, duracion, error }) {

    try {

        await pool.query(
            `
            INSERT INTO respaldos
                (tipo, destino, estado, archivo, bytes, filas, duracion_ms, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [tipo, destino, estadoFinal, archivo || null, bytes || null, filas ?? null, duracion ?? null, error || null]
        );

    } catch (e) {

        console.error("[respaldos] No se pudo registrar el historial:", e.message);
    }
}


/* Crea el respaldo cifrado en memoria (sin subirlo). */
async function generar() {

    const clave = cifrado.obtenerClave();

    if (!clave) {

        throw new ErrorDeConfiguracion(
            "Falta la clave de cifrado (BACKUP_ENCRYPTION_KEY). Generala con: node generarClaveRespaldo.js"
        );
    }

    const resultado = await volcado.crearVolcado(pool);

    return {
        archivo: nombreArchivo(),
        datos: cifrado.cifrar(resultado.datos, clave),
        filas: resultado.filas,
        tablas: resultado.tablas,
        conteo: resultado.conteo,
        advertencias: resultado.advertencias
    };
}


/* Borra los respaldos que ya no entran en la política de retención. */
async function aplicarRetencion(proveedor) {

    const o = opciones();

    const objetos = await proveedor.listar(almacenamiento.prefijo());

    const items = objetos
        .map(objeto => ({ clave: objeto.clave, fecha: fechaDeArchivo(objeto.clave) }))
        .filter(item => item.fecha);

    const borrar = calcularBorrados(items, o);

    let borrados = 0;

    for (const clave of borrar) {

        try {

            await proveedor.borrar(clave);
            borrados++;

        } catch (error) {

            console.error(`[respaldos] No se pudo borrar ${clave}:`, error.message);
        }
    }

    return borrados;
}


/**
 * Genera un respaldo y lo sube al almacenamiento externo.
 * Un candado impide que dos respaldos corran a la vez.
 */
async function ejecutar({ tipo = "manual", proveedor = null } = {}) {

    const prov = proveedor || (almacenamiento.configurado() ? almacenamiento.crearProveedorS3() : null);

    if (!prov) {

        throw new ErrorDeConfiguracion(
            "Falta configurar el almacenamiento externo (variables BACKUP_S3_*)."
        );
    }

    const candado = await pool.connect();

    try {

        const { rows } = await candado.query("SELECT pg_try_advisory_lock($1) AS ok", [CLAVE_CANDADO]);

        if (!rows[0].ok) {
            return { omitido: "Ya hay un respaldo en curso." };
        }

        const inicio = Date.now();

        let generado;

        try {

            generado = await generar();

            const clave = almacenamiento.prefijo() + generado.archivo;

            await prov.subir(clave, generado.datos);

            const duracion = Date.now() - inicio;

            await registrar({
                tipo,
                destino: "almacenamiento",
                estadoFinal: "ok",
                archivo: clave,
                bytes: generado.datos.length,
                filas: generado.filas,
                duracion
            });

            let borrados = 0;

            try {

                borrados = await aplicarRetencion(prov);

            } catch (error) {

                console.error("[respaldos] No se pudo aplicar la retención:", error.message);
            }

            console.log(
                `[respaldos] OK ${clave} (${generado.datos.length} bytes, ${generado.filas} filas, ` +
                `${duracion} ms, ${borrados} antiguos eliminados)`
            );

            return {
                archivo: clave,
                bytes: generado.datos.length,
                filas: generado.filas,
                tablas: generado.tablas,
                eliminados: borrados,
                advertencias: generado.advertencias
            };

        } catch (error) {

            await registrar({
                tipo,
                destino: "almacenamiento",
                estadoFinal: "error",
                archivo: generado ? generado.archivo : null,
                duracion: Date.now() - inicio,
                error: error.message
            });

            console.error("[respaldos] ERROR:", error.message);

            throw error;
        }

    } finally {

        await candado.query("SELECT pg_advisory_unlock($1)", [CLAVE_CANDADO]).catch(() => {});
        candado.release();
    }
}


/* Respaldo para descargar directamente (no se guarda en el almacenamiento). */
async function descargar() {

    const inicio = Date.now();

    try {

        const generado = await generar();

        await registrar({
            tipo: "manual",
            destino: "descarga",
            estadoFinal: "ok",
            archivo: generado.archivo,
            bytes: generado.datos.length,
            filas: generado.filas,
            duracion: Date.now() - inicio
        });

        return generado;

    } catch (error) {

        await registrar({
            tipo: "manual",
            destino: "descarga",
            estadoFinal: "error",
            duracion: Date.now() - inicio,
            error: error.message
        });

        throw error;
    }
}


async function listar(limite = 15) {

    const { rows } = await pool.query(
        `
        SELECT id, creado_en, tipo, destino, estado, archivo, bytes, filas, duracion_ms, error
        FROM respaldos
        ORDER BY id DESC
        LIMIT $1
        `,
        [limite]
    );

    return rows;
}


/* ¿Toca hacer el respaldo automático? (se evalúa cada 15 minutos) */
async function revisar() {

    if (!estado().automatico) {
        return { omitido: "No está configurado" };
    }

    const o = opciones();

    const local = partesLocales(new Date(), o.zona);

    if (local.hora < o.hora) {
        return { omitido: "Todavía no es la hora" };
    }

    const hoy = await pool.query(
        `
        SELECT 1
        FROM respaldos
        WHERE tipo = 'automatico'
          AND estado = 'ok'
          AND (creado_en AT TIME ZONE $1)::date = $2::date
        LIMIT 1
        `,
        [o.zona, local.fecha]
    );

    if (hoy.rows.length > 0) {
        return { omitido: "Ya hay un respaldo automático de hoy" };
    }

    // tras un error se espera un rato antes de reintentar
    const ultimo = await pool.query(
        "SELECT estado, creado_en FROM respaldos WHERE tipo = 'automatico' ORDER BY id DESC LIMIT 1"
    );

    if (
        ultimo.rows.length > 0 &&
        ultimo.rows[0].estado === "error" &&
        Date.now() - new Date(ultimo.rows[0].creado_en).getTime() < ESPERA_TRAS_ERROR_MS
    ) {
        return { omitido: "Se reintentará más tarde" };
    }

    return ejecutar({ tipo: "automatico" });
}


function iniciar() {

    const e = estado();

    if (e.automatico) {

        console.log(
            `[respaldos] Automáticos activos: diario desde las ${e.hora}:00 (${e.zona}), ` +
            `se conservan ${e.retencion.diarios} diarios, ${e.retencion.semanales} semanales y ` +
            `${e.retencion.mensuales} mensuales.`
        );

    } else {

        console.log(
            "[respaldos] Automáticos desactivados " +
            `(clave de cifrado: ${e.claveConfigurada ? "sí" : "FALTA"}, ` +
            `almacenamiento externo: ${e.almacenamientoConfigurado ? "sí" : "FALTA"}).`
        );
    }

    const ciclo = () =>
        revisar()
            .then(r => {
                if (r && r.archivo) {
                    console.log("[respaldos] Respaldo automático completado.");
                }
            })
            .catch(error => console.error("[respaldos] Falló el respaldo automático:", error.message));

    setTimeout(ciclo, 45 * 1000);
    setInterval(ciclo, INTERVALO_REVISION_MS);
}


module.exports = {
    ErrorDeConfiguracion,
    estado,
    generar,
    ejecutar,
    descargar,
    listar,
    revisar,
    iniciar,
    nombreArchivo,
    fechaDeArchivo
};
