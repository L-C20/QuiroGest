
/* =====================================================
   QUIROGEST — SISTEMA GLOBAL DE NOTIFICACIONES
===================================================== */

function mostrarNotificacion(
    titulo,
    mensaje,
    tipo = "success"
) {

    /* =================================================
       CONTENEDOR
    ================================================= */

    let contenedor =
        document.getElementById(
            "contenedorNotificaciones"
        );


    /* =================================================
       CREAR CONTENEDOR SI NO EXISTE
    ================================================= */

    if (!contenedor) {

        contenedor =
            document.createElement("div");

        contenedor.id =
            "contenedorNotificaciones";

        contenedor.className =
            "contenedor-notificaciones";

        document.body.appendChild(
            contenedor
        );

    }


    /* =================================================
       ICONOS
    ================================================= */

    const iconos = {

        success: `
            <svg viewBox="0 0 24 24">
                <path d="M5 12l4 4L19 6"></path>
            </svg>
        `,

        error: `
            <svg viewBox="0 0 24 24">
                <path d="M6 6l12 12"></path>
                <path d="M18 6L6 18"></path>
            </svg>
        `,

        warning: `
            <svg viewBox="0 0 24 24">
                <path d="M12 3L2.5 20h19L12 3z"></path>
                <path d="M12 9v5"></path>
                <path d="M12 17h.01"></path>
            </svg>
        `,

        info: `
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M12 10v6"></path>
                <path d="M12 7h.01"></path>
            </svg>
        `

    };


    /* =================================================
       NOTIFICACIÓN
    ================================================= */

    const notificacion =
        document.createElement("div");

    notificacion.className =
        `notificacion notificacion-${tipo}`;


    notificacion.innerHTML = `

        <div class="notificacion-icono">
            ${iconos[tipo] || iconos.info}
        </div>


        <div class="notificacion-contenido">

            <strong>
                ${titulo}
            </strong>

            <span>
                ${mensaje}
            </span>

        </div>


        <button
            type="button"
            class="notificacion-cerrar"
            aria-label="Cerrar notificación"
        >
            ×
        </button>

    `;


    /* =================================================
       AGREGAR
    ================================================= */

    contenedor.appendChild(
        notificacion
    );


    /* =================================================
       CERRAR MANUALMENTE
    ================================================= */

    const botonCerrar =
        notificacion.querySelector(
            ".notificacion-cerrar"
        );


    botonCerrar.addEventListener(
        "click",
        () => {

            cerrarNotificacion(
                notificacion
            );

        }
    );


    /* =================================================
       ANIMACIÓN DE ENTRADA
    ================================================= */

    requestAnimationFrame(() => {

        notificacion.classList.add(
            "notificacion-visible"
        );

    });


    /* =================================================
       CIERRE AUTOMÁTICO
    ================================================= */

    const temporizador =
        setTimeout(() => {

            cerrarNotificacion(
                notificacion
            );

        }, 4500);


    /* =================================================
       GUARDAR TEMPORIZADOR
    ================================================= */

    notificacion.dataset.timer =
        temporizador;

}


/* =====================================================
   CERRAR NOTIFICACIÓN
===================================================== */

function cerrarNotificacion(
    notificacion
) {

    if (!notificacion) {
        return;
    }


    clearTimeout(
        Number(
            notificacion.dataset.timer
        )
    );


    notificacion.classList.remove(
        "notificacion-visible"
    );


    notificacion.classList.add(
        "notificacion-saliendo"
    );


    setTimeout(() => {

        notificacion.remove();

    }, 250);

}

/* =====================================================
   QUIROGEST — MODAL GLOBAL DE CONFIRMACIÓN
===================================================== */

function confirmarAccion(
    titulo,
    mensaje,
    accionConfirmar,
    textoConfirmar = "Confirmar"
) {

    /* =================================================
       ELIMINAR MODAL ANTERIOR
    ================================================= */

    const modalAnterior =
        document.getElementById(
            "modalConfirmacionGlobal"
        );

    if (modalAnterior) {
        modalAnterior.remove();
    }


    /* =================================================
       CREAR MODAL
    ================================================= */

    const modal =
        document.createElement("div");

    modal.id =
        "modalConfirmacionGlobal";

    modal.className =
        "modal-confirmacion";


    modal.innerHTML = `

        <div class="modal-confirmacion-contenido">

            <div class="modal-confirmacion-icono">

                <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >

                    <path
                        d="M12 9v4"
                    ></path>

                    <path
                        d="M12 17h.01"
                    ></path>

                    <path
                        d="M10.3 3.6L2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0z"
                    ></path>

                </svg>

            </div>


            <div class="modal-confirmacion-texto">

                <h3>
                    ${titulo}
                </h3>

                <p>
                    ${mensaje}
                </p>

            </div>


            <div class="modal-confirmacion-acciones">

                <button
                    type="button"
                    class="btn-confirmacion-cancelar"
                    id="btnCancelarConfirmacion"
                >
                    Cancelar
                </button>


                <button
                    type="button"
                    class="btn-confirmacion-aceptar"
                    id="btnAceptarConfirmacion"
                >
                    ${textoConfirmar}
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    /* =================================================
       ELEMENTOS
    ================================================= */

    const btnCancelar =
        document.getElementById(
            "btnCancelarConfirmacion"
        );


    const btnAceptar =
        document.getElementById(
            "btnAceptarConfirmacion"
        );


    /* =================================================
       MOSTRAR
    ================================================= */

    requestAnimationFrame(() => {

        modal.classList.add(
            "modal-confirmacion-visible"
        );

    });


    /* =================================================
       CERRAR
    ================================================= */

    function cerrar() {

        modal.classList.remove(
            "modal-confirmacion-visible"
        );


        modal.classList.add(
            "modal-confirmacion-saliendo"
        );


        setTimeout(() => {

            modal.remove();

        }, 200);

    }


    /* =================================================
       CANCELAR
    ================================================= */

    btnCancelar.addEventListener(
        "click",
        cerrar
    );


    /* =================================================
       CONFIRMAR
    ================================================= */

    btnAceptar.addEventListener(
        "click",
        async () => {

            cerrar();


            if (
                typeof accionConfirmar ===
                "function"
            ) {

                await accionConfirmar();

            }

        }
    );


    /* =================================================
       CLICK FUERA
    ================================================= */

    modal.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modal
            ) {

                cerrar();

            }

        }
    );


    /* =================================================
       ESC
    ================================================= */

    function cerrarConEscape(event) {

        if (
            event.key === "Escape"
        ) {

            cerrar();

            document.removeEventListener(
                "keydown",
                cerrarConEscape
            );

        }

    }


    document.addEventListener(
        "keydown",
        cerrarConEscape
    );

}
