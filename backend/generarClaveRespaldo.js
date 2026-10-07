/*
 * Genera una clave de cifrado para los respaldos.
 *
 * Uso:   node generarClaveRespaldo.js
 *
 * Copiá el resultado en la variable BACKUP_ENCRYPTION_KEY de Railway y
 * guardalo TAMBIÉN en un lugar seguro fuera de Railway (gestor de
 * contraseñas). Sin esta clave, los respaldos no se pueden abrir.
 */

const { generarClave } = require("./src/services/respaldos/cifrado");

console.log(generarClave());
