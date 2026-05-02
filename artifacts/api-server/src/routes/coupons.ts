import { Router } from "express";
import { db, couponsTable, customersTable, COUPON_TIERS, generateCouponCode } from "@workspace/db";
import type { CouponTier } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { verifyToken, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

// ── internal: create a coupon for a customer on tier_up ───────────────────────
export async function issueTierCoupon(tx: any, customerId: number, tier: CouponTier) {
  const cfg = COUPON_TIERS[tier];
  const code = generateCouponCode(tier);
  const expiresAt = new Date(Date.now() + cfg.expiryDays * 24 * 60 * 60 * 1000);
  const [coupon] = await tx
    .insert(couponsTable)
    .values({
      code,
      customerId,
      tier,
      discountPercent: cfg.discountPercent.toString(),
      status: "active",
      expiresAt,
      notes: `Cupón automático por alcanzar nivel ${cfg.label} — ${cfg.discountPercent}% descuento`,
    })
    .returning();
  return coupon;
}

// ── GET /api/coupons — admin list all coupons ─────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        coupon: couponsTable,
        customerName: customersTable.name,
        customerEmail: customersTable.email,
      })
      .from(couponsTable)
      .leftJoin(customersTable, eq(couponsTable.customerId, customersTable.id))
      .orderBy(desc(couponsTable.createdAt));

    res.json(rows.map(r => ({
      ...r.coupon,
      discountPercent: Number(r.coupon.discountPercent),
      customerName: r.customerName ?? "—",
      customerEmail: r.customerEmail ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "ListCoupons error");
    res.status(500).json({ message: "Error interno" });
  }
});

// ── GET /api/coupons/customer/:customerId ─────────────────────────────────────
router.get("/customer/:customerId", async (req, res) => {
  const customerId = Number(req.params.customerId);
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.customerId, customerId))
      .orderBy(desc(couponsTable.createdAt));

    // mark expired ones lazily in the response (no db update needed for display)
    res.json(rows.map(r => ({
      ...r,
      discountPercent: Number(r.discountPercent),
      status: r.status === "active" && r.expiresAt < now ? "expired" : r.status,
    })));
  } catch (err) {
    req.log.error({ err }, "CustomerCoupons error");
    res.status(500).json({ message: "Error interno" });
  }
});

// ── POST /api/coupons/validate — check a code before applying to sale ─────────
// Body: { code }
router.post("/validate", async (req: AuthRequest, res) => {
  const { code } = req.body ?? {};
  if (!code) { res.status(400).json({ message: "Código requerido" }); return; }

  try {
    const [coupon] = await db
      .select({ coupon: couponsTable, customerName: customersTable.name })
      .from(couponsTable)
      .leftJoin(customersTable, eq(couponsTable.customerId, customersTable.id))
      .where(eq(couponsTable.code, code.trim().toUpperCase()))
      .limit(1);

    if (!coupon) {
      res.status(404).json({ message: "Código no encontrado" });
      return;
    }

    const now = new Date();
    if (coupon.coupon.status === "used") {
      res.status(400).json({ message: "Este cupón ya fue utilizado" });
      return;
    }
    if (coupon.coupon.status === "expired" || coupon.coupon.expiresAt < now) {
      res.status(400).json({ message: "Este cupón ha vencido" });
      return;
    }

    res.json({
      id: coupon.coupon.id,
      code: coupon.coupon.code,
      customerId: coupon.coupon.customerId,
      customerName: coupon.customerName ?? "—",
      tier: coupon.coupon.tier,
      discountPercent: Number(coupon.coupon.discountPercent),
      expiresAt: coupon.coupon.expiresAt instanceof Date
        ? coupon.coupon.expiresAt.toISOString()
        : coupon.coupon.expiresAt,
      notes: coupon.coupon.notes,
      valid: true,
    });
  } catch (err) {
    req.log.error({ err }, "ValidateCoupon error");
    res.status(500).json({ message: "Error interno" });
  }
});

// ── POST /api/coupons/redeem — mark as used (called at sale time) ─────────────
// Body: { code, saleId }
router.post("/redeem", async (req: AuthRequest, res) => {
  const { code, saleId } = req.body ?? {};
  if (!code) { res.status(400).json({ message: "Código requerido" }); return; }

  try {
    const [existing] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, code.trim().toUpperCase()))
      .limit(1);

    if (!existing) { res.status(404).json({ message: "Código no encontrado" }); return; }
    if (existing.status !== "active") { res.status(400).json({ message: `Cupón ${existing.status === "used" ? "ya utilizado" : "vencido"}` }); return; }
    if (existing.expiresAt < new Date()) { res.status(400).json({ message: "Cupón vencido" }); return; }

    const [updated] = await db
      .update(couponsTable)
      .set({ status: "used", usedAt: new Date(), usedInSaleId: saleId ?? null })
      .where(eq(couponsTable.id, existing.id))
      .returning();

    res.json({ ...updated, discountPercent: Number(updated.discountPercent) });
  } catch (err) {
    req.log.error({ err }, "RedeemCoupon error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
