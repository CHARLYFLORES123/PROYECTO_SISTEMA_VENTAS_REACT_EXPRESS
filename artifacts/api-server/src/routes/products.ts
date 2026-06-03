import { Router } from "express";
import { db, productsTable, categoriesTable, brandsTable } from "@workspace/db";
import { eq, ilike, and, lte, or, sql } from "drizzle-orm";
import { CreateProductBody } from "@workspace/api-zod";
import { verifyToken, requireRoles, requireAdmin, AuthRequest } from "../middlewares/auth";
import { auditLog } from "../lib/audit";

const router = Router();
router.use(verifyToken);

const canWrite = requireRoles(["admin", "inventario"]);

function formatProduct(p: any, categoryName?: string | null, brandName?: string | null) {
  return {
    id: p.id, name: p.name, barcode: p.barcode ?? null, description: p.description ?? null,
    purchasePrice: Number(p.purchasePrice), salePrice: Number(p.salePrice),
    stock: p.stock, minStock: p.minStock,
    categoryId: p.categoryId ?? null, categoryName: categoryName ?? null,
    brandId: p.brandId ?? null, brandName: brandName ?? null,
    imageUrl: p.imageUrl ?? null,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

// GET /api/products
router.get("/", async (req, res) => {
  const { search, categoryId, brandId, lowStock } = req.query as any;
  try {
    const rows = await db
      .select({
        id: productsTable.id, name: productsTable.name, barcode: productsTable.barcode,
        description: productsTable.description, purchasePrice: productsTable.purchasePrice,
        salePrice: productsTable.salePrice, stock: productsTable.stock, minStock: productsTable.minStock,
        categoryId: productsTable.categoryId, categoryName: categoriesTable.name,
        brandId: productsTable.brandId, brandName: brandsTable.name,
        imageUrl: productsTable.imageUrl, createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .where(
        and(
          search ? or(
            ilike(productsTable.name, `%${search}%`),
            ilike(productsTable.barcode ?? sql`''`, `%${search}%`),
            ilike(brandsTable.name ?? sql`''`, `%${search}%`),
          ) : undefined,
          categoryId ? eq(productsTable.categoryId, Number(categoryId)) : undefined,
          brandId ? eq(productsTable.brandId, Number(brandId)) : undefined,
          lowStock === "true" ? lte(productsTable.stock, productsTable.minStock) : undefined,
        )
      )
      .orderBy(productsTable.name);

    res.json(rows.map(r => formatProduct(r, r.categoryName, r.brandName)));
  } catch (err) {
    req.log.error({ err }, "GetProducts error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/products/inventory-report — MUST be before /:id
router.get("/inventory-report", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: productsTable.id, name: productsTable.name, barcode: productsTable.barcode,
        categoryName: categoriesTable.name, brandName: brandsTable.name,
        purchasePrice: productsTable.purchasePrice, salePrice: productsTable.salePrice,
        stock: productsTable.stock, minStock: productsTable.minStock, imageUrl: productsTable.imageUrl,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .orderBy(productsTable.name);

    res.json(rows.map(r => ({
      id: r.id, name: r.name, barcode: r.barcode ?? null,
      categoryName: r.categoryName ?? null, brandName: r.brandName ?? null,
      purchasePrice: Number(r.purchasePrice), salePrice: Number(r.salePrice),
      stock: r.stock, minStock: r.minStock,
      stockValue: Number(r.purchasePrice) * r.stock,
      status: r.stock === 0 ? "Sin stock" : r.stock <= r.minStock ? "Stock bajo" : "OK",
      imageUrl: r.imageUrl ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "GetInventoryReport error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/products — inventario + admin
router.post("/", canWrite, async (req: AuthRequest, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [p] = await db.insert(productsTable).values({
      ...parsed.data,
      purchasePrice: String(parsed.data.purchasePrice),
      salePrice: String(parsed.data.salePrice),
    }).returning();
    res.status(201).json(formatProduct(p));
    auditLog({ req, action: "created", entity: "product", entityId: p.id, entityName: p.name, details: { salePrice: Number(p.salePrice), stock: p.stock } });
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
      .select({ p: productsTable, categoryName: categoriesTable.name, brandName: brandsTable.name })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .where(eq(productsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ message: "Producto no encontrado" }); return; }
    res.json(formatProduct(row.p, row.categoryName, row.brandName));
  } catch (err) {
    req.log.error({ err }, "GetProductById error");
    res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/products/:id — inventario + admin
router.put("/:id", canWrite, async (req: AuthRequest, res) => {
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
    auditLog({ req, action: "updated", entity: "product", entityId: p.id, entityName: p.name, details: { salePrice: Number(p.salePrice), stock: p.stock } });
  } catch (err) {
    req.log.error({ err }, "UpdateProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/products/:id — admin only
router.delete("/:id", requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ message: "Producto eliminado" });
    auditLog({ req, action: "deleted", entity: "product", entityId: id, entityName: p?.name });
  } catch (err) {
    req.log.error({ err }, "DeleteProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
