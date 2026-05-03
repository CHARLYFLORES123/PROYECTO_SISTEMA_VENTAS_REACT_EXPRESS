import { useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Printer, Ticket, ChevronRight } from "lucide-react";
import { Toast, Swal } from "@/lib/swal";
import { getToken } from "@/lib/auth";
import { formatCurrency, useCurrency } from "@/contexts/currency-context";
import { downloadLoyaltySummary, printLoyaltySummary, type LoyaltySummaryData } from "@/lib/generate-loyalty-summary";
import { TIERS, TierBadge } from "@/pages/loyalty";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error("Error al cargar datos");
  return res.json();
}

interface CustomerCoupon {
  id: number;
  code: string;
  tier: string;
  discountPercent: number;
  status: string;
  expiresAt: string;
}

export default function LoyaltySummary() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const [, navigate] = useLocation();
  const { currencySymbol } = useCurrency();
  const { data: settings } = useGetBusinessSettings();

  const { data: balance } = useQuery({
    queryKey: ["/api/loyalty/balance", customerId],
    queryFn: () => apiFetch(`/api/loyalty/balance/${customerId}`),
  });

  const { data: coupons } = useQuery<CustomerCoupon[]>({
    queryKey: ["/api/coupons/customer", customerId],
    queryFn: () => apiFetch(`/api/coupons/customer/${customerId}`),
  });

  const summary = useMemo<LoyaltySummaryData | null>(() => {
    if (!balance || !settings) return null;
    return {
      customerId,
      customerName: (balance as any).customerName ?? `Cliente #${String(customerId).padStart(6, "0")}`,
      customerEmail: (balance as any).customerEmail ?? null,
      customerPhone: (balance as any).customerPhone ?? null,
      tier: balance.tier,
      tierLabel: balance.tierLabel,
      tierMultiplier: balance.tierMultiplier,
      tierColor: balance.tierColor,
      points: balance.points,
      lifetimeEarned: balance.lifetimeEarned,
      lifetimeRedeemed: balance.lifetimeRedeemed,
      discountValue: balance.discountValue,
      progressToNext: balance.progressToNext,
      pointsToNext: balance.pointsToNext,
      nextTier: balance.nextTier,
      coupons: (coupons ?? []).map((c) => ({ code: c.code, tier: c.tier, discountPercent: c.discountPercent, status: c.status, expiresAt: c.expiresAt })),
      companyName: settings.companyName,
      currencySymbol,
      generatedAt: new Date().toISOString(),
    };
  }, [balance, settings, coupons, customerId, currencySymbol]);

  if (!summary) return <div className="p-8 text-center text-muted-foreground">Cargando resumen...</div>;

  const activeCoupons = summary.coupons.filter((c) => c.status === "active");
  const handlePrint = async () => {
    try {
      await printLoyaltySummary(summary);
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err.message ?? "No se pudo imprimir" });
    }
  };
  const handleDownload = async () => {
    try {
      await downloadLoyaltySummary(summary);
      Toast.fire({ icon: "success", title: "PDF descargado" });
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err.message ?? "No se pudo descargar" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Button variant="ghost" className="pl-0 mb-2" onClick={() => navigate("/loyalty")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver a fidelización
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="w-6 h-6 text-violet-600" /> Resumen de Fidelización
          </h1>
          <p className="text-sm text-muted-foreground">Tarjeta imprimible/PDF para entregar con el recibo de compra.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary to-violet-600 text-white">
          <CardTitle className="flex items-center justify-between">
            <span>{summary.customerName}</span>
            <TierBadge tier={summary.tier} size="md" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4">
              <p className="text-[11px] text-violet-600 font-semibold">Puntos</p>
              <p className="text-2xl font-bold">{summary.points.toLocaleString("es")}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-[11px] text-amber-600 font-semibold">Disponible</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.discountValue, currencySymbol)}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-[11px] text-emerald-600 font-semibold">Acumulados</p>
              <p className="text-2xl font-bold">{summary.lifetimeEarned.toLocaleString("es")}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-[11px] text-slate-600 font-semibold">Multiplicador</p>
              <p className="text-2xl font-bold">x{summary.tierMultiplier}</p>
            </div>
          </div>

          <div className={`rounded-2xl border p-4 ${TIERS[summary.tier as keyof typeof TIERS]?.bg ?? "bg-white"}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">Progreso al siguiente nivel</p>
              <span className="text-sm text-muted-foreground">{summary.nextTier ? `${summary.pointsToNext.toLocaleString("es")} pts para ${summary.nextTier.label}` : "Nivel máximo"}</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${summary.progressToNext}%` }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Cupones disponibles</h3>
              <span className="text-sm text-muted-foreground">{activeCoupons.length} activos</span>
            </div>
            {activeCoupons.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">Aún no tiene cupones activos.</div>
            ) : (
              <div className="space-y-3">
                {activeCoupons.map((coupon) => (
                  <div key={coupon.code} className="rounded-2xl border bg-white p-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-lg tracking-widest">{coupon.code}</p>
                      <p className="text-sm text-muted-foreground">{coupon.discountPercent}% de descuento · vence {new Date(coupon.expiresAt).toLocaleDateString("es")}</p>
                    </div>
                    <Badge variant="outline" className="font-semibold">{coupon.tier.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center justify-between">
            <span>Ideal para entregar junto con la compra.</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
