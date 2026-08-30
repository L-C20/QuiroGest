const API_URL = "https://quirogest.onrender.com";

const tablaPacientes =
    document.getElementById("tablaPacientes");

const buscarPaciente =
    document.getElementById("buscarPaciente");

const filtroEstado =
    document.getElementById("filtroEstado");

let pacientes = [];


// =========================
// OBTENER PACIENTES
// =========================

async function cargarPacientes() {

    try {

        const token =
            localStorage.getItem("token");

        if (!token) {

            window.location.href =
                "login.html";

            return;
        }


        const respuesta =
            await fetch(
                `${API_URL}/pacientes`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!respuesta.ok) {

            if (respuesta.status === 401) {

                localStorage.removeItem("token");

                window.location.href =
                    "login.html";

                return;
            }

            throw new Error(
                "Error obteniendo pacientes"
            );
        }


        const datos =
            await respuesta.json();


        pacientes =
            datos.pacientes || datos;


        mostrarPacientes();


    } catch (error) {

        console.error(
            "Error cargando pacientes:",
            error
        );


        tablaPacientes.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="table-loading">

                        No se pudieron cargar
                        los pacientes.

                    </div>

                </td>

            </tr>

        `;

    }

}



// =========================
// MOSTRAR PACIENTES
// =========================

function mostrarPacientes() {

    const textoBusqueda =
        buscarPaciente.value
            .toLowerCase()
            .trim();


    const estado =
        filtroEstado.value;


    const pacientesFiltrados =
        pacientes.filter(paciente => {

            const nombreCompleto =
                `${paciente.nombre || ""} ${paciente.apellido || ""}`
                    .toLowerCase();


            const dni =
                String(
                    paciente.dni || ""
                ).toLowerCase();


            const coincideBusqueda =
                nombreCompleto.includes(
                    textoBusqueda
                )
                ||
                dni.includes(
                    textoBusqueda
                );


            const activo =
                paciente.activo !== false;


            const coincideEstado =

                estado === "todos"

                ||

                (
                    estado === "activos"
                    &&
                    activo
                )

                ||

                (
                    estado === "inactivos"
                    &&
                    !activo
                );


            return (
                coincideBusqueda
                &&
                coincideEstado
            );

        });


    renderizarTabla(
        pacientesFiltrados
    );

}



// =========================
// RENDERIZAR TABLA
// =========================

function renderizarTabla(lista) {

    if (lista.length === 0) {

        tablaPacientes.innerHTML = `

            <tr>

                <td colspan="6">

                    <div class="table-loading">

                        No se encontraron pacientes.

                    </div>

                </td>

            </tr>

        `;

        return;
    }


    tablaPacientes.innerHTML =
        lista.map(paciente => {

            const nombre =
                paciente.nombre || "";


            const apellido =
                paciente.apellido || "";


            const activo =
                paciente.activo !== false;


            // =========================
            // ACCIÓN DE ESTADO
            // =========================

            const accionEstado =
                activo

                ? `

                    <button
                        class="table-action"
                        title="Desactivar paciente"
                        onclick="desactivarPaciente(${paciente.id})"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >

                            <path
                                d="M12 3v9"
                            ></path>

                            <path
                                d="M6.2 6.2a8 8 0 1 0 11.6 0"
                            ></path>

                        </svg>

                    </button>

                `

                : `

                    <button
    class="table-action"
    title="Reactivar paciente"
    onclick="reactivarPaciente(${paciente.id})"
>

    <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
    >

        <path
            d="M21 12a9 9 0 1 1-2.64-6.36"
        ></path>

        <path
            d="M21 3v6h-6"
        ></path>

    </svg>

</button>

                `;


            return `

                <tr>

                    <td>

                        ${paciente.numero_identificacion ?? "-"}

                    </td>


                    <td>

                        <div class="patient-name">

                            <strong>
                                ${apellido}, ${nombre}
                            </strong>

                            <span>
                                ID interno: ${paciente.id}
                            </span>

                        </div>

                    </td>


                    <td>

                        ${paciente.dni || "-"}

                    </td>


                    <td>

                        ${paciente.telefono || "-"}

                    </td>


                    <td>

                        <span
                            class="status-badge
                            ${
                                activo
                                    ? "status-active"
                                    : "status-inactive"
                            }"
                        >

                            ${
                                activo
                                    ? "Activo"
                                    : "Inactivo"
                            }

                        </span>

                    </td>


                    <td>

                        <div class="table-actions">

                            <!-- VER -->

                            <button
                                class="table-action"
                                title="Ver paciente"
                                onclick="verPaciente(${paciente.id})"
                            >

                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >

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


                            <!-- EDITAR -->

                            <button
                                class="table-action"
                                title="Editar paciente"
                                onclick="editarPaciente(${paciente.id})"
                            >

                                <svg
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >

                                    <path
                                        d="M12 20h9"
                                    ></path>

                                    <path
                                        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"
                                    ></path>

                                </svg>

                            </button>


                            <!-- DESACTIVAR / REACTIVAR -->

                            ${accionEstado}

                        </div>

                    </td>

                </tr>

            `;

        }).join("");

}



// =========================
// BUSCAR
// =========================

buscarPaciente.addEventListener(
    "input",
    mostrarPacientes
);



// =========================
// FILTRAR ESTADO
// =========================

filtroEstado.addEventListener(
    "change",
    mostrarPacientes
);



// =========================
// MODAL FICHA
// =========================

const modalFichaPaciente =
    document.getElementById(
        "modalFichaPaciente"
    );


const btnCerrarFicha =
    document.getElementById(
        "btnCerrarFicha"
    );


const btnCerrarFichaFooter =
    document.getElementById(
        "btnCerrarFichaFooter"
    );



// =========================
// VER PACIENTE
// =========================

async function verPaciente(id) {

    const token =
        localStorage.getItem("token");


    if (!token) {

        window.location.href =
            "login.html";

        return;
    }


    try {

        const respuesta =
            await fetch(
                `${API_URL}/pacientes/${id}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.mensaje ||
                "No se pudo obtener el paciente"
            );

        }


        const paciente =
            datos.paciente || datos;


        const nombre =
            paciente.nombre || "";


        const apellido =
            paciente.apellido || "";


        const nombreCompleto =
            `${apellido}, ${nombre}`;


        const iniciales =
            `${nombre.charAt(0)}${apellido.charAt(0)}`
                .toUpperCase();


        const activo =
            paciente.activo !== false;


        document.getElementById(
            "fichaNombre"
        ).textContent =
            nombreCompleto;


        document.getElementById(
            "fichaIniciales"
        ).textContent =
            iniciales;


        document.getElementById(
            "fichaNumero"
        ).textContent =
            paciente.numero_identificacion
            ?? "-";


        document.getElementById(
            "fichaDni"
        ).textContent =
            paciente.dni
            || "-";


        document.getElementById(
            "fichaTelefono"
        ).textContent =
            paciente.telefono
            || "-";


        document.getElementById(
            "fichaEmail"
        ).textContent =
            paciente.email
            || "-";


        const fichaEstado =
            document.getElementById(
                "fichaEstado"
            );


        fichaEstado.textContent =
            activo
                ? "Activo"
                : "Inactivo";


        fichaEstado.className =
            `status-badge ${
                activo
                    ? "status-active"
                    : "status-inactive"
            }`;


        document.getElementById(
            "subtituloFichaPaciente"
        ).textContent =
            `Paciente #${
                paciente.numero_identificacion
                ?? paciente.id
            }`;


        modalFichaPaciente.hidden =
            false;

            // ========================= // CARGAR HISTORIAL DE PAGOS // =========================
            // 
            
        cargarHistorialPagos( paciente.id );


    } catch (error) {

        console.error(
            "Error obteniendo paciente:",
            error
        );


       mostrarNotificacion(
    "No se pudo obtener el paciente",
    error.message,
    "error"
);

    }

}



