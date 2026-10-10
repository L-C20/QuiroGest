/* =====================================================
   GESTIONTEC MEDICAL — Agenda visual
   · Vista por día, por semana o en lista
   · Cobro del turno, búsqueda de turnos y recordatorios
   · Clic en un horario libre para agendar
   · Arrastrar un turno para moverlo
   · Bloqueos (vacaciones, feriados, franjas)
   · Horario de la agenda configurable (administrador)
===================================================== */

(function () {

    "use strict";

    const $ = id => document.getElementById(id);

    const CLAVE_VISTA = "gestiontec-agenda-vista";
    const ALTO_SLOT = 40;                  // píxeles por división del calendario
    const REFRESCO_MS = 60000;

    const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
    const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    const dinero = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

    const ETIQUETA_METODO = {
        efectivo: "Efectivo",
        transferencia: "Transferencia",
        mercado_pago: "Mercado Pago",
        tarjeta: "Tarjeta",
        otro: "Otro"
    };

    const ETIQUETA_ESTADO = {
        pendiente: "Pendiente",
        confirmado: "Confirmado",
        atendido: "Atendido",
        cancelado: "Cancelado"
    };

    let vista = leerVista();
    let referencia = hoy();
    let datos = { config: { hora_inicio: 8, hora_fin: 20, intervalo: 30 }, turnos: [], bloqueos: [] };
    let escala = { inicio: 480, fin: 1200, intervalo: 30, px: ALTO_SLOT / 30 };

    let numeroCarga = 0;
    let irAHora = true;                    // llevar el scroll a la hora actual al dibujar
    let arrastrando = null;

    let pacientes = null;                  // [{id, etiqueta}]
    let pacientePorEtiqueta = new Map();

    let edicion = null;                    // turno que se está editando (o null si es nuevo)
    let sobreturnoConfirmado = false;
    let bloqueoAbierto = null;
    let turnoACobrar = null;
    let filtroLista = "todos";
    let recordatoriosCargados = false;


    /* ---------- utilidades de fecha y hora ---------- */

    function hoy() {

        const d = new Date();

        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    const dos = n => String(n).padStart(2, "0");

    function iso(d) {
        return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
    }

    function desdeIso(texto) {

        const [a, m, d] = texto.split("-").map(Number);

        return new Date(a, m - 1, d);
    }

    function sumarDias(d, n) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    }

    function lunesDe(d) {
        return sumarDias(d, -((d.getDay() + 6) % 7));
    }

    function aMinutos(hhmm) {

        const [h, m] = hhmm.split(":").map(Number);

        return h * 60 + m;
    }

    function aHora(min) {
        return `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;
    }

    function leerVista() {

        try {

            const guardada = localStorage.getItem(CLAVE_VISTA);

            if (guardada === "dia" || guardada === "semana" || guardada === "lista") {
                return guardada;
            }

        } catch (e) { /* ignorar */ }

        return window.innerWidth < 700 ? "dia" : "semana";
    }

    function guardarVista() {

        try {
            localStorage.setItem(CLAVE_VISTA, vista);
        } catch (e) { /* ignorar */ }
    }

    function diasDeLaVista() {

        if (vista !== "semana") {
            return [referencia];
        }

        const lunes = lunesDe(referencia);

        return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
    }

    function tituloDeLaVista(dias) {

        const a = dias[0];
        const b = dias[dias.length - 1];

        if (vista !== "semana") {
            return `${NOMBRE_DIA[a.getDay()]} ${a.getDate()} de ${MES_LARGO[a.getMonth()]} de ${a.getFullYear()}`;
        }

        if (a.getMonth() === b.getMonth()) {
            return `${a.getDate()} – ${b.getDate()} de ${MES_LARGO[a.getMonth()]} de ${b.getFullYear()}`;
        }

        const anio = a.getFullYear() === b.getFullYear() ? "" : ` ${a.getFullYear()}`;

        return `${a.getDate()} ${MES_CORTO[a.getMonth()]}${anio} – ${b.getDate()} ${MES_CORTO[b.getMonth()]} ${b.getFullYear()}`;
    }


    /* ---------- red ---------- */

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

        const cuerpoRespuesta = await respuesta.json().catch(() => ({}));

        return { ok: respuesta.ok, status: respuesta.status, datos: cuerpoRespuesta };
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

    function elemento(etiqueta, clase, texto) {

        const e = document.createElement(etiqueta);

        if (clase) e.className = clase;
        if (texto !== undefined) e.textContent = texto;

        return e;
    }


    /* ---------- carga de datos ---------- */

    async function cargar() {

        const dias = diasDeLaVista();
        const desde = iso(dias[0]);
        const hasta = iso(dias[dias.length - 1]);
        const mia = ++numeroCarga;

        $("agCargando").hidden = false;

        try {

            const r = await pedir("GET", `/agenda?desde=${desde}&hasta=${hasta}`);

            if (mia !== numeroCarga) return;     // llegó tarde: ya se pidió otra vista

            if (!r.ok) {
                aviso("Agenda", r.datos.mensaje || "No se pudo cargar la agenda.", "error");
                return;
            }

            datos = r.datos;
            dibujar();

        } catch (e) {

            if (mia === numeroCarga) {
                aviso("Agenda", "No se pudo conectar con el servidor.", "error");
            }

        } finally {

            if (mia === numeroCarga) {
                $("agCargando").hidden = true;
            }
        }
    }

    async function cargarPacientes() {

        if (pacientes) return;

        const r = await pedir("GET", "/pacientes");

        if (!r.ok) {
            throw new Error(r.datos.mensaje || "No se pudieron cargar los pacientes.");
        }

        pacientes = (r.datos.pacientes || [])
            .filter(p => p.activo)
            .map(p => ({
                id: p.id,
                etiqueta: `${p.apellido}, ${p.nombre} — #${p.numero_identificacion}`
            }));

        pacientePorEtiqueta = new Map(pacientes.map(p => [p.etiqueta, p.id]));

        const lista = $("listaPacientes");

        lista.replaceChildren(...pacientes.map(p => {
            const o = document.createElement("option");
            o.value = p.etiqueta;
            return o;
        }));
    }


    /* ---------- dibujo del calendario ---------- */

    function calcularEscala() {

        const c = datos.config;
        let inicio = c.hora_inicio * 60;
        let fin = c.hora_fin * 60;

        /* si hay turnos fuera del horario configurado, se amplía para no esconderlos */
        datos.turnos.forEach(t => {

            const s = aMinutos(t.hora);

            inicio = Math.min(inicio, Math.floor(s / 60) * 60);
            fin = Math.max(fin, Math.min(1440, Math.ceil((s + t.duracion_min) / 60) * 60));
        });

        escala = {
            inicio,
            fin,
            intervalo: c.intervalo,
            px: ALTO_SLOT / c.intervalo,
            configInicio: c.hora_inicio * 60,
            configFin: c.hora_fin * 60
        };
    }

    /* reparte los turnos que se pisan en carriles lado a lado */
    function repartirCarriles(turnos) {

        const orden = turnos
            .map(t => ({ t, ini: aMinutos(t.hora), fin: aMinutos(t.hora) + t.duracion_min }))
            .sort((a, b) => a.ini - b.ini || b.fin - a.fin);

        const resultado = [];
        let grupo = [];
        let finGrupo = -1;

        const cerrar = () => {

            if (!grupo.length) return;

            const total = Math.max(...grupo.map(g => g.carril)) + 1;

            grupo.forEach(g => resultado.push({ ...g, total }));
            grupo = [];
        };

        orden.forEach(item => {

            if (item.ini >= finGrupo) {
                cerrar();
                finGrupo = -1;
            }

            const ocupados = new Set(grupo.filter(g => g.fin > item.ini).map(g => g.carril));

            let carril = 0;

            while (ocupados.has(carril)) carril++;

            item.carril = carril;
            grupo.push(item);
            finGrupo = Math.max(finGrupo, item.fin);
        });

        cerrar();

        return resultado;
    }

    function dibujar() {

        calcularEscala();

        const dias = diasDeLaVista();
        const grilla = $("agGrilla");
        const hoyIso = iso(hoy());
        const alto = (escala.fin - escala.inicio) * escala.px;

        $("agTitulo").textContent = tituloDeLaVista(dias);

        document.querySelectorAll(".agenda-vistas button").forEach(b => {
            b.setAttribute("aria-pressed", String(b.dataset.vista === vista));
        });

        grilla.style.setProperty("--columnas", dias.length);
        grilla.classList.toggle("una-columna", dias.length === 1);

        const enLista = vista === "lista";

        $("agScroll").hidden = enLista;
        $("agLista").hidden = !enLista;
        $("agResumen").hidden = !enLista;
        $("agLeyenda").hidden = enLista;
        $("agAyuda").hidden = enLista;

        if (enLista) {
            dibujarLista();
            return;
        }

        const cabecera = elemento("div", "ag-cabecera");
        cabecera.appendChild(elemento("div", "ag-esquina"));

        dias.forEach(d => {

            const f = iso(d);
            const titulo = elemento("button", "ag-dia-titulo" + (f === hoyIso ? " hoy" : ""));

            titulo.type = "button";
            titulo.dataset.fecha = f;
            titulo.appendChild(elemento("span", "ag-dia-nombre", DIA_CORTO[d.getDay()]));
            titulo.appendChild(elemento("span", "ag-dia-numero", String(d.getDate())));

            if (vista !== "semana") titulo.disabled = true;

            cabecera.appendChild(titulo);
        });

        const cuerpo = elemento("div", "ag-cuerpo");
        cuerpo.style.height = alto + "px";

        /* columna de horas */
        const horas = elemento("div", "ag-horas");

        for (let m = Math.ceil(escala.inicio / 60) * 60; m < escala.fin; m += 60) {

            const e = elemento("span", "ag-hora", aHora(m));

            e.style.top = (m - escala.inicio) * escala.px + "px";
            horas.appendChild(e);
        }

        cuerpo.appendChild(horas);

        const ahora = new Date();
        const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();

        dias.forEach(d => {

            const f = iso(d);
            const col = elemento("div", "ag-col" + (f === hoyIso ? " hoy" : ""));

            col.dataset.fecha = f;
            col.style.setProperty("--alto-slot", ALTO_SLOT + "px");
            col.style.setProperty("--alto-hora", (60 * escala.px) + "px");

            /* zonas fuera del horario de atención */
            if (escala.inicio < escala.configInicio) {
                const z = elemento("div", "ag-fuera");
                z.style.top = "0";
                z.style.height = (escala.configInicio - escala.inicio) * escala.px + "px";
                col.appendChild(z);
            }

            if (escala.fin > escala.configFin) {
                const z = elemento("div", "ag-fuera");
                z.style.top = (escala.configFin - escala.inicio) * escala.px + "px";
                z.style.height = (escala.fin - escala.configFin) * escala.px + "px";
                col.appendChild(z);
            }

            /* bloqueos */
            datos.bloqueos
                .filter(b => b.fecha_desde <= f && b.fecha_hasta >= f)
                .forEach(b => col.appendChild(dibujarBloqueo(b)));

            /* turnos */
            const delDia = datos.turnos.filter(t => t.fecha === f);
            const activos = delDia.filter(t => t.estado !== "cancelado");
            const cancelados = delDia.filter(t => t.estado === "cancelado");

            cancelados.forEach(t => col.appendChild(dibujarTurno(t, 0, 1)));

            repartirCarriles(activos).forEach(x => col.appendChild(dibujarTurno(x.t, x.carril, x.total)));

            /* línea de la hora actual */
            if (f === hoyIso && minutosAhora >= escala.inicio && minutosAhora < escala.fin) {
                const l = elemento("div", "ag-ahora");
                l.style.top = (minutosAhora - escala.inicio) * escala.px + "px";
                col.appendChild(l);
            }

            cuerpo.appendChild(col);
        });

        grilla.replaceChildren(cabecera, cuerpo);

        if (irAHora) {

            irAHora = false;

            const objetivo = dias.some(d => iso(d) === hoyIso) && minutosAhora >= escala.inicio
                ? minutosAhora - 60
                : escala.configInicio - 30;

            $("agScroll").scrollTop = Math.max(0, (objetivo - escala.inicio) * escala.px);
        }
    }

    /* ---------- vista de lista (turnos del día) ---------- */

    const ICONO_EDITAR =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path></svg>';

    function etiquetaPago(t) {

        return t.pago_registrado
            ? `${dinero.format(t.pago_monto)} · ${ETIQUETA_METODO[t.pago_metodo] || t.pago_metodo || "—"}`
            : "";
    }

    function dibujarLista() {

        const f = iso(referencia);
        const turnos = datos.turnos
            .filter(t => t.fecha === f)
            .sort((a, b) => a.hora.localeCompare(b.hora));

        /* contadores: sirven también como filtro */
        const cuenta = { todos: turnos.length, pendiente: 0, confirmado: 0, atendido: 0, cancelado: 0 };

        turnos.forEach(t => { cuenta[t.estado]++; });

        if (filtroLista !== "todos" && !cuenta[filtroLista]) {
            filtroLista = "todos";
        }

        const resumen = $("agResumen");

        resumen.replaceChildren(...[
            ["todos", "Todos"],
            ["pendiente", "Pendientes"],
            ["confirmado", "Confirmados"],
            ["atendido", "Atendidos"],
            ["cancelado", "Cancelados"]
        ].map(([clave, nombre]) => {

            const b = elemento("button", `agenda-contador est-${clave}${filtroLista === clave ? " activo" : ""}`);

            b.type = "button";
            b.dataset.filtro = clave;
            b.setAttribute("aria-pressed", String(filtroLista === clave));
            b.appendChild(elemento("strong", "", String(cuenta[clave])));
            b.appendChild(elemento("span", "", nombre));

            return b;
        }));

        const lista = $("agLista");
        const visibles = filtroLista === "todos" ? turnos : turnos.filter(t => t.estado === filtroLista);
        const bloqueosDelDia = datos.bloqueos.filter(b => b.fecha_desde <= f && b.fecha_hasta >= f);

        const nodos = [];

        bloqueosDelDia.forEach(b => {

            const aviso = elemento("p", "agenda-lista-bloqueo",
                `Bloqueado${b.motivo ? ": " + b.motivo : ""}${b.hora_desde ? ` (${b.hora_desde} a ${b.hora_hasta})` : " todo el día"}`);

            nodos.push(aviso);
        });

        if (!visibles.length) {

            const vacio = elemento("div", "agenda-lista-vacio");

            vacio.appendChild(elemento("p", "", turnos.length ? "No hay turnos con ese estado." : "No hay turnos para este día."));

            const agendar = elemento("button", "primary-button", "+ Nuevo turno");

            agendar.type = "button";
            agendar.dataset.accion = "nuevo";

            vacio.appendChild(agendar);
            nodos.push(vacio);

            lista.replaceChildren(...nodos);

            return;
        }

        const tabla = elemento("table", "agenda-tabla");
        const cabecera = elemento("thead");
        const filaCab = elemento("tr");

        ["Hora", "Paciente", "Estado", "Pago", ""].forEach(t => filaCab.appendChild(elemento("th", "", t)));
        cabecera.appendChild(filaCab);
        tabla.appendChild(cabecera);

        const cuerpo = elemento("tbody");

        visibles.forEach(t => {

            const fila = elemento("tr", `est-${t.estado}`);

            fila.dataset.turno = t.id;

            const hora = elemento("td", "agenda-col-hora");

            hora.appendChild(elemento("strong", "", t.hora));
            hora.appendChild(elemento("small", "", `${t.duracion_min} min`));
            fila.appendChild(hora);

            const paciente = elemento("td", "agenda-col-paciente");

            paciente.appendChild(elemento("strong", "", `${t.apellido}, ${t.nombre}`));

            if (t.dni) paciente.appendChild(elemento("small", "", `DNI ${t.dni}`));

            fila.appendChild(paciente);

            const estado = elemento("td");
            const selector = elemento("select", `agenda-estado est-${t.estado}`);

            selector.dataset.turno = t.id;
            selector.setAttribute("aria-label", "Estado del turno");

            Object.keys(ETIQUETA_ESTADO).forEach(clave => {
                const o = new Option(ETIQUETA_ESTADO[clave], clave);
                o.selected = clave === t.estado;
                selector.appendChild(o);
            });

            estado.appendChild(selector);
            fila.appendChild(estado);

            const pago = elemento("td", "agenda-col-pago");

            if (t.pago_registrado) {

                pago.appendChild(elemento("span", "agenda-chip pagado", etiquetaPago(t)));

            } else {

                const cobrar = elemento("button", "secondary-button agenda-cobrar", "Cobrar");

                cobrar.type = "button";
                cobrar.dataset.accion = "cobrar";
                cobrar.dataset.turno = t.id;
                pago.appendChild(cobrar);
            }

            fila.appendChild(pago);

            const acciones = elemento("td", "agenda-col-acciones");
            const editar = elemento("button", "icono-accion");

            editar.type = "button";
            editar.dataset.accion = "editar";
            editar.dataset.turno = t.id;
            editar.title = "Ver o editar turno";
            editar.setAttribute("aria-label", "Ver o editar turno");
            editar.innerHTML = ICONO_EDITAR;

            acciones.appendChild(editar);
            fila.appendChild(acciones);

            cuerpo.appendChild(fila);
        });

        tabla.appendChild(cuerpo);

        nodos.push(elemento("div", "agenda-tabla-marco"));
        nodos[nodos.length - 1].appendChild(tabla);

        lista.replaceChildren(...nodos);
    }

    async function cambiarEstado(selector) {

        const id = Number(selector.dataset.turno);
        const t = datos.turnos.find(x => x.id === id);

        if (!t || selector.value === t.estado) return;

        selector.disabled = true;

        try {

            const r = await pedir("PATCH", `/turnos/${id}/estado`, { estado: selector.value });

            if (!r.ok) {
                aviso("Agenda", r.datos.mensaje || "No se pudo cambiar el estado.", "error");
                selector.value = t.estado;
                return;
            }

            t.estado = selector.value;
            aviso("Agenda", `Turno ${ETIQUETA_ESTADO[t.estado].toLowerCase()}.`, "success");

            dibujar();

        } catch (e) {

            aviso("Agenda", "No se pudo conectar con el servidor.", "error");
            selector.value = t.estado;

        } finally {

            selector.disabled = false;
        }
    }

    function clicEnLista(evento) {

        const filtro = evento.target.closest("[data-filtro]");

        if (filtro) {
            filtroLista = filtro.dataset.filtro;
            dibujar();
            return;
        }

        const accion = evento.target.closest("[data-accion]");

        if (!accion) return;

        const id = Number(accion.dataset.turno);

        if (accion.dataset.accion === "nuevo") {
            abrirNuevo(iso(referencia), horaRedondaProxima());
        } else if (accion.dataset.accion === "editar") {
            abrirEdicion(id);
        } else if (accion.dataset.accion === "cobrar") {
            abrirPago(datos.turnos.find(t => t.id === id));
        }
    }

    function dibujarBloqueo(b) {

        const parcial = b.hora_desde !== null;
        const ini = parcial ? aMinutos(b.hora_desde) : escala.inicio;
        const fin = parcial ? aMinutos(b.hora_hasta) : escala.fin;

        const e = elemento("div", "ag-bloqueo");

        e.style.top = Math.max(0, (ini - escala.inicio)) * escala.px + "px";
        e.style.height = Math.max(0, Math.min(fin, escala.fin) - Math.max(ini, escala.inicio)) * escala.px + "px";

        const etiqueta = elemento("button", "ag-bloqueo-etiqueta", b.motivo || "Bloqueado");

        etiqueta.type = "button";
        etiqueta.dataset.bloqueo = b.id;
        etiqueta.title = "Ver o quitar bloqueo";

        e.appendChild(etiqueta);

        return e;
    }

    function dibujarTurno(t, carril, total) {

        const ini = aMinutos(t.hora);
        const e = elemento("div", `ag-turno est-${t.estado}`);

        const alto = Math.max(t.duracion_min * escala.px - 2, 18);

        e.style.top = (ini - escala.inicio) * escala.px + 1 + "px";
        e.style.height = alto + "px";

        if (t.estado !== "cancelado") {
            e.style.left = `calc(${(carril / total) * 100}% + 2px)`;
            e.style.width = `calc(${100 / total}% - 4px)`;
        }

        e.dataset.turno = t.id;
        e.dataset.duracion = t.duracion_min;
        e.tabIndex = 0;
        e.setAttribute("role", "button");
        e.draggable = window.matchMedia("(pointer: fine)").matches;

        const nombre = `${t.apellido}, ${t.nombre}`;
        const fin = aHora(ini + t.duracion_min);

        e.title = `${t.hora}–${fin} · ${nombre} · ${ETIQUETA_ESTADO[t.estado]}` +
            (t.pago_registrado ? " · Pago registrado" : "") +
            (t.observaciones ? `\n${t.observaciones}` : "");

        e.setAttribute("aria-label", e.title);

        e.appendChild(elemento("span", "ag-turno-nombre", nombre));

        if (alto >= 34) {
            e.appendChild(elemento("span", "ag-turno-hora", `${t.hora}–${fin}`));
        }

        if (t.pago_registrado) {
            const p = elemento("span", "ag-turno-pago", "$");
            p.setAttribute("aria-hidden", "true");
            e.appendChild(p);
        }

        return e;
    }


    /* ---------- conflictos ---------- */

    function conflictos(fecha, hora, duracion, excluirId) {

        const ini = aMinutos(hora);
        const fin = ini + duracion;

        const turnos = datos.turnos.filter(t =>
            t.fecha === fecha &&
            t.estado !== "cancelado" &&
            t.id !== excluirId &&
            aMinutos(t.hora) < fin &&
            aMinutos(t.hora) + t.duracion_min > ini
        );

        const bloqueo = datos.bloqueos.find(b =>
            b.fecha_desde <= fecha &&
            b.fecha_hasta >= fecha &&
            (b.hora_desde === null || (aMinutos(b.hora_desde) < fin && aMinutos(b.hora_hasta) > ini))
        );

        return { turnos: turnos.length, bloqueo: bloqueo || null };
    }

    function textoConflicto(c) {

        const partes = [];

        if (c.turnos) {
            partes.push(c.turnos === 1 ? "Ya hay un turno en ese horario." : `Ya hay ${c.turnos} turnos en ese horario.`);
        }

        if (c.bloqueo) {
            partes.push(`Ese horario está bloqueado${c.bloqueo.motivo ? " (" + c.bloqueo.motivo + ")" : ""}.`);
        }

        return partes.join(" ");
    }


    /* ---------- diálogo de turno ---------- */

    function limpiarAvisoTurno() {

        sobreturnoConfirmado = false;
        $("avisoTurno").hidden = true;
        $("btnGuardarTurno").textContent = edicion ? "Guardar cambios" : "Agendar";
    }

    async function abrirNuevo(fecha, hora) {

        edicion = null;

        $("turnoTitulo").textContent = "Nuevo turno";
        $("turnoSubtitulo").textContent = "Elegí el paciente y el horario.";
        $("campoPaciente").hidden = false;
        $("pacienteFijo").hidden = true;
        $("campoEstado").hidden = true;
        $("bloquePago").hidden = true;
        $("turPaciente").value = "";
        $("turFecha").value = fecha;
        $("turHora").value = hora;
        $("turDuracion").value = "30";
        $("turObservaciones").value = "";
        $("errorTurno").textContent = "";

        limpiarAvisoTurno();

        $("dialogoTurno").showModal();

        try {
            await cargarPacientes();
        } catch (e) {
            $("errorTurno").textContent = e.message;
        }

        $("turPaciente").focus();
    }

    function abrirEdicion(id) {

        const t = datos.turnos.find(x => x.id === id);

        if (!t) return;

        edicion = t;

        $("turnoTitulo").textContent = "Turno";
        $("turnoSubtitulo").textContent = t.pago_registrado ? "Este turno ya tiene un pago registrado." : "Podés cambiar el horario o el estado.";
        $("campoPaciente").hidden = true;
        $("pacienteFijo").hidden = false;
        $("turPacienteNombre").textContent = `${t.apellido}, ${t.nombre}`;
        $("campoEstado").hidden = false;

        $("bloquePago").hidden = false;
        $("pagoTexto").textContent = t.pago_registrado
            ? `Pago registrado: ${etiquetaPago(t)}`
            : "Este turno todavía no tiene pago registrado.";
        $("btnCobrar").hidden = t.pago_registrado;

        $("turFecha").value = t.fecha;
        $("turHora").value = t.hora;
        $("turEstado").value = t.estado;
        $("turObservaciones").value = t.observaciones || "";
        $("errorTurno").textContent = "";

        const opcion = $("turDuracion").querySelector(`option[value="${t.duracion_min}"]`);

        if (!opcion) {
            const o = document.createElement("option");
            o.value = String(t.duracion_min);
            o.textContent = `${t.duracion_min} minutos`;
            $("turDuracion").appendChild(o);
        }

        $("turDuracion").value = String(t.duracion_min);

        limpiarAvisoTurno();

        $("dialogoTurno").showModal();
    }

    async function guardarTurno(evento) {

        evento.preventDefault();

        const boton = $("btnGuardarTurno");

        if (boton.disabled) return;

        const error = $("errorTurno");

        error.textContent = "";

        const fecha = $("turFecha").value;
        const hora = $("turHora").value;
        const duracion = Number($("turDuracion").value);

        if (!fecha || !/^\d{2}:\d{2}$/.test(hora)) {
            error.textContent = "Indicá fecha y hora.";
            return;
        }

        let pacienteId = null;

        if (!edicion) {

            pacienteId = pacientePorEtiqueta.get($("turPaciente").value.trim());

            if (!pacienteId) {
                error.textContent = "Elegí un paciente de la lista.";
                return;
            }
        }

        /* aviso de superposición o bloqueo: hay que confirmar con un segundo clic */
        if (!sobreturnoConfirmado) {

            const c = conflictos(fecha, hora, duracion, edicion ? edicion.id : null);
            const mensaje = textoConflicto(c);

            if (mensaje) {

                const aviso = $("avisoTurno");

                aviso.textContent = mensaje;
                aviso.hidden = false;
                sobreturnoConfirmado = true;
                boton.textContent = edicion ? "Guardar igualmente" : "Agendar igualmente";

                return;
            }
        }

        ocupado(boton, true);

        try {

            const r = edicion
                ? await pedir("PUT", `/turnos/${edicion.id}`, {
                    fecha,
                    hora,
                    estado: $("turEstado").value,
                    observaciones: $("turObservaciones").value.trim(),
                    duracion_min: duracion
                })
                : await pedir("POST", "/turnos", {
                    paciente_id: pacienteId,
                    fecha,
                    hora,
                    duracion_min: duracion,
                    observaciones: $("turObservaciones").value.trim()
                });

            if (!r.ok) {
                error.textContent = r.datos.mensaje || "No se pudo guardar el turno.";
                return;
            }

            $("dialogoTurno").close();
            aviso("Agenda", edicion ? "Turno actualizado." : "Turno agendado.", "success");

            await irAFecha(fecha);

        } catch (e) {

            error.textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    }

    async function irAFecha(fecha) {

        const d = desdeIso(fecha);
        const visibles = diasDeLaVista().map(iso);

        if (!visibles.includes(fecha)) {
            referencia = d;
        }

        await cargar();
    }


    /* ---------- cobrar ---------- */

    function abrirPago(t) {

        if (!t) return;

        turnoACobrar = t;

        const d = desdeIso(t.fecha);

        $("pagoSubtitulo").textContent =
            `${t.apellido}, ${t.nombre} · ${d.getDate()} ${MES_CORTO[d.getMonth()]} ${t.hora}`;

        $("pagoMonto").value = "";
        $("pagoMetodo").value = "";
        $("pagoObservaciones").value = "";
        $("errorPago").textContent = "";

        if ($("dialogoTurno").open) $("dialogoTurno").close();

        $("dialogoPago").showModal();
        $("pagoMonto").focus();
    }

    async function guardarPago(evento) {

        evento.preventDefault();

        const boton = $("btnGuardarPago");

        if (boton.disabled || !turnoACobrar) return;

        const error = $("errorPago");
        const monto = Number($("pagoMonto").value);

        error.textContent = "";

        if (!Number.isFinite(monto) || monto <= 0) {
            error.textContent = "Ingresá un monto mayor a cero.";
            return;
        }

        if (!$("pagoMetodo").value) {
            error.textContent = "Elegí el medio de pago.";
            return;
        }

        ocupado(boton, true);

        try {

            const r = await pedir("POST", "/pagos", {
                turno_id: turnoACobrar.id,
                monto,
                metodo_pago: $("pagoMetodo").value,
                observaciones: $("pagoObservaciones").value.trim()
            });

            if (!r.ok) {
                error.textContent = r.datos.mensaje || "No se pudo registrar el pago.";

                if (r.status === 409) await cargar();

                return;
            }

            $("dialogoPago").close();
            aviso("Agenda", `Pago de ${dinero.format(monto)} registrado.`, "success");

            await cargar();

        } catch (e) {

            error.textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    }


    /* ---------- buscar turnos ---------- */

    function abrirBuscar() {

        $("busAviso").textContent = "";
        $("busContenedor").hidden = true;
        $("dialogoBuscar").showModal();
        $("busTexto").focus();
    }

    function fechaLarga(f) {

        const d = desdeIso(f);

        return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    async function buscarTurnos(evento) {

        evento.preventDefault();

        const aviso = $("busAviso");
        const parametros = new URLSearchParams();

        if ($("busTexto").value.trim()) parametros.set("q", $("busTexto").value.trim());
        if ($("busEstado").value) parametros.set("estado", $("busEstado").value);
        if ($("busDesde").value) parametros.set("desde", $("busDesde").value);
        if ($("busHasta").value) parametros.set("hasta", $("busHasta").value);

        if (![...parametros.keys()].length) {
            aviso.textContent = "Indicá al menos un filtro para buscar.";
            $("busContenedor").hidden = true;
            return;
        }

        if ($("busDesde").value && $("busHasta").value && $("busDesde").value > $("busHasta").value) {
            aviso.textContent = "La fecha Desde no puede ser posterior a Hasta.";
            return;
        }

        const boton = $("btnBuscarTurnos");

        if (boton.disabled) return;

        ocupado(boton, true, "Buscando…");
        aviso.textContent = "";

        try {

            const r = await pedir("GET", `/turnos?${parametros}`);

            if (!r.ok) {
                aviso.textContent = r.datos.mensaje || "No se pudo realizar la búsqueda.";
                $("busContenedor").hidden = true;
                return;
            }

            const turnos = r.datos.turnos || [];

            $("busContenedor").hidden = false;

            if (!turnos.length) {

                const fila = elemento("tr");
                const celda = elemento("td", "rep-vacio", "No se encontraron turnos con esos filtros.");

                celda.colSpan = 5;
                fila.appendChild(celda);
                $("busTabla").replaceChildren(fila);

                aviso.textContent = "";

                return;
            }

            $("busTabla").replaceChildren(...turnos.map(t => {

                const fila = elemento("tr");

                fila.dataset.turno = t.id;
                fila.dataset.fecha = t.fecha;
                fila.tabIndex = 0;

                fila.appendChild(elemento("td", "", fechaLarga(t.fecha)));
                fila.appendChild(elemento("td", "", t.hora));
                fila.appendChild(elemento("td", "", `${t.apellido}, ${t.nombre}`));

                const estado = elemento("td");

                estado.appendChild(elemento("span", `agenda-chip est-${t.estado}`, ETIQUETA_ESTADO[t.estado] || t.estado));
                fila.appendChild(estado);

                fila.appendChild(elemento("td", "", t.pago_registrado ? "Registrado" : "Sin pago"));

                return fila;
            }));

            aviso.textContent = turnos.length >= 300
                ? "Mostrando los primeros 300 resultados. Afiná la búsqueda."
                : `${turnos.length} ${turnos.length === 1 ? "turno" : "turnos"}`;

        } catch (e) {

            aviso.textContent = "No se pudo conectar con el servidor.";
            $("busContenedor").hidden = true;

        } finally {

            ocupado(boton, false);
        }
    }

    async function abrirResultado(evento) {

        const fila = evento.target.closest("tr[data-turno]");

        if (!fila) return;

        const id = Number(fila.dataset.turno);
        const fecha = fila.dataset.fecha;

        $("dialogoBuscar").close();

        referencia = desdeIso(fecha);

        if (vista === "semana") {
            irAHora = true;
        }

        await cargar();

        abrirEdicion(id);
    }


    /* ---------- recordatorios ---------- */

    const ESTADO_RECORDATORIO = {
        enviado: ["est-atendido", "Enviado"],
        fallido: ["est-cancelado", "Falló"],
        enviando: ["est-pendiente", "Enviando"],
        sin_contacto: ["est-pendiente", "Sin datos de contacto"]
    };

    const CANAL_RECORDATORIO = { email: "Correo", whatsapp: "WhatsApp", ninguno: "—" };

    async function cargarEstadoRecordatorios() {

        try {

            const r = await pedir("GET", "/recordatorios/estado");

            if (!r.ok) throw new Error("estado");

            const e = r.datos;
            const hayCanal = e.canales.email || e.canales.whatsapp;
            const insignia = $("recInsignia");

            insignia.hidden = false;

            if (e.habilitado && hayCanal) {
                insignia.textContent = e.simulacro ? "Simulacro" : "Activos";
                insignia.className = "agenda-insignia activa";
                $("recResumen").textContent = `Se avisa a los pacientes ${e.horasAntes} horas antes del turno.`;
            } else {
                insignia.textContent = "Desactivados";
                insignia.className = "agenda-insignia";
                $("recResumen").textContent = e.habilitado
                    ? "Faltan las claves de un canal para poder enviar."
                    : "Todavía no están activados. Se configuran en el servidor.";
            }

            $("recCanales").replaceChildren(...[["email", "Correo"], ["whatsapp", "WhatsApp"]].map(([clave, nombre]) =>
                elemento("span", `agenda-canal${e.canales[clave] ? " listo" : ""}`,
                    `${nombre}: ${e.canales[clave] ? "listo" : "sin configurar"}`)
            ));

        } catch (e) {

            $("recResumen").textContent = "No se pudo cargar el estado de los recordatorios.";
        }
    }

    async function cargarHistorialRecordatorios() {

        try {

            const r = await pedir("GET", "/recordatorios?limite=30");
            const lista = (r.datos && r.datos.recordatorios) || [];

            if (!r.ok || !lista.length) return;

            $("recTabla").replaceChildren(...lista.map(x => {

                const [clase, texto] = ESTADO_RECORDATORIO[x.estado] || ["", x.estado];
                const fila = elemento("tr");

                fila.appendChild(elemento("td", "", `${fechaLarga(String(x.fecha).slice(0, 10))} ${x.hora}`));
                fila.appendChild(elemento("td", "", `${x.apellido}, ${x.nombre}`));
                fila.appendChild(elemento("td", "", CANAL_RECORDATORIO[x.canal] || x.canal));

                const estado = elemento("td");
                const chip = elemento("span", `agenda-chip ${clase}`, texto);

                if (x.error) chip.title = x.error;

                estado.appendChild(chip);
                fila.appendChild(estado);

                fila.appendChild(elemento("td", "", x.enviado_en
                    ? new Date(x.enviado_en).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                    : "—"));

                return fila;
            }));

        } catch (e) { /* queda el mensaje vacío */ }
    }


    /* ---------- mover arrastrando ---------- */

    function minutosEnColumna(columna, clientY, desfase) {

        const rect = columna.getBoundingClientRect();
        const crudo = (clientY - rect.top) / escala.px - desfase + escala.inicio;
        const ajustado = Math.round(crudo / escala.intervalo) * escala.intervalo;

        return Math.min(Math.max(ajustado, escala.inicio), 1440 - 5);
    }

    function iniciarArrastre(evento) {

        const bloque = evento.target.closest(".ag-turno");

        if (!bloque || !bloque.draggable) return;

        const rect = bloque.getBoundingClientRect();

        arrastrando = {
            id: Number(bloque.dataset.turno),
            duracion: Number(bloque.dataset.duracion),
            desfase: (evento.clientY - rect.top) / escala.px
        };

        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", String(arrastrando.id));

        requestAnimationFrame(() => bloque.classList.add("arrastrando"));
    }

    function sobreColumna(evento) {

        if (!arrastrando) return;

        const col = evento.target.closest(".ag-col");

        if (!col) return;

        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";

        let guia = document.getElementById("agGuia");

        if (!guia) {
            guia = elemento("div", "ag-guia");
            guia.id = "agGuia";
        }

        const min = minutosEnColumna(col, evento.clientY, arrastrando.desfase);

        guia.style.top = (min - escala.inicio) * escala.px + "px";
        guia.style.height = arrastrando.duracion * escala.px + "px";
        guia.textContent = aHora(min);

        if (guia.parentNode !== col) col.appendChild(guia);
    }

    async function soltar(evento) {

        if (!arrastrando) return;

        const col = evento.target.closest(".ag-col");

        evento.preventDefault();

        const movido = arrastrando;

        terminarArrastre();

        if (!col) return;

        const turno = datos.turnos.find(t => t.id === movido.id);

        if (!turno) return;

        /* el turno dura hasta el final del día como máximo */
        let min = minutosEnColumna(col, evento.clientY, movido.desfase);

        if (min + movido.duracion > 1440) {
            min = 1440 - movido.duracion;
        }

        const fecha = col.dataset.fecha;
        const hora = aHora(min);

        if (fecha === turno.fecha && hora === turno.hora) return;

        const c = conflictos(fecha, hora, movido.duracion, turno.id);

        try {

            const r = await pedir("PATCH", `/turnos/${turno.id}/mover`, { fecha, hora });

            if (!r.ok) {
                aviso("Agenda", r.datos.mensaje || "No se pudo mover el turno.", "error");
                return;
            }

            const detalle = textoConflicto(c);

            aviso("Agenda", detalle ? `Turno movido a las ${hora}. ${detalle}` : `Turno movido a las ${hora}.`, detalle ? "info" : "success");

            await cargar();

        } catch (e) {

            aviso("Agenda", "No se pudo conectar con el servidor.", "error");
        }
    }

    function terminarArrastre() {

        arrastrando = null;

        const guia = document.getElementById("agGuia");

        if (guia) guia.remove();

        document.querySelectorAll(".ag-turno.arrastrando").forEach(e => e.classList.remove("arrastrando"));
    }


    /* ---------- bloqueos ---------- */

    function abrirNuevoBloqueo(fecha) {

        $("bloDesde").value = fecha;
        $("bloHasta").value = fecha;
        $("bloTodoDia").checked = true;
        $("bloMotivo").value = "";
        $("errorBloqueo").textContent = "";

        alternarHorasBloqueo();

        $("dialogoBloqueo").showModal();
    }

    function alternarHorasBloqueo() {

        const parcial = !$("bloTodoDia").checked;

        $("campoBloHoraDesde").hidden = !parcial;
        $("campoBloHoraHasta").hidden = !parcial;
    }

    async function guardarBloqueo(evento) {

        evento.preventDefault();

        const boton = $("btnGuardarBloqueo");

        if (boton.disabled) return;

        const error = $("errorBloqueo");

        error.textContent = "";

        const cuerpo = {
            fecha_desde: $("bloDesde").value,
            fecha_hasta: $("bloHasta").value,
            motivo: $("bloMotivo").value.trim()
        };

        if (!cuerpo.fecha_desde || !cuerpo.fecha_hasta) {
            error.textContent = "Indicá las fechas.";
            return;
        }

        if (cuerpo.fecha_hasta < cuerpo.fecha_desde) {
            error.textContent = "La fecha final no puede ser anterior a la inicial.";
            return;
        }

        if (!$("bloTodoDia").checked) {

            cuerpo.hora_desde = $("bloHoraDesde").value;
            cuerpo.hora_hasta = $("bloHoraHasta").value;

            if (!cuerpo.hora_desde || !cuerpo.hora_hasta || cuerpo.hora_hasta <= cuerpo.hora_desde) {
                error.textContent = "La hora final tiene que ser posterior a la inicial.";
                return;
            }
        }

        ocupado(boton, true);

        try {

            const r = await pedir("POST", "/agenda/bloqueos", cuerpo);

            if (!r.ok) {
                error.textContent = r.datos.mensaje || "No se pudo bloquear el horario.";
                return;
            }

            $("dialogoBloqueo").close();
            aviso("Agenda", "Horario bloqueado.", "success");

            await irAFecha(cuerpo.fecha_desde);

        } catch (e) {

            error.textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    }

    function abrirBloqueo(id) {

        const b = datos.bloqueos.find(x => x.id === id);

        if (!b) return;

        bloqueoAbierto = b;

        const fecha = f => {
            const d = desdeIso(f);
            return `${d.getDate()} ${MES_CORTO[d.getMonth()]} ${d.getFullYear()}`;
        };

        $("quitarBloqueoTitulo").textContent = b.motivo || "Horario bloqueado";

        $("quitarBloqueoDetalle").textContent =
            (b.fecha_desde === b.fecha_hasta ? fecha(b.fecha_desde) : `Del ${fecha(b.fecha_desde)} al ${fecha(b.fecha_hasta)}`) +
            (b.hora_desde ? ` · de ${b.hora_desde} a ${b.hora_hasta}` : " · todo el día");

        $("errorQuitarBloqueo").textContent = "";

        $("dialogoQuitarBloqueo").showModal();
    }

    async function quitarBloqueo() {

        const boton = $("btnQuitarBloqueo");

        if (boton.disabled || !bloqueoAbierto) return;

        ocupado(boton, true, "Quitando…");

        try {

            const r = await pedir("DELETE", `/agenda/bloqueos/${bloqueoAbierto.id}`);

            if (!r.ok) {
                $("errorQuitarBloqueo").textContent = r.datos.mensaje || "No se pudo quitar el bloqueo.";
                return;
            }

            $("dialogoQuitarBloqueo").close();
            aviso("Agenda", "Bloqueo quitado.", "success");

            await cargar();

        } catch (e) {

            $("errorQuitarBloqueo").textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    }


    /* ---------- horario de la agenda ---------- */

    function abrirHorario() {

        const inicio = $("horInicio");
        const fin = $("horFin");

        if (!inicio.options.length) {

            for (let h = 0; h <= 23; h++) {
                inicio.appendChild(new Option(`${dos(h)}:00`, String(h)));
            }

            for (let h = 1; h <= 24; h++) {
                fin.appendChild(new Option(`${dos(h % 24)}:00${h === 24 ? " (medianoche)" : ""}`, String(h)));
            }
        }

        inicio.value = String(datos.config.hora_inicio);
        fin.value = String(datos.config.hora_fin);
        $("horIntervalo").value = String(datos.config.intervalo);
        $("errorHorario").textContent = "";

        $("dialogoHorario").showModal();
    }

    async function guardarHorario(evento) {

        evento.preventDefault();

        const boton = $("btnGuardarHorario");

        if (boton.disabled) return;

        const cuerpo = {
            hora_inicio: Number($("horInicio").value),
            hora_fin: Number($("horFin").value),
            intervalo: Number($("horIntervalo").value)
        };

        if (cuerpo.hora_fin <= cuerpo.hora_inicio) {
            $("errorHorario").textContent = "La hora final tiene que ser posterior a la inicial.";
            return;
        }

        ocupado(boton, true);

        try {

            const r = await pedir("PUT", "/agenda/config", cuerpo);

            if (!r.ok) {
                $("errorHorario").textContent = r.datos.mensaje || "No se pudo guardar el horario.";
                return;
            }

            $("dialogoHorario").close();
            aviso("Agenda", "Horario guardado.", "success");

            irAHora = true;
            await cargar();

        } catch (e) {

            $("errorHorario").textContent = "No se pudo conectar con el servidor.";

        } finally {

            ocupado(boton, false);
        }
    }


    /* ---------- eventos ---------- */

    function moverVista(sentido) {

        referencia = sumarDias(referencia, sentido * (vista === "semana" ? 7 : 1));
        irAHora = true;
        cargar();
    }

    function horaRedondaProxima() {

        const ahora = new Date();
        const base = Math.ceil((ahora.getHours() * 60 + ahora.getMinutes()) / 30) * 30;
        const min = Math.min(Math.max(base, datos.config.hora_inicio * 60), 1410);

        return aHora(min);
    }

    function clicEnGrilla(evento) {

        const turno = evento.target.closest(".ag-turno");

        if (turno) {
            abrirEdicion(Number(turno.dataset.turno));
            return;
        }

        const etiqueta = evento.target.closest(".ag-bloqueo-etiqueta");

        if (etiqueta) {
            abrirBloqueo(Number(etiqueta.dataset.bloqueo));
            return;
        }

        const titulo = evento.target.closest(".ag-dia-titulo");

        if (titulo && !titulo.disabled) {
            referencia = desdeIso(titulo.dataset.fecha);
            vista = "dia";
            guardarVista();
            irAHora = true;
            cargar();
            return;
        }

        const col = evento.target.closest(".ag-col");

        if (col) {

            const rect = col.getBoundingClientRect();
            const crudo = (evento.clientY - rect.top) / escala.px + escala.inicio;
            const min = Math.min(Math.floor(crudo / escala.intervalo) * escala.intervalo, 1410);

            abrirNuevo(col.dataset.fecha, aHora(min));
        }
    }

    function conectarEventos() {

        $("agHoy").addEventListener("click", () => {
            referencia = hoy();
            irAHora = true;
            cargar();
        });

        $("agAnterior").addEventListener("click", () => moverVista(-1));
        $("agSiguiente").addEventListener("click", () => moverVista(1));

        document.querySelectorAll(".agenda-vistas button").forEach(b => {
            b.addEventListener("click", () => {
                vista = b.dataset.vista;
                guardarVista();
                irAHora = true;
                cargar();
            });
        });

        $("agNuevo").addEventListener("click", () => abrirNuevo(iso(referencia), horaRedondaProxima()));
        $("agBloquear").addEventListener("click", () => abrirNuevoBloqueo(iso(referencia)));
        $("agHorario").addEventListener("click", abrirHorario);
        $("agBuscar").addEventListener("click", abrirBuscar);

        $("agLista").addEventListener("click", clicEnLista);
        $("agResumen").addEventListener("click", clicEnLista);

        $("agLista").addEventListener("change", evento => {

            const selector = evento.target.closest("select.agenda-estado");

            if (selector) cambiarEstado(selector);
        });

        $("btnCobrar").addEventListener("click", () => abrirPago(edicion));
        $("formPago").addEventListener("submit", guardarPago);
        $("btnCancelarPago").addEventListener("click", () => $("dialogoPago").close());

        $("formBuscar").addEventListener("submit", buscarTurnos);
        $("btnCerrarBuscar").addEventListener("click", () => $("dialogoBuscar").close());
        $("busTabla").addEventListener("click", abrirResultado);

        $("busTabla").addEventListener("keydown", evento => {

            if (evento.key === "Enter") abrirResultado(evento);
        });

        $("agRecordatorios").addEventListener("toggle", () => {

            if ($("agRecordatorios").open && !recordatoriosCargados) {
                recordatoriosCargados = true;
                cargarHistorialRecordatorios();
            }
        });

        const grilla = $("agGrilla");

        grilla.addEventListener("click", clicEnGrilla);

        grilla.addEventListener("keydown", evento => {

            const turno = evento.target.closest && evento.target.closest(".ag-turno");

            if (turno && (evento.key === "Enter" || evento.key === " ")) {
                evento.preventDefault();
                abrirEdicion(Number(turno.dataset.turno));
            }
        });

        grilla.addEventListener("dragstart", iniciarArrastre);
        grilla.addEventListener("dragover", sobreColumna);
        grilla.addEventListener("drop", soltar);
        grilla.addEventListener("dragend", terminarArrastre);

        $("formTurno").addEventListener("submit", guardarTurno);
        $("btnCancelarTurno").addEventListener("click", () => $("dialogoTurno").close());

        ["turFecha", "turHora", "turDuracion"].forEach(id => {
            $(id).addEventListener("input", limpiarAvisoTurno);
        });

        $("formBloqueo").addEventListener("submit", guardarBloqueo);
        $("btnCancelarBloqueo").addEventListener("click", () => $("dialogoBloqueo").close());
        $("bloTodoDia").addEventListener("change", alternarHorasBloqueo);

        $("btnQuitarBloqueo").addEventListener("click", quitarBloqueo);
        $("btnCerrarQuitarBloqueo").addEventListener("click", () => $("dialogoQuitarBloqueo").close());

        $("formHorario").addEventListener("submit", guardarHorario);
        $("btnCancelarHorario").addEventListener("click", () => $("dialogoHorario").close());

        /* actualización silenciosa para ver los cambios de otras personas */
        setInterval(() => {

            if (document.visibilityState !== "visible" || arrastrando || document.querySelector("dialog[open]")) {
                return;
            }

            cargar();

        }, REFRESCO_MS);
    }

    conectarEventos();
    cargar();
    cargarEstadoRecordatorios();

})();
