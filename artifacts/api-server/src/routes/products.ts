import { Router } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, and, lte, or, sql } from "drizzle-orm";
import { CreateProductBody, GetProductsQueryParams } from "@workspace/api-zod";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function formatProduct(p: any, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode ?? null,
    description: p.description ?? null,
    purchasePrice: Number(p.purchasePrice),
    salePrice: Number(p.salePrice),
    stock: p.stock,
    minStock: p.minStock,
    categoryId: p.categoryId ?? null,
    categoryName: categoryName ?? null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

// GET /api/products
router.get("/", async (req, res) => {
  const parsed = GetProductsQueryParams.safeParse(req.query);
  const { search, categoryId, lowStock } = parsed.success ? parsed.data : {} as any;

  try {
    const rows = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        barcode: productsTable.barcode,
        description: productsTable.description,
        purchasePrice: productsTable.purchasePrice,
        salePrice: productsTable.salePrice,
        stock: productsTable.stock,
        minStock: productsTable.minStock,
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(
        and(
          search ? or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.barcode ?? sql`''`, `%${search}%`)) : undefined,
          categoryId ? eq(productsTable.categoryId, Number(categoryId)) : undefined,
          lowStock === true || lowStock === "true" ? lte(productsTable.stock, productsTable.minStock) : undefined,
        )
      )
      .orderBy(productsTable.name);

    res.json(rows.map(r => formatProduct(r, r.categoryName)));
  } catch (err) {
    req.log.error({ err }, "GetProducts error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/products/inventory-report  — must be before /:id
router.get("/inventory-report", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        barcode: productsTable.barcode,
        categoryName: categoriesTable.name,
        purchasePrice: productsTable.purchasePrice,
        salePrice: productsTable.salePrice,
        stock: productsTable.stock,
        minStock: productsTable.minStock,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .orderBy(productsTable.name);

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      barcode: r.barcode ?? null,
      categoryName: r.categoryName ?? null,
      purchasePrice: Number(r.purchasePrice),
      salePrice: Number(r.salePrice),
      stock: r.stock,
      minStock: r.minStock,
      stockValue: Number(r.purchasePrice) * r.stock,
      status: r.stock === 0 ? "Sin stock" : r.stock <= r.minStock ? "Stock bajo" : "OK",
    })));
  } catch (err) {
    req.log.error({ err }, "GetInventoryReport error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/products
router.post("/", async (req, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  try {
    const [p] = await db.insert(productsTable).values({
      ...parsed.data,
      purchasePrice: String(parsed.data.purchasePrice),
      salePrice: String(parsed.data.salePrice),
    }).returning();
    res.status(201).json(formatProduct(p));
  } catch (err) {
    req.log.error({ err }, "CreateProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [row] = await db
      .select({ p: productsTable, categoryName: categoriesTable.name })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(eq(productsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ message: "Producto no encontrado" }); return; }
    res.json(formatProduct(row.p, row.categoryName));
  } catch (err) {
    req.log.error({ err }, "GetProductById error");
    res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  try {
    const [p] = await db.update(productsTable).set({
      ...parsed.data,
      purchasePrice: String(parsed.data.purchasePrice),
      salePrice: String(parsed.data.salePrice),
    }).where(eq(productsTable.id, id)).returning();
    if (!p) { res.status(404).json({ message: "Producto no encontrado" }); return; }
    res.json(formatProduct(p));
  } catch (err) {
    req.log.error({ err }, "UpdateProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ message: "Producto eliminado" });
  } catch (err) {
    req.log.error({ err }, "DeleteProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
