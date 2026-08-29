require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const authRoutes = require("./routes/auth");
const pacientesRoutes = require("./routes/pacientes");
const turnosRoutes = require("./routes/turnos");
const pagosRoutes = require("./routes/pagos");

app.use(cors());
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/pacientes", pacientesRoutes);
app.use("/turnos", turnosRoutes);
app.use("/pagos", pagosRoutes);

app.get("/", (req, res) => {
    res.json({
        mensaje: "QUIROGEST API funcionando"
    });
});

const PORT = process.env.PORT || 3000;


app.listen(PORT, () => {
    console.log(`Servidor QUIROGEST funcionando en el puerto ${PORT}`);
});