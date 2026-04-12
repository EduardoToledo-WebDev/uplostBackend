const express = require("express");
const router = express.Router();
const { getArticulos, registrarArticulo, entregarArticulo, eliminarArticulo, getAuditoria, editarArticulo } = require("../controllers/articulos");

router.get("/articulos", getArticulos);
router.post("/articulos", registrarArticulo);
router.put("/articulos/:id", entregarArticulo);
router.delete("/articulos/:id", eliminarArticulo);
router.put("/articulos/editar/:id", editarArticulo);
router.get("/auditoria", getAuditoria);

module.exports = router;