// =========================
// CERRAR FICHA
// =========================

btnCerrarFicha.addEventListener(
    "click",
    () => {

        modalFichaPaciente.hidden =
            true;

    }
);


btnCerrarFichaFooter.addEventListener(
    "click",
    () => {

        modalFichaPaciente.hidden =
            true;

    }
);


modalFichaPaciente.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            modalFichaPaciente
        ) {

            modalFichaPaciente.hidden =
                true;

        }

    }
);



// =========================
// MODAL EDITAR
// =========================

const modalEditarPaciente =
    document.getElementById(
        "modalEditarPaciente"
    );


const formEditarPaciente =
    document.getElementById(
        "formEditarPaciente"
    );


const btnCerrarEditar =
    document.getElementById(
        "btnCerrarEditar"
    );


const btnCancelarEditar =
    document.getElementById(
        "btnCancelarEditar"
    );



// =========================
// EDITAR PACIENTE
// =========================

async function editarPaciente(id) {

    const token =
        localStorage.getItem("token");


    if (!token) {

        window.location.href =
            "login.html";

        return;
    }


    try {

        const respuesta =
            await fetch(
                `${API_URL}/pacientes/${id}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.mensaje ||
                "No se pudo obtener el paciente"
            );

        }


        const paciente =
            datos.paciente || datos;


        document.getElementById(
            "editarNumeroIdentificacion"
        ).value =
            paciente.numero_identificacion
            ?? "";


        document.getElementById(
            "editarApellido"
        ).value =
            paciente.apellido
            || "";


        document.getElementById(
            "editarNombre"
        ).value =
            paciente.nombre
            || "";


        document.getElementById(
            "editarDni"
        ).value =
            paciente.dni
            || "";


        document.getElementById(
            "editarTelefono"
        ).value =
            paciente.telefono
            || "";


        document.getElementById(
            "editarEmail"
        ).value =
            paciente.email
            || "";


        formEditarPaciente.dataset.id =
            paciente.id;


        modalEditarPaciente.hidden =
            false;


    } catch (error) {

        console.error(
            "Error cargando paciente para editar:",
            error
        );


        mostrarNotificacion(
    "No se pudo cargar el paciente",
    error.message,
    "error"
);

    }

}



// =========================
// GUARDAR CAMBIOS
// =========================

formEditarPaciente.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const token =
            localStorage.getItem("token");


        const id =
            formEditarPaciente.dataset.id;


        if (!token) {

            window.location.href =
                "login.html";

            return;
        }


        if (!id) {
mostrarNotificacion(
    "Paciente no encontrado",
    "No se encontró el paciente que intentás modificar.",
    "warning"
);

            return;
        }


        const numero_identificacion =
            document
                .getElementById(
                    "editarNumeroIdentificacion"
                )
                .value
                .trim();


        const nombre =
            document
                .getElementById(
                    "editarNombre"
                )
                .value
                .trim();


        const apellido =
            document
                .getElementById(
                    "editarApellido"
                )
                .value
                .trim();


        const dni =
            document
                .getElementById(
                    "editarDni"
                )
                .value
                .trim();


        const telefono =
            document
                .getElementById(
                    "editarTelefono"
                )
                .value
                .trim();


        const email =
            document
                .getElementById(
                    "editarEmail"
                )
                .value
                .trim();


        try {

            const respuesta =
                await fetch(
                    `${API_URL}/pacientes/${id}`,
                    {
                        method: "PUT",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${token}`

                        },

                        body: JSON.stringify({

                            numero_identificacion,
                            nombre,
                            apellido,
                            dni,
                            telefono,
                            email

                        })

                    }
                );


            const datos =
                await respuesta.json();


            if (!respuesta.ok) {

                throw new Error(
                    datos.mensaje ||
                    "No se pudieron guardar los cambios"
                );

            }


            mostrarNotificacion(
    "Paciente actualizado",
    "Los datos del paciente fueron actualizados correctamente.",
    "success"
);


            modalEditarPaciente.hidden =
                true;


            await cargarPacientes();


        } catch (error) {

            console.error(
                "Error actualizando paciente:",
                error
            );


           mostrarNotificacion(
    "No se pudo actualizar el paciente",
    error.message,
    "error"
);

        }

    }
);



