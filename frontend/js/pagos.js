/* =====================================================
   QUIROGEST — PAGOS
===================================================== */

const API_URL = "";


/* =====================================================
   ELEMENTOS
===================================================== */

const tablaPagos =
    document.getElementById("tablaPagos");

const totalPagos =
    document.getElementById("totalPagos");

const totalCobrado =
    document.getElementById("totalCobrado");

const pagadoHoy =
    document.getElementById("pagadoHoy");

const filtroPeriodo =
    document.getElementById("filtroPeriodo");

const filtroMetodoPago =
    document.getElementById("filtroMetodoPago");

const filtroBusqueda =
    document.getElementById("filtroBusqueda");

const filtroDesde =
    document.getElementById("filtroDesde");

const filtroHasta =
    document.getElementById("filtroHasta");

const btnNuevoPago =
    document.getElementById("btnNuevoPago");

const modalNuevoPago =
    document.getElementById("modalNuevoPago");

const btnCerrarModalPago =
    document.getElementById("btnCerrarModalPago");

const btnCancelarPago =
    document.getElementById("btnCancelarPago");

const formNuevoPago =
    document.getElementById("formNuevoPago");

const pagoTurno =
    document.getElementById("pagoTurno");

const pagoMonto =
    document.getElementById("pagoMonto");

const pagoMetodo =
    document.getElementById("pagoMetodo");

const pagoObservaciones =
    document.getElementById("pagoObservaciones");


/* =====================================================
   VARIABLES
===================================================== */

let pagos = [];


/* =====================================================
   OBTENER TOKEN
===================================================== */

function obtenerToken() {

    const token =
        localStorage.getItem("token");


    if (!token) {

        throw new Error(
            "Sesión expirada."
        );

    }


    return token;

}


/* =====================================================
   FORMATEAR DINERO
===================================================== */

function formatearDinero(valor) {

    return new Intl.NumberFormat(
        "es-AR",
        {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 0
        }
    ).format(
        Number(valor) || 0
    );

}


/* =====================================================
   FORMATEAR FECHA
===================================================== */

function formatearFecha(fecha) {

    if (!fecha) {
        return "-";
    }


    const fechaObj =
        new Date(fecha);


    return fechaObj.toLocaleDateString(
        "es-AR"
    );

}


/* =====================================================
   FORMATEAR MÉTODO DE PAGO
===================================================== */

function formatearMetodoPago(metodo) {

    const metodos = {

        efectivo:
            "Efectivo",

        transferencia:
            "Transferencia",

        mercado_pago:
            "Mercado Pago",

        tarjeta:
            "Tarjeta",

        otro:
            "Otro"

    };


    return metodos[metodo] ||
        metodo ||
        "-";

}


/* =====================================================
   CARGAR PAGOS
===================================================== */

async function cargarPagos() {

    try {

        tablaPagos.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    Cargando pagos...
                </td>
            </tr>
        `;


        const token =
            obtenerToken();


        const respuesta =
            await fetch(
                `${API_URL}/pagos`,
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
                "No se pudieron cargar los pagos."
            );

        }


        pagos =
            datos.pagos || [];


        actualizarResumen();


        mostrarPagos();


    } catch (error) {

        console.error(
            "Error cargando pagos:",
            error
        );


        tablaPagos.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    No se pudieron cargar los pagos.
                </td>
            </tr>
        `;

    }

}


/* =====================================================
   FILTRAR PAGOS
   (búsqueda, método, período rápido y rango de fechas)
===================================================== */

function fechaLocalISO(fecha) {

    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");

    return `${anio}-${mes}-${dia}`;

}


