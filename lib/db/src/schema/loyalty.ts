import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { salesTable } from "./sales";

export const TIER_CONFIG = {
  bronze: { label: "Bronce", min: 0,    max: 999,  multiplier: 1.0, color: "#CD7F32" },
  silver: { label: "Plata",  min: 1000, max: 4999, multiplier: 1.5, color: "#9CA3AF" },
  gold:   { label: "Oro",    min: 5000, max: null,  multiplier: 2.0, color: "#F59E0B" },
} as const;

export type TierName = keyof typeof TIER_CONFIG;

export function getTierForLifetime(lifetimeEarned: number): TierName {
  if (lifetimeEarned >= TIER_CONFIG.gold.min) return "gold";
  if (lifetimeEarned >= TIER_CONFIG.silver.min) return "silver";
  return "bronze";
}

export const customerPointsTable = pgTable("customer_points", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique().references(() => customersTable.id, { onDelete: "cascade" }),
  points: integer("points").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  lifetimeRedeemed: integer("lifetime_redeemed").notNull().default(0),
  tier: varchar("tier", { length: 20 }).notNull().default("bronze"),
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
