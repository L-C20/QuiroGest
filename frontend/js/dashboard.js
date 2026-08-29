
/* =====================================================
   QUIROGEST — DASHBOARD
===================================================== */

const API_URL = "http://localhost:3000";


/* =====================================================
   ELEMENTOS
===================================================== */

const tarjetasDashboard =
    document.querySelectorAll(
        ".stats-grid .stat-card strong"
    );


const contenedorProximosTurnos =
    document.querySelector(
        "#seccionProximosTurnos .empty-state"
    );


const filtroProximosTurnos =
    document.querySelector(
        "#filtroProximosTurnos"
    );


/* =====================================================
   TURNOS CARGADOS
===================================================== */

let turnosEncontradosGlobal = [];


/* =====================================================
   FECHA ACTUAL
===================================================== */

function obtenerFechaHoy() {

    const hoy =
        new Date();


    const año =
        hoy.getFullYear();


    const mes =
        String(
            hoy.getMonth() + 1
        ).padStart(2, "0");


    const dia =
        String(
            hoy.getDate()
        ).padStart(2, "0");


    return `${año}-${mes}-${dia}`;

}


/* =====================================================
   CLASE DEL ESTADO
===================================================== */

function obtenerClaseEstado(estado) {

    const clases = {

        pendiente:
            "status-pending",

        confirmado:
            "status-confirmed",

        atendido:
            "status-attended",

        cancelado:
            "status-cancelled"

    };


    return (
        clases[
            String(
                estado || "pendiente"
            ).toLowerCase()
        ]
        ||
        "status-pending"
    );

}


/* =====================================================
   NOMBRE DEL ESTADO
===================================================== */

function obtenerNombreEstado(estado) {

    const nombres = {

        pendiente:
            "Pendiente",

        confirmado:
            "Confirmado",

        atendido:
            "Atendido",

        cancelado:
            "Cancelado"

    };


    return (
        nombres[
            String(
                estado || "pendiente"
            ).toLowerCase()
        ]
        ||
        "Pendiente"
    );

}


/* =====================================================
   POSICIONAR MENÚ
===================================================== */

function posicionarMenuEstado(
    boton,
    menu
) {

    if (!boton || !menu) {
        return;
    }


    const rect =
        boton.getBoundingClientRect();


    /*
     * Mostrar el menú primero
     * para obtener su tamaño.
     */

    menu.style.display =
        "flex";


    const menuRect =
        menu.getBoundingClientRect();


    let top =
        rect.bottom + 7;


    let left =
        rect.left;


    /* ==============================================
       EVITAR QUE SALGA POR ABAJO
    ============================================== */

    if (
        top + menuRect.height >
        window.innerHeight - 10
    ) {

        top =
            rect.top -
            menuRect.height -
            7;

    }


    /* ==============================================
       EVITAR QUE SALGA POR LA DERECHA
    ============================================== */

    if (
        left + menuRect.width >
        window.innerWidth - 10
    ) {

        left =
            window.innerWidth -
            menuRect.width -
            10;

    }


    /* ==============================================
       EVITAR QUE SALGA POR LA IZQUIERDA
    ============================================== */

    if (left < 10) {
        left = 10;
    }


    /* ==============================================
       APLICAR POSICIÓN
    ============================================== */

    menu.style.top =
        `${top}px`;


    menu.style.left =
        `${left}px`;

}


/* =====================================================
   CERRAR MENÚS DE ESTADO
===================================================== */

function cerrarMenusEstado(
    except = null
) {

    document
        .querySelectorAll(
            ".estado-turno-container.menu-abierto"
        )
        .forEach(
            contenedor => {

                if (
                    contenedor !==
                    except
                ) {

                    contenedor.classList.remove(
                        "menu-abierto"
                    );


                    const menu =
                        contenedor.querySelector(
                            ".estado-menu"
                        );


                    if (menu) {

                        menu.style.display =
                            "";

                        menu.style.top =
                            "";

                        menu.style.left =
                            "";

                    }

                }

            }
        );

}


/* =====================================================
   FILTRAR TURNOS
===================================================== */

