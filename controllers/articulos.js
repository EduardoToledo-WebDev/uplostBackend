const fs = require("fs");
const path = require("path");

const DIR_DATA = "./data";
const PATH_ARTICULOS = "./data/articulos.json";
const PATH_AUDITORIA = "./data/auditoria.json";

// ==========================================
// INICIALIZACIÓN AUTOMÁTICA DE ARCHIVOS
// ==========================================
const inicializarBaseDeDatos = () => {
    try {
        // 1. Crear carpeta si no existe
        if (!fs.existsSync(DIR_DATA)) {
            fs.mkdirSync(DIR_DATA);
            console.log(" Carpeta 'data' creada.");
        }

        // 2. Crear articulos.json si no existe
        if (!fs.existsSync(PATH_ARTICULOS)) {
            fs.writeFileSync(PATH_ARTICULOS, "[\n]");
            console.log(" Archivo articulos.json creado.");
        }

        // 3. Crear auditoria.json si no existe
        if (!fs.existsSync(PATH_AUDITORIA)) {
            fs.writeFileSync(PATH_AUDITORIA, "[\n]");
            console.log(" Archivo auditoria.json creado.");
        }
    } catch (error) {
        console.error(" ya Error al inicializar los archivos:", error.message);
    }
};

// Ejecutamos la función apenas el archivo sea leído por Node
inicializarBaseDeDatos();
// ==========================================
// FUNCIÓN AUXILIAR: TRAZABILIDAD 
// ==========================================
const registrarMovimiento = (evento, autor, detalles) => {
    try {
        const logs = JSON.parse(fs.readFileSync(PATH_AUDITORIA, "utf-8"));
        logs.push({
            id_movimiento: Date.now().toString(),
            evento: evento,
            autor: autor,
            detalles: detalles,
            timestamp: new Date().toISOString()
        });
        fs.writeFileSync(PATH_AUDITORIA, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error("Error al registrar auditoría:", error.message);
    }
};

// ==========================================
// CONTROLADORES DE ARTÍCULOS (EL CRUD)
// ==========================================

// 1. Consultas (Read)
const getArticulos = (req, res) => {
    try {
        const articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));
        res.json(articulos);
    } catch (error) {
        res.status(500).json({ error: "Fallo en el servidor", detalle: error.message });
    }
};

// 2. Altas (Create)
const registrarArticulo = (req, res) => {
    try {
        const { nombre, descripcion, lugar, reportado_por } = req.body;

        // Validación estricta (Error 400)
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
            entregado_a: null
        };

        articulos.push(nuevoArticulo);
        fs.writeFileSync(PATH_ARTICULOS, JSON.stringify(articulos, null, 2));

        // Auditoría Automática
        registrarMovimiento("Alta de artículo", "Laboratorista", `Se registró: ${nombre}`);

        // TODO: Aquí irá el código de Nodemailer para disparar el correo

        res.status(201).json({ mensaje: "Artículo registrado con éxito", articulo: nuevoArticulo });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: error.message });
    }
};

// 3. Actualizaciones (Update - Marcar como Entregado)
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

        // Auditoría Automática
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

        // Validación 400: No permitir campos obligatorios vacíos
        if (!nombre || !lugar || !reportado_por) {
            return res.status(400).json({
                error: "Bad Request",
                mensaje: "Nombre, lugar y reportado_por son obligatorios para editar."
            });
        }

        const articulos = JSON.parse(fs.readFileSync(PATH_ARTICULOS, "utf-8"));
        const index = articulos.findIndex(a => a.id === id);

        // Validación 404: Si el ID no existe
        if (index === -1) {
            return res.status(404).json({ error: "Not Found", mensaje: "El artículo no existe." });
        }

        const nombreAnterior = articulos[index].nombre;

        // Actualizamos los campos manteniendo el ID y la fecha original
        articulos[index] = {
            ...articulos[index],
            nombre,
            descripcion: descripcion || articulos[index].descripcion,
            lugar,
            reportado_por
        };

        fs.writeFileSync(PATH_ARTICULOS, JSON.stringify(articulos, null, 2));

        // AUDITORÍA AUTOMÁTICA: Registramos el cambio
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

// 4. Bajas (Delete)
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

        // Auditoría Automática
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
        res.json(logs.reverse()); // Muestra los más recientes primero
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error", detalle: "No se pudo cargar la bitácora." });
    }
};

module.exports = {
    getArticulos,
    registrarArticulo,
    entregarArticulo,
    eliminarArticulo,
    getAuditoria,
    editarArticulo
};