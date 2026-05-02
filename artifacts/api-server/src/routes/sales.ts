import { Router } from "express";
import { db, salesTable, saleDetailsTable, productsTable, customersTable } from "@workspace/db";
import { eq, gte, lte, and, sql } from "drizzle-orm";
import { CreateSaleBody, GetSalesQueryParams } from "@workspace/api-zod";
import { verifyToken, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

const IVA_RATE = 0.13;

function formatSale(s: any, customerName?: string | null) {
  return {
    id: s.id,
    customerId: s.customerId ?? null,
    customerName: customerName ?? null,
    subtotal: Number(s.subtotal),
    iva: Number(s.iva),
    total: Number(s.total),
    paymentMethod: s.paymentMethod,
    status: s.status,
    notes: s.notes ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

// GET /api/sales
router.get("/", async (req: AuthRequest, res) => {
  const parsed = GetSalesQueryParams.safeParse(req.query);
  const { dateFrom, dateTo, customerId } = parsed.success ? parsed.data : {} as any;

  try {
    const rows = await db
      .select({
        sale: salesTable,
        customerName: customersTable.name,
      })
      .from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .where(
        and(
          dateFrom ? gte(salesTable.createdAt, new Date(dateFrom)) : undefined,
          dateTo ? lte(salesTable.createdAt, new Date(dateTo)) : undefined,
          customerId ? eq(salesTable.customerId, Number(customerId)) : undefined,
        )
      )
      .orderBy(sql`${salesTable.createdAt} DESC`);

    res.json(rows.map(r => formatSale(r.sale, r.customerName)));
  } catch (err) {
    req.log.error({ err }, "GetSales error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/sales  — transactional: header + details + stock reduction
router.post("/", async (req: AuthRequest, res) => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  const { customerId, items, paymentMethod, notes } = parsed.data;

  try {
    // Fetch all products to validate stock and get names
    const productIds = items.map(i => i.productId);
    const products = await db.select().from(productsTable).where(
      sql`${productsTable.id} = ANY(${sql.raw(`ARRAY[${productIds.join(",")}]::int[]`)})`
    );

    const productMap = new Map(products.map(p => [p.id, p]));

    // Validate stock
    for (const item of items) {
      const p = productMap.get(item.productId);
      if (!p) { res.status(400).json({ message: `Producto ${item.productId} no encontrado` }); return; }
      if (p.stock < item.quantity) {
        res.status(400).json({ message: `Stock insuficiente para ${p.name}. Disponible: ${p.stock}` });
        return;
      }
    }

    // Calculate totals
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const iva = subtotal * IVA_RATE;
    const total = subtotal + iva;

    // Transaction: insert sale + details + update stock
    const result = await db.transaction(async (tx) => {
      // 1. Insert sale header
      const [sale] = await tx.insert(salesTable).values({
        customerId: customerId ?? null,
        userId: req.userId ?? null,
        subtotal: String(subtotal.toFixed(2)),
        iva: String(iva.toFixed(2)),
        total: String(total.toFixed(2)),
        paymentMethod,
        notes: notes ?? null,
      }).returning();

      // 2. Insert sale details
      for (const item of items) {
        const p = productMap.get(item.productId)!;
        await tx.insert(saleDetailsTable).values({
          saleId: sale.id,
          productId: item.productId,
          productName: p.name,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice.toFixed(2)),
          subtotal: String((item.unitPrice * item.quantity).toFixed(2)),
        });

        // 3. Reduce stock
        await tx.update(productsTable)
          .set({ stock: p.stock - item.quantity })
          .where(eq(productsTable.id, item.productId));
      }

      return sale;
    });

    let customerName: string | null = null;
    if (customerId) {
      const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
      customerName = cust?.name ?? null;
    }

    res.status(201).json(formatSale(result, customerName));
  } catch (err) {
    req.log.error({ err }, "CreateSale error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/sales/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [row] = await db
      .select({ sale: salesTable, customerName: customersTable.name })
      .from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .where(eq(salesTable.id, id))
      .limit(1);

    if (!row) { res.status(404).json({ message: "Venta no encontrada" }); return; }

    const details = await db.select().from(saleDetailsTable).where(eq(saleDetailsTable.saleId, id));

    res.json({
      ...formatSale(row.sale, row.customerName),
      details: details.map(d => ({
        id: d.id,
        productId: d.productId ?? null,
        productName: d.productName,
        quantity: d.quantity,
        unitPrice: Number(d.unitPrice),
        subtotal: Number(d.subtotal),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GetSaleById error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/sales/:id/cancel
router.post("/:id/cancel", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id)).limit(1);
    if (!sale) { res.status(404).json({ message: "Venta no encontrada" }); return; }
    if (sale.status === "cancelada") { res.status(400).json({ message: "La venta ya está cancelada" }); return; }

    const details = await db.select().from(saleDetailsTable).where(eq(saleDetailsTable.saleId, id));

    await db.transaction(async (tx) => {
      await tx.update(salesTable).set({ status: "cancelada" }).where(eq(salesTable.id, id));

      // Restore stock
      for (const d of details) {
        if (d.productId) {
          await tx.update(productsTable)
            .set({ stock: sql`${productsTable.stock} + ${d.quantity}` })
            .where(eq(productsTable.id, d.productId));
        }
      }
    });

    res.json({ message: "Venta cancelada y stock restaurado" });
  } catch (err) {
    req.log.error({ err }, "CancelSale error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
