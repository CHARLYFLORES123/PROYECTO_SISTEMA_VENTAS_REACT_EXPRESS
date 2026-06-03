import { Router } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { verifyToken, requireAdmin, AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(verifyToken);
router.use(requireAdmin);

const ACTION_LABELS: Record<string, string> = {
  login:     "Ingresó",
  created:   "Creó",
  updated:   "Actualizó",
  deleted:   "Eliminó",
  cancelled: "Canceló",
  converted: "Convirtió",
};

const ENTITY_LABELS: Record<string, string> = {
  product:  "Producto",
  category: "Categoría",
  brand:    "Marca",
  customer: "Cliente",
  supplier: "Proveedor",
  sale:     "Venta",
  quote:    "Cotización",
  user:     "Usuario",
  settings: "Configuración",
};

// GET /api/audit-logs
router.get("/", async (req: AuthRequest, res) => {
  const { dateFrom, dateTo, userId, action, entity, limit: limitQ, offset: offsetQ } = req.query as any;

  const pageLimit = Math.min(Number(limitQ) || 50, 200);
  const pageOffset = Number(offsetQ) || 0;

  try {
    const rows = await db
      .select()
      .from(auditLogsTable)
      .where(
        and(
          dateFrom ? gte(auditLogsTable.createdAt, new Date(dateFrom)) : undefined,
          dateTo ? lte(auditLogsTable.createdAt, new Date(new Date(dateTo).getTime() + 86399999)) : undefined,
          userId ? eq(auditLogsTable.userId, Number(userId)) : undefined,
          action ? eq(auditLogsTable.action, String(action)) : undefined,
          entity ? eq(auditLogsTable.entity, String(entity)) : undefined,
        )
      )
      .orderBy(sql`${auditLogsTable.createdAt} DESC`)
      .limit(pageLimit)
      .offset(pageOffset);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(auditLogsTable)
      .where(
        and(
          dateFrom ? gte(auditLogsTable.createdAt, new Date(dateFrom)) : undefined,
          dateTo ? lte(auditLogsTable.createdAt, new Date(new Date(dateTo).getTime() + 86399999)) : undefined,
          userId ? eq(auditLogsTable.userId, Number(userId)) : undefined,
          action ? eq(auditLogsTable.action, String(action)) : undefined,
          entity ? eq(auditLogsTable.entity, String(entity)) : undefined,
        )
      );

    res.json({
      total: Number(total),
      limit: pageLimit,
      offset: pageOffset,
      data: rows.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        userRole: r.userRole,
        action: r.action,
        actionLabel: ACTION_LABELS[r.action] ?? r.action,
        entity: r.entity,
        entityLabel: ENTITY_LABELS[r.entity] ?? r.entity,
        entityId: r.entityId,
        entityName: r.entityName,
        details: r.details,
        ip: r.ip,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "GetAuditLogs error");
    res.status(500).json({ message: "Error interno" });
  }
});

export default router;
