import { db, auditLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { AuthRequest } from "../middlewares/auth";

interface AuditOptions {
  req: AuthRequest;
  action: string;
  entity: string;
  entityId?: number | null;
  entityName?: string | null;
  details?: Record<string, unknown>;
}

export async function auditLog({ req, action, entity, entityId, entityName, details }: AuditOptions): Promise<void> {
  try {
    const forwarded = req.headers["x-forwarded-for"] as string | undefined;
    const ip = forwarded?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? null;
    await db.insert(auditLogsTable).values({
      userId: req.userId ?? null,
      userName: req.userName ?? null,
      userRole: req.userRole ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      entityName: entityName ?? null,
      details: details ?? null,
      ip,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to write audit log (non-fatal)");
  }
}
