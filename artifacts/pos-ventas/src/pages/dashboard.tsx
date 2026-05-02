import { useState } from "react";
import { useGetDashboardStats, useGetSalesChart, useGetTopProducts, useGetRecentSales, useGetReportSalesByUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { Package, Users, ShoppingCart, TrendingDown, TrendingUp, DollarSign, AlertTriangle, ArrowUpRight } from "lucide-react";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const CHART_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

function StatCard({
  title, value, sub, icon: Icon, color, trend,
}: {
  title: string; value: string; sub?: string; icon: any; color: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="card-hover border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label, symbol }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-border rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-muted-foreground">
            {formatCurrency(p.value, symbol)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: chartData } = useGetSalesChart();
  const { data: topProducts } = useGetTopProducts();
  const { data: recentSales } = useGetRecentSales();
  const { data: salesByUser } = useGetReportSalesByUser({});
  const { currencySymbol } = useCurrency();

  const formattedChart = (chartData || []).map(d => ({
    ...d,
    date: (() => { try { return format(new Date(d.date), "dd/MM"); } catch { return d.date; } })(),
  }));

  const maxProductRevenue = Math.max(...(topProducts?.map(p => p.revenue) ?? [1]));
  const maxUserRevenue = Math.max(...(salesByUser?.map(u => u.totalRevenue) ?? [1]));

  return (
    <div className="space-y-6">
      {/* KPI Cards — matching Perfisoft 4-card layout */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Productos"
          value={String(stats?.totalProducts ?? 0)}
          sub="Registrados"
          icon={Package}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Total Clientes"
          value={String(stats?.totalCustomers ?? 0)}
          sub="Registrados"
          icon={Users}
          color="bg-orange-50 text-orange-500"
        />
        <StatCard
          title="Ventas Realizadas"
          value={formatCurrency(stats?.totalSalesMonth ?? 0, currencySymbol)}
          sub={`${stats?.salesCountMonth ?? 0} transacciones este mes`}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
          trend="up"
        />
        <StatCard
          title="Stock Bajo"
          value={String(stats?.lowStockCount ?? 0)}
          sub="Productos con stock crítico"
          icon={AlertTriangle}
          color="bg-red-50 text-red-500"
          trend="down"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Line chart — Sales by date (Perfisoft primary chart) */}
        <Card className="lg:col-span-3 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Total Ventas por Fechas</CardTitle>
              <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5">
                Últimos 7 días
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 13% 91%)" />
                  <XAxis dataKey="date" stroke="hsl(220 9% 46%)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(220 9% 46%)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${currencySymbol}${v}`} width={60} />
                  <RechartsTooltip content={<CustomTooltip symbol={currencySymbol} />} />
                  <Area type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2.5} fill="url(#gradPrimary)" dot={{ fill: "#4F46E5", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#4F46E5" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Today & Month stats */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="border-0 shadow-sm flex-1">
            <CardContent className="p-5 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ventas Hoy</p>
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-primary">{formatCurrency(stats?.totalSalesToday ?? 0, currencySymbol)}</p>
                <p className="text-sm text-muted-foreground mt-1">{stats?.salesCountToday ?? 0} ventas realizadas hoy</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>En tiempo real</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm flex-1">
            <CardContent className="p-5 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Este Mes</p>
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(stats?.totalSalesMonth ?? 0, currencySymbol)}</p>
                <p className="text-sm text-muted-foreground mt-1">{stats?.salesCountMonth ?? 0} ventas este mes</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Ventas completadas</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom row: Top Products + Top Sellers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top productos — horizontal bar (Perfisoft style) */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Top Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topProducts && topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const pct = maxProductRevenue > 0 ? (p.revenue / maxProductRevenue) * 100 : 0;
                  return (
                    <div key={p.productId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-medium truncate">{p.productName}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-bold text-foreground">{formatCurrency(p.revenue, currencySymbol)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({p.totalSold} u.)</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sin datos de ventas aún</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por vendedor */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Ventas por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {salesByUser && salesByUser.length > 0 ? (
              <div className="space-y-3">
                {salesByUser.slice(0, 5).map((u, i) => {
                  const pct = maxUserRevenue > 0 ? (u.totalRevenue / maxUserRevenue) * 100 : 0;
                  return (
                    <div key={u.userId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                            {u.userName?.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium truncate">{u.userName}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-bold">{formatCurrency(u.totalRevenue, currencySymbol)}</span>
                          <span className="text-xs text-muted-foreground ml-1">({u.totalSales})</span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all bg-green-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Sin datos de vendedores aún</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Ventas Recientes</CardTitle>
            <a href="/sales" className="text-xs text-primary hover:underline font-medium">Ver historial →</a>
          </div>
        </CardHeader>
        <CardContent className="pt-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">N° Venta</th>
                <th className="text-left pb-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Cliente</th>
                <th className="text-left pb-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide hidden sm:table-cell">Fecha</th>
                <th className="text-center pb-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Estado</th>
                <th className="text-right pb-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentSales?.map((sale) => (
                <tr key={sale.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-3 font-mono font-semibold text-primary">
                    #{String(sale.id).padStart(6, "0")}
                  </td>
                  <td className="py-3 text-foreground">{(sale as any).customerName || "Consumidor Final"}</td>
                  <td className="py-3 text-muted-foreground hidden sm:table-cell text-xs">
                    {new Date(sale.createdAt).toLocaleString("es-BO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 text-center">
                    <span className={sale.status === "completada" ? "badge-completed" : "badge-cancelled"}>
                      {sale.status === "completada" ? "COMPLETADO" : "ANULADO"}
                    </span>
                  </td>
                  <td className="py-3 text-right font-bold text-foreground">{formatCurrency(sale.total, currencySymbol)}</td>
                </tr>
              ))}
              {!recentSales?.length && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">No hay ventas recientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
