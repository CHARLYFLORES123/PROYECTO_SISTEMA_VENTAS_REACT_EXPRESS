import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trophy, Users, TrendingUp, Search, ChevronRight, Gift, Award, History } from "lucide-react";
import { Toast, Swal } from "@/lib/swal";
import { formatCurrency, useCurrency } from "@/contexts/currency-context";
import { getToken } from "@/lib/auth";
import { useGetBusinessSettings } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).message ?? "Error en la solicitud");
  }
  return res.json();
}

interface LoyaltyMember {
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerNitCi: string | null;
  points: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  discountValue: number;
}

interface PointsTransaction {
  id: number;
  delta: number;
  type: string;
  saleId: number | null;
  notes: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earned: { label: "Ganados", color: "text-green-700 bg-green-50 border-green-200" },
  redeemed: { label: "Canjeados", color: "text-orange-700 bg-orange-50 border-orange-200" },
  adjusted: { label: "Ajuste", color: "text-blue-700 bg-blue-50 border-blue-200" },
};

function HistoryPanel({ customerId, onClose }: { customerId: number; onClose: () => void }) {
  const { data: history, isLoading } = useQuery<PointsTransaction[]>({
    queryKey: ["/api/loyalty/history", customerId],
    queryFn: () => apiFetch(`/api/loyalty/history/${customerId}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Historial de Puntos</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-2">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>}
          {!isLoading && (!history || history.length === 0) && (
            <p className="text-center text-sm text-muted-foreground py-8">Sin transacciones aún</p>
          )}
          {history?.map(tx => {
            const meta = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-700 bg-gray-50 border-gray-200" };
            return (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
                <div className={`text-xs font-semibold px-2 py-1 rounded-full border ${meta.color} shrink-0`}>{meta.label}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{tx.notes ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground/60">{new Date(tx.createdAt).toLocaleString("es")}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx.delta > 0 ? "text-green-700" : "text-orange-600"}`}>
                  {tx.delta > 0 ? "+" : ""}{tx.delta} pts
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Loyalty() {
  const [search, setSearch] = useState("");
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const { currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: settings } = useGetBusinessSettings();

  const { data: members, isLoading } = useQuery<LoyaltyMember[]>({
    queryKey: ["/api/loyalty/leaderboard"],
    queryFn: () => apiFetch("/api/loyalty/leaderboard"),
  });

  const adjustMutation = useMutation({
    mutationFn: (body: { customerId: number; delta: number; notes: string }) =>
      apiFetch("/api/loyalty/adjust", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/loyalty/leaderboard"] }),
  });

  const filtered = (members ?? []).filter(m =>
    m.customerName.toLowerCase().includes(search.toLowerCase()) ||
    (m.customerEmail ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalPoints = (members ?? []).reduce((s, m) => s + m.points, 0);
  const totalMembers = members?.length ?? 0;
  const totalLifetime = (members ?? []).reduce((s, m) => s + m.lifetimeEarned, 0);

  const handleAdjust = async (member: LoyaltyMember) => {
    const { value, isConfirmed } = await Swal.fire({
      title: `Ajustar puntos de ${member.customerName}`,
      html: `<p class="text-sm text-gray-600 mb-3">Puntos actuales: <b>${member.points}</b></p>
             <input id="swal-delta" type="number" class="swal2-input" placeholder="Ej: 50 o -20" />
             <textarea id="swal-notes" class="swal2-textarea" placeholder="Motivo (opcional)" rows="2" style="font-size:13px"></textarea>`,
      confirmButtonText: "Aplicar",
      confirmButtonColor: "#4F46E5",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        const delta = parseInt((document.getElementById("swal-delta") as HTMLInputElement).value);
        const notes = (document.getElementById("swal-notes") as HTMLTextAreaElement).value;
        if (isNaN(delta) || delta === 0) { Swal.showValidationMessage("Ingresa un valor distinto de 0"); return false; }
        return { delta, notes };
      },
    });
    if (!isConfirmed || !value) return;
    try {
      await adjustMutation.mutateAsync({ customerId: member.customerId, delta: value.delta, notes: value.notes || `Ajuste manual: ${value.delta > 0 ? "+" : ""}${value.delta}` });
      Toast.fire({ icon: "success", title: `Puntos ajustados: ${value.delta > 0 ? "+" : ""}${value.delta}` });
    } catch (err: any) {
      Toast.fire({ icon: "error", title: err.message });
    }
  };

  if (!settings?.loyaltyEnabled) {
    return (
      <div className="max-w-2xl mx-auto mt-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Star className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Sistema de Puntos no habilitado</h2>
        <p className="text-muted-foreground text-sm">Activa el programa de fidelización en Configuración para comenzar a recompensar a tus clientes.</p>
        <Button onClick={() => setLocation("/settings")} className="gap-2">
          <ChevronRight className="w-4 h-4" /> Ir a Configuración
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Programa de Fidelización</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {settings.pointsPerUnit} punto{settings.pointsPerUnit !== 1 ? "s" : ""} por cada {currencySymbol}1 · 100 pts = {formatCurrency(100 * Number(settings.pointsRedemptionRate), currencySymbol)} de descuento
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Miembros activos</p>
              <p className="text-2xl font-bold">{totalMembers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Puntos en circulación</p>
              <p className="text-2xl font-bold">{totalPoints.toLocaleString("es")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Puntos otorgados (total)</p>
              <p className="text-2xl font-bold">{totalLifetime.toLocaleString("es")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Ranking de Clientes</CardTitle>
              <CardDescription className="text-xs mt-0.5">Clientes con mayor acumulación de puntos</CardDescription>
            </div>
            <div className="sm:ml-auto relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-8 h-8 text-sm rounded-lg"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-12">Cargando...</p>}
          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Award className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Sin miembros aún</p>
              <p className="text-xs mt-1">Los puntos se acumularán automáticamente en las ventas</p>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cliente</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Puntos</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Valor descuento</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ganados</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Canjeados</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map((m, idx) => (
                    <tr key={m.customerId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground font-medium">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : <span className="text-xs">{idx + 1}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                            {m.customerName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{m.customerName}</p>
                            {m.customerEmail && <p className="text-[11px] text-muted-foreground">{m.customerEmail}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="font-bold text-primary border-primary/30 bg-primary/5 text-sm px-2.5">
                          <Star className="w-3 h-3 mr-1 text-amber-500" />
                          {m.points.toLocaleString("es")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(m.discountValue, currencySymbol)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{m.lifetimeEarned.toLocaleString("es")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{m.lifetimeRedeemed.toLocaleString("es")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
                            onClick={() => setHistoryFor(m.customerId)}
                          >
                            <History className="w-3.5 h-3.5 mr-1" /> Ver historial
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs hover:bg-muted"
                            onClick={() => handleAdjust(m)}
                          >
                            <Gift className="w-3.5 h-3.5 mr-1" /> Ajustar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {historyFor !== null && (
        <HistoryPanel customerId={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}