function obtenerTurnosFiltrados() {

    /*
     * Si no hay filtro,
     * mostramos 7 días.
     */

    const filtro =
        filtroProximosTurnos
            ? filtroProximosTurnos.value
            : "7";


    let cantidadDias = 7;


    if (filtro === "hoy") {

        cantidadDias = 1;

    }


    if (filtro === "3") {

        cantidadDias = 3;

    }


    if (filtro === "7") {

        cantidadDias = 7;

    }


    const hoy =
        obtenerFechaHoy();


    /*
     * Obtener las fechas permitidas.
     */

    const fechasPermitidas = [];


    for (
        let i = 0;
        i < cantidadDias;
        i++
    ) {

        const fecha =
            new Date();


        fecha.setDate(
            fecha.getDate() + i
        );


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


        fechasPermitidas.push(
            `${año}-${mes}-${dia}`
        );

    }


    /*
     * Filtrar los turnos cargados.
     */

    return turnosEncontradosGlobal
        .filter(
            turno =>
                fechasPermitidas.includes(
                    turno.fechaConsulta
                )
        )
        .sort(
            (a, b) => {

                const fechaA =
                    `${a.fechaConsulta} ${a.hora || "00:00"}`;


                const fechaB =
                    `${b.fechaConsulta} ${b.hora || "00:00"}`;


                return (
                    new Date(fechaA) -
                    new Date(fechaB)
                );

            }
        );

}


/* =====================================================
   MOSTRAR PRÓXIMOS TURNOS
===================================================== */

function mostrarProximosTurnos() {

    if (!contenedorProximosTurnos) {
        return;
    }


    /*
     * Obtener los turnos según el filtro.
     */

    const turnosFiltrados =
        obtenerTurnosFiltrados();


    /*
     * Mostrar solamente los primeros 5.
     */

    const proximos =
        turnosFiltrados.slice(
            0,
            5
        );


    /* =============================================
       CERRAR MENÚS ANTERIORES
    ============================================= */

    cerrarMenusEstado();


    /* =============================================
       NO HAY TURNOS
    ============================================= */

    if (proximos.length === 0) {

        contenedorProximosTurnos.innerHTML = `

            <div class="empty-icon">

                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >

                    <rect
                        x="3"
                        y="5"
                        width="18"
                        height="16"
                        rx="2"
                    ></rect>

                    <path d="M16 3v4"></path>

                    <path d="M8 3v4"></path>

                    <path d="M3 10h18"></path>

                </svg>

            </div>


            <h4>
                No hay turnos próximos
            </h4>


            <p>
                No hay turnos programados
                para el período seleccionado.
            </p>

        `;


        return;

    }


    /* =============================================
       MOSTRAR TURNOS
    ============================================= */

    contenedorProximosTurnos.innerHTML = `

        <div class="proximos-turnos-lista">

            ${proximos.map(turno => {

                const apellido =
                    turno.apellido || "";


                const nombre =
                    turno.nombre || "";


                const hora =
                    turno.hora
                        ? turno.hora.substring(
                            0,
                            5
                        )
                        : "-";




let fecha =
    new Date(
        `${turno.fechaConsulta}T00:00:00`
    ).toLocaleDateString(
        "es-AR",
        {
            weekday: "long",
            day: "2-digit",
            month: "2-digit"
        }
    )
    .replace(
        ",",
        ""
    );


fecha =
    fecha.charAt(0).toUpperCase() +
    fecha.slice(1);






                const estado =
                    String(
                        turno.estado ||
                        "pendiente"
                    ).toLowerCase();


                const claseEstado =
                    obtenerClaseEstado(
                        estado
                    );


                const nombreEstado =
                    obtenerNombreEstado(
                        estado
                    );


                return `

                    <div
                        class="proximo-turno"
                    >

                        <div
                            class="proximo-turno-fecha"
                        >

                            <strong>
                                ${hora}
                            </strong>

                            <span>
                                ${fecha}
                            </span>

                        </div>


                        <div
                            class="proximo-turno-paciente"
                        >

                            <strong>
                                ${apellido},
                                ${nombre}
                            </strong>

                            <span>
                                Paciente #${
                                    turno.numero_identificacion
                                    || "-"
                                }
                            </span>

                        </div>


                        <!-- =================================
                             ESTADO DEL TURNO
                        ================================== -->

                        <div
                            class="estado-turno-container"
                            data-turno-id="${turno.id}"
                        >

                            <button
                                type="button"
                                class="
                                    appointment-status
                                    btn-estado-turno
                                    ${claseEstado}
                                "
                                data-turno-id="${turno.id}"
                                data-estado="${estado}"
                            >

                                ${nombreEstado}

                                <span
                                    class="estado-flecha"
                                >
                                    ▾
                                </span>

                            </button>


                            <div
                                class="estado-menu"
                            >

                                <button
                                    type="button"
                                    class="
                                        estado-opcion
                                        status-pending
                                    "
                                    data-estado="pendiente"
                                >
                                    Pendiente
                                </button>


                                <button
                                    type="button"
                                    class="
                                        estado-opcion
                                        status-confirmed
                                    "
                                    data-estado="confirmado"
                                >
                                    Confirmado
                                </button>


                                <button
                                    type="button"
                                    class="
                                        estado-opcion
                                        status-attended
                                    "
                                    data-estado="atendido"
                                >
                                    Atendido
                                </button>


                                <button
                                    type="button"
                                    class="
                                        estado-opcion
                                        status-cancelled
                                    "
                                    data-estado="cancelado"
                                >
                                    Cancelado
                                </button>

                            </div>

                        </div>

                    </div>

                `;

            }).join("")}

        </div>

    `;


    /* =============================================
       CONFIGURAR SELECTORES DE ESTADO
    ============================================= */

    configurarSelectoresEstado();

}


