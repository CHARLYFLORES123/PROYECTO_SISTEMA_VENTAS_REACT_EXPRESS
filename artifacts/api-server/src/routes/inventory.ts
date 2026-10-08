import { Router } from "express";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  inventoryDocumentItemsTable,
  inventoryDocumentsTable,
  productsTable,
  suppliersTable,
  usersTable,
} from "@workspace/db";
import { CreateInventoryDocumentBody } from "@workspace/api-zod";
import { AuthRequest, requireRoles, verifyToken } from "../middlewares/auth";
import { auditLog } from "../lib/audit";

const router = Router();
router.use(verifyToken);

const canRead = requireRoles(["admin", "inventario", "compras"]);
const stockManagerRoles = ["admin", "inventario"];
const purchasingRoles = ["admin", "inventario", "compras"];
const MAX_INVOICE_BYTES = 5 * 1024 * 1024;
const INVOICE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

class InventoryRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function getDocument(id: number) {
  const [document] = await db
    .select({ document: inventoryDocumentsTable, createdByName: usersTable.name })
    .from(inventoryDocumentsTable)
    .leftJoin(usersTable, eq(inventoryDocumentsTable.createdBy, usersTable.id))
    .where(eq(inventoryDocumentsTable.id, id))
    .limit(1);
  if (!document) return undefined;
  const record = document.document;

  const items = await db
    .select({
      id: inventoryDocumentItemsTable.id,
      productId: inventoryDocumentItemsTable.productId,
      productName: productsTable.name,
      barcode: productsTable.barcode,
      size: productsTable.size,
      color: productsTable.color,
      quantity: inventoryDocumentItemsTable.quantity,
      countedStock: inventoryDocumentItemsTable.countedStock,
      unitCost: inventoryDocumentItemsTable.unitCost,
      notes: inventoryDocumentItemsTable.notes,
    })
    .from(inventoryDocumentItemsTable)
    .innerJoin(productsTable, eq(inventoryDocumentItemsTable.productId, productsTable.id))
    .where(eq(inventoryDocumentItemsTable.documentId, id));

  return {
    id: record.id,
    type: record.type,
    status: record.status,
    supplierId: record.supplierId ?? null,
    supplierName: record.supplierName ?? null,
    reference: record.reference ?? null,
    invoiceFileName: record.invoiceFileName ?? null,
    invoiceMimeType: record.invoiceMimeType ?? null,
    createdByName: document.createdByName ?? null,
    notes: record.notes ?? null,
    total: Number(record.total),
    paymentMethod: record.paymentMethod ?? null,
    paymentType: record.paymentType ?? null,
    amountPaid: record.amountPaid === null ? null : Number(record.amountPaid),
    balancePending: record.balancePending === null ? null : Number(record.balancePending),
    createdAt: record.createdAt.toISOString(),
    items: items.map((item) => ({
      ...item,
      barcode: item.barcode ?? null,
      size: item.size ?? null,
      color: item.color ?? null,
      countedStock: item.countedStock ?? null,
      unitCost: Number(item.unitCost),
      notes: item.notes ?? null,
    })),
  };
}

router.get("/documents", canRead, async (req, res) => {
  try {
    const documents = await db
      .select({ id: inventoryDocumentsTable.id })
      .from(inventoryDocumentsTable)
      .orderBy(sql`${inventoryDocumentsTable.createdAt} desc`, sql`${inventoryDocumentsTable.id} desc`);
    const results = await Promise.all(documents.map(({ id }) => getDocument(id)));
    res.json(results.filter((document) => document !== undefined));
  } catch (err) {
    req.log.error({ err }, "GetInventoryDocuments error");
    res.status(500).json({ message: "No se pudieron cargar los movimientos de inventario" });
  }
});

