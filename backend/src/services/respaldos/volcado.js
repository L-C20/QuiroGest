/* =====================================================
   Volcado y restauración de la base

   El archivo (antes de comprimir y cifrar) es de texto, una línea por
   registro, con un prefijo de una letra:

     M {json}              metadatos (formato, fecha, versión del servidor)
     E {json}              esquema: tablas, restricciones e índices
     D "tabla"<TAB>[...]   un bloque de filas de esa tabla (JSON crudo)
     F {json}              cierre: cantidad de filas por tabla

   Las filas se guardan como las entrega PostgreSQL (row_to_json), sin
   volver a procesarlas, así los números y fechas se restauran idénticos.
   La línea F permite detectar un archivo truncado.
===================================================== */

const zlib = require("zlib");

const { exportarEsquema, identificador } = require("./esquema");

const FORMATO = 1;
const FILAS_POR_BLOQUE = 1000;


/* =====================================================
   CREAR EL VOLCADO
===================================================== */

async function crearVolcado(pool) {

    const client = await pool.connect();

    try {

        // una "foto" consistente: todas las tablas tal como estaban en un mismo instante
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

        const { rows: [servidor] } = await client.query("SHOW server_version");

        const esquema = await exportarEsquema(client);

        const lineas = [];
        const conteo = {};

        lineas.push("M " + JSON.stringify({
            formato: FORMATO,
            creado: new Date().toISOString(),
            servidor: servidor.server_version,
            tablas: esquema.tablas.map(t => t.nombre),
            advertencias: esquema.advertencias
        }));

        lineas.push("E " + JSON.stringify({
            tablas: esquema.tablas,
            restricciones: esquema.restricciones,
            indices: esquema.indices
        }));

        for (const tabla of esquema.tablas) {

            conteo[tabla.nombre] = 0;

            await client.query(
                `DECLARE volcado_cursor NO SCROLL CURSOR FOR
                 SELECT row_to_json(t)::text AS fila FROM ${identificador(tabla.nombre)} t`
            );

            for (;;) {

                const { rows } = await client.query(
                    `FETCH ${FILAS_POR_BLOQUE} FROM volcado_cursor`
                );

                if (rows.length === 0) {
                    break;
                }

                conteo[tabla.nombre] += rows.length;

                lineas.push(
                    `D ${JSON.stringify(tabla.nombre)}\t[${rows.map(r => r.fila).join(",")}]`
                );
            }

            await client.query("CLOSE volcado_cursor");
        }

        lineas.push("F " + JSON.stringify({ conteo }));

        await client.query("COMMIT");

        const texto = lineas.join("\n") + "\n";

        return {
            datos: zlib.gzipSync(Buffer.from(texto, "utf8")),
            conteo,
            filas: Object.values(conteo).reduce((a, b) => a + b, 0),
            tablas: esquema.tablas.length,
            advertencias: esquema.advertencias
        };

    } catch (error) {

        await client.query("ROLLBACK").catch(() => {});

        throw error;

    } finally {

        client.release();
    }
}


/* =====================================================
   LEER Y VALIDAR UN VOLCADO
===================================================== */

function leerVolcado(datosComprimidos) {

    let texto;

    try {

        texto = zlib.gunzipSync(datosComprimidos).toString("utf8");

    } catch (error) {

        throw new Error("El respaldo está dañado: no se pudo descomprimir.");
    }

    let meta = null;
    let esquema = null;
    let cierre = null;

    const bloques = [];

    for (const linea of texto.split("\n")) {

        if (!linea) continue;

        const tipo = linea[0];
        const resto = linea.slice(2);

        if (tipo === "M") {
            meta = JSON.parse(resto);
        } else if (tipo === "E") {
            esquema = JSON.parse(resto);
        } else if (tipo === "D") {
            const tab = resto.indexOf("\t");
            bloques.push({
                tabla: JSON.parse(resto.slice(0, tab)),
                filas: resto.slice(tab + 1)
            });
        } else if (tipo === "F") {
            cierre = JSON.parse(resto);
        }
    }

    if (!meta || !esquema || !cierre) {
        throw new Error("El respaldo está incompleto (faltan secciones).");
    }

    if (meta.formato !== FORMATO) {
        throw new Error(`Formato de respaldo no soportado (${meta.formato}).`);
    }

    // el cierre debe coincidir con lo que realmente trae el archivo
    const real = {};

    for (const bloque of bloques) {
        real[bloque.tabla] = (real[bloque.tabla] || 0) + JSON.parse(bloque.filas).length;
    }

    for (const tabla of Object.keys(cierre.conteo)) {

        if ((real[tabla] || 0) !== cierre.conteo[tabla]) {
            throw new Error(`El respaldo está incompleto: la tabla ${tabla} no coincide.`);
        }
    }

    return { meta, esquema, bloques, conteo: cierre.conteo };
}


/* =====================================================
   RESTAURAR EN UNA BASE
===================================================== */

async function restaurarVolcado(pool, volcado, { reemplazarTodo = false } = {}) {

    const client = await pool.connect();

    try {

        const { rows: existentes } = await client.query(
            "SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'public'"
        );

        if (existentes[0].n > 0 && !reemplazarTodo) {

            throw new Error(
                `La base de destino ya tiene ${existentes[0].n} tablas. ` +
                "Usá una base vacía o agregá --reemplazar-todo (borra todo lo que hay)."
            );
        }

        await client.query("BEGIN");

        if (reemplazarTodo) {

            await client.query("DROP SCHEMA public CASCADE");
            await client.query("CREATE SCHEMA public");
        }

        for (const tabla of volcado.esquema.tablas) {
            await client.query(tabla.ddl);
        }

        for (const bloque of volcado.bloques) {

            await client.query(
                `INSERT INTO ${identificador(bloque.tabla)}
                 SELECT * FROM json_populate_recordset(null::${identificador(bloque.tabla)}, $1::json)`,
                [bloque.filas]
            );
        }

        for (const restriccion of volcado.esquema.restricciones) {
            await client.query(restriccion.sql);
        }

        for (const sql of volcado.esquema.indices) {
            await client.query(sql);
        }

        // las secuencias continúan después del último id restaurado
        for (const tabla of volcado.esquema.tablas) {

            for (const { columna } of tabla.secuencias) {

                await client.query(
                    `SELECT setval(
                        pg_get_serial_sequence($1, $2),
                        COALESCE((SELECT MAX(${identificador(columna)}) FROM ${identificador(tabla.nombre)}), 1),
                        (SELECT MAX(${identificador(columna)}) IS NOT NULL FROM ${identificador(tabla.nombre)})
                    )`,
                    [identificador(tabla.nombre), columna]
                );
            }
        }

        // verificación final: cada tabla debe tener exactamente las filas del respaldo
        const diferencias = [];

        for (const [tabla, esperado] of Object.entries(volcado.conteo)) {

            const { rows } = await client.query(
                `SELECT COUNT(*)::int AS n FROM ${identificador(tabla)}`
            );

            if (rows[0].n !== esperado) {
                diferencias.push(`${tabla}: ${rows[0].n} en vez de ${esperado}`);
            }
        }

        if (diferencias.length > 0) {
            throw new Error("La restauración no coincide con el respaldo: " + diferencias.join("; "));
        }

        await client.query("COMMIT");

        return volcado.conteo;

    } catch (error) {

        await client.query("ROLLBACK").catch(() => {});

        throw error;

    } finally {

        client.release();
    }
}


module.exports = { crearVolcado, leerVolcado, restaurarVolcado };
