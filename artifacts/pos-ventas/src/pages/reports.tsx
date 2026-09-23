import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetReportSalesByUser, useGetReportByCategory, useGetReportStockAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, subDays, startOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import {
  Download,
  AlertTriangle,
  Calendar,
  User,
  Package,
  DollarSign,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { getToken } from "@/lib/auth";

interface ProductSaleItem {
  productId: number | null;
  productName: string;
  quantity: number;
  subtotal: number;
}

interface DailySellerSale {
  date: string;
  userId: number;
  userName: string;
  userRole: string;
  salesCount: number;
  totalAmount: number;
  products: ProductSaleItem[];
}

interface SellerInfo {
  id: number;
  name: string;
  role: string;
}

interface DailyReportResponse {
  daily: DailySellerSale[];
  summary: {
    totalRevenue: number;
    totalSales: number;
    totalProducts: number;
    activeSellersCount: number;
  };
  sellers: SellerInfo[];
}

export default function Reports() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthStartStr = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(monthStartStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [selectedSeller, setSelectedSeller] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [subView, setSubView] = useState<"daily" | "chart" | "totals">("daily");

  const { currencySymbol } = useCurrency();

  // Fetch report daily sales per seller with products
  const {
    data: dailyData,
    isLoading: isLoadingDaily,
    refetch: refetchDaily,
    isFetching: isFetchingDaily,
  } = useQuery<DailyReportResponse>({
    queryKey: ["report-sales-by-seller-daily", dateFrom, dateTo, selectedSeller],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);
      if (selectedSeller && selectedSeller !== "all") params.append("userId", selectedSeller);

      const token = getToken();
      const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
      const res = await fetch(`${apiUrl}/reports/sales-by-seller-daily?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Error al obtener el reporte");
      return res.json();
    },
  });

  // Queries for standard reports
  const { data: salesByUser } = useGetReportSalesByUser({ dateFrom, dateTo });
  const { data: byCategory } = useGetReportByCategory({ dateFrom, dateTo });
  const { data: stockAlerts } = useGetReportStockAlerts();

  // Quick date filter presets
  const applyPreset = (preset: "today" | "yesterday" | "last7" | "month") => {
    const today = new Date();
    if (preset === "today") {
      const d = format(today, "yyyy-MM-dd");
      setDateFrom(d);
      setDateTo(d);
    } else if (preset === "yesterday") {
      const y = format(subDays(today, 1), "yyyy-MM-dd");
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === "last7") {
      setDateFrom(format(subDays(today, 7), "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
    } else if (preset === "month") {
      setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"));
      setDateTo(format(today, "yyyy-MM-dd"));
    }
  };

  // Toggle row expansion
  const toggleRow = (key: string) => {
    setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpandAll = () => {
    if (!dailyData?.daily) return;
    const allExpanded = dailyData.daily.every((d) => expandedRows[`${d.date}_${d.userId}`]);
    const newState: Record<string, boolean> = {};
    if (!allExpanded) {
      dailyData.daily.forEach((d) => {
        newState[`${d.date}_${d.userId}`] = true;
      });
    }
    setExpandedRows(newState);
  };

  // Filter daily records by search term
  const filteredDaily = useMemo(() => {
    if (!dailyData?.daily) return [];
    if (!searchTerm.trim()) return dailyData.daily;

    const term = searchTerm.toLowerCase();
    return dailyData.daily.filter((item) => {
      const matchSeller = item.userName.toLowerCase().includes(term);
      const matchDate = item.date.includes(term);
      const matchProduct = item.products.some((p) => p.productName.toLowerCase().includes(term));
      return matchSeller || matchDate || matchProduct;
    });
  }, [dailyData?.daily, searchTerm]);

  // Aggregated data for daily chart
  const chartDailyData = useMemo(() => {
    if (!filteredDaily.length) return [];
    // Group by date
    const dateMap = new Map<string, { date: string; displayDate: string; totalRevenue: number; salesCount: number }>();
    for (const item of filteredDaily) {
      const existing = dateMap.get(item.date);
      if (existing) {
        existing.totalRevenue += item.totalAmount;
        existing.salesCount += item.salesCount;
      } else {
        const parts = item.date.split("-");
        const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.date;
        dateMap.set(item.date, {
          date: item.date,
          displayDate,
          totalRevenue: item.totalAmount,
          salesCount: item.salesCount,
        });
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredDaily]);

  // Export comprehensive Excel report
  const exportDailyToExcel = () => {
    if (!dailyData?.daily?.length) return;

    // Sheet 1: Ventas por Vendedor y Día
    const sheet1Data = filteredDaily.map((d) => {
      const parts = d.date.split("-");
      const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d.date;
      const productsSummary = d.products.map((p) => `${p.productName} (${p.quantity})`).join(", ");
      return {
        Fecha: dateFormatted,
        "ID Vendedor": d.userId || "N/A",
        Vendedor: d.userName,
        Rol: d.userRole,
        "N° Ventas": d.salesCount,
        "Total Vendido": d.totalAmount,
        "Productos Vendidos": productsSummary,
        "Cant. Productos": d.products.reduce((acc, p) => acc + p.quantity, 0),
      };
    });

    // Sheet 2: Detalle de Productos Vendidos
    const sheet2Data: any[] = [];
    filteredDaily.forEach((d) => {
      const parts = d.date.split("-");
      const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d.date;
      d.products.forEach((p) => {
        sheet2Data.push({
          Fecha: dateFormatted,
          Vendedor: d.userName,
          "Código/ID Producto": p.productId || "N/A",
          Producto: p.productName,
          "Cantidad Vendida": p.quantity,
          "Monto Recaudado": p.subtotal,
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

    XLSX.utils.book_append_sheet(wb, ws1, "Ventas_por_Dia");
    XLSX.utils.book_append_sheet(wb, ws2, "Productos_Detalle");

    XLSX.writeFile(wb, `Reporte_Ventas_Vendedor_Por_Dia_${dateFrom}_al_${dateTo}.xlsx`);
  };

  const chartColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reportes de Ventas</h2>
          <p className="text-sm text-muted-foreground">
            Visualiza los montos vendidos por vendedor por día y el detalle de productos despachados
          </p>
        </div>
      </div>

      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger
            value="vendedores"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 font-medium"
          >
            Ventas por Vendedor
          </TabsTrigger>
          <TabsTrigger
            value="categorias"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 font-medium"
          >
            Por Categoría
          </TabsTrigger>
          <TabsTrigger
            value="stock"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2 font-medium"
          >
            Alertas de Stock
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: VENTAS POR VENDEDOR */}
        <TabsContent value="vendedores" className="space-y-6 pt-4">
          {/* BARRA DE FILTROS */}
          <Card className="shadow-xs border-muted">
            <CardContent className="p-4 space-y-4">
              {/* Presets rápidos */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Período:
                </span>
                <Button variant="outline" size="sm" onClick={() => applyPreset("today")} className="h-7 text-xs">
                  Hoy
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset("yesterday")} className="h-7 text-xs">
                  Ayer
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset("last7")} className="h-7 text-xs">
                  Últimos 7 días
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset("month")} className="h-7 text-xs">
                  Este Mes
                </Button>
              </div>

              {/* Filtros fecha, vendedor y búsqueda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Desde</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Hasta</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Vendedor</label>
                  <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los vendedores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vendedores</SelectItem>
                      {dailyData?.sellers?.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} ({s.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Buscar producto / vendedor</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Filtrar datos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => refetchDaily()}
                    disabled={isFetchingDaily}
                    title="Actualizar datos"
                    className="shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isFetchingDaily ? "animate-spin text-primary" : ""}`} />
                  </Button>
                  <Button
                    onClick={exportDailyToExcel}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    disabled={!filteredDaily.length}
                  >
                    <Download className="w-4 h-4" /> Exportar Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TARJETAS KPI DE RESUMEN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-emerald-500/10 via-background to-background border-emerald-500/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Monto Total Vendido</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCurrency(dailyData?.summary?.totalRevenue ?? 0, currencySymbol)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">En el período seleccionado</p>
                </div>
                <div className="p-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <DollarSign className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 via-background to-background border-blue-500/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total de Ventas</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {dailyData?.summary?.totalSales ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Transacciones completadas</p>
                </div>
                <div className="p-3 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl">
                  <ShoppingCart className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500/10 via-background to-background border-purple-500/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Productos Despachados</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                    {dailyData?.summary?.totalProducts ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Unidades totales vendidas</p>
                </div>
                <div className="p-3 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl">
                  <Package className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/10 via-background to-background border-amber-500/30">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Vendedores Activos</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {dailyData?.summary?.activeSellersCount ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Con ventas registradas</p>
                </div>
                <div className="p-3 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                  <User className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SUB-VISTAS: DETALLADA POR DÍA / GRÁFICO / ACUMULADO */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex gap-2">
              <Button
                variant={subView === "daily" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSubView("daily")}
                className="text-xs font-semibold"
              >
                Ventas por Día y Productos
              </Button>
              <Button
                variant={subView === "chart" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSubView("chart")}
                className="text-xs font-semibold"
              >
                Gráfico por Día
              </Button>
              <Button
                variant={subView === "totals" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSubView("totals")}
                className="text-xs font-semibold"
              >
                Acumulado General
              </Button>
            </div>

            {subView === "daily" && filteredDaily.length > 0 && (
              <Button variant="ghost" size="sm" onClick={toggleExpandAll} className="text-xs text-muted-foreground">
                {dailyData?.daily && dailyData.daily.every((d) => expandedRows[`${d.date}_${d.userId}`])
                  ? "Plegar todos los productos"
                  : "Desplegar todos los productos"}
              </Button>
            )}
          </div>

          {/* SUBVIEW 1: POR DÍA DETALLADO CON PRODUCTOS */}
          {subView === "daily" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Detalle Diario por Vendedor</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Mostrando {filteredDaily.length} registro(s)
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Haz clic en cualquier fila para ver los productos y cantidades exactas vendidas por ese vendedor en ese día.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingDaily ? (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Cargando ventas por vendedor...</p>
                  </div>
                ) : filteredDaily.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No se encontraron ventas para los filtros seleccionados</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Intenta ampliar el rango de fechas o cambiar el vendedor.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">N° Ventas</TableHead>
                        <TableHead className="text-right">Monto Total Vendido</TableHead>
                        <TableHead className="text-right">Productos Vendidos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDaily.map((row) => {
                        const rowKey = `${row.date}_${row.userId}`;
                        const isExpanded = !!expandedRows[rowKey];
                        const isToday = row.date === todayStr;

                        const parts = row.date.split("-");
                        const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : row.date;
                        const totalUnits = row.products.reduce((sum, p) => sum + p.quantity, 0);

                        return (
                          <>
                            <TableRow
                              key={rowKey}
                              onClick={() => toggleRow(rowKey)}
                              className="cursor-pointer hover:bg-muted/30 transition-colors group"
                            >
                              <TableCell className="text-center p-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 p-0 text-muted-foreground group-hover:text-primary"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-primary font-bold" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-semibold whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span>{dateFormatted}</span>
                                  {isToday && (
                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] py-0">
                                      Hoy
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                                    {row.userName.slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm leading-none">{row.userName}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 capitalize">{row.userRole}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="font-semibold">
                                  {row.salesCount} {row.salesCount === 1 ? "venta" : "ventas"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(row.totalAmount, currencySymbol)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-xs font-semibold text-foreground">
                                    {row.products.length} {row.products.length === 1 ? "producto" : "productos"}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    ({totalUnits} {totalUnits === 1 ? "unidad" : "unidades"} en total)
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* FILA EXPANDIBLE CON EL DETALLE DE PRODUCTOS */}
                            {isExpanded && (
                              <TableRow className="bg-muted/15 border-t border-b hover:bg-muted/15">
                                <TableCell colSpan={6} className="p-3 sm:p-4 pl-8 sm:pl-12">
                                  <div className="bg-background rounded-lg border shadow-xs p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b pb-2">
                                      <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-primary" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                          Productos vendidos por {row.userName} el {dateFormatted}
                                        </h4>
                                      </div>
                                      <span className="text-xs font-medium text-muted-foreground">
                                        Total del día:{" "}
                                        <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                                          {formatCurrency(row.totalAmount, currencySymbol)}
                                        </strong>
                                      </span>
                                    </div>

                                    {row.products.length === 0 ? (
                                      <p className="text-xs text-muted-foreground italic py-2">
                                        No hay detalle de productos individual registrado para estas ventas.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b text-muted-foreground text-left">
                                              <th className="py-1.5 font-semibold">Producto</th>
                                              <th className="py-1.5 text-center font-semibold">Cantidad</th>
                                              <th className="py-1.5 text-right font-semibold">Subtotal</th>
                                              <th className="py-1.5 text-right font-semibold">% del Día</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y">
                                            {row.products.map((prod, idx) => {
                                              const percent = row.totalAmount > 0
                                                ? Math.min(100, Math.round((prod.subtotal / row.totalAmount) * 100))
                                                : 0;

                                              return (
                                                <tr key={idx} className="hover:bg-muted/30">
                                                  <td className="py-2 font-medium text-foreground pr-4">
                                                    {prod.productName}
                                                  </td>
                                                  <td className="py-2 text-center whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                                      {prod.quantity}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 text-right font-bold text-foreground whitespace-nowrap">
                                                    {formatCurrency(prod.subtotal, currencySymbol)}
                                                  </td>
                                                  <td className="py-2 text-right text-muted-foreground whitespace-nowrap">
                                                    <span className="text-[11px] font-medium">{percent}%</span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* SUBVIEW 2: GRÁFICO DIARIO DE VENTAS */}
          {subView === "chart" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Tendencia Diaria de Ventas</CardTitle>
                <CardDescription className="text-xs">
                  Monto total recaudado por día para el rango de fechas seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[360px] pt-4">
                {chartDailyData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    Sin ventas registradas en este período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDailyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                      <XAxis dataKey="displayDate" tickLine={false} axisLine={false} />
                      <YAxis
                        tickFormatter={(val) => `${currencySymbol}${val}`}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(val: number) => [formatCurrency(val, currencySymbol), "Monto Total"]}
                        labelFormatter={(label) => `Fecha: ${label}`}
                      />
                      <Bar dataKey="totalRevenue" fill="#10b981" radius={[6, 6, 0, 0]}>
                        {chartDailyData.map((_, index) => (
                          <Cell key={`cell-daily-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {/* SUBVIEW 3: ACUMULADO GENERAL POR VENDEDOR */}
          {subView === "totals" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Resumen Acumulado por Vendedor</CardTitle>
                  <CardDescription className="text-xs">
                    Totales globales en el período ({dateFrom} al {dateTo})
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-right">N° Ventas</TableHead>
                        <TableHead className="text-right">Total Acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesByUser?.map((s) => (
                        <TableRow key={s.userId}>
                          <TableCell className="font-medium">{s.userName}</TableCell>
                          <TableCell className="text-right">{s.totalSales}</TableCell>
                          <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(s.totalRevenue ?? 0, currencySymbol)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Participación por Vendedor</CardTitle>
                  <CardDescription className="text-xs">Comparativa de ingresos generados</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByUser || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="userName" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(val) => `${currencySymbol}${val}`} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(val: number) => formatCurrency(val, currencySymbol)} />
                      <Bar dataKey="totalRevenue" radius={[4, 4, 0, 0]}>
                        {salesByUser?.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: POR CATEGORÍA */}
        <TabsContent value="categorias" className="space-y-4 pt-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Desde</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Hasta</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(byCategory || []);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Reporte");
                XLSX.writeFile(wb, "Ventas_por_Categoria.xlsx");
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Unidades Vendidas</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byCategory?.map((c) => (
                      <TableRow key={c.categoryId}>
                        <TableCell className="font-medium">{c.categoryName || "Sin Categoría"}</TableCell>
                        <TableCell className="text-right">{c.totalSold}</TableCell>
                        <TableCell className="text-right font-bold">
                          {formatCurrency(c.totalRevenue ?? 0, currencySymbol)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Categoría</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory || []} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" tickFormatter={(val) => `${currencySymbol}${val}`} tickLine={false} axisLine={false} />
                    <YAxis dataKey="categoryName" type="category" tickLine={false} axisLine={false} />
                    <Tooltip formatter={(val: number) => formatCurrency(val, currencySymbol)} />
                    <Bar dataKey="totalRevenue" radius={[0, 4, 4, 0]} fill="var(--color-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: ALERTAS DE STOCK */}
        <TabsContent value="stock" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                const ws = XLSX.utils.json_to_sheet(stockAlerts || []);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Reporte");
                XLSX.writeFile(wb, "Alertas_Stock.xlsx");
              }}
            >
              <Download className="w-4 h-4 mr-2" /> Exportar
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Stock Actual</TableHead>
                    <TableHead className="text-right">Stock Mínimo</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockAlerts?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.categoryName || "-"}</TableCell>
                      <TableCell className="text-right font-bold">{a.stock}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.minStock}</TableCell>
                      <TableCell className="text-center">
                        {a.stock <= 0 ? (
                          <Badge variant="destructive">Sin Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Bajo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}