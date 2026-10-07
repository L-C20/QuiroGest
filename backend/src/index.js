require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const app = express();
const authRoutes = require("./routes/auth");
const pacientesRoutes = require("./routes/pacientes");
const turnosRoutes = require("./routes/turnos");
const pagosRoutes = require("./routes/pagos");
const recordatoriosRoutes = require("./routes/recordatorios");
const configuracionRoutes = require("./routes/configuracion");
const superadminRoutes = require("./routes/superadmin");
const respaldosRoutes = require("./routes/respaldos");
const respaldos = require("./services/respaldos");
const recordatorios = require("./services/recordatorios");
const { migrar } = require("./database/migraciones");
const verificarToken = require("./middleware/authMiddleware");

app.use(cors());
app.use(express.json({ limit: "600kb" }));
app.use("/auth", authRoutes);
app.use("/pacientes", pacientesRoutes);
app.use("/turnos", turnosRoutes);
app.use("/pagos", verificarToken, pagosRoutes);
app.use("/recordatorios", verificarToken, recordatoriosRoutes);
app.use("/configuracion", configuracionRoutes);
app.use(
    "/superadmin/respaldos",
    verificarToken,
    verificarToken.requerirRol("superadmin"),
    respaldosRoutes
);
app.use("/superadmin", superadminRoutes);

app.get("/health", (req, res) => {
    res.json({
        mensaje: "GestionTec Medical API funcionando"
    });
});

// Datos publicos para la politica de privacidad (sin autenticacion)
app.get("/publico/contacto", (req, res) => {
    res.json({
        empresa: "GestionTec Medical",
        contacto: process.env.PRIVACY_CONTACT_EMAIL || null
    });
});

// Frontend estatico servido por el mismo servicio
const frontendDir = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendDir));
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

const PORT = process.env.PORT || 3000;


migrar()
    .then(() => {

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Servidor GestionTec Medical funcionando en el puerto ${PORT}`);
            recordatorios.iniciar();
            respaldos.iniciar();
        });

    })
    .catch(error => {

        console.error("No se pudo preparar la base de datos:", error);
        process.exit(1);

    });