/* =====================================================
   CONFIGURAR SELECTORES DE ESTADO
===================================================== */

function configurarSelectoresEstado() {

    const contenedoresEstado =
        document.querySelectorAll(
            "#seccionProximosTurnos .estado-turno-container"
        );


    contenedoresEstado.forEach(
        contenedor => {

            const boton =
                contenedor.querySelector(
                    ".btn-estado-turno"
                );


            const menu =
                contenedor.querySelector(
                    ".estado-menu"
                );


            const opciones =
                contenedor.querySelectorAll(
                    ".estado-opcion"
                );


            if (
                !boton ||
                !menu
            ) {
                return;
            }


            /* ==================================
               ABRIR / CERRAR
            ================================== */

            boton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    /*
                     * Si ya está abierto,
                     * simplemente cerrarlo.
                     */

                    if (
                        contenedor.classList.contains(
                            "menu-abierto"
                        )
                    ) {

                        contenedor.classList.remove(
                            "menu-abierto"
                        );


                        menu.style.display =
                            "";

                        menu.style.top =
                            "";

                        menu.style.left =
                            "";

                        return;

                    }


                    /*
                     * Cerrar otros.
                     */

                    cerrarMenusEstado(
                        contenedor
                    );


                    /*
                     * Abrir este.
                     */

                    contenedor.classList.add(
                        "menu-abierto"
                    );


                    /*
                     * Posicionar como
                     * en TURNOS.
                     */

                    posicionarMenuEstado(
                        boton,
                        menu
                    );

                }
            );


            /* ==================================
               SELECCIONAR ESTADO
            ================================== */

            opciones.forEach(
                opcion => {

                    opcion.addEventListener(
                        "click",
                        async event => {

                            event.stopPropagation();


                            const nuevoEstado =
                                opcion.dataset.estado;


                            const turnoId =
                                contenedor.dataset.turnoId;


                            const estadoActual =
                                boton.dataset.estado;


                            /*
                             * Si es el mismo,
                             * simplemente cerrar.
                             */

                            if (
                                nuevoEstado ===
                                estadoActual
                            ) {

                                contenedor.classList.remove(
                                    "menu-abierto"
                                );


                                menu.style.display =
                                    "";


                                return;

                            }


                            /* ======================
                               CONFIRMAR
                            ====================== */

                            confirmarAccion(
    "Cambiar estado del turno",
    `¿Querés cambiar el estado a "${obtenerNombreEstado(nuevoEstado)}"?`,
    async () => {

        contenedor.classList.remove(
            "menu-abierto"
        );


        menu.style.display =
            "";


        await cambiarEstadoTurno(
            turnoId,
            nuevoEstado,
            boton
        );

    },
    "Cambiar estado"
);

                        }
                    );

                }
            );

        }
    );

}




