import { pgTable, serial, varchar, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { suppliersTable } from "./suppliers";
import { productsTable } from "./products";
import { usersTable } from "./users";

export const inventoryDocumentsTable = pgTable("inventory_documents", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 30 }).notNull(),
  status: varchar("status", { length: 30 }).notNull(),
  supplierId: integer("supplier_id").references(() => suppliersTable.id, { onDelete: "set null" }),
  supplierName: varchar("supplier_name", { length: 300 }),
  reference: varchar("reference", { length: 150 }),
  invoiceFileName: varchar("invoice_file_name", { length: 255 }),
  invoiceMimeType: varchar("invoice_mime_type", { length: 100 }),
  invoiceFileData: text("invoice_file_data"),
  notes: text("notes"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentMethod: varchar("payment_method", { length: 100 }),
  paymentType: varchar("payment_type", { length: 20 }),
  amountPaid: numeric("amount_paid", { precision: 12, scale: 2 }),
  balancePending: numeric("balance_pending", { precision: 12, scale: 2 }),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryDocumentItemsTable = pgTable("inventory_document_items", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => inventoryDocumentsTable.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  countedStock: integer("counted_stock"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
});

export type InventoryDocument = typeof inventoryDocumentsTable.$inferSelect;
export type InventoryDocumentItem = typeof inventoryDocumentItemsTable.$inferSelect;
