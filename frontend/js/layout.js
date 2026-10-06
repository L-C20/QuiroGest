/* =====================================================
   QUIROGEST — Layout compartido
   · Menú lateral desplegable en pantallas chicas
   · Selector de tema claro / oscuro
===================================================== */

(function () {

    const CLAVE_TEMA = "quirogest-tema";

    function leerTema() {

        try {
            const guardado = localStorage.getItem(CLAVE_TEMA);
            if (guardado === "dark" || guardado === "light") {
                return guardado;
            }
        } catch (e) { /* almacenamiento no disponible */ }

        return "light";
    }

    function aplicarTema(tema) {

        document.documentElement.setAttribute("data-theme", tema);

        const oscuro = tema === "dark";

        document.querySelectorAll("[data-tema-boton]").forEach(boton => {

            boton.setAttribute("aria-pressed", String(oscuro));
            boton.setAttribute(
                "title",
                oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
            );

            const icono = boton.querySelector(".tema-icono");
            const texto = boton.querySelector(".tema-texto");

            if (icono) {
                icono.innerHTML = oscuro ? ICONO_SOL : ICONO_LUNA;
            }

            if (texto) {
                texto.textContent = oscuro ? "Modo claro" : "Modo oscuro";
            }
        });
    }

    function alternarTema() {

        const nuevo =
            document.documentElement.getAttribute("data-theme") === "dark"
                ? "light"
                : "dark";

        try {
            localStorage.setItem(CLAVE_TEMA, nuevo);
        } catch (e) { /* ignorar */ }

        aplicarTema(nuevo);
    }

    const ICONO_LUNA =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"></path></svg>';

    const ICONO_SOL =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>';

    function crearBotonTema() {

        const pie = document.querySelector(".sidebar-footer");

        if (pie && !document.getElementById("botonTema")) {

            const boton = document.createElement("button");

            boton.type = "button";
            boton.id = "botonTema";
            boton.className = "tema-toggle";
            boton.setAttribute("data-tema-boton", "");
            boton.innerHTML =
                '<span class="tema-icono"></span>' +
                '<span class="tema-texto"></span>';

            boton.addEventListener("click", alternarTema);

            pie.insertBefore(boton, pie.firstChild);
        }

        if (!document.getElementById("botonTemaFlotante")) {

            const flotante = document.createElement("button");

            flotante.type = "button";
            flotante.id = "botonTemaFlotante";
            flotante.className = "tema-flotante";
            flotante.setAttribute("data-tema-boton", "");
            flotante.setAttribute("aria-label", "Cambiar tema claro u oscuro");
            flotante.innerHTML = '<span class="tema-icono"></span>';

            flotante.addEventListener("click", alternarTema);

            document.body.appendChild(flotante);
        }

        aplicarTema(leerTema());
    }

    function crearMenuMovil() {

        const sidebar = document.querySelector(".sidebar");

        if (!sidebar || document.getElementById("botonMenu")) {
            return;
        }

        const boton = document.createElement("button");

        boton.type = "button";
        boton.id = "botonMenu";
        boton.className = "menu-toggle";
        boton.setAttribute("aria-label", "Abrir menú");
        boton.setAttribute("aria-expanded", "false");
        boton.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>';

        const fondo = document.createElement("div");

        fondo.className = "sidebar-backdrop";

        document.body.appendChild(boton);
        document.body.appendChild(fondo);

        function abrir(estado) {

            document.body.classList.toggle("menu-abierto", estado);
            boton.setAttribute("aria-expanded", String(estado));
            boton.setAttribute("aria-label", estado ? "Cerrar menú" : "Abrir menú");
        }

        boton.addEventListener("click", function () {
            abrir(!document.body.classList.contains("menu-abierto"));
        });

        fondo.addEventListener("click", function () {
            abrir(false);
        });

        document.addEventListener("keydown", function (evento) {
            if (evento.key === "Escape") {
                abrir(false);
            }
        });

        sidebar.addEventListener("click", function (evento) {
            if (evento.target.closest("a.nav-item")) {
                abrir(false);
            }
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 900) {
                abrir(false);
            }
        });
    }

    function iniciar() {
        crearMenuMovil();
        crearBotonTema();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

})();
