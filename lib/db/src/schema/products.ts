import { pgTable, serial, varchar, text, integer, numeric, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { brandsTable } from "./brands";
import { suppliersTable } from "./suppliers";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  sku: varchar("sku", { length: 100 }),
  barcode: varchar("barcode", { length: 100 }),
  description: text("description"),
  size: varchar("size", { length: 50 }),
  color: varchar("color", { length: 100 }),
  subcategory: varchar("subcategory", { length: 200 }),
  material: varchar("material", { length: 200 }),
  season: varchar("season", { length: 100 }),
  gender: varchar("gender", { length: 50 }),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  entryDate: date("entry_date").notNull().defaultNow(),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  wholesalePrice: numeric("wholesale_price", { precision: 12, scale: 2 }),
  promotionalPrice: numeric("promotional_price", { precision: 12, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  brandId: integer("brand_id").references(() => brandsTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  imageUrls: text("image_urls").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("products_sku_unique").on(table.sku)]);

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
