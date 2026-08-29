
/* =====================================================
   QUIROGEST — TURNOS
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    /* =================================================
       ELEMENTOS
    ================================================= */

    const btnNuevoTurno =
        document.getElementById("btnNuevoTurno");

    const modalNuevoTurno =
        document.getElementById("modalNuevoTurno");

    const btnCerrarModal =
        document.getElementById("btnCerrarModalTurno");

    const btnCancelarTurno =
        document.getElementById("btnCancelarTurno");

    const formNuevoTurno =
        document.getElementById("formNuevoTurno");

    const turnoPaciente =
        document.getElementById("turnoPaciente");

    const turnoFecha =
        document.getElementById("turnoFecha");

    const turnoHora =
        document.getElementById("turnoHora");

    const turnoObservaciones =
        document.getElementById("turnoObservaciones");

    const tablaTurnos =
        document.getElementById("tablaTurnos");

    const btnDiaAnterior =
        document.getElementById("btnDiaAnterior");

    const btnDiaSiguiente =
        document.getElementById("btnDiaSiguiente");

    const fechaActual =
        document.getElementById("fechaActual");


    /* =================================================
       FECHA SELECCIONADA
    ================================================= */

    let fechaSeleccionada = new Date();


    /* =================================================
       UTILIDADES
    ================================================= */

    function obtenerToken() {

        return localStorage.getItem("token");

    }


    function formatoInputFecha(fecha) {

        const año =
            fecha.getFullYear();

        const mes =
            String(
                fecha.getMonth() + 1
            ).padStart(2, "0");

        const dia =
            String(
                fecha.getDate()
            ).padStart(2, "0");

        return `${año}-${mes}-${dia}`;

    }


    function formatearFecha(fecha) {

        const texto =
            fecha.toLocaleDateString(
                "es-AR",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );

        return (
            texto.charAt(0).toUpperCase() +
            texto.slice(1)
        );

    }


    function convertirFechaLocal(fecha) {

        const partes =
            String(fecha)
                .split("T")[0]
                .split("-");

        return new Date(
            Number(partes[0]),
            Number(partes[1]) - 1,
            Number(partes[2])
        );

    }
/* =================================================
   ACTUALIZAR FECHA DE LA AGENDA
================================================= */

function actualizarFecha() {

    if (!fechaActual) {
        return;
    }

    fechaActual.textContent =
        formatearFecha(
            fechaSeleccionada
        );

}
/* =================================================
   CAMBIAR FECHA DESDE EL CALENDARIO
================================================= */

