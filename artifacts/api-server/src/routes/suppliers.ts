import { Router } from "express";
import {
  db,
  inventoryDocumentItemsTable,
  inventoryDocumentsTable,
  productsTable,
  suppliersTable,
} from "@workspace/db";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { CreateSupplierBody, GetCustomersQueryParams } from "@workspace/api-zod";
import { verifyToken, requireRoles, requireAdmin, AuthRequest } from "../middlewares/auth";
import { auditLog } from "../lib/audit";

const router = Router();
router.use(verifyToken);

const canWrite = requireRoles(["admin", "compras"]);

function fmt(s: any) {
  return {
    id: s.id, name: s.name, nitCi: s.nitCi ?? null, contactName: s.contactName ?? null,
    email: s.email ?? null, phone: s.phone ?? null, address: s.address ?? null,
    whatsapp: s.whatsapp ?? null, city: s.city ?? null,
    productsProvided: s.productsProvided ?? [],
    totalPurchased: Number(s.totalPurchased ?? 0),
    pendingDebt: Number(s.pendingDebt ?? 0),
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

router.get("/", async (req, res) => {
  const { search } = GetCustomersQueryParams.safeParse(req.query).data ?? {};
  try {
    const rows = await db.select().from(suppliersTable)
      .where(search ? ilike(suppliersTable.name, `%${search}%`) : undefined)
      .orderBy(suppliersTable.name);
    const supplierIds = rows.map(({ id }) => id);
    const [products, purchases] = supplierIds.length
      ? await Promise.all([
          db.select({ supplierId: productsTable.supplierId, name: productsTable.name })
            .from(productsTable)
            .where(inArray(productsTable.supplierId, supplierIds)),
          db.select({
            supplierId: inventoryDocumentsTable.supplierId,
            total: inventoryDocumentsTable.total,
            balancePending: inventoryDocumentsTable.balancePending,
          })
            .from(inventoryDocumentsTable)
            .where(and(
              inArray(inventoryDocumentsTable.supplierId, supplierIds),
              or(
                eq(inventoryDocumentsTable.type, "purchase"),
                and(
                  eq(inventoryDocumentsTable.type, "supplier_order"),
                  eq(inventoryDocumentsTable.status, "received"),
                ),
              ),
            )),
        ])
      : [[], []];
    const summaries = new Map<number, { productsProvided: string[]; totalPurchased: number; pendingDebt: number }>();
    for (const supplier of rows) summaries.set(supplier.id, { productsProvided: [], totalPurchased: 0, pendingDebt: 0 });
    for (const product of products) {
      if (product.supplierId == null) continue;
      const summary = summaries.get(product.supplierId);
      if (summary && !summary.productsProvided.includes(product.name)) summary.productsProvided.push(product.name);
    }
    for (const purchase of purchases) {
      if (purchase.supplierId == null) continue;
      const summary = summaries.get(purchase.supplierId);
      if (!summary) continue;
      summary.totalPurchased += Number(purchase.total);
      summary.pendingDebt += Number(purchase.balancePending ?? 0);
    }
    res.json(rows.map((supplier) => ({
      ...fmt(supplier),
      ...summaries.get(supplier.id)!,
    })));
  } catch (err) { req.log.error({ err }, "GetSuppliers error"); res.status(500).json({ message: "Error interno" }); }
});

router.get("/:id/purchases", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: "Identificador de proveedor inválido" });
    return;
  }
  try {
    const [supplier] = await db.select({ id: suppliersTable.id })
      .from(suppliersTable)
      .where(eq(suppliersTable.id, id))
      .limit(1);
    if (!supplier) {
      res.status(404).json({ message: "Proveedor no encontrado" });
      return;
    }
    const purchases = await db.select({
      id: inventoryDocumentsTable.id,
      type: inventoryDocumentsTable.type,
      reference: inventoryDocumentsTable.reference,
      total: inventoryDocumentsTable.total,
      amountPaid: inventoryDocumentsTable.amountPaid,
      balancePending: inventoryDocumentsTable.balancePending,
      paymentMethod: inventoryDocumentsTable.paymentMethod,
      paymentType: inventoryDocumentsTable.paymentType,
      createdAt: inventoryDocumentsTable.createdAt,
    })
      .from(inventoryDocumentsTable)
      .where(and(
        eq(inventoryDocumentsTable.supplierId, id),
        or(
          eq(inventoryDocumentsTable.type, "purchase"),
          and(
            eq(inventoryDocumentsTable.type, "supplier_order"),
            eq(inventoryDocumentsTable.status, "received"),
          ),
        ),
      ))
      .orderBy(inventoryDocumentsTable.createdAt);
    const purchaseIds = purchases.map(({ id: purchaseId }) => purchaseId);
    const items = purchaseIds.length
      ? await db.select({
          documentId: inventoryDocumentItemsTable.documentId,
          productName: productsTable.name,
          quantity: inventoryDocumentItemsTable.quantity,
        })
          .from(inventoryDocumentItemsTable)
          .innerJoin(productsTable, eq(inventoryDocumentItemsTable.productId, productsTable.id))
          .where(inArray(inventoryDocumentItemsTable.documentId, purchaseIds))
      : [];
    const itemsByPurchase = new Map<number, Array<{ productName: string; quantity: number }>>();
    for (const item of items) {
      const purchaseItems = itemsByPurchase.get(item.documentId) ?? [];
      purchaseItems.push({ productName: item.productName, quantity: item.quantity });
      itemsByPurchase.set(item.documentId, purchaseItems);
    }
    res.json(purchases.map((purchase) => ({
      id: purchase.id,
      type: purchase.type,
      reference: purchase.reference ?? null,
      total: Number(purchase.total),
      amountPaid: purchase.amountPaid == null ? null : Number(purchase.amountPaid),
      balancePending: purchase.balancePending == null ? null : Number(purchase.balancePending),
      paymentMethod: purchase.paymentMethod ?? null,
      paymentType: purchase.paymentType ?? null,
      createdAt: purchase.createdAt.toISOString(),
      items: itemsByPurchase.get(purchase.id) ?? [],
    })));
  } catch (err) {
    req.log.error({ err }, "GetSupplierPurchases error");
    res.status(500).json({ message: "No se pudo cargar el historial de compras del proveedor" });
  }
});

// POST — compras + admin
router.post("/", canWrite, async (req: AuthRequest, res) => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [s] = await db.insert(suppliersTable).values(parsed.data).returning();
    res.status(201).json(fmt(s));
    auditLog({ req, action: "created", entity: "supplier", entityId: s.id, entityName: s.name });
  } catch (err) { req.log.error({ err }, "CreateSupplier error"); res.status(500).json({ message: "Error interno" }); }
});

// PUT — compras + admin
router.put("/:id", canWrite, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [s] = await db.update(suppliersTable).set(parsed.data).where(eq(suppliersTable.id, id)).returning();
    if (!s) { res.status(404).json({ message: "Proveedor no encontrado" }); return; }
    res.json(fmt(s));
    auditLog({ req, action: "updated", entity: "supplier", entityId: s.id, entityName: s.name });
  } catch (err) { req.log.error({ err }, "UpdateSupplier error"); res.status(500).json({ message: "Error interno" }); }
});

// DELETE — admin only
router.delete("/:id", requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  try {
    const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id)).limit(1);
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.json({ message: "Proveedor eliminado" });
    auditLog({ req, action: "deleted", entity: "supplier", entityId: id, entityName: s?.name });
  } catch (err) { req.log.error({ err }, "DeleteSupplier error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