/* =====================================================
   CERRAR MENÚ AL HACER CLICK AFUERA
===================================================== */

document.addEventListener(
    "click",
    event => {

        if (
            event.target.closest(
                ".estado-turno-container"
            )
        ) {
            return;
        }


        cerrarMenusEstado();

    }
);


/* =====================================================
   REPOSICIONAR MENÚ AL HACER SCROLL
===================================================== */

window.addEventListener(
    "scroll",
    () => {

        document
            .querySelectorAll(
                ".estado-turno-container.menu-abierto"
            )
            .forEach(
                contenedor => {

                    const boton =
                        contenedor.querySelector(
                            ".btn-estado-turno"
                        );


                    const menu =
                        contenedor.querySelector(
                            ".estado-menu"
                        );


                    if (
                        boton &&
                        menu
                    ) {

                        posicionarMenuEstado(
                            boton,
                            menu
                        );

                    }

                }
            );

    },
    true
);


/* =====================================================
   REPOSICIONAR MENÚ AL REDIMENSIONAR
===================================================== */

window.addEventListener(
    "resize",
    () => {

        document
            .querySelectorAll(
                ".estado-turno-container.menu-abierto"
            )
            .forEach(
                contenedor => {

                    const boton =
                        contenedor.querySelector(
                            ".btn-estado-turno"
                        );


                    const menu =
                        contenedor.querySelector(
                            ".estado-menu"
                        );


                    if (
                        boton &&
                        menu
                    ) {

                        posicionarMenuEstado(
                            boton,
                            menu
                        );

                    }

                }
            );

    }
);


/* =====================================================
   CAMBIAR ESTADO DEL TURNO
===================================================== */

async function cambiarEstadoTurno(
    turnoId,
    nuevoEstado,
    boton
) {

    const token =
        localStorage.getItem("token");


    if (
        !token ||
        !turnoId
    ) {
        return;
    }


    /*
     * Buscar el turno correspondiente.
     */

    const turno =
        turnosEncontradosGlobal.find(
            turno =>
                String(turno.id) ===
                String(turnoId)
        );


    if (!turno) {

        console.error(
            "No se encontró el turno:",
            turnoId
        );

        return;

    }


    try {

        const respuesta =
            await fetch(
                `${API_URL}/turnos/${turnoId}`,
                {
                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify({

                            fecha:
                                turno.fechaConsulta,

                            hora:
                                turno.hora,

                            estado:
                                nuevoEstado

                        })

                }
            );


        const datos =
            await respuesta.json();


        if (!respuesta.ok) {

            throw new Error(
                datos.mensaje ||
                "No se pudo cambiar el estado."
            );

        }


        /* ==========================================
           QUITAR COLORES ANTERIORES
        ========================================== */

        boton.classList.remove(

            "status-pending",

            "status-confirmed",

            "status-attended",

            "status-cancelled"

        );


        /* ==========================================
           AGREGAR NUEVO COLOR
        ========================================== */

        boton.classList.add(
            obtenerClaseEstado(
                nuevoEstado
            )
        );


        /* ==========================================
           ACTUALIZAR DATA-ESTADO
        ========================================== */

        boton.dataset.estado =
            nuevoEstado;


        /* ==========================================
           ACTUALIZAR TEXTO
        ========================================== */

        const nombreEstado =
            obtenerNombreEstado(
                nuevoEstado
            );


        const flecha =
            boton.querySelector(
                ".estado-flecha"
            );


        /*
         * Limpiar solamente el texto,
         * manteniendo la flecha.
         */

        boton.childNodes.forEach(
            nodo => {

                if (
                    nodo.nodeType ===
                    Node.TEXT_NODE
                ) {

                    nodo.textContent =
                        "";

                }

            }
        );


        if (flecha) {

            flecha.before(
                document.createTextNode(
                    ` ${nombreEstado} `
                )
            );

        }


        /* ==========================================
           ACTUALIZAR GLOBAL
        ========================================== */

        turno.estado =
            nuevoEstado;


        console.log(
            "Estado actualizado:",
            nuevoEstado
        );

    } catch (error) {

        console.error(
            "Error cambiando estado:",
            error
        );
        console.error(
    "Error cambiando estado:",
    error
);

mostrarNotificacion(
    "No se pudo actualizar",
    error.message ||
    "Ocurrió un error al cambiar el estado del turno.",
    "error"
);

await cargarProximosTurnos();


        /*
         * Si falla,
         * volver a cargar.
         */

        await cargarProximosTurnos();

    }

}


