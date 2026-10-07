/* =====================================================
   GESTIONTEC MEDICAL — Pantalla de Configuración
   Consultorio · Usuarios · Recordatorios · Mi cuenta
===================================================== */

(function () {

    const $ = id => document.getElementById(id);

    const MIN_PASSWORD = 10;
    const TAMANO_LOGO = 256;

    const ETIQUETA_HORAS = {
        2: "2 horas antes",
        4: "4 horas antes",
        12: "12 horas antes",
        24: "1 día antes (24 horas)",
        48: "2 días antes (48 horas)",
        72: "3 días antes (72 horas)"
    };

    const ETIQUETA_ROL = {
        superadmin: "Super administrador",
        administrador: "Administrador",
        usuario: "Usuario"
    };

    let sesion = null;
    let esAdmin = false;
    let yo = null;
    let usuarios = [];
    let usuarioEnEdicion = null;

    /* logo: undefined = sin cambios · null = quitar · texto = imagen nueva */
    let logoNuevo;
    let logoActual = null;


    const ICONOS = {
        editar: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 20h9\"></path><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z\"></path></svg>",
        password: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"8\" cy=\"15\" r=\"4\"></circle><path d=\"M10.8 12.2L20 3\"></path><path d=\"M16 7l3 3\"></path><path d=\"M14 9l2 2\"></path></svg>",
        desactivar: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M10 9v6M14 9v6\"></path></svg>",
        activar: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M10 8.5l6 3.5-6 3.5z\"></path></svg>"
    };

    function botonIcono(accion, id, titulo, nombre, icono, clase) {

        return `<button type="button" class="icono-accion ${clase || ""}" data-accion="${accion}" data-id="${id}" title="${titulo}" aria-label="${titulo}: ${escapar(nombre)}">${ICONOS[icono]}</button>`;
    }

    /* ---------- utilidades ---------- */

    function escapar(valor) {

        return String(valor ?? "").replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
        }[c]));
    }

    async function pedir(metodo, ruta, cuerpo) {

        const respuesta = await fetch(ruta, {
            method: metodo,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`
            },
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
        });

        if (respuesta.status === 401) {
            window.QuiroGest.cerrarSesion();
            throw new Error("Sesión vencida");
        }

        const datos = await respuesta.json().catch(() => ({}));

        return { ok: respuesta.ok, status: respuesta.status, datos };
    }

    function aviso(titulo, mensaje, tipo) {

        if (typeof mostrarNotificacion === "function") {
            mostrarNotificacion(titulo, mensaje, tipo);
        }
    }

    function ocupado(boton, estado, textoOcupado) {

        if (!boton) return;

        if (estado) {
            boton.dataset.texto = boton.textContent;
            boton.textContent = textoOcupado || "Guardando…";
            boton.disabled = true;
        } else {
            boton.textContent = boton.dataset.texto || boton.textContent;
            boton.disabled = false;
        }
    }

    function mostrarError(id, mensaje) {
        $(id).textContent = mensaje || "";
    }


    /* ---------- pestañas ---------- */

    function activarPanel(nombre) {

        const visibles = [...document.querySelectorAll(".config-tab")].filter(t => !t.hidden);

        const elegida = visibles.find(t => t.dataset.panel === nombre) || visibles[0];

        document.querySelectorAll(".config-tab").forEach(tab => {

            const activa = tab === elegida;

            tab.classList.toggle("activa", activa);
            tab.setAttribute("aria-selected", String(activa));
        });

        document.querySelectorAll(".config-panel").forEach(panel => {
            panel.hidden = panel.id !== `panel-${elegida.dataset.panel}`;
        });

        try {
            history.replaceState(null, "", `#${elegida.dataset.panel}`);
        } catch (e) { /* ignorar */ }
    }

    $("configTabs").addEventListener("click", evento => {

        const tab = evento.target.closest(".config-tab");

        if (tab && !tab.hidden) {
            activarPanel(tab.dataset.panel);
        }
    });


    /* =====================================================
       CONSULTORIO
    ===================================================== */

    function dibujarLogo() {

        const vista = $("logoVista");

        const imagen = logoNuevo === undefined ? logoActual : logoNuevo;

        if (imagen) {

            const img = document.createElement("img");
            img.src = imagen;
            img.alt = "Logo del consultorio";
            vista.replaceChildren(img);
            vista.classList.add("con-imagen");

        } else {

            vista.classList.remove("con-imagen");
            vista.textContent = ($("consNombre").value || "Q").trim().charAt(0).toUpperCase() || "Q";
        }

        $("btnQuitarLogo").hidden = !imagen;
    }

    function ajustarImagen(archivo) {

        return new Promise((resolver, rechazar) => {

            if (!/^image\/(png|jpeg|webp)$/.test(archivo.type)) {
                return rechazar(new Error("Elegí una imagen PNG, JPG o WebP."));
            }

            if (archivo.size > 8 * 1024 * 1024) {
                return rechazar(new Error("La imagen es demasiado grande."));
            }

            const lector = new FileReader();

            lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));

            lector.onload = () => {

                const imagen = new Image();

                imagen.onerror = () => rechazar(new Error("No se pudo abrir la imagen."));

                imagen.onload = () => {

                    const escala = Math.min(1, TAMANO_LOGO / Math.max(imagen.width, imagen.height));
                    const ancho = Math.max(1, Math.round(imagen.width * escala));
                    const alto = Math.max(1, Math.round(imagen.height * escala));

                    const lienzo = document.createElement("canvas");
                    lienzo.width = ancho;
                    lienzo.height = alto;
                    lienzo.getContext("2d").drawImage(imagen, 0, 0, ancho, alto);

                    resolver(lienzo.toDataURL("image/png"));
                };

                imagen.src = lector.result;
            };

            lector.readAsDataURL(archivo);
        });
    }

    async function cargarConsultorio() {

        const { ok, datos } = await pedir("GET", "/configuracion/consultorio");

        if (!ok) return;

        const c = datos.consultorio;

        $("consNombre").value = c.nombre || "";
        $("consDireccion").value = c.direccion || "";
        $("consTelefono").value = c.telefono || "";
        $("consEmail").value = c.email || "";

        logoActual = c.logo || null;
        logoNuevo = undefined;

        dibujarLogo();
    }

    $("consNombre").addEventListener("input", () => {
        if (!(logoNuevo === undefined ? logoActual : logoNuevo)) dibujarLogo();
    });

    $("logoArchivo").addEventListener("change", async evento => {

        const archivo = evento.target.files[0];

        evento.target.value = "";

        if (!archivo) return;

        try {

            logoNuevo = await ajustarImagen(archivo);
            mostrarError("errorConsultorio", "");
            dibujarLogo();

        } catch (error) {

            mostrarError("errorConsultorio", error.message);
        }
    });

    $("btnQuitarLogo").addEventListener("click", () => {

        logoNuevo = null;
        dibujarLogo();
    });

    $("formConsultorio").addEventListener("submit", async evento => {

        evento.preventDefault();

        mostrarError("errorConsultorio", "");

        if (!$("consNombre").value.trim()) {
            mostrarError("errorConsultorio", "Ingresá el nombre del consultorio.");
            $("consNombre").focus();
            return;
        }

        const cuerpo = {
            nombre: $("consNombre").value,
            direccion: $("consDireccion").value,
            telefono: $("consTelefono").value,
            email: $("consEmail").value
        };

        if (logoNuevo !== undefined) {
            cuerpo.logo = logoNuevo;
        }

        const boton = $("btnGuardarConsultorio");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const { ok, datos } = await pedir("PUT", "/configuracion/consultorio", cuerpo);

            if (!ok) {
                mostrarError("errorConsultorio", datos.mensaje || "No se pudo guardar.");
                return;
            }

            logoActual = datos.consultorio.logo || null;
            logoNuevo = undefined;
            dibujarLogo();

            aviso("Guardado", "Los datos del consultorio se actualizaron.", "success");

            window.QuiroGest.recargarSesion();

        } catch (error) {

            mostrarError("errorConsultorio", "No se pudo conectar con el servidor.");

        } finally {

            ocupado(boton, false);
        }
    });


    /* =====================================================
       USUARIOS
    ===================================================== */

    async function cargarUsuarios() {

        const { ok, datos } = await pedir("GET", "/configuracion/usuarios");

        if (!ok) {
            $("usuariosCuerpo").innerHTML =
                "<tr><td colspan=\"4\" class=\"config-vacio\">No se pudieron cargar los usuarios.</td></tr>";
            return;
        }

        usuarios = datos.usuarios;
        yo = datos.yo;

        dibujarUsuarios();
    }

    function dibujarUsuarios() {

        if (usuarios.length === 0) {
            $("usuariosCuerpo").innerHTML =
                "<tr><td colspan=\"4\" class=\"config-vacio\">Todavía no hay usuarios.</td></tr>";
            return;
        }

        $("usuariosCuerpo").innerHTML = usuarios.map(u => {

            const esYo = u.id === yo;
            const esSuper = u.rol === "superadmin";

            const estado = u.activo
                ? "<span class=\"appointment-status status-confirmed\">Activo</span>"
                : "<span class=\"appointment-status status-cancelled\">Desactivado</span>";

            const acciones = esSuper
                ? "<span class=\"config-vacio\">—</span>"
                : `
                    <div class="config-acciones">
                        ${botonIcono("editar", u.id, "Editar usuario", u.nombre || u.email, "editar")}
                        ${botonIcono("password", u.id, "Cambiar contraseña", u.nombre || u.email, "password")}
                        ${esYo ? "" : (u.activo
                            ? botonIcono("estado", u.id, "Desactivar usuario", u.nombre || u.email, "desactivar", "peligro")
                            : botonIcono("estado", u.id, "Activar usuario", u.nombre || u.email, "activar", "reactivar"))}
                    </div>`;

            return `
                <tr>
                    <td>
                        <div class="patient-name">
                            <strong>${escapar(u.nombre || u.email.split("@")[0])}${esYo ? " <small class=\"config-tu\">(vos)</small>" : ""}</strong>
                            <span>${escapar(u.email)}</span>
                        </div>
                    </td>
                    <td>${escapar(ETIQUETA_ROL[u.rol] || u.rol)}</td>
                    <td>${estado}</td>
                    <td>${acciones}</td>
                </tr>`;

        }).join("");
    }

    function abrirDialogoUsuario(usuario) {

        usuarioEnEdicion = usuario || null;

        const edicion = Boolean(usuario);

        $("usuarioTitulo").textContent = edicion ? "Editar usuario" : "Nuevo usuario";
        $("usuarioSubtitulo").textContent = edicion
            ? usuario.email
            : "Va a poder iniciar sesión con su correo y la contraseña que definas.";

        $("usuNombre").value = edicion ? (usuario.nombre || "") : "";
        $("usuEmail").value = edicion ? usuario.email : "";
        $("usuEmail").disabled = edicion;
        $("usuRol").value = edicion ? usuario.rol : "usuario";
        $("usuRol").disabled = edicion && usuario.id === yo;
        $("usuPassword").value = "";
        $("campoUsuPassword").hidden = edicion;

        mostrarError("errorUsuario", "");

        $("dialogoUsuario").showModal();
        (edicion ? $("usuNombre") : $("usuEmail")).focus();
    }

    $("btnNuevoUsuario").addEventListener("click", () => abrirDialogoUsuario(null));

    $("btnCancelarUsuario").addEventListener("click", () => $("dialogoUsuario").close());

    $("formUsuario").addEventListener("submit", async evento => {

        evento.preventDefault();

        mostrarError("errorUsuario", "");

        const edicion = Boolean(usuarioEnEdicion);

        if (!edicion) {

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($("usuEmail").value.trim())) {
                mostrarError("errorUsuario", "Ingresá un correo electrónico válido.");
                return;
            }

            if ($("usuPassword").value.length < MIN_PASSWORD) {
                mostrarError("errorUsuario", `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
                return;
            }
        }

        const boton = $("btnGuardarUsuario");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const cuerpo = {
                nombre: $("usuNombre").value,
                rol: $("usuRol").value
            };

            let resultado;

            if (edicion) {

                if (usuarioEnEdicion.id === yo) {
                    delete cuerpo.rol;
                }

                resultado = await pedir("PUT", `/configuracion/usuarios/${usuarioEnEdicion.id}`, cuerpo);

            } else {

                cuerpo.email = $("usuEmail").value;
                cuerpo.password = $("usuPassword").value;

                resultado = await pedir("POST", "/configuracion/usuarios", cuerpo);
            }

            if (!resultado.ok) {
                mostrarError("errorUsuario", resultado.datos.mensaje || "No se pudo guardar.");
                return;
            }

            $("dialogoUsuario").close();

            aviso(
                edicion ? "Usuario actualizado" : "Usuario creado",
                edicion ? "Los cambios se guardaron." : "Ya puede iniciar sesión.",
                "success"
            );

            await cargarUsuarios();

        } catch (error) {

            mostrarError("errorUsuario", "No se pudo conectar con el servidor.");

        } finally {

            ocupado(boton, false);
        }
    });

    $("usuariosCuerpo").addEventListener("click", evento => {

        const boton = evento.target.closest("[data-accion]");

        if (!boton) return;

        const usuario = usuarios.find(u => u.id === Number(boton.dataset.id));

        if (!usuario) return;

        if (boton.dataset.accion === "editar") {
            abrirDialogoUsuario(usuario);
        }

        if (boton.dataset.accion === "password") {

            usuarioEnEdicion = usuario;
            $("passwordUsuarioSub").textContent = usuario.email;
            $("passUsuarioNueva").value = "";
            mostrarError("errorPasswordUsuario", "");
            $("dialogoPassword").showModal();
            $("passUsuarioNueva").focus();
        }

        if (boton.dataset.accion === "estado") {

            const activar = !usuario.activo;

            const ejecutar = async () => {

                const { ok, datos } = await pedir(
                    "PUT",
                    `/configuracion/usuarios/${usuario.id}`,
                    { nombre: usuario.nombre, activo: activar }
                );

                if (!ok) {
                    aviso("No se pudo completar", datos.mensaje || "Intentá nuevamente.", "error");
                    return;
                }

                aviso(
                    activar ? "Usuario activado" : "Usuario desactivado",
                    activar ? "Puede volver a iniciar sesión." : "Ya no puede iniciar sesión.",
                    "success"
                );

                cargarUsuarios();
            };

            if (!activar && typeof confirmarAccion === "function") {

                confirmarAccion(
                    "Desactivar usuario",
                    `${usuario.nombre || usuario.email} dejará de poder iniciar sesión. Podés reactivarlo cuando quieras.`,
                    ejecutar,
                    "Desactivar"
                );

            } else {

                ejecutar();
            }
        }
    });

    $("btnCancelarPasswordUsuario").addEventListener("click", () => $("dialogoPassword").close());

    $("formPasswordUsuario").addEventListener("submit", async evento => {

        evento.preventDefault();

        mostrarError("errorPasswordUsuario", "");

        if ($("passUsuarioNueva").value.length < MIN_PASSWORD) {
            mostrarError("errorPasswordUsuario", `Debe tener al menos ${MIN_PASSWORD} caracteres.`);
            return;
        }

        const boton = $("btnGuardarPasswordUsuario");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const { ok, datos } = await pedir(
                "POST",
                `/configuracion/usuarios/${usuarioEnEdicion.id}/password`,
                { password: $("passUsuarioNueva").value }
            );

            if (!ok) {
                mostrarError("errorPasswordUsuario", datos.mensaje || "No se pudo cambiar.");
                return;
            }

            $("dialogoPassword").close();

            aviso("Contraseña actualizada", "Se cerraron las sesiones abiertas de ese usuario.", "success");

        } catch (error) {

            mostrarError("errorPasswordUsuario", "No se pudo conectar con el servidor.");

        } finally {

            ocupado(boton, false);
        }
    });

    document.querySelectorAll(".config-dialogo").forEach(dialogo => {

        // cerrar al hacer clic fuera del cuadro
        dialogo.addEventListener("click", evento => {
            if (evento.target === dialogo) {
                dialogo.close();
            }
        });
    });


    /* =====================================================
       RECORDATORIOS
    ===================================================== */

    async function cargarRecordatorios() {

        const { ok, datos } = await pedir("GET", "/configuracion/recordatorios");

        if (!ok) return;

        $("recHoras").innerHTML = datos.opciones_horas
            .map(h => `<option value="${h}">${escapar(ETIQUETA_HORAS[h] || h + " horas antes")}</option>`)
            .join("");

        $("recActivo").checked = datos.activo;
        $("recHoras").value = String(datos.horas_antes);
        $("recTexto").value = datos.texto || "";

        const canales = datos.servicio.canales;

        $("recCanales").innerHTML = [
            ["Correo", canales.email],
            ["WhatsApp", canales.whatsapp]
        ].map(([nombre, listo]) =>
            `<span class="recordatorio-canal ${listo ? "listo" : ""}"><i></i>${nombre}: ${listo ? "listo" : "sin configurar"}</span>`
        ).join("");

        const algunCanal = canales.email || canales.whatsapp;

        $("recNotaServicio").textContent = !datos.servicio.habilitado || !algunCanal
            ? "El envío automático todavía no está habilitado en el servidor. Tu proveedor lo activa cuando conecta WhatsApp o el correo; mientras tanto, lo que guardes acá queda listo."
            : "";
    }

    $("formRecordatorios").addEventListener("submit", async evento => {

        evento.preventDefault();

        mostrarError("errorRecordatorios", "");

        const boton = $("btnGuardarRecordatorios");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const { ok, datos } = await pedir("PUT", "/configuracion/recordatorios", {
                activo: $("recActivo").checked,
                horas_antes: Number($("recHoras").value),
                texto: $("recTexto").value
            });

            if (!ok) {
                mostrarError("errorRecordatorios", datos.mensaje || "No se pudo guardar.");
                return;
            }

            aviso("Guardado", "La configuración de recordatorios se actualizó.", "success");

        } catch (error) {

            mostrarError("errorRecordatorios", "No se pudo conectar con el servidor.");

        } finally {

            ocupado(boton, false);
        }
    });


    /* =====================================================
       MI CUENTA
    ===================================================== */

    function cargarCuenta() {

        $("cuentaNombre").value = sesion.usuario.nombre || "";
        $("cuentaEmail").value = sesion.usuario.email;

        const tema = window.QuiroGest.obtenerTema();

        document.querySelectorAll("input[name='tema']").forEach(radio => {
            radio.checked = radio.value === tema;
        });
    }

    $("formCuenta").addEventListener("submit", async evento => {

        evento.preventDefault();

        mostrarError("errorCuenta", "");

        const boton = $("btnGuardarCuenta");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const { ok, datos } = await pedir("PUT", "/configuracion/mi-cuenta", {
                nombre: $("cuentaNombre").value
            });

            if (!ok) {
                mostrarError("errorCuenta", datos.mensaje || "No se pudo guardar.");
                return;
            }

            aviso("Guardado", "Tu nombre se actualizó.", "success");

            window.QuiroGest.recargarSesion();

        } catch (error) {

            mostrarError("errorCuenta", "No se pudo conectar con el servidor.");

        } finally {

            ocupado(boton, false);
        }
    });

    $("formPassword").addEventListener("submit", async evento => {

        evento.preventDefault();

        mostrarError("errorPassword", "");

        const actual = $("passActual").value;
        const nueva = $("passNueva").value;
        const repetir = $("passRepetir").value;

        if (!actual) {
            mostrarError("errorPassword", "Ingresá tu contraseña actual.");
            return;
        }

        if (nueva.length < MIN_PASSWORD) {
            mostrarError("errorPassword", `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres.`);
            return;
        }

        if (nueva !== repetir) {
            mostrarError("errorPassword", "Las contraseñas nuevas no coinciden.");
            return;
        }

        const boton = $("btnCambiarPassword");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const { ok, datos } = await pedir("PUT", "/configuracion/mi-cuenta/password", { actual, nueva });

            if (!ok) {
                mostrarError("errorPassword", datos.mensaje || "No se pudo cambiar la contraseña.");
                return;
            }

            if (datos.token) {
                localStorage.setItem("token", datos.token);
            }

            $("formPassword").reset();

            aviso("Contraseña actualizada", "Tus otras sesiones abiertas se cerraron.", "success");

        } catch (error) {

            mostrarError("errorPassword", "No se pudo conectar con el servidor.");

        } finally {

            ocupado(boton, false);
        }
    });

    document.querySelectorAll("input[name='tema']").forEach(radio => {

        radio.addEventListener("change", () => {

            if (radio.checked) {
                window.QuiroGest.aplicarTema(radio.value);
            }
        });
    });


    /* =====================================================
       INICIO
    ===================================================== */

    function iniciar(datosSesion) {

        if (sesion) return;

        sesion = datosSesion;

        esAdmin = ["administrador", "superadmin"].includes(sesion.usuario.rol);

        document.querySelectorAll("[data-solo-admin]").forEach(tab => {
            tab.hidden = !esAdmin;
        });

        cargarCuenta();

        const pedido = (window.location.hash || "").replace("#", "");

        activarPanel(pedido || (esAdmin ? "consultorio" : "cuenta"));

        if (esAdmin) {
            cargarConsultorio();
            cargarUsuarios();
            cargarRecordatorios();
        }
    }

    if (window.QG_SESION) {
        iniciar(window.QG_SESION);
    } else {
        document.addEventListener("quirogest:sesion", evento => iniciar(evento.detail), { once: true });
    }

    window.addEventListener("hashchange", () => {
        if (sesion) activarPanel((window.location.hash || "").replace("#", ""));
    });

})();