window.cambiarFechaDesdeCalendario =
    async function (fecha) {

        fechaSeleccionada =
            new Date(fecha);


        actualizarFecha();


        await cargarTurnos();

    };


    /* =================================================
       MODAL NUEVO TURNO
    ================================================= */

    function cerrarModal() {

        if (!modalNuevoTurno) {
            return;
        }

        modalNuevoTurno.hidden = true;

        if (formNuevoTurno) {
            formNuevoTurno.reset();
        }

    }


    if (btnNuevoTurno) {

        btnNuevoTurno.addEventListener(
            "click",
            () => {

                modalNuevoTurno.hidden = false;

                turnoFecha.value =
                    formatoInputFecha(
                        fechaSeleccionada
                    );

                cargarPacientes();

            }
        );

    }


    if (btnCerrarModal) {
        btnCerrarModal.addEventListener(
            "click",
            cerrarModal
        );
    }


    if (btnCancelarTurno) {
        btnCancelarTurno.addEventListener(
            "click",
            cerrarModal
        );
    }


    if (modalNuevoTurno) {

        modalNuevoTurno.addEventListener(
            "click",
            (event) => {

                if (
                    event.target === modalNuevoTurno
                ) {

                    cerrarModal();

                }

            }
        );

    }


    /* =================================================
       CAMBIO DE FECHA
    ================================================= */

    if (btnDiaAnterior) {

        btnDiaAnterior.addEventListener(
            "click",
            () => {

                fechaSeleccionada.setDate(
                    fechaSeleccionada.getDate() - 1
                );

                actualizarFecha();
                cargarTurnos();

            }
        );

    }


    if (btnDiaSiguiente) {

        btnDiaSiguiente.addEventListener(
            "click",
            () => {

                fechaSeleccionada.setDate(
                    fechaSeleccionada.getDate() + 1
                );

                actualizarFecha();
                cargarTurnos();

            }
        );

    }


    /* =================================================
       CARGAR PACIENTES
    ================================================= */

    async function cargarPacientes() {

        if (!turnoPaciente) {
            return;
        }

        try {

            turnoPaciente.innerHTML = `
                <option value="">
                    Cargando pacientes...
                </option>
            `;

            const token =
                obtenerToken();

            const respuesta =
                await fetch(
                    "http://localhost:3000/pacientes",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            if (!respuesta.ok) {

                throw new Error(
                    "No se pudieron cargar los pacientes."
                );

            }


            const datos =
                await respuesta.json();


            turnoPaciente.innerHTML = `
                <option value="">
                    Seleccionar paciente
                </option>
            `;


            datos.pacientes
                .filter(
                    paciente =>
                        paciente.activo
                )
                .forEach(
                    paciente => {

                        const opcion =
                            document.createElement(
                                "option"
                            );

                        opcion.value =
                            paciente.id;

                        opcion.textContent =
                            `${paciente.apellido}, ${paciente.nombre} — #${paciente.numero_identificacion}`;

                        turnoPaciente.appendChild(
                            opcion
                        );

                    }
                );


        } catch (error) {

            console.error(
                "Error cargando pacientes:",
                error
            );

            turnoPaciente.innerHTML = `
                <option value="">
                    Error al cargar pacientes
                </option>
            `;

        }

    }


    /* =================================================
       CARGAR TURNOS
    ================================================= */

    async function cargarTurnos() {

        if (!tablaTurnos) {
            return;
        }

        try {

            const token =
                obtenerToken();

            const fecha =
                formatoInputFecha(
                    fechaSeleccionada
                );


            tablaTurnos.innerHTML = `
                <tr>
                    <td colspan="6"
                        style="text-align:center;padding:30px;">
                        Cargando turnos...
                    </td>
                </tr>
            `;


            const respuesta =
                await fetch(
                    `http://localhost:3000/turnos?fecha=${fecha}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            if (!respuesta.ok) {

                throw new Error(
                    "No se pudieron cargar los turnos."
                );

            }


            const datos =
                await respuesta.json();


            if (
                !datos.turnos ||
                datos.turnos.length === 0
            ) {

                tablaTurnos.innerHTML = `
                    <tr>
                        <td colspan="6"
                            style="text-align:center;padding:30px;">
                            No hay turnos para este día.
                        </td>
                    </tr>
                `;

                actualizarResumen([]);

                return;

            }


            tablaTurnos.innerHTML = "";


            datos.turnos.forEach(
                turno => {

                    const fila =
                        document.createElement("tr");


                    /* ==============================
                       ESTADO
                    ============================== */

                    const estados = {

                        pendiente: {
                            texto: "Pendiente",
                            clase: "status-pending"
                        },

                        confirmado: {
                            texto: "Confirmado",
                            clase: "status-confirmed"
                        },

                        atendido: {
                            texto: "Atendido",
                            clase: "status-attended"
                        },

                        cancelado: {
                            texto: "Cancelado",
                            clase: "status-cancelled"
                        }

                    };


                    const estado =
                        estados[turno.estado] ||
                        estados.pendiente;


                    const hora =
                        turno.hora
                            ? turno.hora.substring(0, 5)
                            : "-";


                    const identificacion =
                        turno.numero_identificacion ||
                        "-";


                    fila.innerHTML = `

                        <td>
                            ${hora}
                        </td>

                        <td>

                            <div class="appointment-patient">

                                <strong>
                                    ${turno.apellido || ""},
                                    ${turno.nombre || ""}
                                </strong>

                                <span>
                                    Paciente #${identificacion}
                                </span>

                            </div>

                        </td>

                        <td>
                            ${turno.dni || "-"}
                        </td>

                        <td>

                            <div class="estado-turno-container">

                                <button
                                    type="button"
                                    class="appointment-status ${estado.clase} btn-estado-turno"
                                    data-turno-id="${turno.id}"
                                    data-estado="${turno.estado}"
                                >

                                    ${estado.texto}

                                    <span class="estado-flecha">
                                        ▾
                                    </span>

                                </button>


                                <div
                                    class="estado-menu"
                                    data-turno-id="${turno.id}"
                                >

                                    <button
                                        type="button"
                                        class="estado-opcion status-pending"
                                        data-estado="pendiente"
                                    >
                                        Pendiente
                                    </button>

                                    <button
                                        type="button"
                                        class="estado-opcion status-confirmed"
                                        data-estado="confirmado"
                                    >
                                        Confirmado
                                    </button>

                                    <button
                                        type="button"
                                        class="estado-opcion status-attended"
                                        data-estado="atendido"
                                    >
                                        Atendido
                                    </button>

                                    <button
                                        type="button"
                                        class="estado-opcion status-cancelled"
                                        data-estado="cancelado"
                                    >
                                        Cancelado
                                    </button>

                                </div>

                            </div>

                        </td>

                        <td>

                            <button
                                type="button"
                                class="appointment-payment ${
                                    turno.pago_registrado
                                        ? "payment-paid btn-pago-registrado"
                                        : "payment-pending btn-registrar-pago"
                                }"
                                data-turno-id="${turno.id}"
                            >

                                ${
                                    turno.pago_registrado
                                        ? "Pago registrado"
                                        : "Registrar pago"
                                }

                            </button>

                        </td>

                        <td>

                            <div class="table-actions">

                                <button
                                    class="table-action btn-ver-turno"
                                    title="Ver turno"
                                    type="button"
                                    data-turno-id="${turno.id}"
                                >

                                    <svg viewBox="0 0 24 24">

                                        <path
                                            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                                        ></path>

                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="2.5"
                                        ></circle>

                                    </svg>

                                </button>


                                <button
                                    class="table-action btn-editar-turno"
                                    title="Editar turno"
                                    type="button"
                                    data-turno-id="${turno.id}"
                                >

                                    <svg viewBox="0 0 24 24">

                                        <path
                                            d="M12 20h9"
                                        ></path>

                                        <path
                                            d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"
                                        ></path>

                                    </svg>

                                </button>

                            </div>

                        </td>

                    `;


                    tablaTurnos.appendChild(
                        fila
                    );

                }
            );


            actualizarResumen(
                datos.turnos
            );


        } catch (error) {

            console.error(
                "Error cargando turnos:",
                error
            );

            tablaTurnos.innerHTML = `
                <tr>
                    <td colspan="6"
                        style="text-align:center;padding:30px;">
                        Error al cargar los turnos.
                    </td>
                </tr>
            `;

        }

    }


    /* =================================================
       RESUMEN
    ================================================= */

    function actualizarResumen(turnos) {

        const tarjetas =
            document.querySelectorAll(
                ".summary-card strong"
            );


        if (tarjetas.length < 4) {
            return;
        }


        tarjetas[0].textContent =
            turnos.length;


        tarjetas[1].textContent =
            turnos.filter(
                turno =>
                    turno.estado === "confirmado"
            ).length;


        tarjetas[2].textContent =
            turnos.filter(
                turno =>
                    turno.estado === "pendiente"
            ).length;


        tarjetas[3].textContent =
            turnos.filter(
                turno =>
                    turno.estado === "atendido"
            ).length;

    }


    /* =================================================
       CREAR TURNO
    ================================================= */

    if (formNuevoTurno) {

        formNuevoTurno.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                const paciente =
                    turnoPaciente.value;

                const fecha =
                    turnoFecha.value;

                const hora =
                    turnoHora.value;

                const observaciones =
                    turnoObservaciones.value;


                if (
                    !paciente ||
                    !fecha ||
                    !hora
                ) {

                    mostrarNotificacion(
                        "Datos incompletos",
                        "Completá los campos obligatorios.",
                        "warning"
                    );

                    return;

                }


                const token =
                    obtenerToken();


                if (!token) {

                    mostrarNotificacion(
                        "Sesión expirada",
                        "Volvé a iniciar sesión.",
                        "warning"
                    );

                    return;

                }


                try {

                    const respuesta =
                        await fetch(
                            "http://localhost:3000/turnos",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    Authorization:
                                        `Bearer ${token}`
                                },

                                body:
                                    JSON.stringify({
                                        paciente_id:
                                            paciente,

                                        fecha:
                                            fecha,

                                        hora:
                                            hora,

                                        observaciones:
                                            observaciones
                                    })
                            }
                        );


                    const datos =
                        await respuesta.json();


                    if (!respuesta.ok) {

                        mostrarNotificacion(
                            "No se pudo crear el turno",
                            datos.mensaje ||
                            "Ocurrió un error.",
                            "error"
                        );

                        return;

                    }


                    mostrarNotificacion(
                        "Turno creado",
                        "El turno se creó correctamente.",
                        "success"
                    );


                    cerrarModal();


                    fechaSeleccionada =
                        convertirFechaLocal(
                            fecha
                        );


                    actualizarFecha();

                    await cargarTurnos();


                } catch (error) {

                    console.error(
                        "Error creando turno:",
                        error
                    );

                    mostrarNotificacion(
                        "Error de conexión",
                        "No se pudo conectar con el servidor.",
                        "error"
                    );

                }

            }
        );

    }


    /* =================================================
       MODAL VER TURNO
    ================================================= */

    const modalVerTurno =
        document.getElementById("modalVerTurno");

    const btnCerrarModalVerTurno =
        document.getElementById(
            "btnCerrarModalVerTurno"
        );

    const btnCerrarVerTurno =
        document.getElementById(
            "btnCerrarVerTurno"
        );


    function cerrarModalVerTurno() {

        if (modalVerTurno) {
            modalVerTurno.hidden = true;
        }

    }


    if (btnCerrarModalVerTurno) {
        btnCerrarModalVerTurno.addEventListener(
            "click",
            cerrarModalVerTurno
        );
    }


    if (btnCerrarVerTurno) {
        btnCerrarVerTurno.addEventListener(
            "click",
            cerrarModalVerTurno
        );
    }


    if (modalVerTurno) {

        modalVerTurno.addEventListener(
            "click",
            (event) => {

                if (
                    event.target === modalVerTurno
                ) {

                    cerrarModalVerTurno();

                }

            }
        );

    }


    /* =================================================
       VER TURNO
    ================================================= */

    if (tablaTurnos) {

        tablaTurnos.addEventListener(
            "click",
            async (event) => {

                const boton =
                    event.target.closest(
                        ".btn-ver-turno"
                    );


                if (!boton) {
                    return;
                }


                const turnoId =
                    boton.dataset.turnoId;

                const token =
                    obtenerToken();


                try {

                    const respuesta =
                        await fetch(
                            `http://localhost:3000/turnos/${turnoId}`,
                            {
                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                            }
                        );


                    if (!respuesta.ok) {

                        throw new Error(
                            "No se pudo obtener el turno."
                        );

                    }


                    const datos =
                        await respuesta.json();

                    const turno =
                        datos.turno;


                    document.getElementById(
                        "verTurnoPaciente"
                    ).textContent =
                        `${turno.apellido}, ${turno.nombre}`;


                    document.getElementById(
                        "verTurnoIdentificacion"
                    ).textContent =
                        turno.numero_identificacion ||
                        "-";


                    document.getElementById(
                        "verTurnoDni"
                    ).textContent =
                        turno.dni ||
                        "-";


                    document.getElementById(
                        "verTurnoFecha"
                    ).textContent =
                        formatearFecha(
                            convertirFechaLocal(
                                turno.fecha
                            )
                        );


                    document.getElementById(
                        "verTurnoHora"
                    ).textContent =
                        turno.hora
                            ? turno.hora.substring(0, 5)
                            : "-";


                    const nombresEstados = {

                        pendiente: "Pendiente",
                        confirmado: "Confirmado",
                        atendido: "Atendido",
                        cancelado: "Cancelado"

                    };


                    document.getElementById(
                        "verTurnoEstado"
                    ).textContent =
                        nombresEstados[
                            turno.estado
                        ] ||
                        "Pendiente";


                    document.getElementById(
                        "verTurnoObservaciones"
                    ).textContent =
                        turno.observaciones ||
                        "Sin observaciones";


                    if (modalVerTurno) {
                        modalVerTurno.hidden = false;
                    }


                } catch (error) {

                    console.error(
                        "Error obteniendo turno:",
                        error
                    );

                    mostrarNotificacion(
                        "Error",
                        "No se pudo cargar la información del turno.",
                        "error"
                    );

                }

            }
        );

    }


    /* =================================================
       EDITAR TURNO
    ================================================= */

    const modalEditarTurno =
        document.getElementById("modalEditarTurno");

    const btnCerrarModalEditarTurno =
        document.getElementById(
            "btnCerrarModalEditarTurno"
        );

    const btnCancelarEditarTurno =
        document.getElementById(
            "btnCancelarEditarTurno"
        );

    const formEditarTurno =
        document.getElementById("formEditarTurno");

    const editarTurnoPaciente =
        document.getElementById("editarTurnoPaciente");

    const editarTurnoFecha =
        document.getElementById("editarTurnoFecha");

    const editarTurnoHora =
        document.getElementById("editarTurnoHora");

    const editarTurnoEstado =
        document.getElementById("editarTurnoEstado");

    const editarTurnoObservaciones =
        document.getElementById(
            "editarTurnoObservaciones"
        );


    let turnoEditandoId = null;


    function cerrarModalEditarTurno() {

        if (!modalEditarTurno) {
            return;
        }

        modalEditarTurno.hidden = true;

        turnoEditandoId = null;

    }


    if (btnCerrarModalEditarTurno) {
        btnCerrarModalEditarTurno.addEventListener(
            "click",
            cerrarModalEditarTurno
        );
    }


    if (btnCancelarEditarTurno) {
        btnCancelarEditarTurno.addEventListener(
            "click",
            cerrarModalEditarTurno
        );
    }


    if (modalEditarTurno) {

        modalEditarTurno.addEventListener(
            "click",
            (event) => {

                if (
                    event.target === modalEditarTurno
                ) {

                    cerrarModalEditarTurno();

                }

            }
        );

    }


    if (tablaTurnos) {

        tablaTurnos.addEventListener(
            "click",
            async (event) => {

                const boton =
                    event.target.closest(
                        ".btn-editar-turno"
                    );


                if (!boton) {
                    return;
                }


                const turnoId =
                    boton.dataset.turnoId;


                turnoEditandoId =
                    turnoId;


                const token =
                    obtenerToken();


                try {

                    const respuesta =
                        await fetch(
                            `http://localhost:3000/turnos/${turnoId}`,
                            {
                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                            }
                        );


                    if (!respuesta.ok) {

                        throw new Error(
                            "No se pudo obtener el turno."
                        );

                    }


                    const datos =
                        await respuesta.json();

                    const turno =
                        datos.turno;


                    editarTurnoPaciente.innerHTML = `
                        <option value="${turno.paciente_id}">
                            ${turno.apellido}, ${turno.nombre}
                            — #${turno.numero_identificacion}
                        </option>
                    `;


                    editarTurnoFecha.value =
                        String(turno.fecha)
                            .split("T")[0];


                    editarTurnoHora.value =
                        turno.hora
                            ? turno.hora.substring(0, 5)
                            : "";


                    editarTurnoEstado.value =
                        turno.estado;


                    editarTurnoObservaciones.value =
                        turno.observaciones || "";


                    modalEditarTurno.hidden =
                        false;


                } catch (error) {

                    console.error(
                        "Error cargando turno para editar:",
                        error
                    );

                    mostrarNotificacion(
                        "Error",
                        "No se pudo cargar el turno.",
                        "error"
                    );

                }

            }
        );

    }


    /* =================================================
       GUARDAR EDICIÓN
    ================================================= */

    if (formEditarTurno) {

        formEditarTurno.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                if (!turnoEditandoId) {

                    mostrarNotificacion(
                        "Error",
                        "No se encontró el turno.",
                        "error"
                    );

                    return;

                }


                const fecha =
                    editarTurnoFecha.value;

                const hora =
                    editarTurnoHora.value;

                const estado =
                    editarTurnoEstado.value;

                const observaciones =
                    editarTurnoObservaciones.value;


                if (
                    !fecha ||
                    !hora ||
                    !estado
                ) {

                    mostrarNotificacion(
                        "Datos incompletos",
                        "Completá los campos obligatorios.",
                        "warning"
                    );

                    return;

                }


                const token =
                    obtenerToken();


                if (!token) {

                    mostrarNotificacion(
                        "Sesión expirada",
                        "Volvé a iniciar sesión.",
                        "warning"
                    );

                    return;

                }


                try {

                    const respuesta =
                        await fetch(
                            `http://localhost:3000/turnos/${turnoEditandoId}`,
                            {
                                method: "PUT",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    Authorization:
                                        `Bearer ${token}`
                                },

                                body:
                                    JSON.stringify({
                                        fecha,
                                        hora,
                                        estado,
                                        observaciones
                                    })
                            }
                        );


                    const datos =
                        await respuesta.json();


                    if (!respuesta.ok) {

                        mostrarNotificacion(
                            "No se pudo actualizar",
                            datos.mensaje ||
                            "No se pudo actualizar el turno.",
                            "error"
                        );

                        return;

                    }


                    mostrarNotificacion(
                        "Turno actualizado",
                        "Los cambios se guardaron correctamente.",
                        "success"
                    );


                    cerrarModalEditarTurno();


                    fechaSeleccionada =
                        convertirFechaLocal(
                            fecha
                        );


                    actualizarFecha();

                    await cargarTurnos();


                } catch (error) {

                    console.error(
                        "Error actualizando turno:",
                        error
                    );

                    mostrarNotificacion(
                        "Error de conexión",
                        "No se pudo conectar con el servidor.",
                        "error"
                    );

                }

            }
        );

    }


    /* =================================================
       MENÚ DE ESTADOS
    ================================================= */

    const nombresEstados = {

        pendiente: "Pendiente",
        confirmado: "Confirmado",
        atendido: "Atendido",
        cancelado: "Cancelado"

    };


    if (tablaTurnos) {

        tablaTurnos.addEventListener(
            "click",
            (event) => {

                /* ==========================================
                   ABRIR / CERRAR MENÚ
                ========================================== */

                const boton =
                    event.target.closest(
                        ".btn-estado-turno"
                    );


                if (boton) {

                    const contenedor =
                        boton.closest(
                            ".estado-turno-container"
                        );


                    if (!contenedor) {
                        return;
                    }


                    const menu =
                        contenedor.querySelector(
                            ".estado-menu"
                        );


                    if (!menu) {
                        return;
                    }


                    document
                        .querySelectorAll(
                            ".estado-turno-container.menu-abierto"
                        )
                        .forEach(
                            otro => {

                                if (
                                    otro !== contenedor
                                ) {

                                    otro.classList.remove(
                                        "menu-abierto"
                                    );

                                }

                            }
                        );


                    if (
                        contenedor.classList.contains(
                            "menu-abierto"
                        )
                    ) {

                        contenedor.classList.remove(
                            "menu-abierto"
                        );

                        return;

                    }


                    const rect =
                        boton.getBoundingClientRect();


                    contenedor.classList.add(
                        "menu-abierto"
                    );


                    const menuRect =
                        menu.getBoundingClientRect();


                    let top =
                        rect.bottom + 7;

                    let left =
                        rect.left;


                    if (
                        top + menuRect.height >
                        window.innerHeight - 10
                    ) {

                        top =
                            rect.top -
                            menuRect.height -
                            7;

                    }


                    if (
                        left + menuRect.width >
                        window.innerWidth - 10
                    ) {

                        left =
                            window.innerWidth -
                            menuRect.width -
                            10;

                    }


                    if (left < 10) {
                        left = 10;
                    }


                    menu.style.top =
                        `${top}px`;

                    menu.style.left =
                        `${left}px`;


                    return;

                }


                /* ==========================================
                   SELECCIONAR ESTADO
                ========================================== */

                const opcion =
                    event.target.closest(
                        ".estado-opcion"
                    );


                if (!opcion) {
                    return;
                }


                const contenedor =
                    opcion.closest(
                        ".estado-turno-container"
                    );


                if (!contenedor) {
                    return;
                }


                const botonEstado =
                    contenedor.querySelector(
                        ".btn-estado-turno"
                    );


                if (!botonEstado) {
                    return;
                }


                const turnoId =
                    botonEstado.dataset.turnoId;


                const nuevoEstado =
                    opcion.dataset.estado;


                const estadoActual =
                    botonEstado.dataset.estado;


                /* ==========================================
                   MISMO ESTADO
                ========================================== */

                if (
                    nuevoEstado === estadoActual
                ) {

                    contenedor.classList.remove(
                        "menu-abierto"
                    );

                    return;

                }


                /* ==========================================
                   CERRAR MENÚ
                ========================================== */

                contenedor.classList.remove(
                    "menu-abierto"
                );


                /* ==========================================
                   CONFIRMACIÓN
                   
                   IMPORTANTE:
                   ACÁ NO SE HACE NINGÚN CAMBIO.
                   
                   El PATCH está DENTRO de accionConfirmar.
                ========================================== */

                confirmarAccion(
                    "Cambiar estado del turno",

                    `¿Querés cambiar el estado a "${nombresEstados[nuevoEstado]}"?`,

                    async () => {

                        const token =
                            obtenerToken();


                        if (!token) {

                            mostrarNotificacion(
                                "Sesión expirada",
                                "Volvé a iniciar sesión.",
                                "warning"
                            );

                            return;

                        }


                        try {

                            const respuesta =
                                await fetch(
                                    `http://localhost:3000/turnos/${turnoId}/estado`,
                                    {
                                        method: "PATCH",

                                        headers: {
                                            "Content-Type":
                                                "application/json",

                                            Authorization:
                                                `Bearer ${token}`
                                        },

                                        body:
                                            JSON.stringify({
                                                estado:
                                                    nuevoEstado
                                            })
                                    }
                                );


                            const datos =
                                await respuesta.json();


                            if (!respuesta.ok) {

                                mostrarNotificacion(
                                    "No se pudo actualizar",
                                    datos.mensaje ||
                                    "No se pudo actualizar el estado.",
                                    "error"
                                );

                                return;

                            }


                            mostrarNotificacion(
                                "Estado actualizado",
                                `El turno ahora está "${nombresEstados[nuevoEstado]}".`,
                                "success"
                            );


                            await cargarTurnos();


                        } catch (error) {

                            console.error(
                                "Error cambiando estado:",
                                error
                            );


                            mostrarNotificacion(
                                "Error de conexión",
                                "No se pudo conectar con el servidor.",
                                "error"
                            );

                        }

                    },

                    "Cambiar estado"
                );

            }
        );

    }


    /* =================================================
       CERRAR MENÚ DE ESTADOS AL HACER CLICK AFUERA
    ================================================= */

    document.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest(
                    ".estado-turno-container"
                )
            ) {
                return;
            }


            document
                .querySelectorAll(
                    ".estado-turno-container.menu-abierto"
                )
                .forEach(
                    contenedor => {

                        contenedor.classList.remove(
                            "menu-abierto"
                        );

                    }
                );

        }
    );


    /* =================================================
       MODAL DETALLE DEL PAGO
    ================================================= */

    const modalDetallePago =
        document.getElementById(
            "modalDetallePago"
        );

    const btnCerrarModalDetallePago =
        document.getElementById(
            "btnCerrarModalDetallePago"
        );

    const btnCerrarDetallePago =
        document.getElementById(
            "btnCerrarDetallePago"
        );

    const detallePagoPaciente =
        document.getElementById(
            "detallePagoPaciente"
        );

    const detallePagoIdentificacion =
        document.getElementById(
            "detallePagoIdentificacion"
        );

    const detallePagoMonto =
        document.getElementById(
            "detallePagoMonto"
        );

    const detallePagoMetodo =
        document.getElementById(
            "detallePagoMetodo"
        );

    const detallePagoFecha =
        document.getElementById(
            "detallePagoFecha"
        );

    const detallePagoObservaciones =
        document.getElementById(
            "detallePagoObservaciones"
        );


    function cerrarModalDetallePago() {

        if (modalDetallePago) {
            modalDetallePago.hidden = true;
        }

    }


    if (btnCerrarModalDetallePago) {
        btnCerrarModalDetallePago.addEventListener(
            "click",
            cerrarModalDetallePago
        );
    }


    if (btnCerrarDetallePago) {
        btnCerrarDetallePago.addEventListener(
            "click",
            cerrarModalDetallePago
        );
    }


    if (modalDetallePago) {

        modalDetallePago.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    modalDetallePago
                ) {

                    cerrarModalDetallePago();

                }

            }
        );

    }


    /* =================================================
       MOSTRAR DETALLE DE PAGO
    ================================================= */

    async function mostrarDetallePago(
        turnoId
    ) {

        const token =
            obtenerToken();


        if (!token) {

            mostrarNotificacion(
                "Sesión expirada",
                "Volvé a iniciar sesión.",
                "warning"
            );

            return;

        }


        try {

            const respuesta =
                await fetch(
                    `http://localhost:3000/pagos/turno/${turnoId}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            const datos =
                await respuesta.json();


            if (!respuesta.ok) {

                throw new Error(
                    datos.mensaje ||
                    "No se pudo obtener el pago."
                );

            }


            const pago =
                datos.pago;


            detallePagoPaciente.value =
                `${pago.apellido}, ${pago.nombre}`;


            detallePagoIdentificacion.value =
                pago.numero_identificacion ||
                "-";


            detallePagoMonto.value =
                `$ ${Number(
                    pago.monto
                ).toLocaleString("es-AR")}`;


            detallePagoMetodo.value =
                pago.metodo_pago ||
                "-";


            if (pago.fecha_pago) {

                const fechaPago =
                    new Date(
                        pago.fecha_pago
                    );


                detallePagoFecha.value =
                    fechaPago.toLocaleString(
                        "es-AR",
                        {
                            dateStyle: "short",
                            timeStyle: "short"
                        }
                    );

            } else {

                detallePagoFecha.value =
                    "-";

            }


            detallePagoObservaciones.value =
                pago.observaciones ||
                "Sin observaciones";


            modalDetallePago.hidden =
                false;


        } catch (error) {

            console.error(
                "Error obteniendo detalle del pago:",
                error
            );


            mostrarNotificacion(
                "Error",
                error.message ||
                "No se pudo cargar el detalle del pago.",
                "error"
            );

        }

    }


    /* =================================================
       MODAL REGISTRAR PAGO
    ================================================= */

    const modalRegistrarPago =
        document.getElementById(
            "modalRegistrarPago"
        );

    const btnCerrarModalPago =
        document.getElementById(
            "btnCerrarModalPago"
        );

    const btnCancelarPago =
        document.getElementById(
            "btnCancelarPago"
        );

    const formRegistrarPago =
        document.getElementById(
            "formRegistrarPago"
        );

    const pagoPaciente =
        document.getElementById(
            "pagoPaciente"
        );

    const pagoFecha =
        document.getElementById(
            "pagoFecha"
        );

    const pagoHora =
        document.getElementById(
            "pagoHora"
        );

    const pagoMonto =
        document.getElementById(
            "pagoMonto"
        );

    const pagoMetodo =
        document.getElementById(
            "pagoMetodo"
        );

    const pagoObservaciones =
        document.getElementById(
            "pagoObservaciones"
        );


    let turnoPagoId = null;


    function cerrarModalPago() {

        if (!modalRegistrarPago) {
            return;
        }

        modalRegistrarPago.hidden = true;

        turnoPagoId = null;

        if (formRegistrarPago) {
            formRegistrarPago.reset();
        }

    }


    if (btnCerrarModalPago) {
        btnCerrarModalPago.addEventListener(
            "click",
            cerrarModalPago
        );
    }


    if (btnCancelarPago) {
        btnCancelarPago.addEventListener(
            "click",
            cerrarModalPago
        );
    }


    if (modalRegistrarPago) {

        modalRegistrarPago.addEventListener(
            "click",
            (event) => {

                if (
                    event.target ===
                    modalRegistrarPago
                ) {

                    cerrarModalPago();

                }

            }
        );

    }


    /* =================================================
       ABRIR PAGO / DETALLE
    ================================================= */

    if (tablaTurnos) {

        tablaTurnos.addEventListener(
            "click",
            async (event) => {

                const boton =
                    event.target.closest(
                        ".btn-registrar-pago, .btn-pago-registrado"
                    );


                if (!boton) {
                    return;
                }


                const turnoId =
                    boton.dataset.turnoId;


                /* ==============================
                   PAGO YA REGISTRADO
                ============================== */

                if (
                    boton.classList.contains(
                        "btn-pago-registrado"
                    )
                ) {

                    await mostrarDetallePago(
                        turnoId
                    );

                    return;

                }


                /* ==============================
                   REGISTRAR NUEVO PAGO
                ============================== */

                turnoPagoId =
                    turnoId;


                const token =
                    obtenerToken();


                if (!token) {

                    mostrarNotificacion(
                        "Sesión expirada",
                        "Volvé a iniciar sesión.",
                        "warning"
                    );

                    return;

                }


                try {

                    const respuesta =
                        await fetch(
                            `http://localhost:3000/turnos/${turnoId}`,
                            {
                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                            }
                        );


                    if (!respuesta.ok) {

                        throw new Error(
                            "No se pudo obtener el turno."
                        );

                    }


                    const datos =
                        await respuesta.json();

                    const turno =
                        datos.turno;


                    pagoPaciente.value =
                        `${turno.apellido}, ${turno.nombre}`;


                    pagoFecha.value =
                        formatearFecha(
                            convertirFechaLocal(
                                turno.fecha
                            )
                        );


                    pagoHora.value =
                        turno.hora
                            ? turno.hora.substring(0, 5)
                            : "-";


                    pagoMonto.value = "";
                    pagoMetodo.value = "";
                    pagoObservaciones.value = "";


                    modalRegistrarPago.hidden =
                        false;


                    if (pagoMonto) {
                        pagoMonto.focus();
                    }


                } catch (error) {

                    console.error(
                        "Error cargando turno para pago:",
                        error
                    );


                    mostrarNotificacion(
                        "Error",
                        "No se pudo cargar la información del turno.",
                        "error"
                    );

                }

            }
        );

    }


    /* =================================================
       GUARDAR PAGO
    ================================================= */

    if (formRegistrarPago) {

        formRegistrarPago.addEventListener(
            "submit",
            async (event) => {

                event.preventDefault();


                if (!turnoPagoId) {

                    mostrarNotificacion(
                        "Error",
                        "No se encontró el turno.",
                        "error"
                    );

                    return;

                }


                const monto =
                    pagoMonto.value;

                const metodoPago =
                    pagoMetodo.value;

                const observaciones =
                    pagoObservaciones.value;


                if (
                    !monto ||
                    !metodoPago
                ) {

                    mostrarNotificacion(
                        "Datos incompletos",
                        "Completá el monto y el método de pago.",
                        "warning"
                    );

                    return;

                }


                const token =
                    obtenerToken();


                if (!token) {

                    mostrarNotificacion(
                        "Sesión expirada",
                        "Volvé a iniciar sesión.",
                        "warning"
                    );

                    return;

                }


                try {

                    const respuesta =
                        await fetch(
                            "http://localhost:3000/pagos",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",

                                    Authorization:
                                        `Bearer ${token}`
                                },

                                body:
                                    JSON.stringify({
                                        turno_id:
                                            turnoPagoId,

                                        monto:
                                            monto,

                                        metodo_pago:
                                            metodoPago,

                                        observaciones:
                                            observaciones
                                    })
                            }
                        );


                    const datos =
                        await respuesta.json();


                    if (!respuesta.ok) {

                        mostrarNotificacion(
                            "No se pudo registrar",
                            datos.mensaje ||
                            "No se pudo registrar el pago.",
                            "error"
                        );

                        return;

                    }


                    mostrarNotificacion(
                        "Pago registrado",
                        "El pago se registró correctamente.",
                        "success"
                    );


                    cerrarModalPago();


                    await cargarTurnos();


                } catch (error) {

                    console.error(
                        "Error registrando pago:",
                        error
                    );


                    mostrarNotificacion(
                        "Error de conexión",
                        "No se pudo conectar con el servidor.",
                        "error"
                    );

                }

            }
        );

    }


    /* =================================================
       ESC GLOBAL
    ================================================= */

    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key !== "Escape"
            ) {
                return;
            }


            if (
                modalNuevoTurno &&
                !modalNuevoTurno.hidden
            ) {

                cerrarModal();

            }


            if (
                modalVerTurno &&
                !modalVerTurno.hidden
            ) {

                cerrarModalVerTurno();

            }


            if (
                modalEditarTurno &&
                !modalEditarTurno.hidden
            ) {

                cerrarModalEditarTurno();

            }


            if (
                modalDetallePago &&
                !modalDetallePago.hidden
            ) {

                cerrarModalDetallePago();

            }


            if (
                modalRegistrarPago &&
                !modalRegistrarPago.hidden
            ) {

                cerrarModalPago();

            }

        }
    );


    /* =================================================
       INICIAR AGENDA
    ================================================= */

    actualizarFecha();

    cargarTurnos();
