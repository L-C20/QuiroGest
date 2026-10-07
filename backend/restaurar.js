/*
 * Restaura (o verifica) un respaldo de GestionTec Medical.
 *
 * Variables de entorno:
 *   BACKUP_ENCRYPTION_KEY   la clave con la que se creó el respaldo
 *   DATABASE_URL            base de DESTINO donde se restaura
 *   DB_SSL=false            si la base de destino no usa SSL (por ejemplo, local)
 *   BACKUP_S3_*             solo si el respaldo se lee del almacenamiento externo
 *
 * Uso:
 *   node restaurar.js --listar                      lista los respaldos del almacenamiento externo
 *   node restaurar.js archivo.gtbak --verificar     comprueba el archivo sin tocar ninguna base
 *   node restaurar.js archivo.gtbak                 restaura en una base VACÍA
 *   node restaurar.js --s3 gestiontec/gestiontec-20261007-030000.gtbak
 *   node restaurar.js archivo.gtbak --reemplazar-todo   borra TODO lo que haya en el destino
 */

require("dotenv").config();

const fs = require("fs");

const cifrado = require("./src/services/respaldos/cifrado");
const volcado = require("./src/services/respaldos/volcado");
const almacenamiento = require("./src/services/respaldos/almacenamiento");


function ayuda() {

    console.log(
        "Uso:\n" +
        "  node restaurar.js --listar\n" +
        "  node restaurar.js <archivo.gtbak> [--verificar] [--reemplazar-todo]\n" +
        "  node restaurar.js --s3 <clave-en-el-bucket> [--verificar] [--reemplazar-todo]"
    );
}


async function principal() {

    const args = process.argv.slice(2);

    const bandera = nombre => args.includes(nombre);

    if (args.length === 0 || bandera("--ayuda")) {
        ayuda();
        return;
    }

    if (bandera("--listar")) {

        if (!almacenamiento.configurado()) {
            throw new Error("Falta configurar el almacenamiento externo (BACKUP_S3_*).");
        }

        const items = await almacenamiento.crearProveedorS3().listar(almacenamiento.prefijo());

        items
            .sort((a, b) => a.clave.localeCompare(b.clave))
            .forEach(i => console.log(`${i.clave}  ${(i.bytes / 1024).toFixed(1)} KB`));

        console.log(`${items.length} respaldos.`);
        return;
    }

    const clave = cifrado.obtenerClave();

    if (!clave) {
        throw new Error("Falta BACKUP_ENCRYPTION_KEY.");
    }

    let archivo;

    const indiceS3 = args.indexOf("--s3");

    if (indiceS3 >= 0) {

        if (!almacenamiento.configurado()) {
            throw new Error("Falta configurar el almacenamiento externo (BACKUP_S3_*).");
        }

        archivo = await almacenamiento.crearProveedorS3().descargar(args[indiceS3 + 1]);

    } else {

        const ruta = args.find(a => !a.startsWith("--"));

        if (!ruta || !fs.existsSync(ruta)) {
            throw new Error("No se encontró el archivo de respaldo.");
        }

        archivo = fs.readFileSync(ruta);
    }

    console.log("Descifrando y validando el respaldo…");

    const datos = volcado.leerVolcado(cifrado.descifrar(archivo, clave));

    console.log(`Respaldo del ${datos.meta.creado} (servidor PostgreSQL ${datos.meta.servidor}).`);

    for (const [tabla, filas] of Object.entries(datos.conteo)) {
        console.log(`  ${tabla}: ${filas} filas`);
    }

    if (datos.meta.advertencias.length > 0) {
        console.log("Advertencias:", datos.meta.advertencias.join("; "));
    }

    if (bandera("--verificar")) {
        console.log("El respaldo es válido. No se modificó ninguna base.");
        return;
    }

    const pool = require("./src/database/connection");

    try {

        console.log("Restaurando…");

        await volcado.restaurarVolcado(pool, datos, {
            reemplazarTodo: bandera("--reemplazar-todo")
        });

        console.log("Restauración completa. Cada tabla coincide con el respaldo.");

    } finally {

        await pool.end();
    }
}


principal().catch(error => {

    console.error("ERROR:", error.message);
    process.exitCode = 1;
});
