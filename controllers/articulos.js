const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const DIR_DATA = "./data";
const PATH_ARTICULOS = "./data/articulos.json";
const PATH_AUDITORIA = "./data/auditoria.json";

// ==========================================
// INICIALIZACIÓN AUTOMÁTICA DE ARCHIVOS
// ==========================================
const inicializarBaseDeDatos = () => {
    try {
        if (!fs.existsSync(DIR_DATA)) {
            fs.mkdirSync(DIR_DATA);
            console.log(" Carpeta 'data' creada.");
        }
        if (!fs.existsSync(PATH_ARTICULOS)) {
            fs.writeFileSync(PATH_ARTICULOS, "[\n]");
            console.log(" Archivo articulos.json creado.");
        }
        if (!fs.existsSync(PATH_AUDITORIA)) {
            fs.writeFileSync(PATH_AUDITORIA, "[\n]");
            console.log(" Archivo auditoria.json creado.");
        }
    } catch (error) {
        console.error(" Error al inicializar los archivos:", error.message);
    }
};

inicializarBaseDeDatos();

// ==========================================
// SERVICIO DE TERCEROS: ENVÍO DE CORREOS
// ==========================================
const enviarCorreoAuditoria = async (datosMovimiento) => {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Uplost Alertas <onboarding@resend.dev>', // Correo base que te da Resend
            to: process.env.EMAIL_DESTINO,
            subject: `🚨 Alerta Uplost: ${datosMovimiento.evento}`,
            html: `
                <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px; border-radius: 10px; max-width: 600px;">
                    <h2 style="color: #2563eb; margin-top: 0;">Notificación del Sistema Uplost</h2>
                    <p>Se ha registrado un nuevo movimiento en la bitácora:</p>
                    <hr style="border: 1px solid #f3f4f6;" />
                    <p><strong>Evento:</strong> <span style="background-color: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${datosMovimiento.evento}</span></p>
                    <p><strong>Autor:</strong> ${datosMovimiento.autor}</p>
                    <p><strong>Detalles:</strong> ${datosMovimiento.detalles}</p>
                    <p><strong>Fecha:</strong> ${new Date(datosMovimiento.timestamp).toLocaleString('es-MX')}</p>
                    <hr style="border: 1px solid #f3f4f6;" />
                    <p style="font-size: 11px; color: #9ca3af; text-align: center;">Este es un mensaje automático del servidor AWS EC2.</p>
                </div>
            `
        });

        if (error) {
            console.error("Error de Resend:", error);
            return;
        }
        console.log("Correo de auditoría enviado con éxito (ID:", data.id, ")");
    } catch (err) {
        console.error("Error al procesar correo:", err.message);
    }
};

// ==========================================
// FUNCIÓN AUXILIAR: TRAZABILIDAD 
// ==========================================
const registrarMovimiento = (evento, autor, detalles) => {
    try {
        const logs = JSON.parse(fs.readFileSync(PATH_AUDITORIA, "utf-8"));

        const nuevoMovimiento = {
            id_movimiento: Date.now().toString(),
            evento: evento,
            autor: autor,
            detalles: detalles,
            timestamp: new Date().toISOString()
        };

        logs.push(nuevoMovimiento);
        fs.writeFileSync(PATH_AUDITORIA, JSON.stringify(logs, null, 2));

        // 2. Ejecutamos el envío de correo en segundo plano
        // No bloquea la respuesta principal del servidor
        enviarCorreoAuditoria(nuevoMovimiento);

    } catch (error) {
        console.error("Error al registrar auditoría:", error.message);
    }
};

// ==========================================
// CONFIGURACIÓN DE MULTER (SUBIDA DE IMÁGENES)
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// ==========================================
// CONTROLADORES DE ARTÍCULOS (EL CRUD)
// ==========================================

const getArticulos = (req, res) => {
    try {
        const articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));
        res.json(articulos);
    } catch (error) {
        res.status(500).json({ error: "Fallo en el servidor", detalle: error.message });
    }
};

