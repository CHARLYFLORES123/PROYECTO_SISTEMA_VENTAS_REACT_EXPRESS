import { pgTable, serial, integer, varchar, numeric, timestamp, text } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";
import { salesTable } from "./sales";

export const COUPON_TIERS = {
  silver: { discountPercent: 5,  expiryDays: 30, label: "Nivel Plata" },
  gold:   { discountPercent: 10, expiryDays: 60, label: "Nivel Oro"   },
} as const;

export type CouponTier = keyof typeof COUPON_TIERS;

export function generateCouponCode(tier: CouponTier): string {
  const prefix = tier === "gold" ? "GOLD" : "PLATA";
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${rand}`;
}

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 20 }).notNull(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedInSaleId: integer("used_in_sale_id").references(() => salesTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Coupon = typeof couponsTable.$inferSelect;
