import { Router } from "express";
import { db, businessSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateBusinessSettingsBody } from "@workspace/api-zod";
import { verifyToken, requireAdmin } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

function fmt(s: any) {
  return {
    id: s.id, companyName: s.companyName, rucNit: s.rucNit ?? null,
    phone: s.phone ?? null, email: s.email ?? null, address: s.address ?? null,
    logoUrl: s.logoUrl ?? null, currency: s.currency, currencySymbol: s.currencySymbol,
    loyaltyEnabled: s.loyaltyEnabled ?? false,
    pointsPerUnit: s.pointsPerUnit ?? 1,
    pointsRedemptionRate: Number(s.pointsRedemptionRate ?? 0.01),
    updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
  };
}

async function ensureSettings() {
  const [existing] = await db.select().from(businessSettingsTable).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(businessSettingsTable).values({}).returning();
  return created;
}

// GET — all authenticated roles
router.get("/", async (req, res) => {
  try {
    const settings = await ensureSettings();
    res.json(fmt(settings));
  } catch (err) { req.log.error({ err }, "GetBusinessSettings error"); res.status(500).json({ message: "Error interno" }); }
});

// PUT — admin only
router.put("/", requireAdmin, async (req, res) => {
  const parsed = UpdateBusinessSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Datos inválidos" }); return; }
  try {
    const existing = await ensureSettings();
    const [updated] = await db.update(businessSettingsTable)
      .set(parsed.data)
      .where(eq(businessSettingsTable.id, existing.id))
      .returning();
    res.json(fmt(updated));
  } catch (err) { req.log.error({ err }, "UpdateBusinessSettings error"); res.status(500).json({ message: "Error interno" }); }
});

export default router;
