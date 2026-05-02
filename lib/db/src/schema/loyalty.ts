import { pgTable, serial, integer, numeric, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { salesTable } from "./sales";

export const customerPointsTable = pgTable("customer_points", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique().references(() => customersTable.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeRedeemed: integer("lifetime_redeemed").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const pointsTransactionsTable = pgTable("points_transactions", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  type: varchar("type", { length: 30 }).notNull(),
  saleId: integer("sale_id").references(() => salesTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomerPoints = typeof customerPointsTable.$inferSelect;
export type PointsTransaction = typeof pointsTransactionsTable.$inferSelect;