/* =====================================================
   CARGAR PRÓXIMOS TURNOS
===================================================== */

async function cargarProximosTurnos() {

    if (!contenedorProximosTurnos) {
        return;
    }


    const token =
        localStorage.getItem("token");


    if (!token) {
        return;
    }


    try {

        const hoy =
            new Date();


        /* =============================================
           GENERAR LAS 7 FECHAS
        ============================================= */

        const fechas =
            [];


        for (
            let i = 0;
            i < 7;
            i++
        ) {

            const fecha =
                new Date(hoy);


            fecha.setDate(
                hoy.getDate() + i
            );


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


            fechas.push(
                `${año}-${mes}-${dia}`
            );

        }


        /* =============================================
           HACER LAS 7 CONSULTAS EN PARALELO
        ============================================= */

        const respuestas =
            await Promise.all(

                fechas.map(
                    fechaConsulta =>

                        fetch(
                            `${API_URL}/turnos?fecha=${fechaConsulta}`,
                            {
                                method: "GET",

                                headers: {

                                    "Authorization":
                                        `Bearer ${token}`

                                }

                            }
                        )

                )

            );


        /* =============================================
           PROCESAR RESPUESTAS
        ============================================= */

        const turnosEncontrados =
            [];


        for (
            let i = 0;
            i < respuestas.length;
            i++
        ) {

            const respuesta =
                respuestas[i];


            if (!respuesta.ok) {
                continue;
            }


            const datos =
                await respuesta.json();


            const turnos =
                datos.turnos || [];


            turnos.forEach(
                turno => {

                    turnosEncontrados.push({

                        ...turno,

                        fechaConsulta:
                            fechas[i]

                    });

                }
            );

        }


        /* =============================================
           GUARDAR GLOBALMENTE
        ============================================= */

        turnosEncontradosGlobal =
            turnosEncontrados;


        /* =============================================
           MOSTRAR PRÓXIMOS TURNOS
        ============================================= */

        mostrarProximosTurnos();


        /* =============================================
           ACTUALIZAR GRÁFICO
        ============================================= */

        actualizarGraficoProximosTurnos(
            turnosEncontrados
        );


    } catch (error) {

        console.error(
            "Error cargando próximos turnos:",
            error
        );

    }

}




/* =====================================================
   ACTUALIZAR GRÁFICO — PRÓXIMOS 7 DÍAS
===================================================== */

