import { Router } from "express";
import { db, salesTable, productsTable, customersTable, saleDetailsTable } from "@workspace/db";
import { eq, gte, lte, and, count, sum, sql } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

// GET /api/dashboard/stats
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [[todayStats], [monthStats], [totalCustomers], [totalProducts], [lowStockData]] = await Promise.all([
      db.select({
        totalSales: sum(salesTable.total),
        salesCount: count(salesTable.id),
      }).from(salesTable).where(and(gte(salesTable.createdAt, todayStart), eq(salesTable.status, "completada"))),

      db.select({
        totalSales: sum(salesTable.total),
        salesCount: count(salesTable.id),
      }).from(salesTable).where(and(gte(salesTable.createdAt, monthStart), eq(salesTable.status, "completada"))),

      db.select({ total: count(customersTable.id) }).from(customersTable),

      db.select({ total: count(productsTable.id) }).from(productsTable),

      db.select({ total: count(productsTable.id) }).from(productsTable).where(
        sql`${productsTable.stock} <= ${productsTable.minStock}`
      ),
    ]);

    res.json({
      totalSalesToday: Number(todayStats.totalSales ?? 0),
      totalSalesMonth: Number(monthStats.totalSales ?? 0),
      totalCustomers: Number(totalCustomers.total),
      totalProducts: Number(totalProducts.total),
      lowStockCount: Number(lowStockData.total),
      salesCountToday: Number(todayStats.salesCount),
      salesCountMonth: Number(monthStats.salesCount),
    });
  } catch (err) {
    req.log.error({ err }, "GetDashboardStats error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/dashboard/sales-chart
router.get("/sales-chart", async (req, res) => {
  try {
    const days: { date: string; total: number; count: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextD = new Date(d.getTime() + 86400000);

      const [row] = await db
        .select({ total: sum(salesTable.total), cnt: count(salesTable.id) })
        .from(salesTable)
        .where(and(gte(salesTable.createdAt, d), lte(salesTable.createdAt, nextD), eq(salesTable.status, "completada")));

      days.push({
        date: d.toISOString().split("T")[0],
        total: Number(row.total ?? 0),
        count: Number(row.cnt ?? 0),
      });
    }

    res.json(days);
  } catch (err) {
    req.log.error({ err }, "GetSalesChart error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/dashboard/top-products
router.get("/top-products", async (req, res) => {
  try {
    const rows = await db
      .select({
        productId: saleDetailsTable.productId,
        productName: saleDetailsTable.productName,
        totalSold: sum(saleDetailsTable.quantity),
        revenue: sum(saleDetailsTable.subtotal),
      })
      .from(saleDetailsTable)
      .innerJoin(salesTable, and(eq(saleDetailsTable.saleId, salesTable.id), eq(salesTable.status, "completada")))
      .groupBy(saleDetailsTable.productId, saleDetailsTable.productName)
      .orderBy(sql`sum(${saleDetailsTable.quantity}) DESC`)
      .limit(5);

    res.json(rows.map(r => ({
      productId: r.productId ?? 0,
      productName: r.productName,
      totalSold: Number(r.totalSold ?? 0),
      revenue: Number(r.revenue ?? 0),
    })));
  } catch (err) {
    req.log.error({ err }, "GetTopProducts error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/dashboard/recent-sales
router.get("/recent-sales", async (req, res) => {
  try {
    const rows = await db
      .select({ sale: salesTable, customerName: customersTable.name })
      .from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .orderBy(sql`${salesTable.createdAt} DESC`)
      .limit(10);

    res.json(rows.map(r => ({
      id: r.sale.id,
      customerId: r.sale.customerId ?? null,
      customerName: r.customerName ?? null,
      subtotal: Number(r.sale.subtotal),
      iva: Number(r.sale.iva),
      total: Number(r.sale.total),
      paymentMethod: r.sale.paymentMethod,
      status: r.sale.status,
      notes: r.sale.notes ?? null,
      createdAt: r.sale.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "GetRecentSales error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
