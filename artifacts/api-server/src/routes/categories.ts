import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { CreateCategoryBody } from "@workspace/api-zod";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        description: categoriesTable.description,
        createdAt: categoriesTable.createdAt,
        productCount: count(productsTable.id),
      })
      .from(categoriesTable)
      .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
      .groupBy(categoriesTable.id)
      .orderBy(categoriesTable.name);

    res.json(rows.map(r => ({ ...r, productCount: Number(r.productCount), createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "GetCategories error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/categories
router.post("/", async (req, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  try {
    const [cat] = await db.insert(categoriesTable).values(parsed.data).returning();
    res.status(201).json({ ...cat, productCount: 0, createdAt: cat.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "CreateCategory error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/categories/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id)).limit(1);
    if (!cat) { res.status(404).json({ message: "Categoría no encontrada" }); return; }
    res.json({ ...cat, productCount: 0, createdAt: cat.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "GetCategoryById error");
    res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/categories/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  try {
    const [cat] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, id)).returning();
    if (!cat) { res.status(404).json({ message: "Categoría no encontrada" }); return; }
    res.json({ ...cat, productCount: 0, createdAt: cat.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "UpdateCategory error");
    res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/categories/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ message: "Categoría eliminada" });
  } catch (err) {
    req.log.error({ err }, "DeleteCategory error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
