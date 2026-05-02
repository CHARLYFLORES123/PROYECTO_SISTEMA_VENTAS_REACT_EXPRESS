import { Router } from "express";
import { db, customersTable, salesTable } from "@workspace/db";
import { eq, ilike, count } from "drizzle-orm";
import { CreateCustomerBody, GetCustomersQueryParams } from "@workspace/api-zod";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function formatCustomer(c: any, totalPurchases = 0) {
  return {
    id: c.id,
    name: c.name,
    nitCi: c.nitCi ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    totalPurchases,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
  };
}

// GET /api/customers
router.get("/", async (req, res) => {
  const parsed = GetCustomersQueryParams.safeParse(req.query);
  const { search } = parsed.success ? parsed.data : {} as any;

  try {
    const rows = await db
      .select({
        id: customersTable.id,
        name: customersTable.name,
        nitCi: customersTable.nitCi,
        email: customersTable.email,
        phone: customersTable.phone,
        address: customersTable.address,
        createdAt: customersTable.createdAt,
        totalPurchases: count(salesTable.id),
      })
      .from(customersTable)
      .leftJoin(salesTable, eq(salesTable.customerId, customersTable.id))
      .where(search ? ilike(customersTable.name, `%${search}%`) : undefined)
      .groupBy(customersTable.id)
      .orderBy(customersTable.name);

    res.json(rows.map(r => formatCustomer(r, Number(r.totalPurchases))));
  } catch (err) {
    req.log.error({ err }, "GetCustomers error");
    res.status(500).json({ message: "Error interno" });
  }
});

// POST /api/customers
router.post("/", async (req, res) => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  try {
    const [c] = await db.insert(customersTable).values(parsed.data).returning();
    res.status(201).json(formatCustomer(c));
  } catch (err) {
    req.log.error({ err }, "CreateCustomer error");
    res.status(500).json({ message: "Error interno" });
  }
});

// GET /api/customers/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!c) { res.status(404).json({ message: "Cliente no encontrado" }); return; }
    const [{ total }] = await db.select({ total: count(salesTable.id) }).from(salesTable).where(eq(salesTable.customerId, id));
    res.json(formatCustomer(c, Number(total)));
  } catch (err) {
    req.log.error({ err }, "GetCustomerById error");
    res.status(500).json({ message: "Error interno" });
  }
});

// PUT /api/customers/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }

  try {
    const [c] = await db.update(customersTable).set(parsed.data).where(eq(customersTable.id, id)).returning();
    if (!c) { res.status(404).json({ message: "Cliente no encontrado" }); return; }
    res.json(formatCustomer(c));
  } catch (err) {
    req.log.error({ err }, "UpdateCustomer error");
    res.status(500).json({ message: "Error interno" });
  }
});

// DELETE /api/customers/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.json({ message: "Cliente eliminado" });
  } catch (err) {
    req.log.error({ err }, "DeleteCustomer error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
