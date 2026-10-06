/* =====================================================
   Utilidades de recordatorios
===================================================== */

/**
 * Convierte un teléfono cargado a mano al formato internacional
 * que pide WhatsApp (solo dígitos, con código de país).
 * Devuelve null si no se puede interpretar.
 *
 * Pensado para Argentina (código 54, celulares con "9").
 * Cambiá DEFAULT_COUNTRY_CODE si el consultorio está en otro país.
 */
function normalizarTelefono(telefono, codigoPais = process.env.DEFAULT_COUNTRY_CODE || "54") {

    if (!telefono) {
        return null;
    }

    let digitos = String(telefono).replace(/\D/g, "");

    if (!digitos) {
        return null;
    }

    // prefijo internacional "00"
    if (digitos.startsWith("00")) {
        digitos = digitos.slice(2);
    }

    // ya viene con código de país
    if (digitos.startsWith(codigoPais) && digitos.length >= codigoPais.length + 10) {

        if (codigoPais === "54") {
            // 54 + 11 + 15 + numero  ->  54 9 11 numero
            const resto = digitos.slice(2).replace(/^9/, "");
            return "549" + quitar15(resto);
        }

        return digitos;
    }

    // número local
    digitos = digitos.replace(/^0/, "");

    if (codigoPais === "54") {

        digitos = quitar15(digitos);

        return digitos.length === 10 ? "549" + digitos : null;
    }

    return digitos.length >= 8 ? codigoPais + digitos : null;
}

/** Quita el "15" de los celulares argentinos (11 15 5555-0000 -> 11 5555-0000). */
function quitar15(numero) {

    if (numero.length === 10) {
        return numero;
    }

    if (numero.length === 12) {

        for (const largoArea of [2, 3, 4]) {

            if (numero.slice(largoArea, largoArea + 2) === "15") {
                return numero.slice(0, largoArea) + numero.slice(largoArea + 2);
            }
        }
    }

    return numero;
}

function emailValido(email) {

    return typeof email === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function escaparHtml(texto) {

    return String(texto ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[c]));
}

/** Datos que se insertan en los mensajes. */
function datosMensaje(turno) {

    return {
        nombre: turno.nombre,
        apellido: turno.apellido,
        fecha: turno.fecha_txt,
        hora: turno.hora_txt,
        consultorio: turno.consultorio || process.env.CONSULTORIO_NOMBRE || "el consultorio"
    };
}

function textoRecordatorio(turno) {

    const d = datosMensaje(turno);

    return process.env.REMINDER_TEXT
        ? process.env.REMINDER_TEXT
            .replace(/\{nombre\}/g, d.nombre)
            .replace(/\{fecha\}/g, d.fecha)
            .replace(/\{hora\}/g, d.hora)
            .replace(/\{consultorio\}/g, d.consultorio)
        : `Hola ${d.nombre}, te recordamos tu turno en ${d.consultorio} ` +
          `el ${d.fecha} a las ${d.hora}. ` +
          "Si no podés asistir, avisanos para reprogramarlo.";
}

module.exports = {
    normalizarTelefono,
    emailValido,
    escaparHtml,
    datosMensaje,
    textoRecordatorio
};
