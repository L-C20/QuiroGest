const API_URL = "http://localhost:3000";

const formulario = document.getElementById("loginForm");
const mensajeError = document.getElementById("loginError");


formulario.addEventListener("submit", async (e) => {

    e.preventDefault();

    mensajeError.textContent = "";


    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;


    try {

        const respuesta = await fetch(`${API_URL}/auth/login`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })

        });


        const datos = await respuesta.json();


        if (!respuesta.ok) {

            mensajeError.textContent =
                datos.mensaje || "Error al iniciar sesión";

            return;

        }


        localStorage.setItem("token", datos.token);


        window.location.href = "index.html";


    } catch (error) {

        console.error("Error:", error);

        mensajeError.textContent =
            "No se pudo conectar con el servidor.";

    }

});