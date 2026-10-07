/* =====================================================
   GESTIONTEC MEDICAL — Layout compartido
   · Menú lateral desplegable en pantallas chicas
   · Selector de tema claro / oscuro
===================================================== */

(function () {

    const CLAVE_TEMA = "quirogest-tema";

    const EN_LOGIN = /login\.html$/i.test(window.location.pathname);

    /* Sin sesión iniciada solo se puede ver el login */
    if (!EN_LOGIN && !localStorage.getItem("token")) {
        window.location.replace("login.html");
        return;
    }

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

    /* ---------- cerrar sesión ---------- */

    function cerrarSesion() {

        try {
            localStorage.removeItem("token");
            localStorage.removeItem("token_super");
        } catch (e) { /* ignorar */ }

        window.location.href = "login.html";
    }

    document.addEventListener("click", function (evento) {

        if (evento.target.closest(".logout-button, #btnCerrarSesion")) {
            evento.preventDefault();
            cerrarSesion();
        }
    });


    /* ---------- identidad de la sesión (consultorio, usuario, rol) ---------- */

    const ETIQUETA_ROL = {
        superadmin: "Super administrador",
        administrador: "Administrador",
        usuario: "Usuario"
    };

    const ICONO_PANEL =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"></path><path d="M9 12l2 2 4-4"></path></svg>';

    /* El super admin ve un acceso al panel del proveedor en el menú */
    function enlacePanelProveedor(sesion) {

        const nav = document.querySelector(".sidebar-nav");

        if (!nav || sesion.usuario.rol !== "superadmin" || nav.querySelector("[data-panel-proveedor]")) {
            return;
        }

        const enlace = document.createElement("a");

        enlace.href = "superadmin.html";
        enlace.className = "nav-item";
        enlace.setAttribute("data-panel-proveedor", "");

        if (/superadmin\.html$/i.test(window.location.pathname)) {
            enlace.classList.add("active");
        }

        enlace.innerHTML =
            '<span class="nav-icon">' + ICONO_PANEL + "</span><span>Panel proveedor</span>";

        const separador = nav.querySelector(".nav-separator");

        nav.insertBefore(enlace, separador || null);
    }

    /* Aviso permanente cuando el proveedor está dentro de un consultorio ajeno */
    function bannerSoporte(sesion) {

        const existente = document.querySelector(".banner-soporte");

        if (!sesion.soporte) {

            if (existente) existente.remove();
            document.body.classList.remove("en-soporte");

            try {
                // una sesión normal no necesita la copia guardada
                if (sesion.usuario.rol === "superadmin") {
                    localStorage.removeItem("token_super");
                }
            } catch (e) { /* ignorar */ }

            return;
        }

        document.body.classList.add("en-soporte");

        if (existente) {
            existente.querySelector("strong").textContent = sesion.consultorio.nombre;
            return;
        }

        const banner = document.createElement("div");

        banner.className = "banner-soporte";
        banner.setAttribute("role", "status");
        banner.innerHTML =
            "<span>Modo soporte · estás dentro de <strong></strong>. Los cambios que hagas quedan registrados.</span>" +
            '<button type="button">Volver al panel</button>';

        banner.querySelector("strong").textContent = sesion.consultorio.nombre;

        banner.querySelector("button").addEventListener("click", function () {

            let propio = null;

            try {
                propio = localStorage.getItem("token_super");
                localStorage.removeItem("token_super");
            } catch (e) { /* ignorar */ }

            if (propio) {
                localStorage.setItem("token", propio);
                window.location.href = "superadmin.html";
            } else {
                cerrarSesion();
            }
        });

        document.body.insertBefore(banner, document.body.firstChild);
    }

    function pintarSesion(sesion) {

        window.QG_SESION = sesion;

        const nombreVisible =
            sesion.usuario.nombre || sesion.usuario.email.split("@")[0];

        const subtitulo = document.querySelector(".sidebar-subtitle");

        if (subtitulo) {
            subtitulo.textContent = sesion.consultorio.nombre;
            subtitulo.title = sesion.consultorio.nombre;
        }

        const logo = document.querySelector(".sidebar-logo");

        if (logo) {

            if (sesion.consultorio.logo) {

                logo.textContent = "";
                logo.classList.add("con-imagen");

                const imagen = document.createElement("img");
                imagen.src = sesion.consultorio.logo;
                imagen.alt = "";
                logo.replaceChildren(imagen);

            } else {

                logo.classList.remove("con-imagen");
                logo.textContent = (sesion.consultorio.nombre || "Q").trim().charAt(0).toUpperCase();
            }
        }

        const avatar = document.querySelector(".user-avatar");

        if (avatar) {
            avatar.textContent = nombreVisible.charAt(0).toUpperCase();
        }

        const info = document.querySelector(".user-info");

        if (info) {

            const fuerte = info.querySelector("strong");
            const chico = info.querySelector("span");

            if (fuerte) fuerte.textContent = nombreVisible;
            if (chico) chico.textContent = ETIQUETA_ROL[sesion.usuario.rol] || "";
        }

        enlacePanelProveedor(sesion);
        bannerSoporte(sesion);

        document.dispatchEvent(new CustomEvent("quirogest:sesion", { detail: sesion }));
    }

    async function cargarSesion() {

        if (EN_LOGIN) {
            return;
        }

        try {

            const respuesta = await fetch("/auth/me", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });

            if (respuesta.status === 401) {
                cerrarSesion();
                return;
            }

            if (respuesta.status === 403) {

                const datos = await respuesta.json().catch(() => ({}));

                alert(datos.mensaje || "La cuenta está suspendida.");
                cerrarSesion();
                return;
            }

            if (!respuesta.ok) {
                return;
            }

            pintarSesion(await respuesta.json());

        } catch (error) {
            /* sin conexión: se deja la pantalla como está */
        }
    }

    /* API mínima para otras pantallas */
    window.QuiroGest = {
        obtenerTema: leerTema,
        aplicarTema: function (tema) {

            try {
                localStorage.setItem(CLAVE_TEMA, tema);
            } catch (e) { /* ignorar */ }

            aplicarTema(tema);
        },
        cerrarSesion: cerrarSesion,
        recargarSesion: cargarSesion
    };

    /* Enlace a la política de privacidad, arriba de "Cerrar sesión" */
    function enlacePrivacidad() {

        const pie = document.querySelector(".sidebar-footer");

        if (!pie || pie.querySelector(".sidebar-legal")) {
            return;
        }

        const enlace = document.createElement("a");

        enlace.href = "privacidad.html";
        enlace.target = "_blank";
        enlace.rel = "noopener";
        enlace.className = "sidebar-legal";
        enlace.textContent = "Política de privacidad";

        pie.insertBefore(enlace, pie.firstChild);
    }

    function iniciar() {
        crearMenuMovil();
        aplicarTema(leerTema());
        enlacePrivacidad();
        cargarSesion();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }

})();
