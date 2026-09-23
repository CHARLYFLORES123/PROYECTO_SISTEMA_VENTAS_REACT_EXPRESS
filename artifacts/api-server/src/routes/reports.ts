import { Router } from "express";
import { db, salesTable, saleDetailsTable, productsTable, categoriesTable, usersTable } from "@workspace/db";
import { eq, gte, lte, and, or, count, sum, sql, desc } from "drizzle-orm";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function parseDateRange(query: any) {
  const { dateFrom, dateTo } = query;
  let from: Date | undefined;
  let to: Date | undefined;
  if (dateFrom) {
    from = new Date(dateFrom.includes("T") ? dateFrom : `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    to = new Date(dateTo.includes("T") ? dateTo : `${dateTo}T23:59:59.999`);
  }
  return { from, to };
}

// GET /api/reports/sales-by-seller-daily — Ventas por vendedor por día con productos
router.get("/sales-by-seller-daily", async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  try {
    const rows = await db
      .select({
        saleId: salesTable.id,
        saleTotal: salesTable.total,
        saleCreatedAt: salesTable.createdAt,
        userId: salesTable.userId,
        userName: usersTable.name,
        userRole: usersTable.role,
        productId: saleDetailsTable.productId,
        productName: saleDetailsTable.productName,
        quantity: saleDetailsTable.quantity,
        unitPrice: saleDetailsTable.unitPrice,
        itemSubtotal: saleDetailsTable.subtotal,
      })
      .from(salesTable)
      .leftJoin(usersTable, eq(salesTable.userId, usersTable.id))
      .leftJoin(saleDetailsTable, eq(saleDetailsTable.saleId, salesTable.id))
      .where(
        and(
          eq(salesTable.status, "completada"),
          from ? gte(salesTable.createdAt, from) : undefined,
          to ? lte(salesTable.createdAt, to) : undefined,
          userId ? eq(salesTable.userId, userId) : undefined,
        )
      )
      .orderBy(desc(salesTable.createdAt), desc(salesTable.id));

    // Obtener lista completa de vendedores para el selector
    const sellersList = await db
      .select({ id: usersTable.id, name: usersTable.name, role: usersTable.role })
      .from(usersTable)
      .where(or(eq(usersTable.role, "vendedor"), eq(usersTable.role, "admin")))
      .orderBy(usersTable.name);

    function getLocalDateKey(d: Date): string {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    interface ProductItem {
      productId: number | null;
      productName: string;
      quantity: number;
      subtotal: number;
    }

    interface DayGroup {
      date: string;
      userId: number;
      userName: string;
      userRole: string;
      salesCount: number;
      totalAmount: number;
      saleIds: Set<number>;
      productsMap: Map<string, ProductItem>;
    }

    const groups = new Map<string, DayGroup>();

    for (const row of rows) {
      const dateKey = getLocalDateKey(new Date(row.saleCreatedAt));
      const uid = row.userId ?? 0;
      const key = `${dateKey}_${uid}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          date: dateKey,
          userId: uid,
          userName: row.userName ?? "Sin vendedor asignado",
          userRole: row.userRole ?? "vendedor",
          salesCount: 0,
          totalAmount: 0,
          saleIds: new Set<number>(),
          productsMap: new Map<string, ProductItem>(),
        };
        groups.set(key, group);
      }

      if (!group.saleIds.has(row.saleId)) {
        group.saleIds.add(row.saleId);
        group.salesCount += 1;
        group.totalAmount += Number(row.saleTotal || 0);
      }

      if (row.productName) {
        const prodKey = `${row.productId ?? ''}_${row.productName}`;
        let prod = group.productsMap.get(prodKey);
        if (!prod) {
          prod = {
            productId: row.productId ?? null,
            productName: row.productName,
            quantity: 0,
            subtotal: 0,
          };
          group.productsMap.set(prodKey, prod);
        }
        prod.quantity += Number(row.quantity || 0);
        prod.subtotal += Number(row.itemSubtotal || 0);
      }
    }

    const daily = Array.from(groups.values()).map(g => ({
      date: g.date,
      userId: g.userId,
      userName: g.userName,
      userRole: g.userRole,
      salesCount: g.salesCount,
      totalAmount: Number(g.totalAmount.toFixed(2)),
      products: Array.from(g.productsMap.values()).map(p => ({
        productId: p.productId,
        productName: p.productName,
        quantity: p.quantity,
        subtotal: Number(p.subtotal.toFixed(2)),
      })).sort((a, b) => b.quantity - a.quantity),
    })).sort((a, b) => b.date.localeCompare(a.date) || b.totalAmount - a.totalAmount);

    let totalRevenue = 0;
    let totalSales = 0;
    let totalProducts = 0;
    const activeSellersSet = new Set<number>();

    for (const d of daily) {
      totalRevenue += d.totalAmount;
      totalSales += d.salesCount;
      if (d.userId) activeSellersSet.add(d.userId);
      for (const p of d.products) {
        totalProducts += p.quantity;
      }
    }

    res.json({
      daily,
      summary: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalSales,
        totalProducts,
        activeSellersCount: activeSellersSet.size,
      },
      sellers: sellersList,
    });
  } catch (err) {
    req.log.error({ err }, "ReportSalesBySellerDaily error");
    res.status(500).json({ message: "Error interno" });
  }
});

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
