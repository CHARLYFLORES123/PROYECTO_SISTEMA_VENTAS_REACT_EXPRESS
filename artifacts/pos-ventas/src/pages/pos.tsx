import { useState, useMemo } from "react";
import { useGetProducts, useGetCustomers, useCreateSale } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  stock: number;
}

export default function POS() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("none");
  const [paymentMethod, setPaymentMethod] = useState<string>("Efectivo");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products } = useGetProducts({ search });
  const { data: customers } = useGetCustomers();
  const createSale = useCreateSale();

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0), [cart]);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ title: "Stock insuficiente", variant: "destructive" });
          return prev;
        }
        return prev.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      if (product.stock <= 0) {
        toast({ title: "Sin stock", variant: "destructive" });
        return prev;
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.salePrice,
        stock: product.stock
      }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.productId === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity > item.stock) {
          toast({ title: "Stock insuficiente", variant: "destructive" });
          return item;
        }
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const processSale = () => {
    if (cart.length === 0) return;

    createSale.mutate({
      data: {
        customerId: customerId === "none" ? null : parseInt(customerId),
        paymentMethod,
        items: cart.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      }
    }, {
      onSuccess: () => {
        toast({ title: "Venta procesada exitosamente" });
        setCart([]);
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      },
      onError: (err: any) => {
        toast({ title: "Error al procesar venta", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] gap-6">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nombre o código de barras..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 py-6 text-lg"
          />
        </div>
        
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {products?.map((product) => (
              <Card 
                key={product.id} 
                className={`cursor-pointer transition-all hover:border-primary hover-elevate ${product.stock <= 0 ? 'opacity-50' : ''}`}
                onClick={() => addToCart(product)}
              >
                <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                  <div>
                    <div className="font-bold leading-tight">{product.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{product.barcode || 'Sin código'}</div>
                  </div>
                  <div className="flex items-end justify-between mt-2">
                    <div className="font-bold text-primary">${product.salePrice.toFixed(2)}</div>
                    <div className={`text-xs font-medium ${product.stock <= product.minStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                      Stock: {product.stock}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-[400px] flex flex-col bg-card rounded-xl border shadow-sm">
        <div className="p-4 border-b bg-muted/20">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Carrito
          </h2>
        </div>

        <ScrollArea className="flex-1 p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-10">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.productId} className="flex gap-2 p-2 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">${item.unitPrice.toFixed(2)} c/u</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, -1)}>
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.productId, 1)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.productId)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t bg-muted/10 space-y-4">
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">Cliente</label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Consumidor Final</SelectItem>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium">Método de Pago</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4 border-t space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA (13%)</span>
              <span>${iva.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-xl pt-2">
              <span>TOTAL</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          <Button 
            className="w-full py-6 text-lg font-bold" 
            disabled={cart.length === 0 || createSale.isPending}
            onClick={processSale}
          >
            {createSale.isPending ? "Procesando..." : "Procesar Venta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
