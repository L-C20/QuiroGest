/* =====================================================
   Canal: correo electrónico (API de Resend)
   Variables: RESEND_API_KEY, EMAIL_FROM
   (para cambiar de proveedor solo hay que tocar este archivo)
===================================================== */

const {
    emailValido,
    escaparHtml,
    datosMensaje,
    textoRecordatorio
} = require("../utils");

const nombre = "email";

function configurado() {

    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function contacto(turno) {

    return emailValido(turno.email) ? turno.email.trim() : null;
}

async function enviar(turno, destino) {

    const d = datosMensaje(turno);

    const respuesta = await fetch("https://api.resend.com/emails", {

        method: "POST",

        headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [destino],
            subject: `Recordatorio de turno - ${d.fecha} ${d.hora}`,
            text: textoRecordatorio(turno),
            html: turno.recordatorio_texto
                ? `<p>${escaparHtml(textoRecordatorio(turno)).split("\n").join("<br>")}</p>`
                : `<p>Hola ${escaparHtml(d.nombre)},</p>` +
                `<p>Te recordamos tu turno en <strong>${escaparHtml(d.consultorio)}</strong> ` +
                `el <strong>${escaparHtml(d.fecha)}</strong> a las <strong>${escaparHtml(d.hora)}</strong>.</p>` +
                "<p>Si no podés asistir, avisanos para reprogramarlo.</p>"
        })
    });

    if (!respuesta.ok) {

        const detalle = await respuesta.text();

        throw new Error(`Email: ${respuesta.status} ${detalle.slice(0, 200)}`);
    }
}

module.exports = { nombre, configurado, contacto, enviar };
