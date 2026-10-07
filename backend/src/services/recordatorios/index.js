/* =====================================================
   GESTIONTEC MEDICAL — Recordatorios de turnos

   Apagado por defecto. Para activarlo en Railway:
     REMINDERS_ENABLED=true
   y cargar las claves de al menos un canal
   (ver canales/email.js y canales/whatsapp.js).

   Otras variables opcionales:
     REMINDER_HOURS_BEFORE  horas de anticipación (24)
     REMINDER_INTERVAL_MIN  cada cuántos minutos revisa (10)
     REMINDER_TZ            zona horaria del consultorio
                            (America/Argentina/Buenos_Aires)
     REMINDER_DRY_RUN=true  muestra qué enviaría sin enviar ni registrar
     CONSULTORIO_NOMBRE     nombre que aparece en los mensajes
     REMINDER_TEXT          texto del correo ({nombre} {fecha} {hora} {consultorio})
===================================================== */

const pool = require("../../database/connection");
const email = require("./canales/email");
const whatsapp = require("./canales/whatsapp");

const CANALES = [email, whatsapp];

const MAX_INTENTOS = 3;

let ejecutando = false;


function opciones() {

    return {
        habilitado: process.env.REMINDERS_ENABLED === "true",
        simulacro: process.env.REMINDER_DRY_RUN === "true",
        horasAntes: Number(process.env.REMINDER_HOURS_BEFORE) || 24,
        intervaloMin: Number(process.env.REMINDER_INTERVAL_MIN) || 10,
        zona: process.env.REMINDER_TZ || "America/Argentina/Buenos_Aires"
    };
}


