/* =====================================================
   GESTIONTEC MEDICAL — Reportes
   · Indicadores del período, con comparación contra el anterior
   · Gráficos de ingresos, turnos, medios de pago y horarios
   · Pacientes que dejaron de venir
   · Descarga en CSV para Excel
===================================================== */

(function () {

    "use strict";

    const $ = id => document.getElementById(id);

    const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

    const dinero = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    });

    const dineroExacto = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS"
    });

    const entero = new Intl.NumberFormat("es-AR");

    let ultimo = null;             // último reporte recibido (para exportar)
    let numeroCarga = 0;


    /* ---------- fechas ---------- */

    const dos = n => String(n).padStart(2, "0");
    const iso = d => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

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

    function hoy() {

        const d = new Date();

        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function fechaCorta(texto) {

        const d = desdeIso(texto);

        return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
    }

    function rangoDeAtajo(atajo) {

        const h = hoy();

        switch (atajo) {

            case "mes":
                return [new Date(h.getFullYear(), h.getMonth(), 1), h];

            case "mes-pasado":
                return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0)];

            case "30":
                return [sumarDias(h, -29), h];

            case "90":
                return [sumarDias(h, -89), h];

            case "anio":
                return [new Date(h.getFullYear(), 0, 1), h];
        }

        return [new Date(h.getFullYear(), h.getMonth(), 1), h];
    }


    /* ---------- utilidades ---------- */

    function elemento(etiqueta, clase, texto) {

        const e = document.createElement(etiqueta);

        if (clase) e.className = clase;
        if (texto !== undefined) e.textContent = texto;

        return e;
    }

    function vacio(contenedor, texto) {

        contenedor.replaceChildren(elemento("p", "rep-vacio", texto));
    }

    async function pedir(ruta) {

        const respuesta = await fetch(ruta, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });

        if (respuesta.status === 401) {
            window.QuiroGest.cerrarSesion();
            throw new Error("Sesión vencida");
        }

        const datos = await respuesta.json().catch(() => ({}));

        return { ok: respuesta.ok, status: respuesta.status, datos };
    }


    /* ---------- indicadores ---------- */

    /* variación contra el período anterior; "mejor" dice si subir es bueno */
    function variacion(actual, previo, mejor) {

        if (!previo && !actual) {
            return null;
        }

        if (!previo) {
            return { texto: "Nuevo", clase: "sube" };
        }

        const pct = ((actual - previo) / previo) * 100;

        if (Math.abs(pct) < 0.5) {
            return { texto: "Sin cambios", clase: "igual" };
        }

        const sube = pct > 0;
        const bueno = mejor === "subir" ? sube : !sube;

        return {
            texto: `${sube ? "▲" : "▼"} ${Math.abs(Math.round(pct))}%`,
            clase: bueno ? "sube" : "baja"
        };
    }

    function dibujarKpis(r) {

        const a = r.actual;
        const p = r.previo;

        const kpis = [
            { titulo: "Ingresos", valor: dinero.format(a.ingresos), v: variacion(a.ingresos, p.ingresos, "subir") },
            { titulo: "Turnos", valor: entero.format(a.turnos), v: variacion(a.turnos, p.turnos, "subir") },
            { titulo: "Turnos atendidos", valor: entero.format(a.atendidos), v: variacion(a.atendidos, p.atendidos, "subir") },
            { titulo: "Pacientes nuevos", valor: entero.format(a.pacientes_nuevos), v: variacion(a.pacientes_nuevos, p.pacientes_nuevos, "subir") },
            { titulo: "Pago promedio", valor: dinero.format(a.ticket_promedio), v: variacion(a.ticket_promedio, p.ticket_promedio, "subir") },
            { titulo: "Turnos cancelados", valor: `${Math.round(a.tasa_cancelacion * 100)}%`, nota: `${entero.format(a.cancelados)} de ${entero.format(a.turnos)}`, v: variacion(a.tasa_cancelacion, p.tasa_cancelacion, "bajar") }
        ];

        $("repKpis").replaceChildren(...kpis.map(k => {

            const tarjeta = elemento("article", "rep-kpi");

            tarjeta.appendChild(elemento("span", "rep-kpi-titulo", k.titulo));
            tarjeta.appendChild(elemento("strong", "rep-kpi-valor", k.valor));

            const pie = elemento("div", "rep-kpi-pie");

            if (k.nota) {
                pie.appendChild(elemento("span", "rep-kpi-nota", k.nota));
            }

            if (k.v) {

                const chip = elemento("span", `rep-delta ${k.v.clase}`, k.v.texto);

                chip.title = `Comparado con el período anterior (${fechaCorta(r.anterior.desde)} al ${fechaCorta(r.anterior.hasta)})`;
                pie.appendChild(chip);
            }

            tarjeta.appendChild(pie);

            return tarjeta;
        }));
    }


    /* ---------- series agrupadas ---------- */

    /* ≤ 62 días: por día · ≤ 190: por semana · más: por mes */
    function agrupacion(dias) {
        return dias <= 62 ? "dia" : dias <= 190 ? "semana" : "mes";
    }

    function claveDe(fecha, modo) {

        if (modo === "dia") return fecha;
        if (modo === "semana") return iso(lunesDe(desdeIso(fecha)));

        return fecha.slice(0, 7);
    }

    function crearCubetas(desde, hasta, modo) {

        const cubetas = new Map();
        let d = desdeIso(desde);
        const fin = desdeIso(hasta);

        while (d <= fin) {

            const clave = claveDe(iso(d), modo);

            if (!cubetas.has(clave)) {

                let etiqueta;

                if (modo === "mes") {
                    etiqueta = `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
                } else {
                    const base = modo === "semana" ? desdeIso(clave) : d;
                    etiqueta = `${base.getDate()}/${base.getMonth() + 1}`;
                }

                cubetas.set(clave, { clave, etiqueta, ingresos: 0, atendidos: 0, cancelados: 0, otros: 0 });
            }

            d = sumarDias(d, 1);
        }

        return cubetas;
    }

    function descripcionCubeta(c, modo) {

        if (modo === "mes") {
            const [a, m] = c.clave.split("-").map(Number);
            return `${MESES[m - 1]} ${a}`;
        }

        if (modo === "semana") {
            return `Semana del ${fechaCorta(c.clave)}`;
        }

        return fechaCorta(c.clave);
    }

    function armarSerie(r) {

        const modo = agrupacion(r.rango.dias);
        const cubetas = crearCubetas(r.rango.desde, r.rango.hasta, modo);

        r.ingresos_por_dia.forEach(x => {
            const c = cubetas.get(claveDe(x.fecha, modo));
            if (c) c.ingresos += x.total;
        });

        r.por_dia.forEach(x => {
            const c = cubetas.get(claveDe(x.fecha, modo));
            if (!c) return;
            c.atendidos += x.atendidos;
            c.cancelados += x.cancelados;
            c.otros += x.turnos - x.atendidos - x.cancelados;
        });

        return { modo, cubetas: [...cubetas.values()] };
    }


    /* ---------- gráficos ---------- */

    /* muestra una de cada n etiquetas para que no se pisen */
    function pasoEtiquetas(cantidad) {
        return Math.max(1, Math.ceil(cantidad / 12));
    }

    function graficoBarras(contenedor, cubetas, modo, partes, formato, formatoMaximo) {

        const maximo = Math.max(...cubetas.map(c => partes.reduce((s, p) => s + c[p.campo], 0)), 0);

        if (maximo <= 0) {
            vacio(contenedor, "No hay datos en este período.");
            return;
        }

        const paso = pasoEtiquetas(cubetas.length);
        const caja = elemento("div", "rep-barras-caja");

        caja.style.setProperty("--n", cubetas.length);

        cubetas.forEach((c, i) => {

            const total = partes.reduce((s, p) => s + c[p.campo], 0);

            const col = elemento("div", "rep-col");

            col.title = `${descripcionCubeta(c, modo)}: ${formato(c)}`;

            const pila = elemento("div", "rep-pila");

            pila.style.height = (total / maximo) * 100 + "%";

            partes.forEach(p => {

                if (!c[p.campo]) return;

                const seg = elemento("div", `rep-seg ${p.clase}`);

                seg.style.flexGrow = c[p.campo];
                pila.appendChild(seg);
            });

            col.appendChild(pila);
            col.appendChild(elemento("span", "rep-etiqueta", i % paso === 0 ? c.etiqueta : ""));

            caja.appendChild(col);
        });

        contenedor.replaceChildren(caja);

        if (formatoMaximo) {
            contenedor.insertBefore(elemento("span", "rep-max", `Máximo: ${formatoMaximo(maximo)}`), caja);
        }
    }

    function graficoHorizontal(contenedor, filas, formato) {

        const maximo = Math.max(...filas.map(f => f.valor), 0);

        if (maximo <= 0) {
            vacio(contenedor, "No hay datos en este período.");
            return;
        }

        contenedor.replaceChildren(...filas.map(f => {

            const fila = elemento("div", "rep-fila");

            fila.appendChild(elemento("span", "rep-fila-nombre", f.nombre));

            const pista = elemento("div", "rep-fila-pista");
            const barra = elemento("div", "rep-fila-barra");

            barra.style.width = (f.valor / maximo) * 100 + "%";
            pista.appendChild(barra);

            fila.appendChild(pista);
            fila.appendChild(elemento("span", "rep-fila-valor", formato(f)));

            return fila;
        }));
    }

    function dibujarHoras(r) {

        const contenedor = $("repHoras");
        const datos = r.por_hora;

        if (!datos.length) {
            vacio(contenedor, "No hay datos en este período.");
            return;
        }

        const minimo = Math.min(...datos.map(d => d.hora));
        const maximo = Math.max(...datos.map(d => d.hora));
        const porHora = new Map(datos.map(d => [d.hora, d.turnos]));

        const cubetas = [];

        for (let h = minimo; h <= maximo; h++) {
            cubetas.push({ clave: String(h), etiqueta: `${h}h`, turnos: porHora.get(h) || 0 });
        }

        graficoBarras(contenedor, cubetas, "hora", [{ campo: "turnos", clase: "unica" }],
            c => `${c.turnos} turnos desde las ${c.clave}:00`);

        contenedor.querySelectorAll(".rep-col").forEach((col, i) => {
            col.title = `${cubetas[i].turnos} turnos desde las ${cubetas[i].clave}:00`;
        });
    }

    function dibujarInactivos(r) {

        const cuerpo = $("repInactivos");
        const lista = r.inactivos.pacientes;

        $("repInactivosSub").textContent =
            `Pacientes activos con más de ${r.inactivos.dias} días sin turno (los 15 más recientes)`;

        if (!lista.length) {

            const fila = elemento("tr");
            const celda = elemento("td", "rep-vacio", "Todos los pacientes vinieron hace poco.");

            celda.colSpan = 3;
            fila.appendChild(celda);
            cuerpo.replaceChildren(fila);

            return;
        }

        cuerpo.replaceChildren(...lista.map(p => {

            const fila = elemento("tr");

            fila.appendChild(elemento("td", "", `${p.apellido}, ${p.nombre}`));
            fila.appendChild(elemento("td", "", fechaCorta(p.ultimo_turno)));
            fila.appendChild(elemento("td", "", `${entero.format(p.dias)} días`));

            return fila;
        }));
    }

    function dibujar(r) {

        ultimo = r;

        dibujarKpis(r);

        const { modo, cubetas } = armarSerie(r);

        const unidad = { dia: "por día", semana: "por semana", mes: "por mes" }[modo];

        $("repIngresosSub").textContent =
            `${dinero.format(r.actual.ingresos)} en total · ${unidad}`;

        graficoBarras($("repIngresos"), cubetas, modo, [{ campo: "ingresos", clase: "unica" }],
            c => dineroExacto.format(c.ingresos), v => dinero.format(v));

        graficoBarras($("repTurnos"), cubetas, modo, [
            { campo: "atendidos", clase: "atendido" },
            { campo: "otros", clase: "otros" },
            { campo: "cancelados", clase: "cancelado" }
        ], c => `${c.atendidos} atendidos, ${c.otros} otros, ${c.cancelados} cancelados`, v => `${v} turnos`);

        graficoHorizontal($("repMetodos"),
            r.por_metodo.map(m => ({ nombre: m.metodo, valor: m.total, cantidad: m.cantidad })),
            f => `${dinero.format(f.valor)} · ${f.cantidad}`);

        const semana = DIAS_SEMANA.map((nombre, i) => ({
            nombre,
            valor: (r.por_dia_semana.find(d => d.dia === i) || { turnos: 0 }).turnos
        }));

        graficoHorizontal($("repSemana"), semana, f => String(f.valor));

        dibujarHoras(r);
        dibujarInactivos(r);
    }


    /* ---------- carga ---------- */

    async function cargar(desde, hasta) {

        const error = $("repError");
        const mia = ++numeroCarga;

        error.hidden = true;

        if (!desde || !hasta) {
            error.textContent = "Indicá las dos fechas.";
            error.hidden = false;
            return;
        }

        if (hasta < desde) {
            error.textContent = "La fecha final no puede ser anterior a la inicial.";
            error.hidden = false;
            return;
        }

        $("repKpis").classList.add("cargando");

        try {

            const r = await pedir(`/reportes?desde=${desde}&hasta=${hasta}`);

            if (mia !== numeroCarga) return;

            if (!r.ok) {
                error.textContent = r.status === 403
                    ? "Solo los administradores pueden ver los reportes."
                    : (r.datos.mensaje || "No se pudo generar el reporte.");
                error.hidden = false;
                return;
            }

            dibujar(r.datos);

        } catch (e) {

            if (mia === numeroCarga) {
                error.textContent = "No se pudo conectar con el servidor.";
                error.hidden = false;
            }

        } finally {

            if (mia === numeroCarga) {
                $("repKpis").classList.remove("cargando");
            }
        }
    }

    function aplicarRango(desde, hasta) {

        $("repDesde").value = iso(desde);
        $("repHasta").value = iso(hasta);

        cargar(iso(desde), iso(hasta));
    }


    /* ---------- exportar ---------- */

    function celda(valor) {

        const texto = String(valor ?? "");

        return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    }

    /* Excel en español usa coma decimal y punto y coma como separador */
    const numero = n => String(Math.round(n * 100) / 100).replace(".", ",");

    function exportar() {

        if (!ultimo) return;

        const r = ultimo;
        const a = r.actual;
        const filas = [];

        filas.push(["Reporte GestionTec Medical"]);
        filas.push(["Período", `${r.rango.desde} a ${r.rango.hasta}`]);
        filas.push([]);
        filas.push(["Indicador", "Período", "Período anterior"]);
        filas.push(["Ingresos", numero(a.ingresos), numero(r.previo.ingresos)]);
        filas.push(["Pagos registrados", a.pagos, r.previo.pagos]);
        filas.push(["Pago promedio", numero(a.ticket_promedio), numero(r.previo.ticket_promedio)]);
        filas.push(["Turnos", a.turnos, r.previo.turnos]);
        filas.push(["Atendidos", a.atendidos, r.previo.atendidos]);
        filas.push(["Cancelados", a.cancelados, r.previo.cancelados]);
        filas.push(["Pacientes nuevos", a.pacientes_nuevos, r.previo.pacientes_nuevos]);
        filas.push([]);
        filas.push(["Fecha", "Turnos", "Atendidos", "Cancelados", "Ingresos"]);

        const ingresos = new Map(r.ingresos_por_dia.map(x => [x.fecha, x.total]));
        const turnos = new Map(r.por_dia.map(x => [x.fecha, x]));
        const fechas = [...new Set([...ingresos.keys(), ...turnos.keys()])].sort();

        fechas.forEach(f => {

            const t = turnos.get(f) || { turnos: 0, atendidos: 0, cancelados: 0 };

            filas.push([f, t.turnos, t.atendidos, t.cancelados, numero(ingresos.get(f) || 0)]);
        });

        filas.push([]);
        filas.push(["Medio de pago", "Importe", "Pagos"]);
        r.por_metodo.forEach(m => filas.push([m.metodo, numero(m.total), m.cantidad]));

        const texto = "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");
        const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
        const enlace = document.createElement("a");

        enlace.href = URL.createObjectURL(blob);
        enlace.download = `reporte-${r.rango.desde}_a_${r.rango.hasta}.csv`;

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    }


    /* ---------- arranque ---------- */

    document.querySelectorAll(".rep-atajos button").forEach(b => {

        b.addEventListener("click", () => {

            document.querySelectorAll(".rep-atajos button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));

            const [desde, hasta] = rangoDeAtajo(b.dataset.atajo);

            aplicarRango(desde, hasta);
        });
    });

    $("formRango").addEventListener("submit", evento => {

        evento.preventDefault();

        document.querySelectorAll(".rep-atajos button").forEach(x => x.setAttribute("aria-pressed", "false"));

        cargar($("repDesde").value, $("repHasta").value);
    });

    $("repExportar").addEventListener("click", exportar);

    document.querySelector('.rep-atajos [data-atajo="mes"]').click();

})();
