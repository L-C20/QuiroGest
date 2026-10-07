/* =====================================================
   Cifrado de respaldos (AES-256-GCM)

   Formato del archivo .gtbak:
     "GTB1" (4 bytes) | iv (12) | etiqueta de autenticación (16) | datos cifrados

   GCM autentica el contenido: si el archivo se altera o se usa una
   clave equivocada, descifrar falla en lugar de devolver basura.
===================================================== */

const crypto = require("crypto");

const MAGIA = Buffer.from("GTB1");
const LARGO_IV = 12;
const LARGO_TAG = 16;


function generarClave() {

    return crypto.randomBytes(32).toString("base64");
}


/* Devuelve la clave de BACKUP_ENCRYPTION_KEY, o null si no está configurada. */
function obtenerClave() {

    const valor = process.env.BACKUP_ENCRYPTION_KEY;

    if (!valor) {
        return null;
    }

    const clave = Buffer.from(valor.trim(), "base64");

    if (clave.length !== 32) {
        throw new Error(
            "BACKUP_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64 " +
            "(generala con: node generarClaveRespaldo.js)"
        );
    }

    return clave;
}


function cifrar(datos, clave) {

    const iv = crypto.randomBytes(LARGO_IV);

    const cifrador = crypto.createCipheriv("aes-256-gcm", clave, iv);

    cifrador.setAAD(MAGIA);

    const cifrado = Buffer.concat([cifrador.update(datos), cifrador.final()]);

    return Buffer.concat([MAGIA, iv, cifrador.getAuthTag(), cifrado]);
}


function descifrar(archivo, clave) {

    if (
        archivo.length < MAGIA.length + LARGO_IV + LARGO_TAG ||
        !archivo.subarray(0, MAGIA.length).equals(MAGIA)
    ) {
        throw new Error("El archivo no es un respaldo válido de GestionTec Medical.");
    }

    const iv = archivo.subarray(MAGIA.length, MAGIA.length + LARGO_IV);
    const tag = archivo.subarray(MAGIA.length + LARGO_IV, MAGIA.length + LARGO_IV + LARGO_TAG);
    const cifrado = archivo.subarray(MAGIA.length + LARGO_IV + LARGO_TAG);

    try {

        const descifrador = crypto.createDecipheriv("aes-256-gcm", clave, iv);

        descifrador.setAAD(MAGIA);
        descifrador.setAuthTag(tag);

        return Buffer.concat([descifrador.update(cifrado), descifrador.final()]);

    } catch (error) {

        throw new Error(
            "No se pudo descifrar el respaldo: la clave es incorrecta o el archivo está dañado."
        );
    }
}


module.exports = { generarClave, obtenerClave, cifrar, descifrar };
