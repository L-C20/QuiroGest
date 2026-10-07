/* =====================================================
   Retención de respaldos (abuelo - padre - hijo)

   Se conservan:
     · el último respaldo de cada uno de los últimos N días
     · el último de cada una de las últimas M semanas
     · el último de cada uno de los últimos K meses
   El resto se borra. Nunca se borra el más reciente.
===================================================== */

function claveDia(fecha) {

    return fecha.toISOString().slice(0, 10);
}

function claveSemana(fecha) {

    // lunes de esa semana (UTC)
    const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));

    const desfase = (d.getUTCDay() + 6) % 7;

    d.setUTCDate(d.getUTCDate() - desfase);

    return d.toISOString().slice(0, 10);
}

function claveMes(fecha) {

    return fecha.toISOString().slice(0, 7);
}


/**
 * items: [{ clave, fecha: Date }]
 * devuelve las claves que se pueden borrar.
 */
function calcularBorrados(items, { diarios = 7, semanales = 4, mensuales = 12 } = {}) {

    if (items.length === 0) {
        return [];
    }

    // del más nuevo al más viejo
    const ordenados = [...items].sort((a, b) => b.fecha - a.fecha);

    const conservar = new Set();

    conservar.add(ordenados[0].clave);

    function conservarPorGrupo(funcionClave, cantidad) {

        const vistos = new Set();

        for (const item of ordenados) {

            const grupo = funcionClave(item.fecha);

            if (vistos.has(grupo)) {
                continue;
            }

            if (vistos.size >= cantidad) {
                break;
            }

            vistos.add(grupo);

            conservar.add(item.clave);
        }
    }

    conservarPorGrupo(claveDia, diarios);
    conservarPorGrupo(claveSemana, semanales);
    conservarPorGrupo(claveMes, mensuales);

    return ordenados
        .filter(item => !conservar.has(item.clave))
        .map(item => item.clave);
}


module.exports = { calcularBorrados };
