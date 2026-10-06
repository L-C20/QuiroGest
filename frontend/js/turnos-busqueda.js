/* =====================================================
   QUIROGEST — Búsqueda avanzada de turnos
   Texto + estado + rango de fechas (consulta al backend)
===================================================== */

(function () {

    const formulario = document.getElementById("formBusquedaTurnos");

    if (!formulario) {
        return;
    }

    const campoTexto = document.getElementById("busquedaTexto");
    const campoEstado = document.getElementById("busquedaEstado");
    const campoDesde = document.getElementById("busquedaDesde");
    const campoHasta = document.getElementById("busquedaHasta");
    const botonLimpiar = document.getElementById("btnLimpiarBusqueda");
    const aviso = document.getElementById("resultadosBusqueda");
    const contenedor = document.getElementById("contenedorBusqueda");
    const cuerpo = document.getElementById("tablaBusqueda");

    const ETIQUETAS = {
        pendiente: ["status-pending", "Pendiente"],
        confirmado: ["status-confirmed", "Confirmado"],
        atendido: ["status-attended", "Atendido"],
        cancelado: ["status-cancelled", "Cancelado"]
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

    function formatearFecha(valor) {

        const fecha = String(valor).slice(0, 10).split("-");

        return fecha.length === 3
            ? `${fecha[2]}/${fecha[1]}/${fecha[0]}`
            : valor;

    }

    function dibujar(turnos) {

        contenedor.hidden = false;

        if (turnos.length === 0) {

            cuerpo.innerHTML =
                "<tr><td colspan=\"6\" style=\"text-align:center;padding:30px;\">" +
                "No se encontraron turnos con esos filtros.</td></tr>";

            return;
        }

        cuerpo.innerHTML = turnos.map(turno => {

            const [clase, texto] =
                ETIQUETAS[turno.estado] || ["", escapar(turno.estado)];

            const pago = turno.pago_registrado
                ? "<span class=\"payment-paid\">Pago registrado</span>"
                : "<span class=\"payment-pending\">Sin pago</span>";

            return `
                <tr>
                    <td>${formatearFecha(turno.fecha)}</td>
                    <td>${escapar(String(turno.hora).slice(0, 5))}</td>
                    <td>${escapar(turno.apellido)}, ${escapar(turno.nombre)}</td>
                    <td>${escapar(turno.dni || "—")}</td>
                    <td><span class="appointment-status ${clase}">${texto}</span></td>
                    <td>${pago}</td>
                </tr>
            `;

        }).join("");

    }

    async function buscar(evento) {

        if (evento) {
            evento.preventDefault();
        }

        if (campoDesde.value && campoHasta.value &&
            campoDesde.value > campoHasta.value) {

            aviso.textContent = "La fecha Desde no puede ser posterior a Hasta.";
            return;
        }

        const parametros = new URLSearchParams();

        if (campoTexto.value.trim()) parametros.set("q", campoTexto.value.trim());
        if (campoEstado.value) parametros.set("estado", campoEstado.value);
        if (campoDesde.value) parametros.set("desde", campoDesde.value);
        if (campoHasta.value) parametros.set("hasta", campoHasta.value);

        if ([...parametros.keys()].length === 0) {

            aviso.textContent = "Indicá al menos un filtro para buscar.";
            contenedor.hidden = true;
            return;
        }

        aviso.textContent = "Buscando…";

        try {

            const respuesta = await fetch(`/turnos?${parametros}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });

            if (respuesta.status === 401) {
                localStorage.removeItem("token");
                window.location.href = "login.html";
                return;
            }

            if (!respuesta.ok) {
                throw new Error("Respuesta inválida");
            }

            const datos = await respuesta.json();
            const turnos = datos.turnos || [];

            dibujar(turnos);

            aviso.textContent = turnos.length >= 300
                ? "Mostrando los primeros 300 resultados. Afiná la búsqueda."
                : `${turnos.length} ${turnos.length === 1 ? "turno" : "turnos"}`;

        } catch (error) {

            contenedor.hidden = true;
            aviso.textContent = "No se pudo realizar la búsqueda.";

        }

    }

    formulario.addEventListener("submit", buscar);

    botonLimpiar.addEventListener("click", function () {

        formulario.reset();
        contenedor.hidden = true;
        cuerpo.innerHTML = "";
        aviso.textContent = "";

    });

})();
