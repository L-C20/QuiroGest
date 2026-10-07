/* =====================================================
   GESTIONTEC MEDICAL — Tarjeta de recordatorios (estado e historial)
===================================================== */

(function () {

    const tarjeta = document.getElementById("tarjetaRecordatorios");

    if (!tarjeta) {
        return;
    }

    const resumen = document.getElementById("recordatoriosResumen");
    const insignia = document.getElementById("recordatoriosInsignia");
    const canales = document.getElementById("recordatoriosCanales");
    const cuerpo = document.getElementById("tablaRecordatorios");

    const NOMBRE_CANAL = {
        email: "Correo",
        whatsapp: "WhatsApp",
        ninguno: "—"
    };

    const ESTADOS = {
        enviado: ["status-confirmed", "Enviado"],
        fallido: ["status-cancelled", "Falló"],
        enviando: ["status-pending", "Enviando"],
        sin_contacto: ["status-pending", "Sin datos de contacto"]
    };

    function escapar(texto) {

        return String(texto ?? "").replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[caracter]));
    }

    async function pedir(ruta) {

        const respuesta = await fetch(ruta, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });

        if (respuesta.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "login.html";
            throw new Error("Sesión vencida");
        }

        if (!respuesta.ok) {
            throw new Error("Error " + respuesta.status);
        }

        return respuesta.json();
    }

    function dibujarEstado(estado) {

        const hayCanal = estado.canales.email || estado.canales.whatsapp;

        insignia.hidden = false;

        if (estado.habilitado && hayCanal) {

            insignia.textContent = estado.simulacro ? "Simulacro" : "Activos";
            insignia.className = "recordatorio-insignia activa";
            resumen.textContent =
                `Se avisa a los pacientes ${estado.horasAntes} horas antes del turno.`;

        } else {

            insignia.textContent = "Desactivados";
            insignia.className = "recordatorio-insignia inactiva";
            resumen.textContent = estado.habilitado
                ? "Faltan las claves de un canal para poder enviar."
                : "Todavía no están activados. Se configuran en el servidor.";
        }

        canales.innerHTML = [
            ["email", "Correo"],
            ["whatsapp", "WhatsApp"]
        ].map(([clave, nombre]) =>
            `<span class="recordatorio-canal ${estado.canales[clave] ? "listo" : ""}">` +
            `<i></i>${nombre}: ${estado.canales[clave] ? "listo" : "sin configurar"}</span>`
        ).join("");
    }

    function dibujarHistorial(lista) {

        if (lista.length === 0) {
            return;
        }

        cuerpo.innerHTML = lista.map(r => {

            const [clase, texto] = ESTADOS[r.estado] || ["", escapar(r.estado)];

            const fecha = String(r.fecha).split("-").reverse().join("/");

            const cuando = r.enviado_en
                ? new Date(r.enviado_en).toLocaleString("es-AR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                })
                : "—";

            const titulo = r.error ? ` title="${escapar(r.error)}"` : "";

            return `
                <tr>
                    <td>${escapar(fecha)} ${escapar(r.hora)}</td>
                    <td>${escapar(r.apellido)}, ${escapar(r.nombre)}</td>
                    <td>${NOMBRE_CANAL[r.canal] || escapar(r.canal)}</td>
                    <td><span class="appointment-status ${clase}"${titulo}>${texto}</span></td>
                    <td>${cuando}</td>
                </tr>
            `;

        }).join("");
    }

    async function cargar() {

        try {

            dibujarEstado(await pedir("/recordatorios/estado"));

            const datos = await pedir("/recordatorios?limite=30");

            dibujarHistorial(datos.recordatorios || []);

        } catch (error) {

            resumen.textContent = "No se pudo cargar el estado de los recordatorios.";
        }
    }

    cargar();

})();
