import { useState } from "react";
import { Link } from "wouter";
import { useGetSales, useGetCustomers } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Sales() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerId, setCustomerId] = useState("all");

  const { data: sales, isLoading } = useGetSales({ 
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    customerId: customerId !== "all" ? parseInt(customerId) : undefined
  });
  
  const { data: customers } = useGetCustomers();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Historial de Ventas</h2>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-b">
          <div className="space-y-2">
            <label className="text-xs font-medium">Desde</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Hasta</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Cliente</label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
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
        </CardContent>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Venta</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Método Pago</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-4">Cargando...</TableCell></TableRow>
              ) : sales?.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">#{sale.id.toString().padStart(6, '0')}</TableCell>
                  <TableCell>{new Date(sale.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{sale.customerName || "Consumidor Final"}</TableCell>
                  <TableCell>{sale.paymentMethod}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={sale.status === 'COMPLETED' ? 'default' : 'secondary'} 
                           className={sale.status === 'COMPLETED' ? 'bg-success hover:bg-success/80 text-success-foreground' : ''}>
                      {sale.status === 'COMPLETED' ? 'Completado' : sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">${sale.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/sales/${sale.id}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {sales?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron ventas con los filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