// =========================
// CERRAR MODAL EDITAR
// =========================

btnCerrarEditar.addEventListener(
    "click",
    () => {

        modalEditarPaciente.hidden =
            true;

    }
);


btnCancelarEditar.addEventListener(
    "click",
    () => {

        modalEditarPaciente.hidden =
            true;

    }
);


modalEditarPaciente.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            modalEditarPaciente
        ) {

            modalEditarPaciente.hidden =
                true;

        }

    }
);



// =========================
// MODAL NUEVO PACIENTE
// =========================

const modalPaciente =
    document.getElementById(
        "modalPaciente"
    );


const btnNuevoPaciente =
    document.getElementById(
        "btnNuevoPaciente"
    );


const btnCerrarModal =
    document.getElementById(
        "btnCerrarModal"
    );


const btnCancelarPaciente =
    document.getElementById(
        "btnCancelarPaciente"
    );


const formPaciente =
    document.getElementById(
        "formPaciente"
    );



// =========================
// ABRIR MODAL NUEVO
// =========================

btnNuevoPaciente.addEventListener(
    "click",
    () => {

        modalPaciente.hidden =
            false;

    }
);



// =========================
// CERRAR MODAL NUEVO
// =========================

btnCerrarModal.addEventListener(
    "click",
    () => {

        modalPaciente.hidden =
            true;

    }
);


