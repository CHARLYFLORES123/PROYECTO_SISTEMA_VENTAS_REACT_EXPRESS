import { useRoute } from "wouter";
import { useGetSaleById, useGetBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, FileText } from "lucide-react";
import { Link } from "wouter";
import { downloadBoleta, printBoleta } from "@/lib/generate-boleta";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { useState } from "react";

export default function SaleDetail() {
  const [match, params] = useRoute("/sales/:id");
  const id = match ? parseInt((params as any).id) : 0;
  const { data: sale, isLoading } = useGetSaleById(id, { query: { enabled: !!id } as any });
  const { data: settings } = useGetBusinessSettings();
  const { currencySymbol } = useCurrency();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const handleDownload = () => {
    if (!sale || !settings) return;
    setDownloading(true);
    downloadBoleta(sale, settings);
    setTimeout(() => setDownloading(false), 1200);
  };

  const handlePrint = () => {
    if (!sale || !settings) return;
    setPrinting(true);
    printBoleta(sale, settings);
    setTimeout(() => setPrinting(false), 1200);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
        Cargando detalle...
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="w-10 h-10 mb-3 opacity-20" />
        <p>Venta no encontrada</p>
        <Link href="/sales">
          <Button variant="outline" size="sm" className="mt-4 rounded-full">← Volver al historial</Button>
        </Link>
      </div>
    );
  }

  const isCompleted = sale.status === "completada";

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/sales">
            <Button variant="outline" size="icon" className="rounded-xl h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-xl font-bold">
              Boleta <span className="font-mono text-primary">#{String(sale.id).padStart(6, "0")}</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(sale.createdAt).toLocaleString("es-BO", {
                day: "2-digit", month: "long", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${isCompleted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
            {isCompleted ? "COMPLETADO" : "ANULADO"}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5"
            onClick={handlePrint}
            disabled={printing || !settings}
          >
            {printing ? (
              <div className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            Imprimir
          </Button>
          <Button
            size="sm"
            className="rounded-full gap-1.5"
            onClick={handleDownload}
            disabled={downloading || !settings}
          >
            {downloading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Cliente</p>
            <p className="font-semibold text-sm">{sale.customerName || "Consumidor Final"}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Método de Pago</p>
            <p className="font-semibold text-sm">{sale.paymentMethod}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Vendedor</p>
            <p className="font-semibold text-sm">{(sale as any).userName || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Products table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold">Detalle de Productos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold text-xs uppercase tracking-wide">N°</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide">Producto</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-right">Precio Unit.</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-right">Cantidad</TableHead>
                  <TableHead className="font-semibold text-xs uppercase tracking-wide text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.details.map((detail, i) => (
                  <TableRow key={detail.id} className="hover:bg-muted/20">
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-medium text-sm">{detail.productName}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(detail.unitPrice, currencySymbol)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{detail.quantity}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCurrency(detail.subtotal, currencySymbol)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="p-5 border-t bg-muted/10 flex justify-end">
            <div className="w-64 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(sale.subtotal, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (13%)</span>
                <span className="font-medium">{formatCurrency(sale.iva, currencySymbol)}</span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold text-2xl text-primary">{formatCurrency(sale.total, currencySymbol)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {sale.notes && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Nota Adicional</p>
            <p className="text-sm text-foreground">{sale.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
