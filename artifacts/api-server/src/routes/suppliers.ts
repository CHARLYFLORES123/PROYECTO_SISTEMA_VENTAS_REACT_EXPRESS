import { Router } from "express";
import { db, suppliersTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { CreateSupplierBody, GetCustomersQueryParams } from "@workspace/api-zod";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function fmt(s: any) {
  return {
    id: s.id, name: s.name, nitCi: s.nitCi ?? null, contactName: s.contactName ?? null,
    email: s.email ?? null, phone: s.phone ?? null, address: s.address ?? null,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
  };
}

router.get("/", async (req, res) => {
  const { search } = GetCustomersQueryParams.safeParse(req.query).data ?? {};
  try {
    const rows = await db.select().from(suppliersTable)
      .where(search ? ilike(suppliersTable.name, `%${search}%`) : undefined)
      .orderBy(suppliersTable.name);
    res.json(rows.map(fmt));
  } catch (err) { req.log.error({ err }, "GetSuppliers error"); res.status(500).json({ message: "Error interno" }); }
});

router.post("/", async (req, res) => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [s] = await db.insert(suppliersTable).values(parsed.data).returning();
    res.status(201).json(fmt(s));
  } catch (err) { req.log.error({ err }, "CreateSupplier error"); res.status(500).json({ message: "Error interno" }); }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [s] = await db.update(suppliersTable).set(parsed.data).where(eq(suppliersTable.id, id)).returning();
    if (!s) { res.status(404).json({ message: "Proveedor no encontrado" }); return; }
    res.json(fmt(s));
  } catch (err) { req.log.error({ err }, "UpdateSupplier error"); res.status(500).json({ message: "Error interno" }); }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.json({ message: "Proveedor eliminado" });
  } catch (err) { req.log.error({ err }, "DeleteSupplier error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
