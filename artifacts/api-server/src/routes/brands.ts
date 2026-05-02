import { Router } from "express";
import { db, brandsTable, productsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { CreateBrandBody } from "@workspace/api-zod";
import { verifyToken } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function fmt(b: any, productCount = 0) {
  return { id: b.id, name: b.name, description: b.description ?? null, productCount, createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt };
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.select({
      id: brandsTable.id, name: brandsTable.name, description: brandsTable.description,
      createdAt: brandsTable.createdAt, productCount: count(productsTable.id),
    }).from(brandsTable).leftJoin(productsTable, eq(productsTable.brandId, brandsTable.id))
      .groupBy(brandsTable.id).orderBy(brandsTable.name);
    res.json(rows.map(r => fmt(r, Number(r.productCount))));
  } catch (err) { req.log.error({ err }, "GetBrands error"); res.status(500).json({ message: "Error interno" }); }
});

router.post("/", async (req, res) => {
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [b] = await db.insert(brandsTable).values(parsed.data).returning();
    res.status(201).json(fmt(b));
  } catch (err) { req.log.error({ err }, "CreateBrand error"); res.status(500).json({ message: "Error interno" }); }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = CreateBrandBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const [b] = await db.update(brandsTable).set(parsed.data).where(eq(brandsTable.id, id)).returning();
    if (!b) { res.status(404).json({ message: "Marca no encontrada" }); return; }
    res.json(fmt(b));
  } catch (err) { req.log.error({ err }, "UpdateBrand error"); res.status(500).json({ message: "Error interno" }); }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(brandsTable).where(eq(brandsTable.id, id));
    res.json({ message: "Marca eliminada" });
  } catch (err) { req.log.error({ err }, "DeleteBrand error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
