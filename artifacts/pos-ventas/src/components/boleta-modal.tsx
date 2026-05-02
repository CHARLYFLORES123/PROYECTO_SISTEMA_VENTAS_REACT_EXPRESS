import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, Printer, X, ShoppingCart, Receipt } from "lucide-react";
import { downloadBoleta, printBoleta } from "@/lib/generate-boleta";
import { downloadTicket, printTicket } from "@/lib/generate-ticket";
import { useGetBusinessSettings } from "@workspace/api-client-react";
import { formatCurrency, useCurrency } from "@/contexts/currency-context";

interface SaleDetail {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface CompletedSale {
  id: number;
  customerName?: string | null;
  userName?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  details: SaleDetail[];
}

interface BoletaModalProps {
  sale: CompletedSale | null;
  onClose: () => void;
}

function SpinIcon() {
  return <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />;
}

export function BoletaModal({ sale, onClose }: BoletaModalProps) {
  const { data: settings } = useGetBusinessSettings();
  const { currencySymbol } = useCurrency();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [dlTicket, setDlTicket] = useState(false);
  const [printTicketLoading, setPrintTicketLoading] = useState(false);

  if (!sale || !settings) return null;

  const withLoading = (setter: (v: boolean) => void, fn: () => void) => {
    setter(true);
    fn();
    setTimeout(() => setter(false), 1200);
  };

  return (
    <Dialog open={!!sale} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        {/* Success header */}
        <div className="bg-primary px-6 pt-7 pb-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold">¡Venta Registrada!</h2>
          <p className="text-white/80 text-sm mt-1">
            Boleta <span className="font-mono font-semibold">#{String(sale.id).padStart(6, "0")}</span>
          </p>
        </div>

        {/* Sale summary */}
        <div className="px-6 py-4 bg-white space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{sale.customerName || "Consumidor Final"}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Método de Pago</span>
              <span className="font-medium">{sale.paymentMethod}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(sale.subtotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">IVA (13%)</span>
              <span>{formatCurrency(sale.iva, currencySymbol)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
              <span className="font-bold text-sm">TOTAL</span>
              <span className="font-bold text-xl text-primary">{formatCurrency(sale.total, currencySymbol)}</span>
            </div>
          </div>

          {/* Products mini-list */}
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {sale.details.map((d) => (
              <div key={d.id} className="flex justify-between text-xs px-1">
                <span className="text-muted-foreground truncate flex-1 mr-2">
                  {d.quantity}× {d.productName}
                </span>
                <span className="font-medium shrink-0">{formatCurrency(d.subtotal, currencySymbol)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 bg-white space-y-2">
          {/* Row 1 — Boleta A4 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-1.5 h-9 text-sm"
              onClick={() => withLoading(setDownloading, () => downloadBoleta(sale, settings))}
              disabled={downloading}
            >
              {downloading ? <SpinIcon /> : <Download className="w-3.5 h-3.5" />}
              Boleta PDF
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-1.5 h-9 text-sm"
              onClick={() => withLoading(setPrinting, () => printBoleta(sale, settings))}
              disabled={printing}
            >
              {printing ? <SpinIcon /> : <Printer className="w-3.5 h-3.5" />}
              Imprimir
            </Button>
          </div>

          {/* Row 2 — Ticket térmico */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-1.5 h-9 text-sm border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => withLoading(setDlTicket, () => downloadTicket(sale, settings))}
              disabled={dlTicket}
            >
              {dlTicket ? <SpinIcon /> : <Receipt className="w-3.5 h-3.5" />}
              Ticket 80mm
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-full gap-1.5 h-9 text-sm border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => withLoading(setPrintTicketLoading, () => printTicket(sale, settings))}
              disabled={printTicketLoading}
            >
              {printTicketLoading ? <SpinIcon /> : <Printer className="w-3.5 h-3.5" />}
              Imprimir Ticket
            </Button>
          </div>

          {/* Row 3 — Nueva venta */}
          <Button
            className="w-full rounded-full h-11 gap-2 font-semibold"
            onClick={onClose}
          >
            <ShoppingCart className="w-4 h-4" />
            Nueva Venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
