import { Router } from "express";
import { db, salesTable, saleDetailsTable, productsTable, customersTable, usersTable, businessSettingsTable } from "@workspace/db";
import { eq, gte, lte, and, sql } from "drizzle-orm";
import { CreateSaleBody } from "@workspace/api-zod";
import { verifyToken, requireRoles, requireAdmin, AuthRequest } from "../middlewares/auth";
import { awardPointsForSale } from "./loyalty";

const router = Router();
router.use(verifyToken);

const canCreate = requireRoles(["admin", "vendedor"]);

const IVA_RATE = 0.13;

function formatSale(s: any, customerName?: string | null, userName?: string | null) {
  return {
    id: s.id,
    customerId: s.customerId ?? null,
    customerName: customerName ?? null,
    userId: s.userId ?? null,
    userName: userName ?? null,
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
  const { dateFrom, dateTo, customerId, userId } = req.query as any;
  try {
    const rows = await db
      .select({
        sale: salesTable,
        customerName: customersTable.name,
        userName: usersTable.name,
      })
      .from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .leftJoin(usersTable, eq(salesTable.userId, usersTable.id))
      .where(
        and(
          dateFrom ? gte(salesTable.createdAt, new Date(dateFrom)) : undefined,
          dateTo ? lte(salesTable.createdAt, new Date(new Date(dateTo).getTime() + 86399999)) : undefined,
          customerId ? eq(salesTable.customerId, Number(customerId)) : undefined,
          userId ? eq(salesTable.userId, Number(userId)) : undefined,
        )
      )
      .orderBy(sql`${salesTable.createdAt} DESC`);

    res.json(rows.map(r => formatSale(r.sale, r.customerName, r.userName)));
  } catch (err) {
    req.log.error({ err }, "GetSales error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/sales — vendedor + admin
router.post("/", canCreate, async (req: AuthRequest, res) => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  const { customerId, items, paymentMethod, notes } = parsed.data;

  try {
    const productIds = items.map(i => i.productId);
    const products = await db.select().from(productsTable).where(
      sql`${productsTable.id} = ANY(${sql.raw(`ARRAY[${productIds.join(",")}]::int[]`)})`
    );
    const productMap = new Map(products.map(p => [p.id, p]));

    for (const item of items) {
      const p = productMap.get(item.productId);
      if (!p) { res.status(400).json({ message: `Producto ${item.productId} no encontrado` }); return; }
      if (p.stock < item.quantity) {
        res.status(400).json({ message: `Stock insuficiente para ${p.name}. Disponible: ${p.stock}` });
        return;
      }
    }

    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const iva = subtotal * IVA_RATE;
    const total = subtotal + iva;

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.insert(salesTable).values({
        customerId: customerId ?? null,
        userId: req.userId ?? null,
        subtotal: String(subtotal.toFixed(2)),
        iva: String(iva.toFixed(2)),
        total: String(total.toFixed(2)),
        paymentMethod,
        notes: notes ?? null,
      }).returning();

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
        await tx.update(productsTable)
          .set({ stock: p.stock - item.quantity })
          .where(eq(productsTable.id, item.productId));
      }
      return sale;
    });

    let customerName: string | null = null;
    if (customerId) {
      const [c] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
      customerName = c?.name ?? null;
    }

    // Award loyalty points if enabled
    try {
      const [settings] = await db.select().from(businessSettingsTable).limit(1);
      if (settings?.loyaltyEnabled && customerId) {
        await awardPointsForSale(customerId, result.id, Number(result.total), settings.pointsPerUnit);
      }
    } catch (pointsErr) {
      req.log.warn({ err: pointsErr }, "Failed to award loyalty points (non-fatal)");
    }

    const pointsEarned = (() => {
      try {
        return 0;
      } catch { return 0; }
    })();

    res.status(201).json({ ...formatSale(result, customerName), pointsEarned });
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
      .select({ sale: salesTable, customerName: customersTable.name, userName: usersTable.name })
      .from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .leftJoin(usersTable, eq(salesTable.userId, usersTable.id))
      .where(eq(salesTable.id, id))
      .limit(1);

    if (!row) { res.status(404).json({ message: "Venta no encontrada" }); return; }

    const details = await db.select().from(saleDetailsTable).where(eq(saleDetailsTable.saleId, id));
    res.json({
      ...formatSale(row.sale, row.customerName, row.userName),
      details: details.map(d => ({
        id: d.id, productId: d.productId ?? null, productName: d.productName,
        quantity: d.quantity, unitPrice: Number(d.unitPrice), subtotal: Number(d.subtotal),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GetSaleById error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/sales/:id/cancel — admin only
router.post("/:id/cancel", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, id)).limit(1);
    if (!sale) { res.status(404).json({ message: "Venta no encontrada" }); return; }
    if (sale.status === "cancelada") { res.status(400).json({ message: "La venta ya está cancelada" }); return; }

    const details = await db.select().from(saleDetailsTable).where(eq(saleDetailsTable.saleId, id));

    await db.transaction(async (tx) => {
      await tx.update(salesTable).set({ status: "cancelada" }).where(eq(salesTable.id, id));
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
