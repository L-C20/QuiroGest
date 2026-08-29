/* =====================================================
   QUIROGEST — PAGOS
===================================================== */

const API_URL = "http://localhost:3000";


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
   MOSTRAR PAGOS
===================================================== */

function mostrarPagos() {

    const filtroMetodo =
        filtroMetodoPago.value;

    const filtroPeriodoValor =
        filtroPeriodo.value;


    let pagosFiltrados =
        pagos;


    /* =============================================
       FILTRO POR MÉTODO
    ============================================= */

    if (filtroMetodo) {

        pagosFiltrados =
            pagosFiltrados.filter(
                pago =>
                    pago.metodo_pago ===
                    filtroMetodo
            );

    }


    /* =============================================
       FILTRO POR PERÍODO
    ============================================= */

    if (filtroPeriodoValor) {

        const hoy =
            new Date();

        pagosFiltrados =
            pagosFiltrados.filter(
                pago => {

                    if (!pago.fecha_pago) {
                        return false;
                    }


                    const fechaPago =
                        new Date(
                            pago.fecha_pago
                        );


                    if (
                        filtroPeriodoValor ===
                        "hoy"
                    ) {

                        return (
                            fechaPago.getDate() ===
                                hoy.getDate() &&

                            fechaPago.getMonth() ===
                                hoy.getMonth() &&

                            fechaPago.getFullYear() ===
                                hoy.getFullYear()
                        );

                    }


                    if (
                        filtroPeriodoValor ===
                        "semana"
                    ) {

                        const inicioSemana =
                            new Date(hoy);

                        const dia =
                            inicioSemana.getDay();

                        const diferencia =
                            dia === 0
                                ? 6
                                : dia - 1;


                        inicioSemana.setDate(
                            inicioSemana.getDate() -
                            diferencia
                        );


                        inicioSemana.setHours(
                            0,
                            0,
                            0,
                            0
                        );


                        const finSemana =
                            new Date(
                                inicioSemana
                            );

                        finSemana.setDate(
                            finSemana.getDate() +
                            7
                        );


                        return (
                            fechaPago >=
                                inicioSemana &&
                            fechaPago <
                                finSemana
                        );

                    }


                    if (
                        filtroPeriodoValor ===
                        "mes"
                    ) {

                        return (
                            fechaPago.getMonth() ===
                                hoy.getMonth() &&

                            fechaPago.getFullYear() ===
                                hoy.getFullYear()
                        );

                    }


                    return true;

                }
            );

    }


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

    const filtroMetodo =
        filtroMetodoPago.value;

    const filtroPeriodoValor =
        filtroPeriodo.value;


    let pagosFiltrados =
        pagos;


    /* =============================================
       FILTRO POR MÉTODO
    ============================================= */

    if (filtroMetodo) {

        pagosFiltrados =
            pagosFiltrados.filter(
                pago =>
                    pago.metodo_pago ===
                    filtroMetodo
            );

    }


    /* =============================================
       FILTRO POR PERÍODO
    ============================================= */

    if (filtroPeriodoValor) {

        const hoy =
            new Date();

        pagosFiltrados =
            pagosFiltrados.filter(
                pago => {

                    if (!pago.fecha_pago) {
                        return false;
                    }


                    const fechaPago =
                        new Date(
                            pago.fecha_pago
                        );


                    /* HOY */

                    if (
                        filtroPeriodoValor ===
                        "hoy"
                    ) {

                        return (
                            fechaPago.getDate() ===
                                hoy.getDate() &&

                            fechaPago.getMonth() ===
                                hoy.getMonth() &&

                            fechaPago.getFullYear() ===
                                hoy.getFullYear()
                        );

                    }


                    /* ESTA SEMANA */

                    if (
                        filtroPeriodoValor ===
                        "semana"
                    ) {

                        const inicioSemana =
                            new Date(hoy);

                        const dia =
                            inicioSemana.getDay();

                        const diferencia =
                            dia === 0
                                ? 6
                                : dia - 1;


                        inicioSemana.setDate(
                            inicioSemana.getDate() -
                            diferencia
                        );


                        inicioSemana.setHours(
                            0,
                            0,
                            0,
                            0
                        );


                        const finSemana =
                            new Date(
                                inicioSemana
                            );

                        finSemana.setDate(
                            finSemana.getDate() +
                            7
                        );


                        return (
                            fechaPago >=
                                inicioSemana &&
                            fechaPago <
                                finSemana
                        );

                    }


                    /* ESTE MES */

                    if (
                        filtroPeriodoValor ===
                        "mes"
                    ) {

                        return (
                            fechaPago.getMonth() ===
                                hoy.getMonth() &&

                            fechaPago.getFullYear() ===
                                hoy.getFullYear()
                        );

                    }


                    return true;

                }
            );

    }


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

if (filtroMetodoPago) {

    filtroMetodoPago.addEventListener(
        "change",
        function () {

            actualizarResumen();
            mostrarPagos();

        }
    );

}


if (filtroPeriodo) {

    filtroPeriodo.addEventListener(
        "change",
        function () {

            actualizarResumen();
            mostrarPagos();

        }
    );

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