function normalizarTexto(texto) {

    return String(texto || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();

}


function filtrarPagos() {

    const metodo = filtroMetodoPago.value;
    const periodo = filtroPeriodo.value;
    const busqueda = normalizarTexto(
        filtroBusqueda ? filtroBusqueda.value : ""
    );
    const desde = filtroDesde ? filtroDesde.value : "";
    const hasta = filtroHasta ? filtroHasta.value : "";

    const hoy = new Date();

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(
        inicioSemana.getDate() -
        (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1)
    );
    inicioSemana.setHours(0, 0, 0, 0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 7);

    return pagos.filter(pago => {

        if (metodo && pago.metodo_pago !== metodo) {
            return false;
        }

        if (busqueda) {

            const texto = normalizarTexto(
                `${pago.nombre} ${pago.apellido} ` +
                `${pago.apellido} ${pago.nombre} ` +
                `${pago.numero_identificacion}`
            );

            if (!texto.includes(busqueda)) {
                return false;
            }

        }

        const necesitaFecha = periodo || desde || hasta;

        if (!necesitaFecha) {
            return true;
        }

        if (!pago.fecha_pago) {
            return false;
        }

        const fechaPago = new Date(pago.fecha_pago);

        if (periodo === "hoy" &&
            fechaLocalISO(fechaPago) !== fechaLocalISO(hoy)) {
            return false;
        }

        if (periodo === "semana" &&
            !(fechaPago >= inicioSemana && fechaPago < finSemana)) {
            return false;
        }

        if (periodo === "mes" &&
            !(fechaPago.getMonth() === hoy.getMonth() &&
              fechaPago.getFullYear() === hoy.getFullYear())) {
            return false;
        }

        const fechaISO = fechaLocalISO(fechaPago);

        if (desde && fechaISO < desde) {
            return false;
        }

        if (hasta && fechaISO > hasta) {
            return false;
        }

        return true;

    });

}


function refrescarVista() {

    actualizarResumen();
    mostrarPagos();

    const cantidad = filtrarPagos().length;
    const aviso = document.getElementById("resultadosFiltro");

    if (aviso) {
        aviso.textContent =
            cantidad === pagos.length
                ? `${pagos.length} pagos`
                : `${cantidad} de ${pagos.length} pagos`;
    }

}


/* =====================================================
   MOSTRAR PAGOS
===================================================== */

function mostrarPagos() {

    const pagosFiltrados =
        filtrarPagos();


    /* =============================================
       SIN RESULTADOS
    ============================================= */

    if (pagosFiltrados.length === 0) {

        tablaPagos.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    style="
                        text-align:center;
                        padding:30px;
                    "
                >
                    No hay pagos que coincidan con los filtros.
                </td>
            </tr>
        `;

        return;

    }


    /* =============================================
       MOSTRAR PAGOS
    ============================================= */

    tablaPagos.innerHTML =
        pagosFiltrados.map(
            pago => {

                const paciente =
                    `${pago.apellido}, ${pago.nombre}`;


                const turno =
                    `${formatearFecha(pago.fecha_turno)}
                    ${pago.hora_turno || ""}`;


                return `

                    <tr>

                        <td>
                            ${formatearFecha(
                                pago.fecha_pago
                            )}
                        </td>


                        <td>

                            <strong>
                                ${paciente}
                            </strong>

                            <small>
                                #${pago.numero_identificacion}
                            </small>

                        </td>


                        <td>
                            ${turno}
                        </td>


                        <td>
                            ${formatearDinero(
                                pago.monto
                            )}
                        </td>


                        <td>
                            ${formatearMetodoPago(
                                pago.metodo_pago
                            )}
                        </td>


                        <td>

                            <span class="payment-status paid">
                                Pagado
                            </span>

                        </td>

                    </tr>

                `;

            }
        ).join("");

}


/* =====================================================
   ACTUALIZAR RESUMEN
===================================================== */

function actualizarResumen() {

    const pagosFiltrados =
        filtrarPagos();


    /* =============================================
       CANTIDAD DE PAGOS
    ============================================= */

    totalPagos.textContent =
        pagosFiltrados.length;


    /* =============================================
       TOTAL COBRADO
    ============================================= */

    const totalGeneral =
        pagosFiltrados.reduce(
            (
                acumulado,
                pago
            ) =>
                acumulado +
                Number(
                    pago.monto || 0
                ),
            0
        );


    totalCobrado.textContent =
formatearDinero(
totalGeneral
);

/* =============================================
COBRADO HOY
============================================= */

const hoy =
new Date();

const totalHoy =
pagos
.filter(
pago => {

            if (!pago.fecha_pago) {
                return false;
            }

            const fechaPago =
                new Date(
                    pago.fecha_pago
                );

            return (
                fechaPago.getDate() ===
                    hoy.getDate() &&

                fechaPago.getMonth() ===
                    hoy.getMonth() &&

                fechaPago.getFullYear() ===
                    hoy.getFullYear()
            );

        }
    )
    .reduce(
        (
            acumulado,
            pago
        ) =>
            acumulado +
            Number(
                pago.monto || 0
            ),
        0
    );

pagadoHoy.textContent =
formatearDinero(
totalHoy
);


}


/* =====================================================
   ABRIR MODAL
===================================================== */

function abrirModalPago() {

    if (!modalNuevoPago) {
        return;
    }


    modalNuevoPago.hidden =
        false;


    cargarTurnosDisponibles();

}


/* =====================================================
   CERRAR MODAL
===================================================== */

function cerrarModalPago() {

    if (!modalNuevoPago) {
        return;
    }


    modalNuevoPago.hidden =
        true;


    if (formNuevoPago) {

        formNuevoPago.reset();

    }

}


/* =====================================================
   CARGAR TURNOS DISPONIBLES
===================================================== */

async function cargarTurnosDisponibles() {

    try {

        if (!pagoTurno) {
            return;
        }


        pagoTurno.innerHTML = `
            <option value="">
                Cargando turnos...
            </option>
        `;


        const token =
            obtenerToken();


        const respuesta =
            await fetch(
                `${API_URL}/turnos`,
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
                "No se pudieron cargar los turnos."
            );

        }


        const turnos =
            datos.turnos || [];


        pagoTurno.innerHTML = `
            <option value="">
                Seleccionar turno
            </option>
        `;


        if (turnos.length === 0) {

            pagoTurno.innerHTML += `
                <option value="">
                    No hay turnos disponibles
                </option>
            `;

            return;

        }


        turnos.forEach(
            turno => {

                const opcion =
                    document.createElement(
                        "option"
                    );


                opcion.value =
                    turno.id;


                const paciente =
                    `${turno.apellido}, ${turno.nombre}`;


                opcion.textContent =
                    `${formatearFecha(
                        turno.fecha
                    )} — ${turno.hora} — ${paciente}`;


                pagoTurno.appendChild(
                    opcion
                );

            }
        );


    } catch (error) {

        console.error(
            "Error cargando turnos:",
            error
        );


        pagoTurno.innerHTML = `
            <option value="">
                Error al cargar turnos
            </option>
        `;

    }

}


/* =====================================================
   REGISTRAR PAGO
===================================================== */

async function registrarPago(datosPago) {

    try {

        const token =
            obtenerToken();


        const respuesta =
            await fetch(
                `${API_URL}/pagos`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify(
                            datosPago
                        )

                }
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.mensaje ||
                "No se pudo registrar el pago."
            );

        }


        return datos;


    } catch (error) {

        console.error(
            "Error registrando pago:",
            error
        );

        throw error;

    }

}


/* =====================================================
   SUBMIT DEL FORMULARIO
===================================================== */

if (formNuevoPago) {

    formNuevoPago.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const turno_id =
                pagoTurno.value;


            const monto =
                Number(
                    pagoMonto.value
                );


            const metodo_pago =
                pagoMetodo.value;


            const observaciones =
                pagoObservaciones.value
                    .trim();


            if (
                !turno_id ||
                !monto ||
                !metodo_pago
            ) {

                mostrarNotificacion(
    "Datos incompletos",
    "Completá todos los campos obligatorios.",
    "warning"
);

                return;

            }


            try {

                const boton =
                    formNuevoPago.querySelector(
                        'button[type="submit"]'
                    );


                if (boton) {

                    boton.disabled =
                        true;

                    boton.textContent =
                        "Registrando...";

                }


                await registrarPago({

                    turno_id:
                        Number(turno_id),

                    monto,

                    metodo_pago,

                    observaciones:
                        observaciones || null

                });


                mostrarNotificacion(
    "Pago registrado",
    "El pago fue registrado correctamente.",
    "success"
);


                cerrarModalPago();


                await cargarPagos();


            } catch (error) {

                mostrarNotificacion(
    "No se pudo registrar el pago",
    error.message ||
    "Ocurrió un error al registrar el pago.",
    "error"
);

            } finally {

                const boton =
                    formNuevoPago.querySelector(
                        'button[type="submit"]'
                    );


                if (boton) {

                    boton.disabled =
                        false;

                    boton.textContent =
                        "Registrar pago";

                }

            }

        }
    );

}


/* =====================================================
   EVENTOS
===================================================== */

if (btnNuevoPago) {

    btnNuevoPago.addEventListener(
        "click",
        abrirModalPago
    );

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

[filtroMetodoPago, filtroPeriodo, filtroDesde, filtroHasta]
    .forEach(control => {
        if (control) {
            control.addEventListener("change", refrescarVista);
        }
    });

if (filtroBusqueda) {
    filtroBusqueda.addEventListener("input", refrescarVista);
}

const btnLimpiarFiltros =
    document.getElementById("btnLimpiarFiltros");

if (btnLimpiarFiltros) {

    btnLimpiarFiltros.addEventListener("click", function () {

        filtroBusqueda.value = "";
        filtroMetodoPago.value = "";
        filtroPeriodo.value = "";
        filtroDesde.value = "";
        filtroHasta.value = "";

        refrescarVista();

    });

}




/* =====================================================
   CERRAR AL HACER CLICK FUERA
===================================================== */

if (modalNuevoPago) {

    modalNuevoPago.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                modalNuevoPago
            ) {

                cerrarModalPago();

            }

        }
    );

}


/* =====================================================
   INICIALIZAR
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        cargarPagos();

    }
);

