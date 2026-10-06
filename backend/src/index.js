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
const recordatorios = require("./services/recordatorios");
const verificarToken = require("./middleware/authMiddleware");

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/pacientes", pacientesRoutes);
app.use("/turnos", turnosRoutes);
app.use("/pagos", verificarToken, pagosRoutes);
app.use("/recordatorios", verificarToken, recordatoriosRoutes);

app.get("/health", (req, res) => {
    res.json({
        mensaje: "QUIROGEST API funcionando"
    });
});

// Frontend estatico servido por el mismo servicio
const frontendDir = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendDir));
app.get("/", (req, res) => {
    res.redirect("/login.html");
});

const PORT = process.env.PORT || 3000;


app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor QUIROGEST funcionando en el puerto ${PORT}`);
    recordatorios.iniciar();
});