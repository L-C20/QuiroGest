/* =====================================================
   GESTIONTEC MEDICAL — Migración multi-consultorio y roles

   Es idempotente: se puede ejecutar muchas veces y solo
   hace lo que falta. Corre al iniciar el servidor, dentro
   de una transacción (si algo falla no queda nada a medias)
   y con un candado para que dos instancias no choquen.

   Qué hace:
   - Crea la tabla `consultorios` y un consultorio inicial
     donde quedan los datos que ya existían.
   - Agrega `consultorio_id` a pacientes, turnos y pagos.
   - Agrega a `usuarios`: rol, consultorio_id, activo, nombre.
     El primer usuario (o SUPERADMIN_EMAIL) pasa a ser
     "superadmin"; el resto "administrador".
   - DNI y N° de identificación pasan a ser únicos
     por consultorio (antes eran únicos en toda la base).
===================================================== */

const pool = require("./connection");

const ROLES = ["superadmin", "administrador", "usuario"];

async function columnaExiste(client, tabla, columna) {

    const { rowCount } = await client.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        `,
        [tabla, columna]
    );

    return rowCount > 0;
}


async function migrar() {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        // candado: una sola instancia migra a la vez
        await client.query("SELECT pg_advisory_xact_lock(727001)");


        /* ---------- consultorios ---------- */

        await client.query(`
            CREATE TABLE IF NOT EXISTS consultorios (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                direccion VARCHAR(250),
                telefono VARCHAR(50),
                email VARCHAR(150),
                logo TEXT,
                activo BOOLEAN NOT NULL DEFAULT true,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await client.query(
            `
            INSERT INTO consultorios (nombre)
            SELECT $1
            WHERE NOT EXISTS (SELECT 1 FROM consultorios)
            `,
            [process.env.CONSULTORIO_NOMBRE || "Consultorio"]
        );

        const { rows: [inicial] } = await client.query(
            "SELECT MIN(id) AS id FROM consultorios"
        );

        const consultorioInicial = inicial.id;


        /* ---------- auditoría de las acciones del proveedor ---------- */

        await client.query(`
            CREATE TABLE IF NOT EXISTS auditoria (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
                consultorio_id INTEGER REFERENCES consultorios(id) ON DELETE SET NULL,
                accion VARCHAR(50) NOT NULL,
                detalle TEXT,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);

        await client.query("CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (creado_en DESC)");


        /* ---------- historial de respaldos ---------- */

        await client.query(`
            CREATE TABLE IF NOT EXISTS respaldos (
                id SERIAL PRIMARY KEY,
                creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                tipo VARCHAR(20) NOT NULL,
                destino VARCHAR(20) NOT NULL,
                estado VARCHAR(10) NOT NULL,
                archivo TEXT,
                bytes BIGINT,
                filas INTEGER,
                duracion_ms INTEGER,
                error TEXT
            )
        `);


        /* ---------- ajustes de recordatorios y logo por consultorio ---------- */

        await client.query(`
            ALTER TABLE consultorios
                ADD COLUMN IF NOT EXISTS recordatorios_activo BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS recordatorio_horas INTEGER NOT NULL DEFAULT 24,
                ADD COLUMN IF NOT EXISTS recordatorio_texto TEXT
        `);


        /* ---------- usuarios ---------- */

        const usuariosYaMigrados = await columnaExiste(client, "usuarios", "rol");

        await client.query(`
            ALTER TABLE usuarios
                ADD COLUMN IF NOT EXISTS rol VARCHAR(20) NOT NULL DEFAULT 'usuario',
                ADD COLUMN IF NOT EXISTS consultorio_id INTEGER REFERENCES consultorios(id),
                ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS nombre VARCHAR(150),
                ADD COLUMN IF NOT EXISTS sesion_valida_desde TIMESTAMP
        `);

        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_rol_check'
                ) THEN
                    ALTER TABLE usuarios
                        ADD CONSTRAINT usuarios_rol_check
                        CHECK (rol IN ('superadmin', 'administrador', 'usuario'));
                END IF;
            END $$
        `);

        if (!usuariosYaMigrados) {

            // usuarios que existían antes de los roles: administradores
            await client.query("UPDATE usuarios SET rol = 'administrador'");

            // el super admin: SUPERADMIN_EMAIL, o el usuario más antiguo
            const email = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();

            await client.query(
                `
                UPDATE usuarios
                SET rol = 'superadmin'
                WHERE id = COALESCE(
                    (SELECT id FROM usuarios WHERE LOWER(email) = $1 LIMIT 1),
                    (SELECT MIN(id) FROM usuarios)
                )
                `,
                [email]
            );
        }

        await client.query(
            "UPDATE usuarios SET consultorio_id = $1 WHERE consultorio_id IS NULL",
            [consultorioInicial]
        );


        /* ---------- pacientes ---------- */

        await client.query(`
            ALTER TABLE pacientes
                ADD COLUMN IF NOT EXISTS consultorio_id INTEGER REFERENCES consultorios(id)
        `);

        await client.query(
            "UPDATE pacientes SET consultorio_id = $1 WHERE consultorio_id IS NULL",
            [consultorioInicial]
        );

        await client.query(
            "ALTER TABLE pacientes ALTER COLUMN consultorio_id SET NOT NULL"
        );


        /* ---------- turnos ---------- */

        await client.query(`
            ALTER TABLE turnos
                ADD COLUMN IF NOT EXISTS consultorio_id INTEGER REFERENCES consultorios(id)
        `);

        await client.query(`
            UPDATE turnos t
            SET consultorio_id = p.consultorio_id
            FROM pacientes p
            WHERE p.id = t.paciente_id
              AND t.consultorio_id IS NULL
        `);

        await client.query(
            "ALTER TABLE turnos ALTER COLUMN consultorio_id SET NOT NULL"
        );


        /* ---------- pagos ---------- */

        await client.query(`
            ALTER TABLE pagos
                ADD COLUMN IF NOT EXISTS consultorio_id INTEGER REFERENCES consultorios(id)
        `);

        await client.query(`
            UPDATE pagos pg
            SET consultorio_id = t.consultorio_id
            FROM turnos t
            WHERE t.id = pg.turno_id
              AND pg.consultorio_id IS NULL
        `);

        await client.query(
            "ALTER TABLE pagos ALTER COLUMN consultorio_id SET NOT NULL"
        );


        /* ---------- unicidad por consultorio ---------- */

        for (const nombre of [
            "pacientes_dni_key",
            "pacientes_numero_identificacion_key"
        ]) {
            await client.query(`ALTER TABLE pacientes DROP CONSTRAINT IF EXISTS ${nombre}`);
            await client.query(`DROP INDEX IF EXISTS ${nombre}`);
        }

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS pacientes_consultorio_dni_key
                ON pacientes (consultorio_id, dni)
        `);

        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS pacientes_consultorio_numero_key
                ON pacientes (consultorio_id, numero_identificacion)
        `);


        /* ---------- índices de consulta ---------- */

        await client.query("CREATE INDEX IF NOT EXISTS idx_turnos_consultorio_fecha ON turnos (consultorio_id, fecha)");
        await client.query("CREATE INDEX IF NOT EXISTS idx_pagos_consultorio ON pagos (consultorio_id)");
        await client.query("CREATE INDEX IF NOT EXISTS idx_usuarios_consultorio ON usuarios (consultorio_id)");


        /* ---------- agenda: duración de turnos, horario de atención y bloqueos ---------- */

        await client.query("ALTER TABLE turnos ADD COLUMN IF NOT EXISTS duracion_min INTEGER NOT NULL DEFAULT 30");

        await client.query(`
            ALTER TABLE consultorios
            ADD COLUMN IF NOT EXISTS agenda_hora_inicio INTEGER NOT NULL DEFAULT 8,
            ADD COLUMN IF NOT EXISTS agenda_hora_fin INTEGER NOT NULL DEFAULT 20,
            ADD COLUMN IF NOT EXISTS agenda_intervalo INTEGER NOT NULL DEFAULT 30
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS bloqueos (
                id SERIAL PRIMARY KEY,
                consultorio_id INTEGER NOT NULL REFERENCES consultorios(id),
                fecha_desde DATE NOT NULL,
                fecha_hasta DATE NOT NULL,
                hora_desde TIME,
                hora_hasta TIME,
                motivo VARCHAR(120),
                creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query("CREATE INDEX IF NOT EXISTS idx_bloqueos_consultorio_fecha ON bloqueos (consultorio_id, fecha_desde, fecha_hasta)");


        /* ---------- turnos recurrentes (series) ---------- */

        await client.query(`
            CREATE TABLE IF NOT EXISTS series_turnos (
                id SERIAL PRIMARY KEY,
                consultorio_id INTEGER NOT NULL REFERENCES consultorios(id),
                paciente_id INTEGER NOT NULL REFERENCES pacientes(id),
                descripcion VARCHAR(200),
                creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        await client.query("ALTER TABLE turnos ADD COLUMN IF NOT EXISTS serie_id INTEGER REFERENCES series_turnos(id)");
        await client.query("CREATE INDEX IF NOT EXISTS idx_turnos_serie ON turnos (serie_id) WHERE serie_id IS NOT NULL");

        await client.query("COMMIT");

    } catch (error) {

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
}

module.exports = { migrar, ROLES };
