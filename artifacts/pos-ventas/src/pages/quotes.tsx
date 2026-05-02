import { useState, useMemo } from "react";
import { useGetProducts, useGetCustomers, useGetQuotes, useCreateQuote, useConvertQuoteToSale } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, FileText, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { format } from "date-fns";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("none");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();

  const { data: products } = useGetProducts({ search });
  const { data: customers } = useGetCustomers();
  const { data: quotes } = useGetQuotes();
  
  const createQuote = useCreateQuote();
  const convertToSale = useConvertQuoteToSale();

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0), [cart]);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.salePrice
      }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.productId === productId) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const processQuote = () => {
    if (cart.length === 0) return;

    createQuote.mutate({
      data: {
        customerId: customerId === "none" ? null : parseInt(customerId),
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      }
    }, {
      onSuccess: () => {
        toast({ title: "Proforma guardada exitosamente" });
        setCart([]);
        setCustomerId("none");
        queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      }
    });
  };

  const handleConvertToSale = (quoteId: number) => {
    if (confirm("¿Estás seguro de convertir esta proforma a venta?")) {
      convertToSale.mutate({ id: quoteId }, {
        onSuccess: () => {
          toast({ title: "Proforma convertida a venta" });
          queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
          queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row h-[60vh] gap-6">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input placeholder="Buscar productos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 py-6 text-lg" />
          </div>
          <ScrollArea className="flex-1 border rounded-xl bg-card p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
              {products?.map((product) => (
                <Card key={product.id} className="cursor-pointer transition-all hover:border-primary hover-elevate" onClick={() => addToCart(product)}>
                  <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                    <div>
                      <div className="font-bold leading-tight">{product.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{product.barcode || 'Sin código'}</div>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                      <div className="font-bold text-primary">{formatCurrency(product.salePrice, currencySymbol)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="w-full lg:w-[400px] flex flex-col bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b bg-muted/20">
            <h2 className="font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Proforma</h2>
          </div>
          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-10">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>La proforma está vacía</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.productId} className="flex gap-2 p-2 border rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice, currencySymbol)} c/u</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)}><Plus className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.productId)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t bg-muted/10 space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">Cliente</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Consumidor Final</SelectItem>
                  {customers?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="pt-4 border-t space-y-1">
              <div className="flex justify-between font-bold text-xl pt-2">
                <span>TOTAL</span><span className="text-primary">{formatCurrency(total, currencySymbol)}</span>
              </div>
            </div>
            <Button className="w-full py-6 text-lg font-bold" disabled={cart.length === 0 || createQuote.isPending} onClick={processQuote}>
              {createQuote.isPending ? "Guardando..." : "Guardar Proforma"}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="p-4 border-b font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Proformas Guardadas</div>
          <Table>
            <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {quotes?.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">#{q.id.toString().padStart(6, '0')}</TableCell>
                  <TableCell>{format(new Date(q.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{q.customerName || "Consumidor Final"}</TableCell>
                  <TableCell>
                    {q.status === 'pendiente' && <Badge variant="secondary">Pendiente</Badge>}
                    {q.status === 'convertida' && <Badge className="bg-success text-success-foreground border-success">Convertida</Badge>}
                    {q.status === 'vencida' && <Badge variant="destructive">Vencida</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(q.total, currencySymbol)}</TableCell>
                  <TableCell className="text-right">
                    {q.status === 'pendiente' && (
                      <Button size="sm" onClick={() => handleConvertToSale(q.id)} disabled={convertToSale.isPending}>
                        <ArrowRight className="w-4 h-4 mr-2" /> Convertir a Venta
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}