router.post("/documents", async (req: AuthRequest, res) => {
  const parsed = CreateInventoryDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Datos inválidos para el movimiento de inventario" });
    return;
  }

  const { type, items } = parsed.data;
  const role = req.userRole?.toLowerCase() ?? "";
  if (["count", "damaged", "loss"].includes(type) && !stockManagerRoles.includes(role)) {
    res.status(403).json({ message: "Solo inventario o administración puede registrar ajustes de stock" });
    return;
  }
  if (["purchase", "supplier_order"].includes(type) && !purchasingRoles.includes(role)) {
    res.status(403).json({ message: "No tienes permiso para registrar compras o pedidos" });
    return;
  }
  if (["purchase", "supplier_order"].includes(type) && !parsed.data.supplierId) {
    res.status(400).json({ message: "Selecciona un proveedor para la compra o pedido" });
    return;
  }
  const paymentFields = [
    parsed.data.paymentMethod,
    parsed.data.paymentType,
    parsed.data.amountPaid,
  ];
  if (type === "purchase" && (
    paymentFields.some((value) => value === undefined || value === null || value === "") ||
    !parsed.data.paymentMethod?.trim()
  )) {
    res.status(400).json({ message: "Completa la forma de pago, condición y monto pagado de la compra" });
    return;
  }
  if (type !== "purchase" && paymentFields.some((value) => value !== undefined && value !== null && value !== "")) {
    res.status(400).json({ message: "Los datos de pago solo se aceptan para compras recibidas" });
    return;
  }
  const invoiceValues = [
    parsed.data.invoiceFileName,
    parsed.data.invoiceMimeType,
    parsed.data.invoiceFileData,
  ];
  if (invoiceValues.some(Boolean) && invoiceValues.some((value) => !value)) {
    res.status(400).json({ message: "El archivo de factura está incompleto" });
    return;
  }
  if (parsed.data.invoiceFileData) {
    const { invoiceFileData, invoiceMimeType } = parsed.data;
    if (!invoiceMimeType || !INVOICE_MIME_TYPES.has(invoiceMimeType)) {
      res.status(400).json({ message: "Adjunta la factura en PDF, JPEG, PNG o WebP" });
      return;
    }
    const fileBuffer = Buffer.from(invoiceFileData, "base64");
    if (
      fileBuffer.length === 0 ||
      fileBuffer.length > MAX_INVOICE_BYTES ||
      fileBuffer.toString("base64") !== invoiceFileData
    ) {
      res.status(400).json({ message: "El archivo debe pesar como máximo 5 MB y ser válido" });
      return;
    }
    const matchesMimeType =
      (invoiceMimeType === "application/pdf" && fileBuffer.subarray(0, 5).toString() === "%PDF-") ||
      (invoiceMimeType === "image/jpeg" && fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[fileBuffer.length - 2] === 0xff && fileBuffer[fileBuffer.length - 1] === 0xd9) ||
      (invoiceMimeType === "image/png" && fileBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (invoiceMimeType === "image/webp" && fileBuffer.subarray(0, 4).toString() === "RIFF" && fileBuffer.subarray(8, 12).toString() === "WEBP");
    if (!matchesMimeType) {
      res.status(400).json({ message: "El contenido del archivo no coincide con su formato" });
      return;
    }
  }

  try {
    const documentId = await db.transaction(async (tx) => {
      const productIds = items.map((item) => item.productId);
      if (new Set(productIds).size !== productIds.length) {
        throw new InventoryRequestError("No repitas productos dentro del mismo movimiento", 400);
      }

      const products = await tx.select().from(productsTable).where(inArray(productsTable.id, productIds));
      if (products.length !== productIds.length) {
        throw new InventoryRequestError("Uno o más productos ya no existen", 404);
      }
      const productById = new Map(products.map((product) => [product.id, product]));

      let supplierName: string | null = null;
      if (parsed.data.supplierId) {
        const [supplier] = await tx
          .select({ name: suppliersTable.name })
          .from(suppliersTable)
          .where(eq(suppliersTable.id, parsed.data.supplierId))
          .limit(1);
        if (!supplier) throw new InventoryRequestError("El proveedor seleccionado no existe", 404);
        supplierName = supplier.name;
      }

      const preparedItems = items.map((item) => {
        const product = productById.get(item.productId)!;
        if (type === "count") {
          if (item.countedStock === null || item.countedStock === undefined || item.countedStock < 0) {
            throw new InventoryRequestError("El conteo requiere una cantidad física igual o mayor a cero", 400);
          }
          return { ...item, quantity: item.countedStock - product.stock };
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new InventoryRequestError("Las cantidades deben ser números enteros mayores a cero", 400);
        }
        if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
          throw new InventoryRequestError("El costo unitario no puede ser negativo", 400);
        }
        return item;
      });

      const total = ["purchase", "supplier_order"].includes(type)
        ? preparedItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
        : 0;
      const roundedTotal = Math.round((total + Number.EPSILON) * 100) / 100;
      const amountPaid = parsed.data.amountPaid;
      const roundedAmountPaid = amountPaid == null
        ? null
        : Math.round((amountPaid + Number.EPSILON) * 100) / 100;
      if (type === "purchase" && (
        roundedAmountPaid === null ||
        !Number.isFinite(roundedAmountPaid) ||
        roundedAmountPaid < 0 ||
        roundedAmountPaid > roundedTotal ||
        (parsed.data.paymentType === "contado" && roundedAmountPaid !== roundedTotal)
      )) {
        throw new InventoryRequestError("El monto pagado debe estar entre cero y el total; una compra al contado debe pagarse completa", 400);
      }
      const status = type === "supplier_order" ? "prepared" : type === "purchase" ? "received" : "recorded";
      const [document] = await tx
        .insert(inventoryDocumentsTable)
        .values({
          type,
          status,
          supplierId: parsed.data.supplierId ?? null,
          supplierName,
          reference: parsed.data.reference?.trim() || null,
          invoiceFileName: parsed.data.invoiceFileName ?? null,
          invoiceMimeType: parsed.data.invoiceMimeType ?? null,
          invoiceFileData: parsed.data.invoiceFileData ?? null,
          notes: parsed.data.notes?.trim() || null,
          total: String(roundedTotal),
          paymentMethod: type === "purchase" ? parsed.data.paymentMethod!.trim() : null,
          paymentType: type === "purchase" ? parsed.data.paymentType! : null,
          amountPaid: type === "purchase" ? String(roundedAmountPaid) : null,
          balancePending: type === "purchase" ? String(Math.round((roundedTotal - roundedAmountPaid!) * 100) / 100) : null,
          createdBy: req.userId ?? null,
        })
        .returning({ id: inventoryDocumentsTable.id });

      await tx.insert(inventoryDocumentItemsTable).values(
        preparedItems.map((item) => ({
          documentId: document.id,
          productId: item.productId,
          quantity: item.quantity,
          countedStock: item.countedStock ?? null,
          unitCost: String(item.unitCost),
          notes: item.notes?.trim() || null,
        })),
      );

      if (type === "purchase" || type === "count" || type === "damaged" || type === "loss") {
        for (const item of preparedItems) {
          const product = productById.get(item.productId)!;
          if (type === "count") {
            await tx
              .update(productsTable)
              .set({ stock: item.countedStock! })
              .where(eq(productsTable.id, item.productId));
          } else if (type === "damaged" || type === "loss") {
            const [updated] = await tx
              .update(productsTable)
              .set({ stock: sql`${productsTable.stock} - ${item.quantity}` })
              .where(and(eq(productsTable.id, item.productId), gte(productsTable.stock, item.quantity)))
              .returning({ id: productsTable.id });
            if (!updated) {
              throw new InventoryRequestError(`Stock insuficiente para ${product.name}`, 409);
            }
          } else {
            await tx
              .update(productsTable)
              .set({
                stock: sql`${productsTable.stock} + ${item.quantity}`,
                purchasePrice: String(item.unitCost),
              })
              .where(eq(productsTable.id, item.productId));
          }
        }
      }

      return document.id;
    });

    const result = await getDocument(documentId);
    if (!result) throw new Error(`Created inventory document ${documentId} could not be reloaded`);
    res.status(201).json(result);
    auditLog({
      req,
      action: "created",
      entity: "inventory_document",
      entityId: documentId,
      entityName: type,
      details: { type, status: result.status, total: result.total },
    });
  } catch (err) {
    if (err instanceof InventoryRequestError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    req.log.error({ err }, "CreateInventoryDocument error");
    res.status(500).json({ message: "No se pudo guardar el movimiento de inventario" });
  }
});

