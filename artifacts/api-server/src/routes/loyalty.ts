import { Router } from "express";
import {
  db, customerPointsTable, pointsTransactionsTable,
  businessSettingsTable, customersTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { verifyToken, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);

// ── helpers ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const [s] = await db.select().from(businessSettingsTable).limit(1);
  return s ?? null;
}

async function getOrCreateBalance(tx: any, customerId: number) {
  const [row] = await tx
    .select()
    .from(customerPointsTable)
    .where(eq(customerPointsTable.customerId, customerId))
    .limit(1);
  if (row) return row;
  const [created] = await tx
    .insert(customerPointsTable)
    .values({ customerId, points: 0, lifetimeEarned: 0, lifetimeRedeemed: 0 })
    .returning();
  return created;
}

// ── Award points (called internally from sales route) ─────────────────────────
export async function awardPointsForSale(
  customerId: number,
  saleId: number,
  totalAmount: number,
  pointsPerUnit: number
) {
  const earned = Math.floor(totalAmount * pointsPerUnit);
  if (earned <= 0) return 0;

  await db.transaction(async (tx) => {
    const bal = await getOrCreateBalance(tx, customerId);
    await tx
      .update(customerPointsTable)
      .set({
        points: bal.points + earned,
        lifetimeEarned: bal.lifetimeEarned + earned,
      })
      .where(eq(customerPointsTable.customerId, customerId));
    await tx.insert(pointsTransactionsTable).values({
      customerId,
      delta: earned,
      type: "earned",
      saleId,
      notes: `Puntos ganados por venta #${String(saleId).padStart(6, "0")}`,
    });
  });

  return earned;
}

// ── GET /api/loyalty/balance/:customerId ──────────────────────────────────────
router.get("/balance/:customerId", async (req, res) => {
  const customerId = Number(req.params.customerId);
  try {
    const settings = await getSettings();
    const [bal] = await db
      .select()
      .from(customerPointsTable)
      .where(eq(customerPointsTable.customerId, customerId))
      .limit(1);

    const points = bal?.points ?? 0;
    const redemptionRate = Number(settings?.pointsRedemptionRate ?? 0.01);
    const discountValue = +(points * redemptionRate).toFixed(2);

    res.json({
      customerId,
      points,
      lifetimeEarned: bal?.lifetimeEarned ?? 0,
      lifetimeRedeemed: bal?.lifetimeRedeemed ?? 0,
      discountValue,
      redemptionRate,
      pointsPerUnit: settings?.pointsPerUnit ?? 1,
      loyaltyEnabled: settings?.loyaltyEnabled ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "GetLoyaltyBalance error");
    res.status(500).json({ message: "Error interno" });
  }
});

// ── GET /api/loyalty/history/:customerId ──────────────────────────────────────
router.get("/history/:customerId", async (req, res) => {
  const customerId = Number(req.params.customerId);
  try {
    const rows = await db
      .select()
      .from(pointsTransactionsTable)
      .where(eq(pointsTransactionsTable.customerId, customerId))
      .orderBy(desc(pointsTransactionsTable.createdAt))
      .limit(100);

    res.json(
      rows.map((r) => ({
        id: r.id,
        delta: r.delta,
        type: r.type,
        saleId: r.saleId ?? null,
        notes: r.notes ?? null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "GetLoyaltyHistory error");
    res.status(500).json({ message: "Error interno" });
  }
});

// ── GET /api/loyalty/leaderboard — all customers with points ─────────────────
router.get("/leaderboard", async (req, res) => {
  try {
    const rows = await db
      .select({
        cp: customerPointsTable,
        customerName: customersTable.name,
        customerEmail: customersTable.email,
        customerPhone: customersTable.phone,
        customerNitCi: customersTable.nitCi,
      })
      .from(customerPointsTable)
      .leftJoin(customersTable, eq(customerPointsTable.customerId, customersTable.id))
      .orderBy(desc(customerPointsTable.points));

    const settings = await getSettings();
    const redemptionRate = Number(settings?.pointsRedemptionRate ?? 0.01);

    res.json(
      rows.map((r) => ({
        customerId: r.cp.customerId,
        customerName: r.customerName ?? "Desconocido",
        customerEmail: r.customerEmail ?? null,
        customerPhone: r.customerPhone ?? null,
        customerNitCi: r.customerNitCi ?? null,
        points: r.cp.points,
        lifetimeEarned: r.cp.lifetimeEarned,
        lifetimeRedeemed: r.cp.lifetimeRedeemed,
        discountValue: +(r.cp.points * redemptionRate).toFixed(2),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "GetLeaderboard error");
    res.status(500).json({ message: "Error interno" });
  }
});

// ── POST /api/loyalty/redeem ──────────────────────────────────────────────────
// Body: { customerId, pointsToRedeem }
router.post("/redeem", async (req: AuthRequest, res) => {
  const { customerId, pointsToRedeem } = req.body ?? {};
  if (!customerId || !pointsToRedeem || pointsToRedeem <= 0) {
    res.status(400).json({ message: "Datos inválidos" });
    return;
  }

  try {
    const settings = await getSettings();
    if (!settings?.loyaltyEnabled) {
      res.status(400).json({ message: "El sistema de puntos no está habilitado" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const bal = await getOrCreateBalance(tx, customerId);
      if (bal.points < pointsToRedeem) {
        throw new Error(`Puntos insuficientes. Disponibles: ${bal.points}`);
      }

      const redemptionRate = Number(settings.pointsRedemptionRate ?? 0.01);
      const discountAmount = +(pointsToRedeem * redemptionRate).toFixed(2);

      await tx
        .update(customerPointsTable)
        .set({
          points: bal.points - pointsToRedeem,
          lifetimeRedeemed: bal.lifetimeRedeemed + pointsToRedeem,
        })
        .where(eq(customerPointsTable.customerId, customerId));

      await tx.insert(pointsTransactionsTable).values({
        customerId,
        delta: -pointsToRedeem,
        type: "redeemed",
        notes: `Canje de ${pointsToRedeem} puntos por descuento de ${discountAmount}`,
      });

      return {
        pointsRedeemed: pointsToRedeem,
        discountAmount,
        remainingPoints: bal.points - pointsToRedeem,
      };
    });

    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Puntos insuficientes")) {
      res.status(400).json({ message: err.message });
    } else {
      req.log.error({ err }, "RedeemPoints error");
      res.status(500).json({ message: "Error interno" });
    }
  }
});

// ── POST /api/loyalty/adjust ─ manual admin adjustment ────────────────────────
router.post("/adjust", async (req: AuthRequest, res) => {
  const { customerId, delta, notes } = req.body ?? {};
  if (!customerId || delta === undefined) {
    res.status(400).json({ message: "Datos inválidos" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const bal = await getOrCreateBalance(tx, customerId);
      const newPoints = Math.max(0, bal.points + delta);

      await tx
        .update(customerPointsTable)
        .set({ points: newPoints })
        .where(eq(customerPointsTable.customerId, customerId));

      await tx.insert(pointsTransactionsTable).values({
        customerId,
        delta,
        type: "adjusted",
        notes: notes ?? `Ajuste manual: ${delta > 0 ? "+" : ""}${delta} puntos`,
      });

      return { customerId, points: newPoints, delta };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "AdjustPoints error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