btnCancelarPaciente.addEventListener(
    "click",
    () => {

        modalPaciente.hidden =
            true;

    }
);


modalPaciente.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            modalPaciente
        ) {

            modalPaciente.hidden =
                true;

        }

    }
);



// =========================
// CREAR PACIENTE
// =========================

formPaciente.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const token =
            localStorage.getItem("token");


        if (!token) {

            window.location.href =
                "login.html";

            return;
        }


        const numero_identificacion =
            document
                .getElementById(
                    "numeroIdentificacion"
                )
                .value
                .trim();


        const nombre =
            document
                .getElementById(
                    "nombre"
                )
                .value
                .trim();


        const apellido =
            document
                .getElementById(
                    "apellido"
                )
                .value
                .trim();


        const dni =
            document
                .getElementById(
                    "dni"
                )
                .value
                .trim();


        const telefono =
            document
                .getElementById(
                    "telefono"
                )
                .value
                .trim();


        const email =
            document
                .getElementById(
                    "email"
                )
                .value
                .trim();


        try {

            const respuesta =
                await fetch(
                    `${API_URL}/pacientes`,
                    {
                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${token}`

                        },

                        body: JSON.stringify({

                            numero_identificacion,
                            nombre,
                            apellido,
                            dni,
                            telefono,
                            email

                        })

                    }
                );


            const datos =
                await respuesta.json();


            if (!respuesta.ok) {

                throw new Error(
                    datos.mensaje ||
                    "No se pudo crear el paciente"
                );

            }




mostrarNotificacion(
    "Paciente creado",
    "El paciente fue registrado correctamente.",
    "success"
);






            formPaciente.reset();


            modalPaciente.hidden =
                true;


            await cargarPacientes();


        } catch (error) {

            console.error(
                "Error creando paciente:",
                error
            );



mostrarNotificacion(
    "No se pudo crear el paciente",
    error.message
);



        }

    }
);



// =========================
// INICIAR
// =========================

cargarPacientes();

// =========================
// DESACTIVAR PACIENTE
// =========================

async function desactivarPaciente(id) {

    confirmarAccion(
        "Desactivar paciente",
        "El paciente dejará de aparecer entre los pacientes activos, pero sus datos se conservarán.",
        async () => {

            const token =
                localStorage.getItem("token");


            if (!token) {

                window.location.href =
                    "login.html";

                return;

            }


            try {

                const respuesta =
                    await fetch(
                        `${API_URL}/pacientes/${id}`,
                        {
                            method: "DELETE",

                            headers: {
                                "Authorization":
                                    `Bearer ${token}`
                            }
                        }
                    );


                const datos =
                    await respuesta.json();


                if (!respuesta.ok) {

                    throw new Error(
                        datos.mensaje ||
                        "No se pudo desactivar el paciente"
                    );

                }


                mostrarNotificacion(
                    "Paciente desactivado",
                    "El paciente fue desactivado correctamente.",
                    "success"
                );


                await cargarPacientes();


            } catch (error) {

                console.error(
                    "Error desactivando paciente:",
                    error
                );


                mostrarNotificacion(
                    "No se pudo desactivar el paciente",
                    error.message,
                    "error"
                );

            }

        },
        "Desactivar"
    );

}

// =========================
// REACTIVAR PACIENTE
// =========================

async function reactivarPaciente(id) {

    confirmarAccion(
        "Reactivar paciente",
        "El paciente volverá a aparecer entre los pacientes activos.",
        async () => {

            const token =
                localStorage.getItem("token");


            if (!token) {

                window.location.href =
                    "login.html";

                return;

            }


            try {

                const respuesta =
                    await fetch(
                        `${API_URL}/pacientes/${id}/reactivar`,
                        {
                            method: "PATCH",

                            headers: {
                                "Authorization":
                                    `Bearer ${token}`
                            }
                        }
                    );


                const datos =
                    await respuesta.json();


                if (!respuesta.ok) {

                    throw new Error(
                        datos.mensaje ||
                        "No se pudo reactivar el paciente"
                    );

                }


                mostrarNotificacion(
                    "Paciente reactivado",
                    "El paciente volvió a estar activo correctamente.",
                    "success"
                );


                await cargarPacientes();


            } catch (error) {

                console.error(
                    "Error reactivando paciente:",
                    error
                );


                mostrarNotificacion(
                    "No se pudo reactivar el paciente",
                    error.message,
                    "error"
                );

            }

        },
        "Reactivar"
    );

}


// =========================
// HISTORIAL DE PAGOS
// =========================

async function cargarHistorialPagos(pacienteId) {

    const contenedor =
        document.getElementById(
            "historialPagosPaciente"
        );


    if (!contenedor) {

        return;

    }


    const token =
        localStorage.getItem("token");


    if (!token) {

        window.location.href =
            "login.html";

        return;

    }


    // Mostrar estado de carga

    contenedor.innerHTML = `

        <div class="historial-pagos-vacio">

            Cargando pagos...

        </div>

    `;


    try {

        const respuesta =
            await fetch(
                `${API_URL}/pagos/paciente/${pacienteId}`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.mensaje ||
                "No se pudo obtener el historial de pagos."
            );

        }


        const pagos =
            datos.pagos || [];


        // =========================
        // SIN PAGOS
        // =========================

        if (pagos.length === 0) {

            contenedor.innerHTML = `

                <div class="historial-pagos-vacio">

                    Este paciente todavía no tiene
                    pagos registrados.

                </div>

            `;

            return;

        }


        // =========================
        // MOSTRAR PAGOS
        // =========================

        contenedor.innerHTML =
            pagos.map(pago => {

                const fechaPago =
                    pago.fecha_pago
                        ? new Date(
                            pago.fecha_pago
                        ).toLocaleDateString(
                            "es-AR"
                        )
                        : "-";


                const fechaTurno =
                    pago.fecha_turno
                        ? new Date(
                            pago.fecha_turno
                        ).toLocaleDateString(
                            "es-AR"
                        )
                        : "-";


                const monto =
                    Number(
                        pago.monto
                    ).toLocaleString(
                        "es-AR",
                        {
                            style: "currency",
                            currency: "ARS"
                        }
                    );


                const metodo =
                    pago.metodo_pago
                        ? pago.metodo_pago
                            .replaceAll(
                                "_",
                                " "
                            )
                            .replace(
                                /^./,
                                letra =>
                                    letra.toUpperCase()
                            )
                        : "-";


                return `

                    <div class="historial-pago">


                        <div class="historial-pago-info">

                            <strong>
                                ${monto}
                            </strong>

                            <span>
                                ${metodo}
                            </span>

                        </div>


                        <div class="historial-pago-detalle">

                            <span>
                                Turno: ${fechaTurno}
                            </span>

                            <span>
                                Pago: ${fechaPago}
                            </span>

                        </div>


                    </div>

                `;

            }).join("");


    } catch (error) {

        console.error(
            "Error cargando historial de pagos:",
            error
        );


        contenedor.innerHTML = `

            <div class="historial-pagos-vacio">

                No se pudo cargar el historial
                de pagos.

            </div>

        `;

    }

}