router.get("/documents/:id/attachment", canRead, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: "Identificador de movimiento inválido" });
    return;
  }
  try {
    const [document] = await db
      .select({
        invoiceFileName: inventoryDocumentsTable.invoiceFileName,
        invoiceMimeType: inventoryDocumentsTable.invoiceMimeType,
        invoiceFileData: inventoryDocumentsTable.invoiceFileData,
      })
      .from(inventoryDocumentsTable)
      .where(eq(inventoryDocumentsTable.id, id))
      .limit(1);
    if (!document) {
      res.status(404).json({ message: "Movimiento no encontrado" });
      return;
    }
    if (!document.invoiceFileData || !document.invoiceFileName || !document.invoiceMimeType) {
      res.status(404).json({ message: "Este movimiento no tiene factura adjunta" });
      return;
    }
    res
      .set("Content-Type", document.invoiceMimeType)
      .set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(document.invoiceFileName)}`)
      .set("X-Content-Type-Options", "nosniff")
      .send(Buffer.from(document.invoiceFileData, "base64"));
  } catch (err) {
    req.log.error({ err }, "DownloadInventoryInvoice error");
    res.status(500).json({ message: "No se pudo descargar la factura" });
  }
});

router.post("/documents/:id/receive", async (req: AuthRequest, res) => {
  if (!purchasingRoles.includes(req.userRole?.toLowerCase() ?? "")) {
    res.status(403).json({ message: "No tienes permiso para recibir pedidos de proveedores" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ message: "Identificador de pedido inválido" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const [document] = await tx
        .update(inventoryDocumentsTable)
        .set({ status: "received" })
        .where(and(
          eq(inventoryDocumentsTable.id, id),
          eq(inventoryDocumentsTable.type, "supplier_order"),
          eq(inventoryDocumentsTable.status, "prepared"),
        ))
        .returning({ id: inventoryDocumentsTable.id });
      if (!document) {
        const [existing] = await tx
          .select({ id: inventoryDocumentsTable.id })
          .from(inventoryDocumentsTable)
          .where(eq(inventoryDocumentsTable.id, id))
          .limit(1);
        throw new InventoryRequestError(
          existing ? "El pedido ya fue recibido o no está preparado" : "Pedido no encontrado",
          existing ? 409 : 404,
        );
      }

      const items = await tx
        .select()
        .from(inventoryDocumentItemsTable)
        .where(eq(inventoryDocumentItemsTable.documentId, id));
      for (const item of items) {
        await tx
          .update(productsTable)
          .set({
            stock: sql`${productsTable.stock} + ${item.quantity}`,
            purchasePrice: String(item.unitCost),
          })
          .where(eq(productsTable.id, item.productId));
      }
    });

    const result = await getDocument(id);
    if (!result) throw new Error(`Received inventory document ${id} could not be reloaded`);
    res.json(result);
    auditLog({
      req,
      action: "received",
      entity: "inventory_document",
      entityId: id,
      entityName: result.supplierName ?? result.reference ?? `Pedido #${id}`,
      details: { total: result.total },
    });
  } catch (err) {
    if (err instanceof InventoryRequestError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    req.log.error({ err }, "ReceiveInventoryDocument error");
    res.status(500).json({ message: "No se pudo recibir el pedido" });
  }
});

export default router;
