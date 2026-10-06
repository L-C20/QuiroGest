const express = require("express");
const router = express.Router();

const recordatorios = require("../services/recordatorios");


/* Estado de la configuración (qué canales están listos) */

router.get("/estado", (req, res) => {

    res.json(recordatorios.estadoConfiguracion());
});


/* Últimos recordatorios registrados */

router.get("/", async (req, res) => {

    try {

        const limite = Math.min(Number(req.query.limite) || 50, 200);

        res.json({
            recordatorios: await recordatorios.listarRecientes(limite)
        });

    } catch (error) {

        console.error("Error listando recordatorios:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
});


/* Ejecuta una revisión ahora mismo (útil para probar) */

router.post("/ejecutar", async (req, res) => {

    try {

        res.json(await recordatorios.procesar());

    } catch (error) {

        console.error("Error ejecutando recordatorios:", error);

        res.status(500).json({
            mensaje: "Error interno del servidor"
        });
    }
});


module.exports = router;