function actualizarGraficoProximosTurnos(
    turnos
) {

    const linea =
        document.querySelector(
            "#lineaProximosTurnos"
        );


    const puntos =
        document.querySelector(
            "#puntosProximosTurnos"
        );


    const etiquetas =
        document.querySelector(
            "#etiquetasProximosTurnos"
        );


    const totalElemento =
        document.querySelector(
            "#totalTurnosSemana"
        );


    const promedioElemento =
        document.querySelector(
            "#promedioTurnosSemana"
        );


    const mejorDiaElemento =
        document.querySelector(
            "#mejorDiaTurnos"
        );


    if (
        !linea ||
        !puntos ||
        !etiquetas
    ) {

        console.warn(
            "No se encontró el gráfico de próximos turnos."
        );

        return;

    }


    const hoy =
        new Date();


    const datosSemana =
        [];


    /* =============================================
       CREAR LOS 7 DÍAS
    ============================================= */

    for (
        let i = 0;
        i < 7;
        i++
    ) {

        const fecha =
            new Date(hoy);


        fecha.setDate(
            hoy.getDate() + i
        );


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


        const fechaConsulta =
            `${año}-${mes}-${dia}`;


        const turnosDelDia =
            turnos.filter(
                turno =>
                    turno.fechaConsulta ===
                    fechaConsulta
            );


        const nombreDia =
            fecha
                .toLocaleDateString(
                    "es-AR",
                    {
                        weekday: "short"
                    }
                )
                .replace(
                    ".",
                    ""
                );


        datosSemana.push({

            fecha:
                fechaConsulta,

            etiqueta:
                nombreDia.charAt(0).toUpperCase() +
                nombreDia.slice(1),

            cantidad:
                turnosDelDia.length

        });

    }


    /* =============================================
       CALCULAR TOTAL
    ============================================= */

    const total =
        datosSemana.reduce(
            (acumulado, dia) =>
                acumulado +
                dia.cantidad,
            0
        );


    /* =============================================
       CALCULAR PROMEDIO
    ============================================= */

    const promedio =
        total / 7;


    /* =============================================
       BUSCAR DÍA CON MÁS TURNOS
    ============================================= */

    const mayorCantidad =
        Math.max(
            ...datosSemana.map(
                dia =>
                    dia.cantidad
            )
        );


    const mejorDia =
        datosSemana.find(
            dia =>
                dia.cantidad ===
                mayorCantidad
        );


    /* =============================================
       ACTUALIZAR RESUMEN
    ============================================= */

    if (totalElemento) {

        totalElemento.textContent =
            total;

    }


    if (promedioElemento) {

        promedioElemento.textContent =
            promedio
                .toFixed(1)
                .replace(
                    ".",
                    ","
                );

    }


    if (mejorDiaElemento) {

        mejorDiaElemento.textContent =
            mejorDia
                ? `${mejorDia.etiqueta} ${mejorDia.fecha.slice(8, 10)}`
                : "—";

    }


    /* =============================================
       GENERAR ETIQUETAS
    ============================================= */

    etiquetas.innerHTML =
        datosSemana
            .map(
                dia => `

                    <span>
                        ${dia.etiqueta}
                        ${dia.fecha.slice(8, 10)}
                    </span>

                `
            )
            .join("");


    /* =============================================
       ESCALA DEL GRÁFICO
    ============================================= */

    const maximo =
        Math.max(
            ...datosSemana.map(
                dia =>
                    dia.cantidad
            ),
            1
        );


    const alturaMaxima =
        180;


    const alturaBase =
        250;


    const posicionesX = [

        70,
        180,
        290,
        400,
        510,
        620,
        730

    ];


    /* =============================================
       CREAR PUNTOS
    ============================================= */

    const puntosGrafico =
        datosSemana.map(
            (dia, indice) => {

                const altura =
                    (
                        dia.cantidad /
                        maximo
                    ) *
                    alturaMaxima;


                const y =
                    alturaBase -
                    altura;


                return {

                    x:
                        posicionesX[
                            indice
                        ],

                    y

                };

            }
        );


    /* =============================================
       ACTUALIZAR LÍNEA
    ============================================= */

    linea.setAttribute(
        "points",
        puntosGrafico
            .map(
                punto =>
                    `${punto.x},${punto.y}`
            )
            .join(" ")
    );


    /* =============================================
       ACTUALIZAR PUNTOS
    ============================================= */

    puntos.innerHTML =
        puntosGrafico
            .map(
                punto => `

                    <circle
                        cx="${punto.x}"
                        cy="${punto.y}"
                        r="5"
                        class="chart-point"
                    />

                `
            )
            .join("");

}



/* =====================================================
   CARGAR DASHBOARD
===================================================== */

