import { useEffect, useState } from "react";
import {
  useCreateInventoryDocument,
  useGetInventoryDocuments,
  useGetPaymentMethods,
  useGetInventoryReport,
  useGetProducts,
  useGetSuppliers,
  useReceiveInventoryDocument,
  customFetch,
} from "@workspace/api-client-react";
import type { CreateInventoryDocumentBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardList, Download, FileSpreadsheet, FileText, PackagePlus, Plus, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Swal, Toast } from "@/lib/swal";
import { exportTablePDF } from "@/lib/export-table-pdf";

type DocumentType = CreateInventoryDocumentBody["type"];
type ItemDraft = { productId: string; quantity: string; countedStock: string; unitCost: string };
type InvoiceDraft = { fileName: string; mimeType: string; data: string };

const EMPTY_ITEM: ItemDraft = { productId: "", quantity: "1", countedStock: "", unitCost: "0" };
const MAX_INVOICE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_INVOICE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const DOCUMENT_LABELS: Record<DocumentType, string> = {
  purchase: "Compra recibida",
  supplier_order: "Pedido a proveedor",
  count: "Conteo físico",
  damaged: "Producto dañado",
  loss: "Pérdida",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error al guardar el movimiento";
}

export default function Inventory() {
  const { currencySymbol } = useCurrency();
  const { can, role } = usePermissions();
  const normalizedRole = role.toLowerCase();
  const canManageStock = normalizedRole === "admin" || normalizedRole === "inventario";
  const canCreate = can("inventory", "create");
  const queryClient = useQueryClient();
  const { data: report, isLoading: reportLoading, error: reportError } = useGetInventoryReport();
  const { data: documents, isLoading: documentsLoading, error: documentsError } = useGetInventoryDocuments();
  const { data: products, error: productsError } = useGetProducts();
  const { data: suppliers, error: suppliersError } = useGetSuppliers();
  const { data: paymentMethods } = useGetPaymentMethods();
  const createMutation = useCreateInventoryDocument();
  const receiveMutation = useReceiveInventoryDocument();

  const [type, setType] = useState<DocumentType>("purchase");
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [paymentType, setPaymentType] = useState<"contado" | "credito">("contado");
  const [amountPaid, setAmountPaid] = useState("0");
  const [invoice, setInvoice] = useState<InvoiceDraft | null>(null);
  const [isReadingInvoice, setIsReadingInvoice] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [activeTab, setActiveTab] = useState("report");
  const activePaymentMethods = paymentMethods?.filter((method) => method.isActive).map((method) => method.name) ?? [];
  const availablePaymentMethods = activePaymentMethods.length
    ? activePaymentMethods
    : ["Efectivo", "Transferencia", "Tarjeta", "Otro"];
  const purchaseTotal = Math.round(items.reduce((sum, item) =>
    sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0) * 100) / 100;
  const pendingBalance = Math.max(0, purchaseTotal - (paymentType === "contado" ? purchaseTotal : Number(amountPaid) || 0));

  useEffect(() => {
    if (activePaymentMethods.length && !activePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(activePaymentMethods[0]);
    }
  }, [activePaymentMethods.join("|"), paymentMethod]);

  const invalidateInventory = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/inventory/documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/products/inventory-report"] });
  };

  const handleExport = () => {
    if (!report) return;
    const worksheetData = report.map((item) => ({
      "ID": item.id,
      "Código de Barras": item.barcode || "",
      "Producto": item.name,
      "SKU": item.sku || "",
      "Talla": item.size || "",
      "Color": item.color || "",
      "Subcategoría": item.subcategory || "",
      "Material": item.material || "",
      "Temporada": item.season || "",
      "Género": item.gender || "",
      "Proveedor": item.supplierName || "",
      "Fecha de ingreso": item.entryDate,
      "Categoría": item.categoryName || "",
      "Precio Compra": item.purchasePrice,
      "Precio Venta": item.salePrice,
      "Precio Mayorista": item.wholesalePrice ?? "",
      "Precio Promocional": item.promotionalPrice ?? "",
      "Margen (%)": item.profitMargin,
      "Stock Actual": item.stock,
      "Stock Mínimo": item.minStock,
      "Valor en Stock": item.stockValue,
      "Estado": item.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    worksheet["!cols"] = [5, 15, 28, 15, 10, 15, 18, 18, 18, 16, 20, 14, 15, 15, 15, 16, 16, 12, 10, 10, 15, 12].map((wch) => ({ wch }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    XLSX.writeFile(workbook, `Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPDF = () => {
    if (activeTab === "movements") {
      exportTablePDF({
        title: "Movimientos de Inventario",
        fileName: `Movimientos_Inventario_${new Date().toISOString().slice(0, 10)}.pdf`,
        headers: ["Fecha", "Tipo", "Proveedor/referencia", "Productos", "Total", "Forma de pago", "Pagado", "Saldo", "Registró", "Estado"],
        rows: (documents ?? []).map((document) => [
          new Date(document.createdAt).toLocaleString("es-BO"),
          DOCUMENT_LABELS[document.type],
          document.supplierName || document.reference || "-",
          document.items.map((item) => `${item.productName} × ${item.quantity}${item.size || item.color ? ` (${[item.size, item.color].filter(Boolean).join(" / ")})` : ""}`).join(", "),
          formatCurrency(document.total ?? 0, currencySymbol),
          document.paymentMethod ? `${document.paymentMethod} · ${document.paymentType === "credito" ? "Crédito" : "Contado"}` : "-",
          formatCurrency(document.amountPaid ?? 0, currencySymbol),
          formatCurrency(document.balancePending ?? 0, currencySymbol),
          document.createdByName || "-",
          document.status === "prepared" ? "Pendiente de recibir" : document.status === "received" ? "Recibido" : "Registrado",
        ]),
      });
      return;
    }
    exportTablePDF({
      title: "Gestión de Inventario",
      fileName: `Inventario_${new Date().toISOString().slice(0, 10)}.pdf`,
      subtitle: `Variantes: ${report?.length ?? 0} · Valor en stock: ${formatCurrency(stockValue, currencySymbol)} · Stock bajo/agotado: ${lowStockCount}`,
      headers: ["Producto", "SKU", "Talla", "Color", "Categoría", "Proveedor", "Costo", "Precio", "Stock", "Valor", "Estado"],
      rows: (report ?? []).map((item) => [
        item.name,
        item.sku || "-",
        item.size || "-",
        item.color || "-",
        item.categoryName || "-",
        item.supplierName || "-",
        formatCurrency(item.purchasePrice, currencySymbol),
        formatCurrency(item.salePrice, currencySymbol),
        `${item.stock} (mín. ${item.minStock})`,
        formatCurrency(item.stockValue, currencySymbol),
        item.status,
      ]),
    });
  };

  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ));
  };

  const handleTypeChange = (value: string) => {
    setType(value as DocumentType);
    setSupplierId("");
    setItems([{ ...EMPTY_ITEM }]);
    setInvoice(null);
    setPaymentType("contado");
    setAmountPaid("0");
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.find((item) => item.id === Number(productId));
    updateItem(index, {
      productId,
      unitCost: product ? String(product.purchasePrice) : "0",
    });
  };

  const handleInvoiceChange = async (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_INVOICE_TYPES.includes(file.type)) {
      Toast.fire({ icon: "error", title: "Adjunta la factura en PDF, JPEG, PNG o WebP" });
      return;
    }
    if (file.size > MAX_INVOICE_BYTES) {
      Toast.fire({ icon: "error", title: "La factura debe pesar como máximo 5 MB" });
      return;
    }
    if (file.name.length > 255) {
      Toast.fire({ icon: "error", title: "El nombre del archivo supera los 255 caracteres" });
      return;
    }
    setIsReadingInvoice(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Archivo inválido"));
        reader.readAsDataURL(file);
      });
      const data = dataUrl.split(",", 2)[1];
      if (!data) throw new Error("El archivo no contiene datos");
      setInvoice({ fileName: file.name, mimeType: file.type, data });
    } catch (error) {
      Toast.fire({ icon: "error", title: errorMessage(error) });
    } finally {
      setIsReadingInvoice(false);
    }
  };

  const handleDownloadInvoice = async (id: number, fileName: string) => {
    try {
      const blob = await customFetch<Blob>(`/api/inventory/documents/${id}/attachment`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      Toast.fire({ icon: "error", title: errorMessage(error) });
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestItems = items.map((item) => ({
      productId: Number(item.productId),
      quantity: type === "count" ? 1 : Number(item.quantity),
      countedStock: type === "count" ? Number(item.countedStock) : null,
      unitCost: Number(item.unitCost),
    }));

    if (requestItems.some((item) => !item.productId || !Number.isFinite(item.unitCost))) {
      Toast.fire({ icon: "error", title: "Completa el producto y el costo de cada línea" });
      return;
    }
    if (type === "count" && items.some((item) => item.countedStock === "" || Number(item.countedStock) < 0)) {
      Toast.fire({ icon: "error", title: "Indica las unidades contadas físicamente" });
      return;
    }
    if (requiresSupplier && !supplierId) {
      Toast.fire({ icon: "error", title: "Selecciona un proveedor" });
      return;
    }
    if (type !== "count" && requestItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      Toast.fire({ icon: "error", title: "Las cantidades deben ser enteros mayores a cero" });
      return;
    }
    const paid = paymentType === "contado" ? purchaseTotal : Number(amountPaid);
    if (type === "purchase" && (
      !paymentMethod ||
      !Number.isFinite(paid) ||
      paid < 0 ||
      paid > purchaseTotal
    )) {
      Toast.fire({ icon: "error", title: "Revisa la forma de pago y el monto pagado; no puede superar el total" });
      return;
    }

    const body: CreateInventoryDocumentBody = {
      type,
      supplierId: supplierId ? Number(supplierId) : null,
      reference: reference.trim() || null,
      invoiceFileName: invoice?.fileName ?? null,
      invoiceMimeType: invoice?.mimeType ?? null,
      invoiceFileData: invoice?.data ?? null,
      paymentMethod: type === "purchase" ? paymentMethod : null,
      paymentType: type === "purchase" ? paymentType : null,
      amountPaid: type === "purchase" ? paid : null,
      notes: notes.trim() || null,
      items: requestItems,
    };
    createMutation.mutate({ data: body }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: `${DOCUMENT_LABELS[type]} registrada` });
        invalidateInventory();
        setSupplierId("");
        setReference("");
        setNotes("");
        setInvoice(null);
        setPaymentType("contado");
        setAmountPaid("0");
        setItems([{ ...EMPTY_ITEM }]);
        setActiveTab("movements");
      },
      onError: (error) => Toast.fire({ icon: "error", title: errorMessage(error) }),
    });
  };

  const handleReceive = async (id: number, supplierName: string | null) => {
    const confirmation = await Swal.fire({
      title: "¿Recibir este pedido?",
      text: `Se sumarán las cantidades al inventario${supplierName ? ` del proveedor ${supplierName}` : ""}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Recibir mercadería",
      cancelButtonText: "Cancelar",
    });
    if (!confirmation.isConfirmed) return;
    receiveMutation.mutate({ id }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: "Mercadería recibida y stock actualizado" });
        invalidateInventory();
      },
      onError: (error) => Toast.fire({ icon: "error", title: errorMessage(error) }),
    });
  };

  const stockValue = report?.reduce((sum, item) => sum + item.stockValue, 0) ?? 0;
  const lowStockCount = report?.filter((item) => item.status !== "OK").length ?? 0;
  const requiresSupplier = type === "purchase" || type === "supplier_order";
  const typeOptions = (Object.keys(DOCUMENT_LABELS) as DocumentType[])
    .filter((value) => canManageStock || value === "purchase" || value === "supplier_order");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestión de inventario</h2>
          <p className="text-sm text-muted-foreground">Compras, recepción, conteos y ajustes de existencias por variante.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!report?.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Descargar Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF} disabled={activeTab === "movements" ? !documents?.length : !report?.length}>
            <FileText className="mr-2 h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Variantes de producto</div>
          <div className="mt-1 text-3xl font-bold">{report?.length ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Valor actual del stock</div>
          <div className="mt-1 text-3xl font-bold text-primary">{formatCurrency(stockValue, currencySymbol)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-sm text-muted-foreground">Stock bajo o agotado</div>
          <div className="mt-1 flex items-center gap-2 text-3xl font-bold text-destructive">
            <AlertTriangle className="h-6 w-6" /> {lowStockCount}
          </div>
        </CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="report">Revisar inventario</TabsTrigger>
          <TabsTrigger value="movements">Movimientos</TabsTrigger>
          {canCreate && <TabsTrigger value="register">Registrar movimiento</TabsTrigger>}
        </TabsList>

        <TabsContent value="report">
          <Card>
            <CardHeader><CardTitle>Existencias por talla y color</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Producto</TableHead><TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Compra</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {reportError ? (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center text-destructive">{errorMessage(reportError)}</TableCell></TableRow>
                    ) : reportLoading ? (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center">Cargando inventario...</TableCell></TableRow>
                    ) : report?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {[item.sku && `SKU ${item.sku}`, item.size && `Talla ${item.size}`, item.color, item.subcategory, item.material, item.season, item.gender, item.supplierName, item.entryDate, item.barcode]
                              .filter(Boolean).join(" · ") || "Sin detalles adicionales"}
                          </div>
                        </TableCell>
                        <TableCell>{item.categoryName || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.purchasePrice, currencySymbol)}</TableCell>
                        <TableCell className="text-right">
                          <div>{formatCurrency(item.salePrice, currencySymbol)}</div>
                          {item.promotionalPrice != null && <div className="text-xs text-destructive">Promo {formatCurrency(item.promotionalPrice, currencySymbol)}</div>}
                          {item.wholesalePrice != null && <div className="text-xs text-muted-foreground">May. {formatCurrency(item.wholesalePrice, currencySymbol)}</div>}
                          <div className="text-xs text-muted-foreground">Margen {item.profitMargin.toFixed(2)}%</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.stock}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(item.stockValue, currencySymbol)}</TableCell>
                        <TableCell className="text-center">
                          {item.status === "Sin stock" ? <Badge variant="destructive">Agotado</Badge>
                            : item.status === "Stock bajo" ? <Badge variant="outline">Bajo</Badge>
                              : <Badge variant="outline">OK</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!reportError && !reportLoading && !report?.length && (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No hay productos registrados.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader><CardTitle>Historial de compras, pedidos y ajustes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Proveedor / referencia</TableHead>
                    <TableHead>Productos</TableHead><TableHead className="text-right">Total</TableHead>
                    <TableHead>Pago / saldo</TableHead><TableHead>Registró</TableHead><TableHead>Factura</TableHead>
                    <TableHead>Estado</TableHead>{canCreate && <TableHead>Acciones</TableHead>}
                  </TableRow></TableHeader>
                  <TableBody>
                    {documentsError ? (
                      <TableRow><TableCell colSpan={canCreate ? 10 : 9} className="py-8 text-center text-destructive">{errorMessage(documentsError)}</TableCell></TableRow>
                    ) : documentsLoading ? (
                      <TableRow><TableCell colSpan={canCreate ? 10 : 9} className="py-8 text-center">Cargando movimientos...</TableCell></TableRow>
                    ) : documents?.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell>{new Date(document.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{DOCUMENT_LABELS[document.type]}</TableCell>
                        <TableCell>{document.supplierName || document.reference || "-"}</TableCell>
                        <TableCell>
                          <div>{document.items.map((item) => {
                            const movement = document.type === "count"
                              ? `conteo ${item.countedStock} (${item.quantity > 0 ? "+" : ""}${item.quantity})`
                              : `${document.type === "damaged" || document.type === "loss" ? "-" : "+"}${item.quantity}`;
                            return `${item.productName} (${movement})`;
                          }).join(", ")}</div>
                          {document.items.some((item) => item.size || item.color) && (
                            <div className="text-xs text-muted-foreground">
                              {document.items.map((item) => [item.size, item.color].filter(Boolean).join(" / ")).filter(Boolean).join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{document.total ? formatCurrency(document.total, currencySymbol) : "-"}</TableCell>
                        <TableCell>
                          {document.paymentMethod ? (
                            <div className="text-xs">
                              <div>{document.paymentMethod} · {document.paymentType === "contado" ? "Contado" : "Crédito"}</div>
                              <div>Pagado: {formatCurrency(document.amountPaid ?? 0, currencySymbol)}</div>
                              <div>Saldo: {formatCurrency(document.balancePending ?? 0, currencySymbol)}</div>
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{document.createdByName || "-"}</TableCell>
                        <TableCell>
                          {document.invoiceFileName ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => void handleDownloadInvoice(document.id, document.invoiceFileName!)}>
                              <Download className="mr-1 h-4 w-4" /> Descargar
                            </Button>
                          ) : "-"}
                        </TableCell>
                        <TableCell><Badge variant={document.status === "prepared" ? "secondary" : "outline"}>
                          {document.status === "prepared" ? "Pendiente de recibir" : document.status === "received" ? "Recibido" : "Registrado"}
                        </Badge></TableCell>
                        {canCreate && <TableCell>
                          {document.type === "supplier_order" && document.status === "prepared" && (
                            <Button size="sm" onClick={() => handleReceive(document.id, document.supplierName ?? null)} disabled={receiveMutation.isPending}>
                              <PackagePlus className="mr-1 h-4 w-4" /> Recibir
                            </Button>
                          )}
                        </TableCell>}
                      </TableRow>
                    ))}
                    {!documentsError && !documentsLoading && !documents?.length && (
                      <TableRow><TableCell colSpan={canCreate ? 10 : 9} className="py-8 text-center text-muted-foreground">Aún no hay movimientos de inventario.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canCreate && <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Registrar movimiento</CardTitle>
              <p className="text-sm text-muted-foreground">Las compras aumentan el stock al guardarse. Los pedidos preparados lo aumentan al recibirlos.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {productsError && <p role="alert" className="text-sm text-destructive">{errorMessage(productsError)}</p>}
                {requiresSupplier && suppliersError && <p role="alert" className="text-sm text-destructive">{errorMessage(suppliersError)}</p>}
                {!productsError && !products?.length && <p className="text-sm text-muted-foreground">Registra primero un producto para iniciar los movimientos.</p>}
                {requiresSupplier && !suppliersError && !suppliers?.length && <p className="text-sm text-muted-foreground">Registra primero un proveedor para crear compras o pedidos.</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    Tipo de movimiento
                    <Select value={type} onValueChange={handleTypeChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((value) => <SelectItem key={value} value={value}>{DOCUMENT_LABELS[value]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  {requiresSupplier && <label className="space-y-2 text-sm font-medium">
                    Proveedor
                    <Select value={supplierId} onValueChange={setSupplierId} required>
                      <SelectTrigger><SelectValue placeholder="Selecciona un proveedor" /></SelectTrigger>
                      <SelectContent>{suppliers?.map((supplier) =>
                        <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>}
                  <label className="space-y-2 text-sm font-medium">
                    Referencia (factura / pedido)
                    <Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={150} />
                  </label>
                  {type === "purchase" && <>
                    <label className="space-y-2 text-sm font-medium">
                      Forma de pago
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger><SelectValue placeholder="Selecciona una forma de pago" /></SelectTrigger>
                        <SelectContent>{availablePaymentMethods.map((method) =>
                          <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                      Condición de pago
                      <Select value={paymentType} onValueChange={(value) => {
                        const nextType = value as "contado" | "credito";
                        setPaymentType(nextType);
                        if (nextType === "credito") setAmountPaid("0");
                      }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contado">Contado</SelectItem>
                          <SelectItem value="credito">Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Total de la compra</p>
                      <p>{formatCurrency(purchaseTotal, currencySymbol)}</p>
                    </div>
                    <label className="space-y-2 text-sm font-medium">
                      Monto pagado
                      <Input
                        type="number"
                        min="0"
                        max={purchaseTotal}
                        step="0.01"
                        value={paymentType === "contado" ? purchaseTotal : amountPaid}
                        onChange={(event) => setAmountPaid(event.target.value)}
                        readOnly={paymentType === "contado"}
                        required
                      />
                    </label>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Saldo pendiente</p>
                      <p>{formatCurrency(pendingBalance, currencySymbol)}</p>
                    </div>
                    <label className="space-y-2 text-sm font-medium md:col-span-2">
                      Factura o documento del proveedor (PDF o imagen, máximo 5 MB)
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          void handleInvoiceChange(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                      {isReadingInvoice && <span className="text-xs text-muted-foreground">Cargando archivo...</span>}
                      {invoice && <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-4 w-4" /> {invoice.fileName}
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Quitar factura adjunta" onClick={() => setInvoice(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </span>}
                    </label>
                  </>}
                  <label className="space-y-2 text-sm font-medium">
                    Observaciones
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Productos y cantidades</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, { ...EMPTY_ITEM }])}>
                      <Plus className="mr-1 h-4 w-4" /> Agregar producto
                    </Button>
                  </div>
                  {items.map((item, index) => {
                    const selectedProduct = products?.find((product) => product.id === Number(item.productId));
                    return <div key={index} className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-12">
                      <label className="space-y-2 text-sm font-medium md:col-span-5">
                        Producto / variante
                        <Select value={item.productId} onValueChange={(value) => handleProductChange(index, value)}>
                          <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                          <SelectContent>{products?.map((product) => (
                            <SelectItem key={product.id} value={String(product.id)}>
                              {product.name}{product.size ? ` · Talla ${product.size}` : ""}{product.color ? ` · ${product.color}` : ""} (stock: {product.stock})
                            </SelectItem>
                          ))}</SelectContent>
                        </Select>
                      </label>
                      {type === "count" ? <label className="space-y-2 text-sm font-medium md:col-span-3">
                        Unidades contadas
                        <Input type="number" min="0" step="1" value={item.countedStock} onChange={(event) => updateItem(index, { countedStock: event.target.value })} required />
                      </label> : <label className="space-y-2 text-sm font-medium md:col-span-2">
                        Cantidad
                        <Input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} required />
                      </label>}
                      {(type === "purchase" || type === "supplier_order") && <label className="space-y-2 text-sm font-medium md:col-span-2">
                        Costo unitario
                        <Input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateItem(index, { unitCost: event.target.value })} required />
                      </label>}
                      <div className="text-xs text-muted-foreground md:col-span-2">
                        {selectedProduct ? `Stock actual: ${selectedProduct.stock}` : "Selecciona variante"}
                        {index > 0 && <Button type="button" variant="ghost" size="icon" className="ml-2 text-destructive" aria-label="Quitar producto" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>}
                      </div>
                    </div>;
                  })}
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={createMutation.isPending || isReadingInvoice || !products?.length}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    {createMutation.isPending ? "Guardando..." : type === "supplier_order" ? "Preparar pedido" : "Guardar movimiento"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>}
      </Tabs>
    </div>
  );
}
