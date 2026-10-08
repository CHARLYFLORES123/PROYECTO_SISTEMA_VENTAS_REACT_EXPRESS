import { useRoute } from "wouter";
import { useGetSaleById, useGetBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, FileText, Receipt, Star } from "lucide-react";
import { Link } from "wouter";
import { downloadBoleta, printBoleta } from "@/lib/generate-boleta";
import { downloadTicket, printTicket } from "@/lib/generate-ticket";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { useState } from "react";

export default function SaleDetail() {
  const [match, params] = useRoute("/sales/:id");
  const id = match ? parseInt((params as any).id) : 0;
  const { data: sale, isLoading, isError, error } = useGetSaleById(id, { query: { enabled: !!id } as any });
  const { data: settings } = useGetBusinessSettings();
  const { currencySymbol } = useCurrency();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [dlTicket, setDlTicket] = useState(false);
  const [printingTicket, setPrintingTicket] = useState(false);

  const withLoading = (setter: (v: boolean) => void, fn: () => void) => {
    if (!sale || !settings) return;
    setter(true);
    fn();
    setTimeout(() => setter(false), 1200);
  };

  const handleDownload = () => withLoading(setDownloading, () => downloadBoleta(sale!, settings!));
  const handlePrint = () => withLoading(setPrinting, () => printBoleta(sale!, settings!));
  const handleDlTicket = () => withLoading(setDlTicket, () => downloadTicket(sale!, settings!));
  const handlePrintTicket = () => withLoading(setPrintingTicket, () => printTicket(sale!, settings!));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
        Cargando detalle...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-medium">No se pudo cargar el detalle de la venta</p>
        <p className="text-sm mt-1">{(error as Error)?.message || "Verifica que el servidor esté disponible."}</p>
        <Link href="/sales">
          <Button variant="outline" size="sm" className="mt-4 rounded-full">Volver al historial</Button>
        </Link>
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
  const isCashSale = (sale.paymentMethod || "").toLowerCase().includes("efectivo") || (sale as any).amountPaid != null;
  const cashReceived = (sale as any).amountPaid !== null && (sale as any).amountPaid !== undefined
    ? Number((sale as any).amountPaid)
    : (isCashSale ? Number(sale.total) : null);
  const changeDue = (sale as any).changeDue !== null && (sale as any).changeDue !== undefined
    ? Number((sale as any).changeDue)
    : 0;

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

        <div className="flex flex-wrap gap-2">
          {/* Ticket térmico 80mm */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={handleDlTicket}
            disabled={dlTicket || !settings}
          >
            {dlTicket ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-600 rounded-full animate-spin" />
            ) : (
              <Receipt className="h-3.5 w-3.5" />
            )}
            Ticket 80mm
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
            onClick={handlePrintTicket}
            disabled={printingTicket || !settings}
          >
            {printingTicket ? (
              <div className="w-3.5 h-3.5 border-2 border-amber-400/40 border-t-amber-600 rounded-full animate-spin" />
            ) : (
              <Printer className="h-3.5 w-3.5" />
            )}
            Imprimir Ticket
          </Button>
          {/* Boleta A4 */}
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
            Imprimir Boleta
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
            {(sale as any).customerNitCi && (
              <p className="text-xs text-muted-foreground mt-0.5">CI/NIT: <span className="font-mono font-medium text-foreground">{(sale as any).customerNitCi}</span></p>
            )}
            {(sale as any).customerPhone && (
              <p className="text-xs text-muted-foreground mt-0.5">Tel: {(sale as any).customerPhone}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Método de Pago</p>
            <p className="font-semibold text-sm">{sale.paymentMethod}</p>
            {isCashSale && cashReceived !== null && (
              <div className="mt-2.5 pt-2 border-t border-border/60 space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Efectivo Recibido:</span>
                  <span className="font-semibold font-mono text-foreground">{formatCurrency(cashReceived, currencySymbol)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="font-medium">Monto a Devolver (Cambio):</span>
                  <span className="font-bold font-mono text-emerald-700">{formatCurrency(changeDue, currencySymbol)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Vendedor</p>
            <p className="font-semibold text-sm">{(sale as any).userName || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Puntos Ganados Banner */}
      {(sale as any).pointsEarned && (sale as any).pointsEarned > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-3.5 flex items-center gap-3 shadow-2xs">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0 font-bold">
            <Star className="w-5 h-5 fill-amber-400 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-amber-900">
              ¡Puntos Ganados en esta venta: +{(sale as any).pointsEarned.toLocaleString("es")} pts!
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              El cliente puede canjear estos puntos por descuentos en su próxima compra.
            </p>
          </div>
        </div>
      ) : null}

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
                {(sale.details ?? []).map((detail, i) => (
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
            <div className="w-72 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(sale.subtotal, currencySymbol)}</span>
              </div>
              <div className="flex justify-between items-center pt-2.5 border-t">
                <span className="font-bold">TOTAL</span>
                <span className="font-bold text-2xl text-primary">{formatCurrency(sale.total, currencySymbol)}</span>
              </div>
              {isCashSale && cashReceived !== null && (
                <div className="pt-2.5 border-t border-dashed space-y-1.5 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-800 font-medium">Efectivo Recibido:</span>
                    <span className="font-semibold text-emerald-950 font-mono text-sm">{formatCurrency(cashReceived, currencySymbol)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-emerald-200/60 pt-1.5">
                    <span className="text-emerald-800 font-bold uppercase tracking-wider text-[11px]">Monto a Devolver (Cambio):</span>
                    <span className="font-extrabold text-base text-emerald-700 font-mono">
                      {formatCurrency(changeDue, currencySymbol)}
                    </span>
                  </div>
                </div>
              )}
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
