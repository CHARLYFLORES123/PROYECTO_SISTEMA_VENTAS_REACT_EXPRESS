import { Router } from "express";
import { db, productsTable, categoriesTable, brandsTable, suppliersTable, inventoryDocumentItemsTable } from "@workspace/db";
import { eq, ilike, and, lte, or, sql } from "drizzle-orm";
import { CreateProductBody } from "@workspace/api-zod";
import { verifyToken, requireRoles, requireAdmin, AuthRequest } from "../middlewares/auth";
import { auditLog } from "../lib/audit";

const router = Router();
router.use(verifyToken);

const canWrite = requireRoles(["admin", "inventario"]);

function isDuplicateSku(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    error.code === "23505" && "constraint" in error &&
    error.constraint === "products_sku_unique";
}

function formatProduct(p: any, categoryName?: string | null, brandName?: string | null, supplierName?: string | null) {
  const purchasePrice = Number(p.purchasePrice);
  const salePrice = Number(p.salePrice);
  const imageUrls: string[] = Array.isArray(p.imageUrls) && p.imageUrls.length
    ? p.imageUrls
    : p.imageUrl ? [p.imageUrl] : [];
  return {
    id: p.id, name: p.name, sku: p.sku ?? null, barcode: p.barcode ?? null, description: p.description ?? null,
    size: p.size ?? null, color: p.color ?? null,
    subcategory: p.subcategory ?? null, material: p.material ?? null,
    season: p.season ?? null, gender: p.gender ?? null,
    supplierId: p.supplierId ?? null, supplierName: supplierName ?? null,
    entryDate: p.entryDate instanceof Date ? p.entryDate.toISOString().slice(0, 10) : p.entryDate,
    purchasePrice, salePrice,
    wholesalePrice: p.wholesalePrice == null ? null : Number(p.wholesalePrice),
    promotionalPrice: p.promotionalPrice == null ? null : Number(p.promotionalPrice),
    profitMargin: salePrice > 0 ? Number((((salePrice - purchasePrice) / salePrice) * 100).toFixed(2)) : 0,
    stock: p.stock, minStock: p.minStock,
    categoryId: p.categoryId ?? null, categoryName: categoryName ?? null,
    brandId: p.brandId ?? null, brandName: brandName ?? null,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
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
        sku: productsTable.sku,
        description: productsTable.description, purchasePrice: productsTable.purchasePrice,
        size: productsTable.size, color: productsTable.color,
        subcategory: productsTable.subcategory, material: productsTable.material,
        season: productsTable.season, gender: productsTable.gender,
        supplierId: productsTable.supplierId, supplierName: suppliersTable.name,
        entryDate: productsTable.entryDate,
        wholesalePrice: productsTable.wholesalePrice, promotionalPrice: productsTable.promotionalPrice,
        salePrice: productsTable.salePrice, stock: productsTable.stock, minStock: productsTable.minStock,
        categoryId: productsTable.categoryId, categoryName: categoriesTable.name,
        brandId: productsTable.brandId, brandName: brandsTable.name,
        imageUrl: productsTable.imageUrl, imageUrls: productsTable.imageUrls, createdAt: productsTable.createdAt,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(
        and(
          search ? or(
            ilike(productsTable.name, `%${search}%`),
            ilike(productsTable.sku ?? sql`''`, `%${search}%`),
            ilike(productsTable.barcode ?? sql`''`, `%${search}%`),
            ilike(productsTable.subcategory ?? sql`''`, `%${search}%`),
            ilike(productsTable.material ?? sql`''`, `%${search}%`),
            ilike(productsTable.season ?? sql`''`, `%${search}%`),
            ilike(productsTable.gender ?? sql`''`, `%${search}%`),
            ilike(productsTable.size ?? sql`''`, `%${search}%`),
            ilike(productsTable.color ?? sql`''`, `%${search}%`),
            ilike(brandsTable.name ?? sql`''`, `%${search}%`),
          ) : undefined,
          categoryId ? eq(productsTable.categoryId, Number(categoryId)) : undefined,
          brandId ? eq(productsTable.brandId, Number(brandId)) : undefined,
          lowStock === "true" ? lte(productsTable.stock, productsTable.minStock) : undefined,
        )
      )
      .orderBy(productsTable.name);

    res.json(rows.map(r => formatProduct(r, r.categoryName, r.brandName, r.supplierName)));
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
        sku: productsTable.sku,
        size: productsTable.size, color: productsTable.color,
        subcategory: productsTable.subcategory, material: productsTable.material,
        season: productsTable.season, gender: productsTable.gender,
        supplierId: productsTable.supplierId, supplierName: suppliersTable.name,
        entryDate: productsTable.entryDate,
        categoryName: categoriesTable.name, brandName: brandsTable.name,
        purchasePrice: productsTable.purchasePrice, salePrice: productsTable.salePrice,
        wholesalePrice: productsTable.wholesalePrice, promotionalPrice: productsTable.promotionalPrice,
        stock: productsTable.stock, minStock: productsTable.minStock, imageUrl: productsTable.imageUrl,
        imageUrls: productsTable.imageUrls,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .orderBy(productsTable.name);

    res.json(rows.map(r => ({
      id: r.id, name: r.name, barcode: r.barcode ?? null,
      sku: r.sku ?? null,
      size: r.size ?? null, color: r.color ?? null,
      subcategory: r.subcategory ?? null, material: r.material ?? null,
      season: r.season ?? null, gender: r.gender ?? null,
      supplierId: r.supplierId ?? null, supplierName: r.supplierName ?? null,
      entryDate: r.entryDate,
      categoryName: r.categoryName ?? null, brandName: r.brandName ?? null,
      purchasePrice: Number(r.purchasePrice), salePrice: Number(r.salePrice),
      wholesalePrice: r.wholesalePrice === null ? null : Number(r.wholesalePrice),
      promotionalPrice: r.promotionalPrice === null ? null : Number(r.promotionalPrice),
      profitMargin: Number(r.salePrice) > 0 ? Number((((Number(r.salePrice) - Number(r.purchasePrice)) / Number(r.salePrice)) * 100).toFixed(2)) : 0,
      stock: r.stock, minStock: r.minStock,
      stockValue: Number(r.purchasePrice) * r.stock,
      status: r.stock === 0 ? "Sin stock" : r.stock <= r.minStock ? "Stock bajo" : "OK",
      imageUrl: r.imageUrl ?? null,
      imageUrls: Array.isArray(r.imageUrls) && r.imageUrls.length ? r.imageUrls : r.imageUrl ? [r.imageUrl] : [],
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
    const [supplier] = parsed.data.supplierId
      ? await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, parsed.data.supplierId)).limit(1)
      : [];
    if (parsed.data.supplierId && !supplier) {
      res.status(400).json({ message: "El proveedor seleccionado no existe" });
      return;
    }
    const [p] = await db.insert(productsTable).values({
      ...parsed.data,
      sku: parsed.data.sku?.trim() || null,
      description: parsed.data.description?.trim() || null,
      subcategory: parsed.data.subcategory?.trim() || null,
      material: parsed.data.material?.trim() || null,
      season: parsed.data.season?.trim() || null,
      gender: parsed.data.gender?.trim() || null,
      entryDate: parsed.data.entryDate || undefined,
      imageUrl: parsed.data.imageUrls?.[0] ?? parsed.data.imageUrl ?? null,
      imageUrls: parsed.data.imageUrls?.length ? parsed.data.imageUrls : parsed.data.imageUrl ? [parsed.data.imageUrl] : [],
      purchasePrice: String(parsed.data.purchasePrice),
      salePrice: String(parsed.data.salePrice),
      wholesalePrice: parsed.data.wholesalePrice == null ? null : String(parsed.data.wholesalePrice),
      promotionalPrice: parsed.data.promotionalPrice == null ? null : String(parsed.data.promotionalPrice),
    }).returning();
    res.status(201).json(formatProduct(p, null, null, supplier?.name));
    auditLog({ req, action: "created", entity: "product", entityId: p.id, entityName: p.name, details: { salePrice: Number(p.salePrice), stock: p.stock } });
  } catch (err) {
    if (isDuplicateSku(err)) {
      res.status(409).json({ message: "Ya existe un producto con ese código SKU" });
      return;
    }
    req.log.error({ err }, "CreateProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [row] = await db
      .select({ p: productsTable, categoryName: categoriesTable.name, brandName: brandsTable.name, supplierName: suppliersTable.name })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .leftJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
      .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
      .where(eq(productsTable.id, id))
      .limit(1);
    if (!row) { res.status(404).json({ message: "Producto no encontrado" }); return; }
    res.json(formatProduct(row.p, row.categoryName, row.brandName, row.supplierName));
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
    const [supplier] = parsed.data.supplierId
      ? await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, parsed.data.supplierId)).limit(1)
      : [];
    if (parsed.data.supplierId && !supplier) {
      res.status(400).json({ message: "El proveedor seleccionado no existe" });
      return;
    }
    const [p] = await db.update(productsTable).set({
      ...parsed.data,
      sku: parsed.data.sku?.trim() || null,
      description: parsed.data.description?.trim() || null,
      subcategory: parsed.data.subcategory?.trim() || null,
      material: parsed.data.material?.trim() || null,
      season: parsed.data.season?.trim() || null,
      gender: parsed.data.gender?.trim() || null,
      entryDate: parsed.data.entryDate || undefined,
      imageUrl: parsed.data.imageUrls?.[0] ?? parsed.data.imageUrl ?? null,
      imageUrls: parsed.data.imageUrls?.length ? parsed.data.imageUrls : parsed.data.imageUrl ? [parsed.data.imageUrl] : [],
      purchasePrice: String(parsed.data.purchasePrice),
      salePrice: String(parsed.data.salePrice),
      wholesalePrice: parsed.data.wholesalePrice == null ? null : String(parsed.data.wholesalePrice),
      promotionalPrice: parsed.data.promotionalPrice == null ? null : String(parsed.data.promotionalPrice),
    }).where(eq(productsTable.id, id)).returning();
    if (!p) { res.status(404).json({ message: "Producto no encontrado" }); return; }
    res.json(formatProduct(p, null, null, supplier?.name));
    auditLog({ req, action: "updated", entity: "product", entityId: p.id, entityName: p.name, details: { salePrice: Number(p.salePrice), stock: p.stock } });
  } catch (err) {
    if (isDuplicateSku(err)) {
      res.status(409).json({ message: "Ya existe un producto con ese código SKU" });
      return;
    }
    req.log.error({ err }, "UpdateProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/products/:id — admin only
router.delete("/:id", requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    const [inventoryHistory] = await db
      .select({ id: inventoryDocumentItemsTable.id })
      .from(inventoryDocumentItemsTable)
      .where(eq(inventoryDocumentItemsTable.productId, id))
      .limit(1);
    if (inventoryHistory) {
      res.status(409).json({ message: "No se puede eliminar un producto con historial de inventario" });
      return;
    }
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ message: "Producto eliminado" });
    auditLog({ req, action: "deleted", entity: "product", entityId: id, entityName: p?.name });
  } catch (err) {
    req.log.error({ err }, "DeleteProduct error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