async function cargarDashboard() {

    try {

        const token =
            localStorage.getItem("token");


        if (!token) {

            window.location.href =
                "login.html";

            return;

        }


        /* =============================================
           FECHA DE HOY
        ============================================= */

        const fechaHoy =
            obtenerFechaHoy();


        /* =============================================
           REALIZAR CONSULTAS EN PARALELO
        ============================================= */

        const [
            respuestaPacientes,
            respuestaTurnos,
            respuestaPagos
        ] = await Promise.all([

            fetch(
                `${API_URL}/pacientes`,
                {
                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            ),


            fetch(
                `${API_URL}/turnos?fecha=${fechaHoy}`,
                {
                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            ),


            fetch(
                `${API_URL}/pagos`,
                {
                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            )

        ]);


        /* =============================================
           VERIFICAR RESPUESTAS
        ============================================= */

        if (
            !respuestaPacientes.ok ||
            !respuestaTurnos.ok ||
            !respuestaPagos.ok
        ) {

            throw new Error(
                "No se pudieron cargar los datos del dashboard."
            );

        }


        /* =============================================
           PROCESAR RESPUESTAS
        ============================================= */

        const [
            datosPacientes,
            datosTurnos,
            datosPagos
        ] = await Promise.all([

            respuestaPacientes.json(),

            respuestaTurnos.json(),

            respuestaPagos.json()

        ]);


        /* =============================================
           PACIENTES
        ============================================= */

        const pacientes =
            datosPacientes.pacientes ||
            datosPacientes ||
            [];


        const pacientesActivos =
            pacientes.filter(
                paciente =>
                    paciente.activo !== false
            );


        /* =============================================
           TURNOS DE HOY
        ============================================= */

        const turnos =
            datosTurnos.turnos ||
            [];


        /* =============================================
           PAGOS
        ============================================= */

        const pagos =
            datosPagos.pagos ||
            [];


        /* =============================================
           PAGOS REGISTRADOS HOY
        ============================================= */

        const pagosHoy =
            pagos.filter(
                pago => {

                    if (!pago.fecha_pago) {
                        return false;
                    }


                    const fechaPago =
                        new Date(
                            pago.fecha_pago
                        );


                    const año =
                        fechaPago.getFullYear();


                    const mes =
                        String(
                            fechaPago.getMonth() + 1
                        ).padStart(2, "0");


                    const dia =
                        String(
                            fechaPago.getDate()
                        ).padStart(2, "0");


                    const fecha =
                        `${año}-${mes}-${dia}`;


                    return (
                        fecha ===
                        fechaHoy
                    );

                }
            );


        /* =============================================
           ACTUALIZAR TARJETAS
        ============================================= */

        if (
            tarjetasDashboard.length >= 3
        ) {

            tarjetasDashboard[0]
                .textContent =
                pacientesActivos.length;


            tarjetasDashboard[1]
                .textContent =
                turnos.length;


            tarjetasDashboard[2]
                .textContent =
                pagosHoy.length;

        }


        /* =============================================
           DEBUG
        ============================================= */

        console.log(
            "Dashboard:",
            {

                pacientesActivos:
                    pacientesActivos.length,

                turnosHoy:
                    turnos.length,

                pagosHoy:
                    pagosHoy.length

            }
        );


    } catch (error) {

        console.error(
            "Error cargando dashboard:",
            error
        );


        if (
            tarjetasDashboard.length >= 3
        ) {

            tarjetasDashboard[0]
                .textContent =
                "—";


            tarjetasDashboard[1]
                .textContent =
                "—";


            tarjetasDashboard[2]
                .textContent =
                "—";

        }

    }

}



/* =====================================================
   CAMBIAR FILTRO DE PRÓXIMOS TURNOS
===================================================== */

if (filtroProximosTurnos) {

    filtroProximosTurnos.addEventListener(
        "change",
        () => {

            cargarProximosTurnos();

        }
    );

}




/* =====================================================
   INICIAR
===================================================== */

cargarDashboard();

cargarProximosTurnos();

