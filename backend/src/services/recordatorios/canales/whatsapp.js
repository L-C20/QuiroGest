/* =====================================================
   Canal: WhatsApp (API oficial WhatsApp Business / Cloud API de Meta)

   Variables:
     WHATSAPP_TOKEN          token de acceso permanente
     WHATSAPP_PHONE_ID       ID del número de teléfono en Meta
     WHATSAPP_TEMPLATE_NAME  nombre de la plantilla aprobada
     WHATSAPP_TEMPLATE_LANG  idioma de la plantilla (por defecto es_AR)

   La plantilla debe tener 4 variables, en este orden:
     {{1}} nombre del paciente   {{2}} fecha   {{3}} hora   {{4}} consultorio
   Ejemplo de texto de plantilla (categoría "Utilidad"):
     "Hola {{1}}, te recordamos tu turno el {{2}} a las {{3}} en {{4}}.
      Si no podés asistir, respondé a este mensaje."
===================================================== */

const { normalizarTelefono, datosMensaje } = require("../utils");

const nombre = "whatsapp";

const VERSION_API = process.env.WHATSAPP_API_VERSION || "v21.0";

function configurado() {

    return Boolean(
        process.env.WHATSAPP_TOKEN &&
        process.env.WHATSAPP_PHONE_ID &&
        process.env.WHATSAPP_TEMPLATE_NAME
    );
}

function contacto(turno) {

    return normalizarTelefono(turno.telefono);
}

async function enviar(turno, destino) {

    const d = datosMensaje(turno);

    const respuesta = await fetch(
        `https://graph.facebook.com/${VERSION_API}/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
            method: "POST",

            headers: {
                "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: destino,
                type: "template",
                template: {
                    name: process.env.WHATSAPP_TEMPLATE_NAME,
                    language: {
                        code: process.env.WHATSAPP_TEMPLATE_LANG || "es_AR"
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                d.nombre,
                                d.fecha,
                                d.hora,
                                d.consultorio
                            ].map(texto => ({ type: "text", text: String(texto) }))
                        }
                    ]
                }
            })
        }
    );

    if (!respuesta.ok) {

        const detalle = await respuesta.text();

        throw new Error(`WhatsApp: ${respuesta.status} ${detalle.slice(0, 200)}`);
    }
}

module.exports = { nombre, configurado, contacto, enviar };
