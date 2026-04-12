const express = require('express');
const rateLimit = require('express-rate-limit');
require('dotenv').config(); // Indispensable para leer el .env

const app = express();
app.use(express.json());

// ==========================================
// 1. CONFIGURACIÓN DEL RATE LIMIT
// ==========================================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Tiempo: 15 minutos
    max: 100, // Límite: 100 peticiones por IP en esos 15 minutos
    message: {
        error: "Too Many Requests",
        mensaje: "Calma lince, estás haciendo demasiadas peticiones. Intenta en 15 minutos."
    }
});

// Aplicamos el límite a TODA la API
app.use(limiter);


// ==========================================
// 2. MIDDLEWARE: SEGURIDAD POR API KEY
// ==========================================
const verificarApiKey = (req, res, next) => {
    // Buscamos la llave en los headers de la petición
    const apiKeyRecibida = req.headers['x-api-key'];

    // Comparamos con la llave secreta de tu archivo .env
    if (!apiKeyRecibida || apiKeyRecibida !== process.env.API_KEY_LABORATORIO) {
        return res.status(401).json({
            error: "Unauthorized",
            mensaje: "Acceso denegado. API Key faltante o incorrecta."
        });
    }

    next(); // Si la llave es correcta, deja pasar la petición
};

// ==========================================
// 3. RUTAS PROTEGIDAS
// ==========================================
const articulosRoutes = require('./router/routes');

// Al poner 'verificarApiKey' aquí, proteges TODAS las rutas de artículos
app.use('/api', verificarApiKey, articulosRoutes);

// Iniciar servidor
app.listen(3000, () => {
    console.log("Servidor corriendo en puerto 3000");
});