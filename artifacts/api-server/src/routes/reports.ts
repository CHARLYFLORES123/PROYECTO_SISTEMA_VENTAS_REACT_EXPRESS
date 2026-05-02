import { Router } from "express";
import { db, salesTable, saleDetailsTable, productsTable, categoriesTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and, count, sum, sql } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function parseDateRange(query: any) {
  const { dateFrom, dateTo } = query;
  return {
    from: dateFrom ? new Date(dateFrom) : undefined,
    to: dateTo ? new Date(new Date(dateTo).getTime() + 86399999) : undefined,
  };
}

// GET /api/reports/sales-by-user
router.get("/sales-by-user", async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  try {
    const rows = await db
      .select({
        userId: salesTable.userId,
        userName: usersTable.name,
        totalSales: count(salesTable.id),
        totalRevenue: sum(salesTable.total),
      })
      .from(salesTable)
      .leftJoin(usersTable, eq(salesTable.userId, usersTable.id))
      .where(
        and(
          eq(salesTable.status, "completada"),
          from ? gte(salesTable.createdAt, from) : undefined,
          to ? lte(salesTable.createdAt, to) : undefined,
        )
      )
      .groupBy(salesTable.userId, usersTable.name)
      .orderBy(sql`sum(${salesTable.total}) DESC`);

    res.json(rows.map(r => ({
      userId: r.userId ?? 0,
      userName: r.userName ?? "Sin vendedor",
      totalSales: Number(r.totalSales),
      totalRevenue: Number(r.totalRevenue ?? 0),
    })));
  } catch (err) { req.log.error({ err }, "ReportSalesByUser error"); res.status(500).json({ message: "Error interno" }); }
});

// GET /api/reports/by-category
router.get("/by-category", async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  try {
    const rows = await db
      .select({
        categoryId: productsTable.categoryId,
        categoryName: categoriesTable.name,
        totalSold: sum(saleDetailsTable.quantity),
        totalRevenue: sum(saleDetailsTable.subtotal),
      })
      .from(saleDetailsTable)
      .innerJoin(salesTable, and(eq(saleDetailsTable.saleId, salesTable.id), eq(salesTable.status, "completada")))
      .leftJoin(productsTable, eq(saleDetailsTable.productId, productsTable.id))
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(
        and(
          from ? gte(salesTable.createdAt, from) : undefined,
          to ? lte(salesTable.createdAt, to) : undefined,
        )
      )
      .groupBy(productsTable.categoryId, categoriesTable.name)
      .orderBy(sql`sum(${saleDetailsTable.subtotal}) DESC`);

    res.json(rows.map(r => ({
      categoryId: r.categoryId ?? null,
      categoryName: r.categoryName ?? "Sin categoría",
      totalSold: Number(r.totalSold ?? 0),
      totalRevenue: Number(r.totalRevenue ?? 0),
    })));
  } catch (err) { req.log.error({ err }, "ReportByCategory error"); res.status(500).json({ message: "Error interno" }); }
});

// GET /api/reports/stock-alerts
router.get("/stock-alerts", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        stock: productsTable.stock,
        minStock: productsTable.minStock,
        categoryName: categoriesTable.name,
      })
      .from(productsTable)
      .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
      .where(sql`${productsTable.stock} <= ${productsTable.minStock}`)
      .orderBy(productsTable.stock);

    res.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      stock: r.stock,
      minStock: r.minStock,
      categoryName: r.categoryName ?? null,
      brandName: null,
      status: r.stock === 0 ? "Sin stock" : "Stock bajo",
    })));
  } catch (err) { req.log.error({ err }, "ReportStockAlerts error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
