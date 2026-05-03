import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Trophy, Users, TrendingUp, Search, ChevronRight, Gift, Award, History, Zap, Ticket, Clock, CheckCircle, XCircle, Printer, Download } from "lucide-react";
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

export const TIERS = {
  bronze: { label: "Bronce", min: 0, max: 999, multiplier: 1.0, emoji: "🥉", bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", bar: "bg-amber-400" },
  silver: { label: "Plata", min: 1000, max: 4999, multiplier: 1.5, emoji: "🥈", bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-600", bar: "bg-slate-400" },
  gold: { label: "Oro", min: 5000, max: null, multiplier: 2.0, emoji: "🥇", bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700", bar: "bg-yellow-400" },
} as const;

export type TierName = keyof typeof TIERS;

export function TierBadge({ tier, size = "sm" }: { tier: string; size?: "xs" | "sm" | "md" }) {
  const t = TIERS[tier as TierName] ?? TIERS.bronze;
  const px = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[10px]";
  return <span className={`inline-flex items-center gap-0.5 rounded-full border font-bold ${t.bg} ${t.border} ${t.text} ${px}`}>{t.emoji} {t.label}</span>;
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
  tier: TierName;
  tierLabel: string;
  tierMultiplier: number;
  nextTier: { name: string; label: string; min: number } | null;
  progressToNext: number;
  pointsToNext: number;
}

interface PointsTransaction {
  id: number;
  delta: number;
  type: string;
  saleId: number | null;
  notes: string | null;
  createdAt: string;
}

interface CustomerCoupon {
  id: number;
  code: string;
  tier: string;
  discountPercent: number;
  status: string;
  expiresAt: string;
  usedAt: string | null;
  notes: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earned: { label: "Ganados", color: "text-green-700 bg-green-50 border-green-200" },
  redeemed: { label: "Canjeados", color: "text-orange-700 bg-orange-50 border-orange-200" },
  adjusted: { label: "Ajuste", color: "text-blue-700 bg-blue-50 border-blue-200" },
  tier_up: { label: "¡Nivel!", color: "text-yellow-700 bg-yellow-50 border-yellow-300" },
  coupon: { label: "Cupón", color: "text-violet-700 bg-violet-50 border-violet-200" },
};

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  active: { label: "Activo", icon: <CheckCircle className="w-3 h-3" />, cls: "text-green-700 bg-green-50 border-green-200" },
  used: { label: "Usado", icon: <XCircle className="w-3 h-3" />, cls: "text-slate-500 bg-slate-50 border-slate-200" },
  expired: { label: "Vencido", icon: <Clock className="w-3 h-3" />, cls: "text-red-600 bg-red-50 border-red-200" },
};

function CouponsModal({ customerId, customerName, onClose }: { customerId: number; customerName: string; onClose: () => void }) {
  const { data: coupons, isLoading } = useQuery<CustomerCoupon[]>({
    queryKey: ["/api/coupons/customer", customerId],
    queryFn: () => apiFetch(`/api/coupons/customer/${customerId}`),
  });
  const active = coupons?.filter(c => c.status === "active") ?? [];
  const used = coupons?.filter(c => c.status !== "active") ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-base flex items-center gap-2"><Ticket className="w-4 h-4 text-violet-600" /> Cupones — {customerName}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>}
          {!isLoading && (!coupons || coupons.length === 0) && <div className="text-center py-10 space-y-2"><Ticket className="w-10 h-10 mx-auto text-muted-foreground/30" /><p className="text-sm text-muted-foreground">Sin cupones generados aún</p></div>}
          {active.length > 0 && <div className="space-y-2">{active.map(c => { const t = TIERS[c.tier as TierName] ?? TIERS.bronze; return <div key={c.id} className={`rounded-xl border-2 p-3.5 space-y-2 ${t.border} ${t.bg}`}><div className="flex items-start justify-between gap-2"><div><p className="font-mono font-bold text-base tracking-widest text-slate-800">{c.code}</p><p className={`text-xs font-semibold mt-0.5 ${t.text}`}>{t.emoji} Nivel {t.label} · {c.discountPercent}% de descuento</p></div><span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_META.active.cls}`}>{STATUS_META.active.icon} Activo</span></div><div className="flex items-center justify-between text-[10px] text-muted-foreground"><span>Válido hasta: {new Date(c.expiresAt).toLocaleDateString("es")}</span><span>Generado: {new Date(c.createdAt).toLocaleDateString("es")}</span></div></div>; })}</div>}
          {used.length > 0 && <div className="space-y-2"><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Historial</p>{used.map(c => { const meta = STATUS_META[c.status] ?? STATUS_META.expired; return <div key={c.id} className="rounded-xl border border-border/50 bg-muted/20 p-3 flex items-center gap-3 opacity-70"><div className="flex-1 min-w-0"><p className="font-mono text-xs font-bold tracking-widest text-slate-600">{c.code}</p><p className="text-[10px] text-muted-foreground">{c.discountPercent}% · {c.status === "used" && c.usedAt ? `Usado: ${new Date(c.usedAt).toLocaleDateString("es")}` : `Vencido: ${new Date(c.expiresAt).toLocaleDateString("es")}`}</p></div><span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.icon} {meta.label}</span></div>; })}</div>}
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ customerId, customerName, onClose }: { customerId: number; customerName: string; onClose: () => void }) {
  const { data: history, isLoading } = useQuery<PointsTransaction[]>({ queryKey: ["/api/loyalty/history", customerId], queryFn: () => apiFetch(`/api/loyalty/history/${customerId}`) });
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"><div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"><div className="flex items-center justify-between px-5 py-4 border-b"><h3 className="font-bold text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Historial — {customerName}</h3><button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm font-bold">✕</button></div><div className="overflow-y-auto p-4 space-y-2">{isLoading && <p className="text-center text-sm text-muted-foreground py-8">Cargando...</p>}{!isLoading && (!history || history.length === 0) && <p className="text-center text-sm text-muted-foreground py-8">Sin transacciones aún</p>}{history?.map(tx => { const meta = TYPE_LABELS[tx.type] ?? { label: tx.type, color: "text-gray-700 bg-gray-50 border-gray-200" }; const isTierUp = tx.type === "tier_up" || tx.type === "coupon"; return <div key={tx.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isTierUp ? "border-violet-200 bg-violet-50" : "border-border/50 bg-muted/20"}`}><div className={`text-xs font-semibold px-2 py-1 rounded-full border ${meta.color} shrink-0`}>{meta.label}</div><div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground truncate">{tx.notes ?? "—"}</p><p className="text-[10px] text-muted-foreground/60">{new Date(tx.createdAt).toLocaleString("es")}</p></div><span className={`text-sm font-bold shrink-0 ${tx.delta > 0 ? "text-green-700" : "text-orange-600"}`}>{tx.delta > 0 ? "+" : ""}{tx.delta} pts</span></div>; })}</div></div></div>;
}

function TierProgressBar({ member }: { member: LoyaltyMember }) {
  const tier = TIERS[member.tier] ?? TIERS.bronze;
  return <div className={`rounded-xl border p-3 space-y-1.5 ${tier.bg} ${tier.border}`}><div className="flex items-center justify-between"><span className={`text-xs font-bold ${tier.text}`}>{tier.emoji} {tier.label}</span>{member.nextTier ? <span className="text-[10px] text-muted-foreground">{member.pointsToNext.toLocaleString("es")} pts para {member.nextTier.label}</span> : <span className={`text-[10px] font-semibold ${tier.text}`}>Nivel máximo ✨</span>}</div>{member.nextTier && <div className="h-1.5 rounded-full bg-black/10 overflow-hidden"><div className={`h-full rounded-full ${tier.bar}`} style={{ width: `${member.progressToNext}%` }} /></div>}<p className={`text-[10px] ${tier.text} font-medium`}>Multiplicador ×{tier.multiplier} — {member.lifetimeEarned.toLocaleString("es")} pts acumulados</p></div>;
}

export default function Loyalty() {
  const [search, setSearch] = useState("");
  const [historyFor, setHistoryFor] = useState<{ id: number; name: string } | null>(null);
  const [couponsFor, setCouponsFor] = useState<{ id: number; name: string } | null>(null);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const { currencySymbol } = useCurrency();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: settings } = useGetBusinessSettings();
  const { data: members, isLoading } = useQuery<LoyaltyMember[]>({ queryKey: ["/api/loyalty/leaderboard"], queryFn: () => apiFetch("/api/loyalty/leaderboard") });
  const adjustMutation = useMutation({ mutationFn: (body: { customerId: number; delta: number; notes: string }) => apiFetch("/api/loyalty/adjust", { method: "POST", body: JSON.stringify(body) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/loyalty/leaderboard"] }) });
  const filtered = (members ?? []).filter(m => { const matchSearch = m.customerName.toLowerCase().includes(search.toLowerCase()) || (m.customerEmail ?? "").toLowerCase().includes(search.toLowerCase()); const matchTier = tierFilter === "all" || m.tier === tierFilter; return matchSearch && matchTier; });
  const totalPoints = (members ?? []).reduce((s, m) => s + m.points, 0);
  const goldCount = (members ?? []).filter(m => m.tier === "gold").length;
  const silverCount = (members ?? []).filter(m => m.tier === "silver").length;
  const activeMembers = (members ?? []).length;

  const handleAdjust = async (member: LoyaltyMember) => {
    const { value, isConfirmed } = await Swal.fire({ title: `Ajustar puntos — ${member.customerName}`, html: `<p class="text-sm text-gray-600 mb-3">Puntos actuales: <b>${member.points}</b> · Nivel: <b>${member.tierLabel}</b></p><input id="swal-delta" type="number" class="swal2-input" placeholder="Ej: 50 o -20" /><textarea id="swal-notes" class="swal2-textarea" placeholder="Motivo (opcional)" rows="2" style="font-size:13px"></textarea>`, confirmButtonText: "Aplicar", confirmButtonColor: "#4F46E5", showCancelButton: true, cancelButtonText: "Cancelar", preConfirm: () => { const delta = parseInt((document.getElementById("swal-delta") as HTMLInputElement).value); const notes = (document.getElementById("swal-notes") as HTMLTextAreaElement).value; if (isNaN(delta) || delta === 0) { Swal.showValidationMessage("Ingresa un valor distinto de 0"); return false; } return { delta, notes }; } });
    if (!isConfirmed || !value) return;
    try {
      const result = await adjustMutation.mutateAsync({ customerId: member.customerId, delta: value.delta, notes: value.notes || `Ajuste manual: ${value.delta > 0 ? "+" : ""}${value.delta}` });
      const msg = result.tier !== member.tier ? `¡Ascendió a nivel ${TIERS[result.tier as TierName]?.label ?? result.tier}!` : `Puntos ajustados: ${value.delta > 0 ? "+" : ""}${value.delta}`;
      Toast.fire({ icon: "success", title: msg });
    } catch (err: any) { Toast.fire({ icon: "error", title: err.message }); }
  };

  if (!settings?.loyaltyEnabled) {
    return <div className="max-w-2xl mx-auto mt-16 text-center space-y-4"><div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"><Star className="w-8 h-8 text-primary" /></div><h2 className="text-xl font-bold">Sistema de Puntos no habilitado</h2><p className="text-muted-foreground text-sm">Activa el programa en Configuración para comenzar.</p><Button onClick={() => setLocation("/settings")} className="gap-2"><ChevronRight className="w-4 h-4" /> Ir a Configuración</Button></div>;
  }

  return <div className="space-y-6"><div><h1 className="text-2xl font-bold flex items-center gap-2"><Star className="w-6 h-6 text-amber-500" /> Programa de Fidelización</h1><p className="text-muted-foreground text-sm mt-1">{settings.pointsPerUnit} pt{settings.pointsPerUnit !== 1 ? "s" : ""} por {currencySymbol}1 · 100 pts = {formatCurrency(100 * Number(settings.pointsRedemptionRate), currencySymbol)} · Niveles: 🥉×1 · 🥈×1.5 (1k pts) · 🥇×2 (5k pts)</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => setLocation(`/loyalty/${members?.[0]?.customerId ?? 0}/summary`)} disabled={!members?.length} className="gap-2"><Printer className="w-4 h-4" /> Resumen PDF</Button></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{(Object.entries(TIERS) as [TierName, typeof TIERS.bronze][]).map(([key, t]) => { const count = (members ?? []).filter(m => m.tier === key).length; return <button key={key} onClick={() => setTierFilter(tierFilter === key ? "all" : key)} className={`rounded-2xl border-2 p-4 text-left transition-all ${tierFilter === key ? `${t.border} ${t.bg} shadow-md` : "border-border bg-white hover:border-border/80 hover:shadow-sm"}`}><div className="flex items-center gap-2 mb-2"><span className="text-2xl">{t.emoji}</span><span className={`font-bold text-sm ${tierFilter === key ? t.text : ""}`}>{t.label}</span><span className="ml-auto text-xs font-semibold text-muted-foreground bg-muted rounded-full px-2 py-0.5">{count} cliente{count !== 1 ? "s" : ""}</span></div><p className="text-[11px] text-muted-foreground">{key === "bronze" ? "0 – 999 pts" : key === "silver" ? "1,000 – 4,999 pts" : "5,000+ pts"}</p><p className={`text-xs font-bold mt-1 ${t.text}`}>×{t.multiplier} multiplicador</p></button>; })}</div><div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-primary" /></div><div><p className="text-[11px] text-muted-foreground">Miembros</p><p className="text-xl font-bold">{activeMembers}</p></div></CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Star className="w-4 h-4 text-amber-600" /></div><div><p className="text-[11px] text-muted-foreground">En circulación</p><p className="text-xl font-bold">{totalPoints.toLocaleString("es")}</p></div></CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0"><span className="text-base">🥇</span></div><div><p className="text-[11px] text-muted-foreground">Nivel Oro</p><p className="text-xl font-bold">{goldCount}</p></div></CardContent></Card><Card className="border-0 shadow-sm"><CardContent className="p-4 flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><span className="text-base">🥈</span></div><div><p className="text-[11px] text-muted-foreground">Nivel Plata</p><p className="text-xl font-bold">{silverCount}</p></div></CardContent></Card></div><Card className="border-0 shadow-sm"><CardHeader className="pb-3"><div className="flex flex-col sm:flex-row sm:items-center gap-3"><div><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Ranking de Clientes{tierFilter !== "all" && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${TIERS[tierFilter as TierName].bg} ${TIERS[tierFilter as TierName].border} ${TIERS[tierFilter as TierName].text}`}>{TIERS[tierFilter as TierName].emoji} {TIERS[tierFilter as TierName].label}</span>}</CardTitle></div><div className="sm:ml-auto relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-8 h-8 text-sm rounded-lg" /></div></div></CardHeader><CardContent className="p-0">{isLoading && <p className="text-center text-sm text-muted-foreground py-12">Cargando...</p>}{!isLoading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground"><Award className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm font-medium">{tierFilter !== "all" ? `Sin clientes en nivel ${TIERS[tierFilter as TierName]?.label}` : "Sin miembros aún"}</p></div>}{filtered.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border/50 bg-muted/30"><th className="text-left px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-10">#</th><th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Cliente / Nivel</th><th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Puntos</th><th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Desc. disponible</th><th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Progreso</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-border/30">{filtered.map((m, idx) => { const t = TIERS[m.tier] ?? TIERS.bronze; return <tr key={m.customerId} className="hover:bg-muted/20 transition-colors"><td className="px-5 py-3 text-muted-foreground font-medium text-center">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : <span className="text-xs">{idx + 1}</span>}</td><td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${t.border} ${t.bg} ${t.text}`}>{m.customerName.charAt(0).toUpperCase()}</div><div><p className="font-semibold text-sm">{m.customerName}</p><div className="flex items-center gap-1.5 mt-0.5"><TierBadge tier={m.tier} size="xs" />{m.tierMultiplier > 1 && <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />×{m.tierMultiplier}</span>}</div></div></div></td><td className="px-4 py-3 text-right"><Badge variant="outline" className="font-bold text-primary border-primary/30 bg-primary/5"><Star className="w-3 h-3 mr-1 text-amber-500" />{m.points.toLocaleString("es")}</Badge></td><td className="px-4 py-3 text-right font-semibold text-green-700 hidden lg:table-cell">{formatCurrency(m.discountValue, currencySymbol)}</td><td className="px-4 py-3 hidden xl:table-cell w-48">{m.nextTier ? <div className="space-y-1"><div className="flex justify-between text-[10px] text-muted-foreground"><span>{m.progressToNext}%</span><span>{m.pointsToNext.toLocaleString("es")} para {m.nextTier.label}</span></div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${t.bar}`} style={{ width: `${m.progressToNext}%` }} /></div></div> : <span className={`text-[11px] font-semibold ${t.text}`}>✨ Nivel máximo</span>}</td><td className="px-4 py-3"><div className="flex items-center gap-1 justify-end"><Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-violet-600 hover:bg-violet-50" onClick={() => setCouponsFor({ id: m.customerId, name: m.customerName })}><Ticket className="w-3.5 h-3.5 mr-1" /> Cupones</Button><Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-primary hover:bg-primary/10" onClick={() => setHistoryFor({ id: m.customerId, name: m.customerName })}><History className="w-3.5 h-3.5 mr-1" /> Historial</Button><Button size="sm" variant="ghost" className="h-7 px-2 text-xs hover:bg-muted" onClick={() => handleAdjust(m)}><Gift className="w-3.5 h-3.5 mr-1" /> Ajustar</Button></div></td></tr>; })}</tbody></table></div>}</CardContent></Card>{couponsFor && <CouponsModal customerId={couponsFor.id} customerName={couponsFor.name} onClose={() => setCouponsFor(null)} />}{historyFor && <HistoryPanel customerId={historyFor.id} customerName={historyFor.name} onClose={() => setHistoryFor(null)} />}</div>;
}
