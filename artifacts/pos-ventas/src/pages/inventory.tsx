import { useGetInventoryReport } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

export default function Inventory() {
  const { data: report, isLoading } = useGetInventoryReport();

  const handleExport = () => {
    if (!report) return;
    
    const worksheetData = report.map(item => ({
      'ID': item.id,
      'Código de Barras': item.barcode || '',
      'Producto': item.name,
      'Categoría': item.categoryName || '',
      'Precio Compra': item.purchasePrice,
      'Precio Venta': item.salePrice,
      'Stock Actual': item.stock,
      'Stock Mínimo': item.minStock,
      'Valor en Stock': item.stockValue,
      'Estado': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    
    // Auto-size columns
    const maxWidths = [5, 15, 30, 15, 12, 12, 10, 10, 15, 10];
    ws['!cols'] = maxWidths.map(w => ({ wch: w }));

    XLSX.writeFile(wb, `Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalValue = report?.reduce((acc, item) => acc + item.stockValue, 0) || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Reporte de Inventario</h2>
        <Button onClick={handleExport} disabled={!report || report.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Descargar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Productos</div>
            <div className="text-3xl font-bold">{report?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Valor Total en Stock</div>
            <div className="text-3xl font-bold text-primary">${totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Stock Bajo / Agotado</div>
            <div className="text-3xl font-bold text-destructive">
              {report?.filter(i => i.status !== 'OK').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Precio Compra</TableHead>
                <TableHead className="text-right">Precio Venta</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-4">Cargando...</TableCell></TableRow>
              ) : report?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.barcode}</div>
                  </TableCell>
                  <TableCell>{item.categoryName || "-"}</TableCell>
                  <TableCell className="text-right">${item.purchasePrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${item.salePrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">{item.stock}</TableCell>
                  <TableCell className="text-right font-bold">${item.stockValue.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    {item.status === 'OUT_OF_STOCK' ? (
                      <Badge variant="destructive">Agotado</Badge>
                    ) : item.status === 'LOW_STOCK' ? (
                      <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10"><AlertTriangle className="w-3 h-3 mr-1" /> Bajo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-success text-success-foreground bg-success/10">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {report?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay datos de inventario.
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
