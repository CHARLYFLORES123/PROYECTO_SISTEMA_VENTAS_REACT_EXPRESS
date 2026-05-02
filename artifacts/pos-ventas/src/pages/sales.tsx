import { useState } from "react";
import { Link } from "wouter";
import { useGetSales, useGetCustomers, useCancelSale } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Eye, MoreHorizontal, XCircle, Filter, Download, Plus, Search } from "lucide-react";
import { Toast, Swal } from "@/lib/swal";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import * as XLSX from "xlsx";

export default function Sales() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerId, setCustomerId] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();

  const { data: sales, isLoading } = useGetSales({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    customerId: customerId !== "all" ? parseInt(customerId) : undefined,
  });
  const { data: customers } = useGetCustomers();
  const cancelSale = useCancelSale();

  const handleCancel = async (id: number) => {
    const result = await Swal.fire({
      title: "¿Anular venta?",
      text: "Esta acción restaurará el stock de los productos.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonText: "No, mantener",
      confirmButtonText: "Sí, anular",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    cancelSale.mutate({ id }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: `Venta #${String(id).padStart(6, "0")} anulada` });
        queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      },
      onError: (err: any) => {
        Swal.fire({ icon: "error", title: "Error al anular venta", text: err.message });
      },
    });
  };

  const exportToExcel = () => {
    if (!sales?.length) return;
    const data = sales.map(s => ({
      "N° Venta": `#${String(s.id).padStart(6, "0")}`,
      "Cliente": (s as any).customerName || "Consumidor Final",
      "Vendedor": (s as any).userName || "-",
      "Fecha": new Date(s.createdAt).toLocaleString(),
      "Método Pago": s.paymentMethod,
      "Subtotal": s.subtotal,
      "IVA": s.iva,
      "Total": s.total,
      "Estado": s.status,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, `Ventas_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Historial de Ventas</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sales?.length ?? 0} venta{sales?.length !== 1 ? "s" : ""} encontrada{sales?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-full gap-1.5 ${showFilters ? "border-primary text-primary bg-primary/5" : ""}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} className="rounded-full gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
          <Link href="/pos">
            <Button size="sm" className="rounded-full gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nueva Venta
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha Inicio</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha Fin</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="h-9 rounded-xl text-sm">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {customers?.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(dateFrom || dateTo || customerId !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setDateFrom(""); setDateTo(""); setCustomerId("all"); }}
                className="mt-3 text-xs text-muted-foreground"
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs uppercase tracking-wide">N° Venta</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide">Cliente</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide hidden md:table-cell">Vendedor</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide hidden sm:table-cell">Fecha</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide hidden lg:table-cell">Método Pago</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-center">Estado</TableHead>
                <TableHead className="font-semibold text-xs uppercase tracking-wide text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="font-medium">No se encontraron ventas</p>
                    <p className="text-xs mt-1">Intenta cambiar los filtros de búsqueda</p>
                  </TableCell>
                </TableRow>
              ) : (
                sales?.map(sale => (
                  <TableRow key={sale.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="font-mono font-bold text-primary text-sm">
                      #{String(sale.id).padStart(6, "0")}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {(sale as any).customerName || "Consumidor Final"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                      {(sale as any).userName || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {new Date(sale.createdAt).toLocaleString("es-BO", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </TableCell>
                    <TableCell className="text-sm hidden lg:table-cell">{sale.paymentMethod}</TableCell>
                    <TableCell className="text-center">
                      <span className={sale.status === "completada" ? "badge-completed" : "badge-cancelled"}>
                        {sale.status === "completada" ? "COMPLETADO" : "ANULADO"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm">
                      {formatCurrency(sale.total, currencySymbol)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/sales/${sale.id}`}>
                              <Eye className="w-4 h-4 mr-2" /> Ver detalle
                            </Link>
                          </DropdownMenuItem>
                          {sale.status === "completada" && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleCancel(sale.id)}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Anular venta
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
