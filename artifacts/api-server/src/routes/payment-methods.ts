import { Router } from "express";
import { db, paymentMethodsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreatePaymentMethodBody } from "@workspace/api-zod";
import { verifyToken, requireAdmin } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function fmt(p: any) {
  return { id: p.id, name: p.name, description: p.description ?? null, isActive: p.isActive, createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt };
}

// GET — all authenticated roles (needed for payment selection in POS/quotes)
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(paymentMethodsTable).orderBy(paymentMethodsTable.name);
    res.json(rows.map(fmt));
  } catch (err) { req.log.error({ err }, "GetPaymentMethods error"); res.status(500).json({ message: "Error interno" }); }
});

// POST — admin only
router.post("/", requireAdmin, async (req, res) => {
  const parsed = CreatePaymentMethodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [p] = await db.insert(paymentMethodsTable).values({ ...parsed.data, isActive: parsed.data.isActive ?? true }).returning();
    res.status(201).json(fmt(p));
  } catch (err) { req.log.error({ err }, "CreatePaymentMethod error"); res.status(500).json({ message: "Error interno" }); }
});

// PUT — admin only
router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreatePaymentMethodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [p] = await db.update(paymentMethodsTable).set(parsed.data).where(eq(paymentMethodsTable.id, id)).returning();
    if (!p) { res.status(404).json({ message: "Método no encontrado" }); return; }
    res.json(fmt(p));
  } catch (err) { req.log.error({ err }, "UpdatePaymentMethod error"); res.status(500).json({ message: "Error interno" }); }
});

// DELETE — admin only
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.id, id));
    res.json({ message: "Método eliminado" });
  } catch (err) { req.log.error({ err }, "DeletePaymentMethod error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
