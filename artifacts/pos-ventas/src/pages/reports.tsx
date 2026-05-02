import { useState } from "react";
import { useGetReportSalesByUser, useGetReportByCategory, useGetReportStockAlerts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Download, AlertTriangle } from "lucide-react";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return format(d, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const { currencySymbol } = useCurrency();

  const { data: salesByUser } = useGetReportSalesByUser({ dateFrom, dateTo });
  const { data: byCategory } = useGetReportByCategory({ dateFrom, dateTo });
  const { data: stockAlerts } = useGetReportStockAlerts();

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const chartColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Reportes</h2>
      </div>

      <Tabs defaultValue="vendedores" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
          <TabsTrigger value="vendedores" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Ventas por Vendedor</TabsTrigger>
          <TabsTrigger value="categorias" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Por Categoría</TabsTrigger>
          <TabsTrigger value="stock" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">Alertas de Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="vendedores" className="space-y-4 pt-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1"><label className="text-xs font-medium">Desde</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Hasta</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
            <Button onClick={() => exportToExcel(salesByUser || [], "Ventas_por_Vendedor")}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead className="text-right">N° Ventas</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {salesByUser?.map((s) => (
                      <TableRow key={s.userId}>
                        <TableCell className="font-medium">{s.userName}</TableCell>
                        <TableCell className="text-right">{s.totalSales}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(s.totalRevenue ?? 0, currencySymbol)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ingresos por Vendedor</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByUser}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="userName" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(val) => `${currencySymbol}${val}`} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(val: number) => formatCurrency(val, currencySymbol)} />
                    <Bar dataKey="totalRevenue" radius={[4, 4, 0, 0]}>
                      {salesByUser?.map((entry, index) => <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categorias" className="space-y-4 pt-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1"><label className="text-xs font-medium">Desde</label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Hasta</label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
            <Button onClick={() => exportToExcel(byCategory || [], "Ventas_por_Categoria")}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Categoría</TableHead><TableHead className="text-right">Unidades Vendidas</TableHead><TableHead className="text-right">Ingresos</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {byCategory?.map((c) => (
                      <TableRow key={c.categoryId}>
                        <TableCell className="font-medium">{c.categoryName || 'Sin Categoría'}</TableCell>
                        <TableCell className="text-right">{c.totalSold}</TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(c.totalRevenue ?? 0, currencySymbol)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Ingresos por Categoría</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byCategory} layout="vertical" margin={{ left: 30 }}>
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

        <TabsContent value="stock" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button onClick={() => exportToExcel(stockAlerts || [], "Alertas_Stock")}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Categoría</TableHead><TableHead className="text-right">Stock Actual</TableHead><TableHead className="text-right">Stock Mínimo</TableHead><TableHead className="text-center">Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stockAlerts?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.categoryName || '-'}</TableCell>
                      <TableCell className="text-right font-bold">{a.stock}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.minStock}</TableCell>
                      <TableCell className="text-center">
                        {a.stock <= 0 ? (
                          <Badge variant="destructive">Sin Stock</Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10"><AlertTriangle className="w-3 h-3 mr-1" /> Bajo</Badge>
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