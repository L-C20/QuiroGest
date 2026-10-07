/* =====================================================
   GESTIONTEC MEDICAL — Panel del proveedor (solo super admin)
===================================================== */

(function () {

    const $ = id => document.getElementById(id);

    const MIN_PASSWORD = 10;

    const ACCIONES = {
        crear_consultorio: "Alta de consultorio",
        renombrar_consultorio: "Cambio de nombre",
        suspender_consultorio: "Suspensión",
        reactivar_consultorio: "Reactivación",
        entrar_consultorio: "Ingreso de soporte",
        soporte_modificacion: "Cambio en soporte"
    };

    let consultorios = [];
    let miConsultorio = null;
    let enEdicion = null;
    let sesion = null;


    const ICONOS = {
        entrar: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\"></path><path d=\"M10 17l5-5-5-5\"></path><path d=\"M15 12H3\"></path></svg>",
        renombrar: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 20h9\"></path><path d=\"M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z\"></path></svg>",
        suspender: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M10 9v6M14 9v6\"></path></svg>",
        reactivar: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"></circle><path d=\"M10 8.5l6 3.5-6 3.5z\"></path></svg>"
    };

    function botonIcono(accion, id, titulo, nombre, clase) {

        return `<button type="button" class="icono-accion ${clase || ""}" data-accion="${accion}" data-id="${id}" title="${titulo}" aria-label="${titulo}: ${escapar(nombre)}">${ICONOS[clase === "reactivar" ? "reactivar" : accion === "estado" ? "suspender" : accion]}</button>`;
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

    function ocupado(boton, estado, texto) {

        if (estado) {
            boton.dataset.texto = boton.textContent;
            boton.textContent = texto || "Guardando…";
            boton.disabled = true;
        } else {
            boton.textContent = boton.dataset.texto || boton.textContent;
            boton.disabled = false;
        }
    }

    function fecha(valor, conHora) {

        if (!valor) return "—";

        return new Date(valor).toLocaleString("es-AR", conHora
            ? { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }
            : { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function generarPassword() {

        // sin caracteres ambiguos (0/O, 1/l/I) para poder dictarla o copiarla sin errores
        const letras = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        const valores = new Uint32Array(16);

        crypto.getRandomValues(valores);

        return Array.from(valores, v => letras[v % letras.length]).join("");
    }


    /* ---------- lista ---------- */

    async function cargar() {

        const { ok, datos } = await pedir("GET", "/superadmin/consultorios");

        if (!ok) {
            $("consultoriosCuerpo").innerHTML =
                "<tr><td colspan=\"7\" class=\"config-vacio\">No se pudieron cargar los consultorios.</td></tr>";
            return;
        }

        consultorios = datos.consultorios;
        miConsultorio = datos.miConsultorio;

        dibujarResumen();
        dibujarTabla();
    }

    function dibujarResumen() {

        const suma = campo => consultorios.reduce((t, c) => t + (c[campo] || 0), 0);

        $("totActivos").textContent = consultorios.filter(c => c.activo).length;
        $("totSuspendidos").textContent = consultorios.filter(c => !c.activo).length;
        $("totUsuarios").textContent = suma("usuarios");
        $("totPacientes").textContent = suma("pacientes");
    }

    function dibujarTabla() {

        const q = $("buscarConsultorio").value.trim().toLowerCase();

        const visibles = consultorios.filter(c =>
            !q ||
            c.nombre.toLowerCase().includes(q) ||
            (c.administrador || "").toLowerCase().includes(q)
        );

        if (visibles.length === 0) {
            $("consultoriosCuerpo").innerHTML =
                `<tr><td colspan="7" class="config-vacio">${consultorios.length ? "Sin resultados." : "Todavía no hay consultorios."}</td></tr>`;
            return;
        }

        $("consultoriosCuerpo").innerHTML = visibles.map(c => {

            const estado = c.activo
                ? "<span class=\"appointment-status status-confirmed\">Activo</span>"
                : "<span class=\"appointment-status status-cancelled\">Suspendido</span>";

            const propio = c.id === miConsultorio ? " <small class=\"config-tu\">(el tuyo)</small>" : "";

            return `
                <tr>
                    <td>
                        <div class="patient-name">
                            <strong>${escapar(c.nombre)}${propio}</strong>
                            <span>${escapar(c.administrador || "Sin administrador")}</span>
                        </div>
                    </td>
                    <td>${estado}</td>
                    <td>${c.usuarios}</td>
                    <td>${c.pacientes}</td>
                    <td>${c.turnos}</td>
                    <td>${fecha(c.creado_en)}</td>
                    <td>
                        <div class="config-acciones">
                            ${botonIcono("entrar", c.id, "Entrar al consultorio (soporte)", c.nombre, "principal")}
                            ${botonIcono("renombrar", c.id, "Cambiar nombre", c.nombre)}
                            ${c.activo
                                ? botonIcono("estado", c.id, "Suspender consultorio", c.nombre, "peligro")
                                : botonIcono("estado", c.id, "Reactivar consultorio", c.nombre, "reactivar")}
                        </div>
                    </td>
                </tr>`;

        }).join("");
    }

    $("buscarConsultorio").addEventListener("input", dibujarTabla);

    $("consultoriosCuerpo").addEventListener("click", async evento => {

        const boton = evento.target.closest("[data-accion]");

        if (!boton) return;

        const consultorio = consultorios.find(c => c.id === Number(boton.dataset.id));

        if (!consultorio) return;

        if (boton.dataset.accion === "entrar") {
            entrar(consultorio, boton);
        }

        if (boton.dataset.accion === "renombrar") {

            enEdicion = consultorio;
            $("renombrarNombre").value = consultorio.nombre;
            $("errorRenombrar").textContent = "";
            $("dialogoRenombrar").showModal();
            $("renombrarNombre").select();
        }

        if (boton.dataset.accion === "estado") {

            const activar = !consultorio.activo;

            const ejecutar = async () => {

                const { ok, datos } = await pedir(
                    "PATCH",
                    `/superadmin/consultorios/${consultorio.id}/estado`,
                    { activo: activar }
                );

                if (!ok) {
                    aviso("No se pudo completar", datos.mensaje || "Intentá nuevamente.", "error");
                    return;
                }

                aviso(
                    activar ? "Consultorio reactivado" : "Consultorio suspendido",
                    activar
                        ? `${consultorio.nombre} vuelve a tener acceso.`
                        : `${consultorio.nombre} ya no puede ingresar.`,
                    "success"
                );

                cargar();
                cargarActividad();
            };

            if (!activar && typeof confirmarAccion === "function") {

                confirmarAccion(
                    "Suspender consultorio",
                    `Todos los usuarios de «${consultorio.nombre}» quedarán sin acceso hasta que lo reactives. Sus datos no se borran.`,
                    ejecutar,
                    "Suspender"
                );

            } else {

                ejecutar();
            }
        }
    });


    /* ---------- entrar como soporte ---------- */

    async function entrar(consultorio, boton) {

        boton.disabled = true;

        try {

            const { ok, datos } = await pedir("POST", `/superadmin/consultorios/${consultorio.id}/entrar`);

            if (!ok) {
                aviso("No se pudo entrar", datos.mensaje || "Intentá nuevamente.", "error");
                boton.disabled = false;
                return;
            }

            // se conserva la sesión propia para poder volver al panel
            if (!sesion || !sesion.soporte) {
                localStorage.setItem("token_super", localStorage.getItem("token"));
            }

            localStorage.setItem("token", datos.token);

            window.location.href = "index.html";

        } catch (error) {

            boton.disabled = false;
        }
    }


    /* ---------- renombrar ---------- */

    $("btnCancelarRenombrar").addEventListener("click", () => $("dialogoRenombrar").close());

    $("formRenombrar").addEventListener("submit", async evento => {

        evento.preventDefault();

        $("errorRenombrar").textContent = "";

        const nombre = $("renombrarNombre").value.trim();

        if (!nombre) {
            $("errorRenombrar").textContent = "Ingresá un nombre.";
            return;
        }

        const boton = $("btnGuardarRenombrar");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true);

        try {

            const { ok, datos } = await pedir("PUT", `/superadmin/consultorios/${enEdicion.id}`, { nombre });

            if (!ok) {
                $("errorRenombrar").textContent = datos.mensaje || "No se pudo guardar.";
                return;
            }

            $("dialogoRenombrar").close();
            aviso("Guardado", "El nombre se actualizó.", "success");
            cargar();
            cargarActividad();

        } catch (error) {

            $("errorRenombrar").textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    });


    /* ---------- alta ---------- */

    $("btnNuevoConsultorio").addEventListener("click", () => {

        $("formConsultorioNuevo").reset();
        $("nuevoPassword").value = generarPassword();
        $("errorConsultorioNuevo").textContent = "";
        $("dialogoConsultorio").showModal();
        $("nuevoNombre").focus();
    });

    $("btnGenerarPassword").addEventListener("click", () => {
        $("nuevoPassword").value = generarPassword();
    });

    $("btnCancelarNuevo").addEventListener("click", () => $("dialogoConsultorio").close());

    $("formConsultorioNuevo").addEventListener("submit", async evento => {

        evento.preventDefault();

        const error = $("errorConsultorioNuevo");

        error.textContent = "";

        const nombre = $("nuevoNombre").value.trim();
        const email = $("nuevoEmail").value.trim();
        const password = $("nuevoPassword").value;

        if (!nombre) {
            error.textContent = "Ingresá el nombre del consultorio.";
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            error.textContent = "Ingresá un correo válido para el administrador.";
            return;
        }

        if (password.length < MIN_PASSWORD) {
            error.textContent = `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
            return;
        }

        const boton = $("btnCrearConsultorio");

        if (boton.disabled) {
            return;
        }

        ocupado(boton, true, "Creando…");

        try {

            const { ok, datos } = await pedir("POST", "/superadmin/consultorios", {
                nombre,
                nombreAdmin: $("nuevoAdminNombre").value,
                email,
                password
            });

            if (!ok) {
                error.textContent = datos.mensaje || "No se pudo crear el consultorio.";
                return;
            }

            $("dialogoConsultorio").close();

            $("credencialesTexto").textContent =
                `Sistema: ${window.location.origin}\n` +
                `Consultorio: ${nombre}\n` +
                `Usuario: ${email}\n` +
                `Contraseña: ${password}`;

            $("dialogoCredenciales").showModal();

            cargar();
            cargarActividad();

        } catch (e) {

            error.textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    });

    $("btnCopiarCredenciales").addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText($("credencialesTexto").textContent);
            aviso("Copiado", "Los datos de acceso están en el portapapeles.", "success");

        } catch (e) {

            aviso("No se pudo copiar", "Seleccioná el texto y copialo a mano.", "warning");
        }
    });

    $("btnCerrarCredenciales").addEventListener("click", () => {

        $("credencialesTexto").textContent = "";
        $("dialogoCredenciales").close();
    });

    document.querySelectorAll(".config-dialogo").forEach(dialogo => {

        // los datos de acceso solo se cierran con el botón (para no perderlos sin querer)
        if (dialogo.id === "dialogoCredenciales") return;

        dialogo.addEventListener("click", evento => {
            if (evento.target === dialogo) dialogo.close();
        });
    });


    /* ---------- actividad ---------- */

    async function cargarActividad() {

        const { ok, datos } = await pedir("GET", "/superadmin/actividad");

        if (!ok) return;

        if (datos.actividad.length === 0) {
            $("actividadCuerpo").innerHTML =
                "<tr><td colspan=\"4\" class=\"config-vacio\">Todavía no hay actividad.</td></tr>";
            return;
        }

        $("actividadCuerpo").innerHTML = datos.actividad.map(a => `
            <tr>
                <td>${fecha(a.creado_en, true)}</td>
                <td>${escapar(ACCIONES[a.accion] || a.accion)}</td>
                <td>${escapar(a.consultorio || "—")}</td>
                <td class="proveedor-detalle">${escapar(a.detalle || "")}</td>
            </tr>`).join("");
    }


    /* ---------- respaldos ---------- */

    let estadoRespaldos = null;

    function bytes(valor) {

        const n = Number(valor);

        if (!Number.isFinite(n) || n <= 0) return "—";

        return n < 1024 * 1024
            ? `${(n / 1024).toFixed(1)} KB`
            : `${(n / 1024 / 1024).toFixed(2)} MB`;
    }

    function dibujarEstadoRespaldos(estado, historial) {

        estadoRespaldos = estado;

        const chip = (texto, listo) =>
            `<span class="recordatorio-canal ${listo ? "listo" : ""}"><i></i>${texto}</span>`;

        $("respaldosEstado").innerHTML = [
            chip(`Clave de cifrado: ${estado.claveConfigurada ? "lista" : "falta"}`, estado.claveConfigurada),
            chip(`Almacenamiento externo: ${estado.almacenamientoConfigurado ? "listo" : "sin configurar"}`, estado.almacenamientoConfigurado),
            chip(
                estado.automatico
                    ? `Automático: diario desde las ${estado.hora}:00 · conserva ${estado.retencion.diarios} diarios, ${estado.retencion.semanales} semanales y ${estado.retencion.mensuales} mensuales`
                    : "Automático: desactivado",
                estado.automatico
            )
        ].join("");

        $("btnRespaldarAhora").disabled = !estado.automatico;
        $("btnRespaldarAhora").title = estado.automatico
            ? "Crea ahora un respaldo en el almacenamiento externo"
            : "Primero configurá la clave de cifrado y el almacenamiento externo";

        $("btnDescargarRespaldo").disabled = !estado.claveConfigurada;
        $("btnDescargarRespaldo").title = estado.claveConfigurada
            ? "Descarga un respaldo cifrado a tu equipo"
            : "Primero configurá la clave de cifrado";

        // aviso si el respaldo automático no se está haciendo
        const alerta = $("respaldosAlerta");

        let mensaje = "";
        let gravedad = "alerta";

        if (estado.errorClave) {

            mensaje = estado.errorClave;

        } else if (estado.automatico) {

            const ultimoAutomatico = historial.find(h => h.tipo === "automatico");

            const ultimoGuardado = historial.find(
                h => h.destino === "almacenamiento" && h.estado === "ok"
            );

            if (ultimoAutomatico && ultimoAutomatico.estado === "error") {

                mensaje = "El último respaldo automático falló. Revisá el detalle en la tabla.";

            } else if (!ultimoGuardado) {

                mensaje = `Todavía no hay respaldos en el almacenamiento externo. El primero automático se hará a partir de las ${estado.hora}:00, o podés crearlo ahora.`;
                gravedad = "info";

            } else if ((Date.now() - new Date(ultimoGuardado.creado_en).getTime()) / 36e5 > 36) {

                mensaje = "Hace más de 36 horas que no se guarda un respaldo en el almacenamiento externo.";
            }

        } else if (!estado.claveConfigurada || !estado.almacenamientoConfigurado) {

            mensaje = "Los respaldos automáticos están desactivados: faltan variables en Railway. " +
                "Sin respaldos externos, un problema con la base podría significar pérdida de datos.";
        }

        alerta.textContent = mensaje;
        alerta.hidden = !mensaje;
        alerta.classList.toggle("info", gravedad === "info");
    }

    function dibujarHistorialRespaldos(historial) {

        if (historial.length === 0) {
            $("respaldosCuerpo").innerHTML =
                "<tr><td colspan=\"6\" class=\"config-vacio\">Todavía no se hizo ningún respaldo.</td></tr>";
            return;
        }

        $("respaldosCuerpo").innerHTML = historial.map(h => {

            const estado = h.estado === "ok"
                ? "<span class=\"appointment-status status-confirmed\">Correcto</span>"
                : "<span class=\"appointment-status status-cancelled\">Falló</span>";

            const detalle = h.estado === "ok"
                ? `${h.filas ?? "—"} filas · ${h.duracion_ms ? (h.duracion_ms / 1000).toFixed(1) + " s" : ""}`
                : (h.error || "");

            return `
                <tr>
                    <td>${fecha(h.creado_en, true)}</td>
                    <td>${h.tipo === "automatico" ? "Automático" : "Manual"}</td>
                    <td>${h.destino === "descarga" ? "Descarga" : "Almacenamiento"}</td>
                    <td>${estado}</td>
                    <td>${bytes(h.bytes)}</td>
                    <td class="proveedor-detalle">${escapar(detalle)}</td>
                </tr>`;

        }).join("");
    }

    async function cargarRespaldos() {

        try {

            const { ok, datos } = await pedir("GET", "/superadmin/respaldos");

            if (!ok) return;

            dibujarEstadoRespaldos(datos.estado, datos.historial);
            dibujarHistorialRespaldos(datos.historial);

        } catch (error) {
            /* sesión vencida: ya se redirige */
        }
    }

    $("btnRespaldarAhora").addEventListener("click", async () => {

        const boton = $("btnRespaldarAhora");

        if (boton.disabled) return;

        ocupado(boton, true, "Respaldando…");

        try {

            const { ok, datos } = await pedir("POST", "/superadmin/respaldos/ejecutar", {});

            if (!ok) {
                aviso("No se pudo respaldar", datos.mensaje || "Revisá el historial.", "error");
            } else {
                aviso("Respaldo creado", `${datos.filas} filas · ${bytes(datos.bytes)}.`, "success");
            }

        } catch (error) {

            aviso("No se pudo respaldar", "No se pudo conectar con el servidor.", "error");

        } finally {

            ocupado(boton, false);

            if (estadoRespaldos) {
                $("btnRespaldarAhora").disabled = !estadoRespaldos.automatico;
            }

            cargarRespaldos();
            cargarActividad();
        }
    });

    $("btnDescargarRespaldo").addEventListener("click", async () => {

        const boton = $("btnDescargarRespaldo");

        if (boton.disabled) return;

        ocupado(boton, true, "Preparando…");

        try {

            const respuesta = await fetch("/superadmin/respaldos/descargar", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`
                }
            });

            if (respuesta.status === 401) {
                window.QuiroGest.cerrarSesion();
                return;
            }

            if (!respuesta.ok) {

                const datos = await respuesta.json().catch(() => ({}));

                aviso("No se pudo descargar", datos.mensaje || "Intentá nuevamente.", "error");
                return;
            }

            const disposicion = respuesta.headers.get("Content-Disposition") || "";
            const coincidencia = /filename="([^"]+)"/.exec(disposicion);
            const nombre = coincidencia ? coincidencia[1] : "respaldo.gtbak";

            const url = URL.createObjectURL(await respuesta.blob());

            const enlace = document.createElement("a");

            enlace.href = url;
            enlace.download = nombre;

            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();

            setTimeout(() => URL.revokeObjectURL(url), 5000);

            aviso("Respaldo descargado", "Guardalo en un lugar seguro junto con la clave de cifrado.", "success");

        } catch (error) {

            aviso("No se pudo descargar", "No se pudo conectar con el servidor.", "error");

        } finally {

            ocupado(boton, false);

            if (estadoRespaldos) {
                $("btnDescargarRespaldo").disabled = !estadoRespaldos.claveConfigurada;
            }

            cargarRespaldos();
        }
    });


    /* ---------- inicio ---------- */

    function iniciar(datosSesion) {

        sesion = datosSesion;

        if (sesion.usuario.rol !== "superadmin") {
            window.location.replace("index.html");
            return;
        }

        cargar();
        cargarActividad();
        cargarRespaldos();
    }

    if (window.QG_SESION) {
        iniciar(window.QG_SESION);
    } else {
        document.addEventListener("quirogest:sesion", evento => iniciar(evento.detail), { once: true });
    }

})();