/* =====================================================
   QUIROGEST — CALENDARIO MENSUAL
===================================================== */


/* =====================================================
   ELEMENTOS
===================================================== */

const calendarioGrid =
    document.getElementById("calendarioGrid");

const calendarioMesActual =
    document.getElementById("calendarioMesActual");

const btnMesAnterior =
    document.getElementById("btnMesAnterior");

const btnMesSiguiente =
    document.getElementById("btnMesSiguiente");

const btnCalendarioHoy =
    document.getElementById("btnCalendarioHoy");


/* =====================================================
   FECHA DEL CALENDARIO
===================================================== */

let fechaCalendario =
    new Date();


/* =====================================================
   TURNOS DEL MES
===================================================== */

let turnosCalendario = [];


/* =====================================================
   NOMBRES DE LOS MESES
===================================================== */

const nombresMeses = [

    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"

];


/* =====================================================
   MISMO DÍA
===================================================== */

function esMismoDiaCalendario(
    fechaA,
    fechaB
) {

    return (

        fechaA.getFullYear() ===
        fechaB.getFullYear()

        &&

        fechaA.getMonth() ===
        fechaB.getMonth()

        &&

        fechaA.getDate() ===
        fechaB.getDate()

    );

}


/* =====================================================
   OBTENER TURNOS DEL DÍA
===================================================== */

