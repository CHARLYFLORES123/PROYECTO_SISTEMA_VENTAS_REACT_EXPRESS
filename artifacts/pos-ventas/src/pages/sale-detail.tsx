import { useRoute } from "wouter";
import { useGetSaleById } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "wouter";

export default function SaleDetail() {
  const [match, params] = useRoute("/sales/:id");
  const id = match ? parseInt(params.id) : 0;
  
  const { data: sale, isLoading } = useGetSaleById(id, { query: { enabled: !!id } });

  if (isLoading) return <div>Cargando detalle de venta...</div>;
  if (!sale) return <div>Venta no encontrada</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/sales">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">Detalle de Venta #{sale.id.toString().padStart(6, '0')}</h2>
          <Badge variant={sale.status === 'COMPLETED' ? 'default' : 'secondary'} 
                 className={sale.status === 'COMPLETED' ? 'bg-success text-success-foreground' : ''}>
            {sale.status}
          </Badge>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir Recibo
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-medium">{sale.customerName || "Consumidor Final"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Información de Pago</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-sm text-muted-foreground">Fecha</div>
              <div className="font-medium">{new Date(sale.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Método</div>
              <div className="font-medium">{sale.paymentMethod}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio Unitario</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.details.map((detail) => (
                <TableRow key={detail.id}>
                  <TableCell className="font-medium">{detail.productName}</TableCell>
                  <TableCell className="text-right">${detail.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{detail.quantity}</TableCell>
                  <TableCell className="text-right font-medium">${detail.subtotal.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <div className="p-4 border-t bg-muted/10 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${sale.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA (13%)</span>
                <span>${sale.iva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-2 border-t">
                <span>TOTAL</span>
                <span className="text-primary">${sale.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
