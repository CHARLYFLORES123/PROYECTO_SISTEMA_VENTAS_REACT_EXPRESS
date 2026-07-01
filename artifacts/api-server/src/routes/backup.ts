import { Router } from "express";
import { db, usersTable, productsTable, categoriesTable, brandsTable, customersTable, suppliersTable, salesTable, saleDetailsTable, quotesTable, quoteDetailsTable, businessSettingsTable, paymentMethodsTable } from "@workspace/db";
import { verifyToken, requireAdmin, AuthRequest } from "../middlewares/auth";
import { auditLog } from "../lib/audit";

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/backup
router.get("/", async (req: AuthRequest, res) => {
  try {
    const [
      users,
      products,
      categories,
      brands,
      customers,
      suppliers,
      sales,
      saleDetails,
      quotes,
      quoteDetails,
      businessSettings,
      paymentMethods,
    ] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, createdAt: usersTable.createdAt }).from(usersTable),
      db.select().from(productsTable),
      db.select().from(categoriesTable),
      db.select().from(brandsTable),
      db.select().from(customersTable),
      db.select().from(suppliersTable),
      db.select().from(salesTable),
      db.select().from(saleDetailsTable),
      db.select().from(quotesTable),
      db.select().from(quoteDetailsTable),
      db.select().from(businessSettingsTable),
      db.select().from(paymentMethodsTable),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.userName ?? `user#${req.userId}`,
      version: "1.0",
      data: {
        users,
        products,
        categories,
        brands,
        customers,
        suppliers,
        sales,
        saleDetails,
        quotes,
        quoteDetails,
        businessSettings,
        paymentMethods,
      },
    };

    const filename = `backup-pos-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(backup);

    auditLog({ req, action: "created", entity: "settings", entityName: "Backup exportado", details: { filename } });
  } catch (err) {
    req.log.error({ err }, "Backup error");
    res.status(500).json({ message: "Error al generar backup" });
  }
});

export default router;
