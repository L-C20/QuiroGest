/* =====================================================
   GESTIONTEC MEDICAL — Respaldos (solo super admin)

     GET  /superadmin/respaldos            estado y últimos respaldos
     POST /superadmin/respaldos/ejecutar   respaldo ahora, al almacenamiento externo
     GET  /superadmin/respaldos/descargar  respaldo cifrado para guardar en tu equipo
===================================================== */

const express = require("express");

const pool = require("../database/connection");
const respaldos = require("../services/respaldos");

const router = express.Router();


async function auditar(req, accion, detalle) {

    try {

        await pool.query(
            `
            INSERT INTO auditoria (usuario_id, consultorio_id, accion, detalle)
            VALUES ($1, $2, $3, $4)
            `,
            [req.usuario.id, null, accion, detalle]
        );

    } catch (error) {

        console.error("No se pudo registrar la auditoría:", error.message);
    }
}


router.get("/", async (req, res) => {

    try {

        res.json({
            estado: respaldos.estado(),
            historial: await respaldos.listar(15)
        });

    } catch (error) {

        console.error("Error consultando respaldos:", error);

        res.status(500).json({ mensaje: "Error interno del servidor" });
    }
});


router.post("/ejecutar", async (req, res) => {

    try {

        const resultado = await respaldos.ejecutar({ tipo: "manual" });

        if (resultado.omitido) {
            return res.status(409).json({ mensaje: resultado.omitido });
        }

        await auditar(req, "respaldo_manual", resultado.archivo);

        res.json({
            mensaje: "Respaldo creado correctamente.",
            ...resultado
        });

    } catch (error) {

        if (error instanceof respaldos.ErrorDeConfiguracion) {
            return res.status(400).json({ mensaje: error.message });
        }

        console.error("Error creando respaldo:", error);

        res.status(500).json({
            mensaje: "No se pudo crear el respaldo. Revisá el historial para ver el detalle."
        });
    }
});


router.get("/descargar", async (req, res) => {

    try {

        const generado = await respaldos.descargar();

        await auditar(req, "respaldo_descarga", generado.archivo);

        res.set({
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${generado.archivo}"`,
            "Content-Length": generado.datos.length,
            "Cache-Control": "no-store"
        });

        res.send(generado.datos);

    } catch (error) {

        if (error instanceof respaldos.ErrorDeConfiguracion) {
            return res.status(400).json({ mensaje: error.message });
        }

        console.error("Error generando respaldo para descarga:", error);

        res.status(500).json({ mensaje: "No se pudo generar el respaldo." });
    }
});


module.exports = router;
