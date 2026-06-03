import { pgTable, serial, integer, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  userName: varchar("user_name", { length: 200 }),
  userRole: varchar("user_role", { length: 50 }),
  action: varchar("action", { length: 50 }).notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: integer("entity_id"),
  entityName: varchar("entity_name", { length: 300 }),
  details: jsonb("details"),
  ip: varchar("ip", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