function obtenerTurnosDelDia(
    fecha
) {

    return turnosCalendario.filter(
        turno => {

            if (!turno.fecha) {
                return false;
            }

            const fechaTurno =
                convertirFechaLocal(
                    turno.fecha
                );

            return esMismoDiaCalendario(
                fechaTurno,
                fecha
            );

        }
    );

}


/* =====================================================
   CARGAR TURNOS DEL MES
===================================================== */

async function cargarTurnosCalendario() {

    const token =
        obtenerToken();


    if (!token) {
        return;
    }


    try {

        turnosCalendario = [];


        const año =
            fechaCalendario.getFullYear();

        const mes =
            fechaCalendario.getMonth();


        const cantidadDias =
            new Date(
                año,
                mes + 1,
                0
            ).getDate();


        const consultas = [];


        for (
            let dia = 1;
            dia <= cantidadDias;
            dia++
        ) {

            const fecha =
                formatoInputFecha(
                    new Date(
                        año,
                        mes,
                        dia
                    )
                );


            consultas.push(

                fetch(
                    `http://localhost:3000/turnos?fecha=${fecha}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                )
                .then(
                    respuesta => {

                        if (!respuesta.ok) {
                            return {
                                turnos: []
                            };
                        }

                        return respuesta.json();

                    }
                )
                .catch(
                    error => {

                        console.error(
                            `Error cargando turnos del ${fecha}:`,
                            error
                        );

                        return {
                            turnos: []
                        };

                    }
                )

            );

        }


        const resultados =
            await Promise.all(
                consultas
            );


        resultados.forEach(
            datos => {
console.log("TURNOS DEL CALENDARIO:", datos.turnos);
                if (
                    datos.turnos &&
                    Array.isArray(
                        datos.turnos
                    )
                ) {

                    turnosCalendario.push(
                        ...datos.turnos
                    );

                }

            }
        );
        


        renderizarCalendario();


    } catch (error) {

        console.error(
            "Error cargando turnos del calendario:",
            error
        );

    }

}


/* =====================================================
   RENDERIZAR CALENDARIO
===================================================== */

function renderizarCalendario() {

    if (!calendarioGrid) {
        return;
    }


    const año =
        fechaCalendario.getFullYear();

    const mes =
        fechaCalendario.getMonth();


    /* =============================================
       NOMBRE DEL MES
    ============================================= */

    if (calendarioMesActual) {

        calendarioMesActual.textContent =
            `${nombresMeses[mes]} ${año}`;

    }


    /* =============================================
       LIMPIAR
    ============================================= */

    calendarioGrid.innerHTML = "";


    /* =============================================
       PRIMER DÍA DEL MES
    ============================================= */

    const primerDia =
        new Date(
            año,
            mes,
            1
        );


    let diaSemana =
        primerDia.getDay();


    if (diaSemana === 0) {
        diaSemana = 7;
    }


    /* =============================================
       DÍAS DEL MES ANTERIOR
    ============================================= */

    const diasMesAnterior =
        new Date(
            año,
            mes,
            0
        ).getDate();


    for (
        let i = diaSemana - 1;
        i > 0;
        i--
    ) {

        const fecha =
            new Date(
                año,
                mes - 1,
                diasMesAnterior - i + 1
            );


        crearDiaCalendario(
            fecha,
            true
        );

    }


    /* =============================================
       DÍAS DEL MES ACTUAL
    ============================================= */

    const cantidadDias =
        new Date(
            año,
            mes + 1,
            0
        ).getDate();


    for (
        let dia = 1;
        dia <= cantidadDias;
        dia++
    ) {

        const fecha =
            new Date(
                año,
                mes,
                dia
            );


        crearDiaCalendario(
            fecha,
            false
        );

    }


    /* =============================================
       COMPLETAR ÚLTIMA SEMANA
    ============================================= */

    const cantidadCeldas =
        calendarioGrid.children.length;


    const diasRestantes =
        cantidadCeldas % 7 === 0
            ? 0
            : 7 -
              (
                  cantidadCeldas % 7
              );


    for (
        let dia = 1;
        dia <= diasRestantes;
        dia++
    ) {

        const fecha =
            new Date(
                año,
                mes + 1,
                dia
            );


        crearDiaCalendario(
            fecha,
            true
        );

    }

}


/* =====================================================
   CREAR DÍA
===================================================== */

function crearDiaCalendario(
    fecha,
    esOtroMes
) {

    const elemento =
        document.createElement("div");


    elemento.className =
        "calendar-day";


    if (esOtroMes) {

        elemento.classList.add(
            "other-month"
        );

    }


    /* =============================================
       HOY
    ============================================= */

    const hoy =
        new Date();


    if (
        esMismoDiaCalendario(
            fecha,
            hoy
        )
    ) {

        elemento.classList.add(
            "today"
        );

    }


    /* =============================================
       FECHA SELECCIONADA
    ============================================= */

    if (
        esMismoDiaCalendario(
            fecha,
            fechaSeleccionada
        )
    ) {

        elemento.classList.add(
            "selected"
        );

    }


    /* =============================================
       TURNOS DEL DÍA
    ============================================= */

    const turnosDelDia =
        obtenerTurnosDelDia(
            fecha
        );
        
function obtenerTurnosDelDia(fecha) {

    const fechaBuscada =
        formatoInputFecha(fecha);

    return turnosCalendario.filter(turno => {

        if (!turno.fecha) {
            return false;
        }

        const fechaTurno =
            String(turno.fecha)
                .split("T")[0];

        return fechaTurno === fechaBuscada;

    });

}

    /* =============================================
       CONTENIDO
    ============================================= */

    let contenidoTurnos = "";


    if (
        turnosDelDia.length > 0
    ) {

        const cantidad =
            turnosDelDia.length;


        contenidoTurnos = `

            <span class="calendar-day-appointments">

                ${cantidad}
                ${
                    cantidad === 1
                        ? "turno"
                        : "turnos"
                }

            </span>

        `;

    }


    elemento.innerHTML = `

        <span class="calendar-day-number">
            ${fecha.getDate()}
        </span>

        ${contenidoTurnos}

    `;


    /* =============================================
       CLICK
    ============================================= */

    elemento.addEventListener(
        "click",
        () => {

            seleccionarFechaCalendario(
                fecha
            );

        }
    );


    calendarioGrid.appendChild(
        elemento
    );

}


/* =====================================================
   SELECCIONAR FECHA
===================================================== */

function seleccionarFechaCalendario(
    fecha
) {

    fechaSeleccionada =
        new Date(fecha);


    fechaCalendario =
        new Date(fecha);


    actualizarFecha();


    cargarTurnos();


    renderizarCalendario();

}


/* =====================================================
   MES ANTERIOR
===================================================== */

if (btnMesAnterior) {

    btnMesAnterior.addEventListener(
        "click",
        async () => {

            fechaCalendario.setMonth(
                fechaCalendario.getMonth() - 1
            );


            turnosCalendario = [];


            renderizarCalendario();


            await cargarTurnosCalendario();

        }
    );

}


/* =====================================================
   MES SIGUIENTE
===================================================== */

if (btnMesSiguiente) {

    btnMesSiguiente.addEventListener(
        "click",
        async () => {

            fechaCalendario.setMonth(
                fechaCalendario.getMonth() + 1
            );


            turnosCalendario = [];


            renderizarCalendario();


            await cargarTurnosCalendario();

        }
    );

}


/* =====================================================
   BOTÓN HOY
===================================================== */

if (btnCalendarioHoy) {

    btnCalendarioHoy.addEventListener(
        "click",
        async () => {

            const hoy =
                new Date();


            fechaSeleccionada =
                new Date(hoy);


            fechaCalendario =
                new Date(hoy);


            actualizarFecha();


            cargarTurnos();


            turnosCalendario = [];


            renderizarCalendario();


            await cargarTurnosCalendario();

        }
    );

}


/* =====================================================
   INICIAR CALENDARIO
===================================================== */

renderizarCalendario();

cargarTurnosCalendario();


});
