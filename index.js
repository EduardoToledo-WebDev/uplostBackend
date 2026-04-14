const express = require('express');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const cors = require('cors');
const path = require('path');

const app = express();

// ==========================================
// 0. MIDDLEWARES BÁSICOS Y CARPETAS PÚBLICAS
// ==========================================
app.use(express.json());
app.use(cors());


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ==========================================
// 1. CONFIGURACIÓN DEL RATE LIMIT
// ==========================================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Tiempo: 15 minutos
    max: 1000, // Límite: 1000 peticiones por IP en esos 15 minutos
    message: {
        error: "Too Many Requests",
        mensaje: " Estás haciendo demasiadas peticiones. Intenta en 15 minutos."
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
const articulosRoutes = require('./router/routes.js');

// Al poner 'verificarApiKey' aquí, proteges TODAS las rutas de artículos
// Ahora todas tus rutas colgarán de /api (ej. /api/articulos)
app.use('/api', verificarApiKey, articulosRoutes);


// ==========================================
// 4. INICIAR SERVIDOR
// ==========================================
// Es buena práctica usar process.env.PORT por si lo subes a la nube (como Render o Heroku)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});