const registrarArticulo = (req, res) => {
    try {
        const { nombre, descripcion, lugar, reportado_por } = req.body;
        const rutaImagen = req.file ? req.file.filename : null;

        if (!nombre || !lugar || !reportado_por) {
            return res.status(400).json({
                error: "Bad Request",
                mensaje: "Nombre, lugar y quien reporta son campos obligatorios."
            });
        }

        const articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));

        const nuevoArticulo = {
            id: Date.now().toString(),
            nombre,
            descripcion: descripcion || "Sin descripción",
            lugar,
            fecha_registro: new Date().toISOString(),
            estado: "disponible",
            reportado_por,
            entregado_a: null,
            imagen: rutaImagen
        };

        articulos.push(nuevoArticulo);
        fs.writeFileSync(PATH_ARTICULOS, JSON.stringify(articulos, null, 2));

        // Registra el movimiento 
        registrarMovimiento("Alta de artículo", "Laboratorista", `Se registró: ${nombre}`);

        res.status(201).json({ mensaje: "Artículo registrado con éxito", articulo: nuevoArticulo });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: error.message });
    }
};

const entregarArticulo = (req, res) => {
    try {
        const { id } = req.params;
        const { entregado_a } = req.body;

        if (!entregado_a) {
            return res.status(400).json({
                error: "Bad Request",
                mensaje: "Debes indicar a quién se le entregó el artículo."
            });
        }

        const articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));
        const index = articulos.findIndex(a => a.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Not Found", mensaje: "El artículo solicitado no existe." });
        }

        articulos[index].estado = "entregado";
        articulos[index].entregado_a = entregado_a;

        fs.writeFileSync(PATH_ARTICULOS, JSON.stringify(articulos, null, 2));

        registrarMovimiento("Entrega", "Laboratorista", `Se entregó '${articulos[index].nombre}' a ${entregado_a}`);

        res.json({ mensaje: "Entrega registrada correctamente", articulo: articulos[index] });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: error.message });
    }
};

const editarArticulo = (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, lugar, reportado_por } = req.body;

        if (!nombre || !lugar || !reportado_por) {
            return res.status(400).json({
                error: "Bad Request",
                mensaje: "Nombre, lugar y reportado_por son obligatorios para editar."
            });
        }

        const articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));
        const index = articulos.findIndex(a => a.id === id);

        if (index === -1) {
            return res.status(404).json({ error: "Not Found", mensaje: "El artículo no existe." });
        }

        const nombreAnterior = articulos[index].nombre;

        articulos[index] = {
            ...articulos[index],
            nombre,
            descripcion: descripcion || articulos[index].descripcion,
            lugar,
            reportado_por
        };

        fs.writeFileSync(PATH_ARTICULOS, JSON.stringify(articulos, null, 2));

        registrarMovimiento(
            "Edición de datos",
            "Laboratorista",
            `Se corrigieron los datos de: ${nombreAnterior}`
        );

        res.json({ mensaje: "Datos corregidos con éxito", articulo: articulos[index] });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: error.message });
    }
};

const eliminarArticulo = (req, res) => {
    try {
        const { id } = req.params;
        let articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));

        const articuloAEliminar = articulos.find(a => a.id === id);

        if (!articuloAEliminar) {
            return res.status(404).json({ error: "Not Found", mensaje: "No se encontró el artículo a eliminar." });
        }

        articulos = articulos.filter(a => a.id !== id);
        fs.writeFileSync(PATH_ARTICULOS, JSON.stringify(articulos, null, 2));

        registrarMovimiento("Eliminación", "Laboratorista", `Se eliminó el registro: ${articuloAEliminar.nombre}`);

        res.json({ mensaje: "Artículo eliminado de la base de datos." });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: error.message });
    }
};

// ==========================================
// CONTROLADOR DE AUDITORÍA
// ==========================================
const getAuditoria = (req, res) => {
    try {
        const logs = JSON.parse(fs.readFileSync(PATH_AUDITORIA, "utf-8"));
        res.json(logs.reverse());
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: "No se pudo cargar la bitácora." });
    }
};

// Exportamos todos los controladores 
module.exports = {
    getArticulos,
    registrarArticulo,
    entregarArticulo,
    editarArticulo,
    eliminarArticulo,
    getAuditoria,
    upload
};