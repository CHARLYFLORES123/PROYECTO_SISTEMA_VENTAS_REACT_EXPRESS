import { pgTable, serial, varchar, text, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessSettingsTable = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  companyName: varchar("company_name", { length: 300 }).notNull().default("Mi Empresa"),
  rucNit: varchar("ruc_nit", { length: 50 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 256 }),
  address: text("address"),
  logoUrl: text("logo_url"),
  currency: varchar("currency", { length: 10 }).notNull().default("BOB"),
  currencySymbol: varchar("currency_symbol", { length: 10 }).notNull().default("Bs"),
  // Loyalty / points
  loyaltyEnabled: boolean("loyalty_enabled").notNull().default(false),
  pointsPerUnit: integer("points_per_unit").notNull().default(1),
  pointsRedemptionRate: numeric("points_redemption_rate", { precision: 8, scale: 4 }).notNull().default("0.01"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBusinessSettingsSchema = createInsertSchema(businessSettingsTable).omit({ id: true, updatedAt: true });
export type InsertBusinessSettings = z.infer<typeof insertBusinessSettingsSchema>;
export type BusinessSettings = typeof businessSettingsTable.$inferSelect;