/* Crea la tabla si no existe (se ejecuta al iniciar el servidor). */
async function prepararTabla() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS recordatorios (
            id SERIAL PRIMARY KEY,
            turno_id INTEGER NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
            canal VARCHAR(20) NOT NULL,
            estado VARCHAR(20) NOT NULL,
            intentos INTEGER NOT NULL DEFAULT 1,
            error TEXT,
            enviado_en TIMESTAMP,
            creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
            UNIQUE (turno_id, canal)
        )
    `);
}


function estadoConfiguracion() {

    const o = opciones();

    return {
        habilitado: o.habilitado,
        simulacro: o.simulacro,
        horasAntes: o.horasAntes,
        canales: {
            email: email.configurado(),
            whatsapp: whatsapp.configurado()
        }
    };
}


async function turnosPorRecordar(o) {

    const { rows } = await pool.query(
        `
        SELECT
            t.id,
            to_char(t.fecha, 'DD/MM/YYYY') AS fecha_txt,
            to_char(t.hora, 'HH24:MI') AS hora_txt,
            p.nombre,
            p.apellido,
            p.telefono,
            p.email,
            c.nombre AS consultorio,
            c.recordatorio_texto
        FROM turnos t
        INNER JOIN pacientes p ON p.id = t.paciente_id
        INNER JOIN consultorios c
            ON c.id = t.consultorio_id
           AND c.activo = true
           AND c.recordatorios_activo = true
        WHERE p.activo = true
          AND t.estado IN ('pendiente', 'confirmado')
          AND (t.fecha + t.hora) > (NOW() AT TIME ZONE $1) + interval '1 hour'
          AND (t.fecha + t.hora) <= (NOW() AT TIME ZONE $1) + make_interval(hours => c.recordatorio_horas)
        ORDER BY t.fecha, t.hora
        LIMIT 200
        `,
        [o.zona]
    );

    return rows;
}


/**
 * Reserva (turno, canal) para que dos ejecuciones no envíen lo mismo.
 * Devuelve true si este proceso es el que debe enviarlo.
 */
async function reservar(turnoId, canal) {

    const { rowCount } = await pool.query(
        `
        INSERT INTO recordatorios (turno_id, canal, estado)
        VALUES ($1, $2, 'enviando')
        ON CONFLICT (turno_id, canal) DO UPDATE
            SET estado = 'enviando',
                intentos = recordatorios.intentos + 1
            WHERE recordatorios.estado = 'fallido'
              AND recordatorios.intentos < $3
        `,
        [turnoId, canal, MAX_INTENTOS]
    );

    return rowCount > 0;
}


async function registrar(turnoId, canal, estado, error = null) {

    await pool.query(
        `
        UPDATE recordatorios
        SET estado = $3::varchar,
            error = $4::text,
            enviado_en = CASE WHEN $3::varchar = 'enviado' THEN NOW() ELSE NULL END
        WHERE turno_id = $1 AND canal = $2
        `,
        [turnoId, canal, estado, error]
    );
}


async function procesar() {

    const o = opciones();

    if (!o.habilitado) {
        return { omitido: "REMINDERS_ENABLED no está en true" };
    }

    const activos = CANALES.filter(canal => canal.configurado());

    if (activos.length === 0) {
        return { omitido: "No hay ningún canal configurado" };
    }

    if (ejecutando) {
        return { omitido: "Ya hay una ejecución en curso" };
    }

    ejecutando = true;

    const resumen = {
        revisados: 0,
        enviados: 0,
        fallidos: 0,
        sinContacto: 0,
        simulados: 0
    };

    try {

        const turnos = await turnosPorRecordar(o);

        resumen.revisados = turnos.length;

        for (const turno of turnos) {

            const destinos = activos
                .map(canal => ({ canal, destino: canal.contacto(turno) }))
                .filter(x => x.destino);

            if (destinos.length === 0) {

                if (o.simulacro) {
                    resumen.simulados++;
                    console.log(`[recordatorios] (simulacro) turno ${turno.id}: sin datos de contacto`);
                    continue;
                }

                if (await reservar(turno.id, "ninguno")) {
                    await registrar(turno.id, "ninguno", "sin_contacto");
                    resumen.sinContacto++;
                }

                continue;
            }

            for (const { canal, destino } of destinos) {

                if (o.simulacro) {
                    resumen.simulados++;
                    console.log(`[recordatorios] (simulacro) turno ${turno.id} -> ${canal.nombre}`);
                    continue;
                }

                if (!(await reservar(turno.id, canal.nombre))) {
                    continue;
                }

                try {

                    await canal.enviar(turno, destino);
                    await registrar(turno.id, canal.nombre, "enviado");
                    resumen.enviados++;

                } catch (error) {

                    await registrar(turno.id, canal.nombre, "fallido", error.message);
                    resumen.fallidos++;

                    console.error(`[recordatorios] turno ${turno.id} (${canal.nombre}):`, error.message);
                }
            }
        }

        return resumen;

    } finally {

        ejecutando = false;
    }
}


async function listarRecientes(consultorioId, limite = 50) {

    const { rows } = await pool.query(
        `
        SELECT
            r.id,
            r.turno_id,
            r.canal,
            r.estado,
            r.intentos,
            r.error,
            r.enviado_en,
            r.creado_en,
            to_char(t.fecha, 'YYYY-MM-DD') AS fecha,
            to_char(t.hora, 'HH24:MI') AS hora,
            p.nombre,
            p.apellido
        FROM recordatorios r
        INNER JOIN turnos t ON t.id = r.turno_id
        INNER JOIN pacientes p ON p.id = t.paciente_id
        WHERE t.consultorio_id = $1
        ORDER BY r.creado_en DESC
        LIMIT $2
        `,
        [consultorioId, limite]
    );

    return rows;
}


/* Se llama una vez al iniciar el servidor. */
async function iniciar() {

    try {
        await prepararTabla();
    } catch (error) {
        console.error("[recordatorios] No se pudo preparar la tabla:", error.message);
        return;
    }

    const o = opciones();

    if (!o.habilitado) {
        console.log("[recordatorios] Desactivados (REMINDERS_ENABLED no es true).");
        return;
    }

    console.log(
        `[recordatorios] Activos: revisión cada ${o.intervaloMin} min, ` +
        `aviso ${o.horasAntes} h antes` +
        (o.simulacro ? " (SIMULACRO: no se envía nada)" : "") + "."
    );

    const ciclo = () =>
        procesar()
            .then(r => {
                if (r && !r.omitido && (r.enviados || r.fallidos || r.sinContacto || r.simulados)) {
                    console.log("[recordatorios]", JSON.stringify(r));
                }
            })
            .catch(error => console.error("[recordatorios] Error:", error.message));

    setTimeout(ciclo, 15 * 1000);
    setInterval(ciclo, o.intervaloMin * 60 * 1000);
}


module.exports = {
    iniciar,
    procesar,
    listarRecientes,
    estadoConfiguracion
};
