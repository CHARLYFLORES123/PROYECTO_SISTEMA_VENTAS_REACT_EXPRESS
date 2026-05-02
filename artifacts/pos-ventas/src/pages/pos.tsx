import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useGetProducts, useGetCustomers, useCreateSale, useGetCategories, useGetPaymentMethods } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Minus, Trash2, ShoppingCart, Package, User, CreditCard, CheckCircle2, ScanLine } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { BoletaModal } from "@/components/boleta-modal";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  stock: number;
  imageUrl?: string | null;
}

interface CompletedSaleForModal {
  id: number;
  customerName?: string | null;
  userName?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  details: { id: number; productName: string; quantity: number; unitPrice: number; subtotal: number }[];
}

export default function POS() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("none");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Efectivo");
  const [notes, setNotes] = useState("");
  const [completedSale, setCompletedSale] = useState<CompletedSaleForModal | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();

  const { data: products, isLoading: productsLoading } = useGetProducts({
    search: search || undefined,
    categoryId: categoryId ?? undefined,
  });
  const { data: customers } = useGetCustomers();
  const { data: categories } = useGetCategories();
  const { data: paymentMethods } = useGetPaymentMethods();
  const createSale = useCreateSale();

  const activePaymentMethods = useMemo(() => {
    if (!paymentMethods || paymentMethods.length === 0) return ["Efectivo", "Tarjeta", "Transferencia"];
    return paymentMethods.filter(m => m.isActive).map(m => m.name);
  }, [paymentMethods]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers || [];
    const q = customerSearch.toLowerCase();
    return (customers || []).filter(c =>
      c.name.toLowerCase().includes(q) || (c as any).email?.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => {
    if (customerId === "none") return null;
    return customers?.find(c => c.id === parseInt(customerId));
  }, [customerId, customers]);

  const subtotal = useMemo(() => cart.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0), [cart]);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ title: "Stock insuficiente", description: `Solo quedan ${product.stock} unidades`, variant: "destructive" });
          return prev;
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (product.stock <= 0) {
        toast({ title: "Sin stock disponible", variant: "destructive" });
        return prev;
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.salePrice,
        stock: product.stock,
        imageUrl: product.imageUrl,
      }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = item.quantity + delta;
        if (newQty > item.stock) {
          toast({ title: "Stock insuficiente", variant: "destructive" });
          return item;
        }
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  // Kiosk mode: auto-focus barcode input when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      const t = setTimeout(() => barcodeRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [cart.length]);

  const handleBarcodeScan = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !products) return;
    const product = products.find(
      p => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
    );
    if (!product) {
      toast({ title: "Código no encontrado", description: `Barcode: ${trimmed}`, variant: "destructive" });
      return;
    }
    addToCart(product);
    toast({ title: `✓ ${product.name}`, description: "Añadido al carrito" });
  }, [products]);

  const processSale = () => {
    if (cart.length === 0) return;
    // Snapshot cart for the modal (in case cart clears before modal opens)
    const cartSnapshot = [...cart];
    const customerIdSnapshot = customerId;
    const paymentMethodSnapshot = paymentMethod;
    const notesSnapshot = notes;

    createSale.mutate({
      data: {
        customerId: customerIdSnapshot === "none" ? null : parseInt(customerIdSnapshot),
        paymentMethod: paymentMethodSnapshot,
        notes: notesSnapshot || null,
        items: cartSnapshot.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      },
    }, {
      onSuccess: (sale) => {
        // Build completed sale for boleta modal, reconstructing details from cart snapshot
        const saleForModal: CompletedSaleForModal = {
          id: sale.id,
          customerName: selectedCustomer?.name ?? null,
          userName: null,
          subtotal: sale.subtotal,
          iva: sale.iva,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          status: sale.status,
          notes: notesSnapshot || null,
          createdAt: sale.createdAt,
          details: cartSnapshot.map((item, idx) => ({
            id: idx + 1,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice,
          })),
        };
        setCompletedSale(saleForModal);
        setCart([]);
        setCustomerId("none");
        setCustomerSearch("");
        setNotes("");
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      },
      onError: (err: any) => {
        toast({ title: "Error al procesar venta", description: err.message, variant: "destructive" });
      },
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-5.5rem)] gap-4">
      {/* ===== LEFT: Product Catalog ===== */}
      <div className="flex-1 flex flex-col min-w-0 gap-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar producto por nombre o código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-border shadow-sm rounded-xl"
            />
          </div>
          {/* Barcode scanner input */}
          <div className="relative w-48 shrink-0">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none" />
            <Input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleBarcodeScan(barcodeInput);
                  setBarcodeInput("");
                }
              }}
              placeholder="Escanear código..."
              className="pl-9 h-11 bg-white border-primary/30 shadow-sm rounded-xl focus:border-primary text-sm"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Category chips — Perfisoft style */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setCategoryId(null)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              categoryId === null
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
            }`}
          >
            Todos {products && categoryId === null ? `(${products.length})` : ""}
          </button>
          {categories?.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id === categoryId ? null : cat.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all border flex items-center gap-1.5 ${
                categoryId === cat.id
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
              }`}
            >
              {(cat as any).color && (
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: (cat as any).color }} />
              )}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <ScrollArea className="flex-1">
          {productsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl h-48 animate-pulse" />
              ))}
            </div>
          ) : products?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
              {products?.map(product => {
                const inCart = cart.find(i => i.productId === product.id);
                const outOfStock = product.stock <= 0;
                return (
                  <Card
                    key={product.id}
                    className={`cursor-pointer transition-all border-0 shadow-sm overflow-hidden group ${
                      outOfStock ? "opacity-50 cursor-not-allowed" : "hover:shadow-md hover:-translate-y-0.5"
                    } ${inCart ? "ring-2 ring-primary" : ""}`}
                    onClick={() => !outOfStock && addToCart(product)}
                  >
                    {/* Image */}
                    <div className="h-28 bg-muted/50 flex items-center justify-center overflow-hidden border-b border-border/50">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" onError={e => (e.currentTarget.parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full text-muted-foreground/30"><svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'1.5\'><rect width=\'18\' height=\'18\' x=\'3\' y=\'3\' rx=\'2\'/><circle cx=\'9\' cy=\'9\' r=\'2\'/><path d=\'m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\'/></svg></div>')} />
                      ) : (
                        <Package className="w-8 h-8 text-muted-foreground/30" />
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm leading-tight line-clamp-1">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{product.barcode || "Sin código"}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-primary text-sm">{formatCurrency(product.salePrice, currencySymbol)}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          product.stock === 0 ? "stock-zero" : product.stock <= product.minStock ? "stock-low" : "stock-ok"
                        }`}>
                          {product.stock}
                        </span>
                      </div>
                      {inCart && (
                        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full py-0.5">
                          <CheckCircle2 className="w-3 h-3" /> En carrito ({inCart.quantity})
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ===== RIGHT: Cart + Sale Panel ===== */}
      <div className="w-full lg:w-[360px] flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden shrink-0">
        {/* Cart header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-sm">Carrito</h2>
          {cart.length > 0 && (
            <span className="ml-auto bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </div>

        {/* Cart items */}
        <ScrollArea className="flex-1 px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="text-xs mt-1">Haz clic en un producto para agregar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map(item => (
                <div key={item.productId} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                  {/* Thumbnail */}
                  <div className="w-8 h-8 rounded-lg bg-muted overflow-hidden shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight line-clamp-1">{item.productName}</p>
                    <p className="text-[10px] text-muted-foreground">{formatCurrency(item.unitPrice, currencySymbol)} c/u</p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      onClick={() => updateQuantity(item.productId, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                    <button
                      className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                      onClick={() => updateQuantity(item.productId, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      className="w-6 h-6 ml-1 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Sale info + totals */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Customer selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Cliente
            </label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{(selectedCustomer as any).email || ""}</p>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => { setCustomerId("none"); setCustomerSearch(""); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Consumidor Final" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Consumidor Final</SelectItem>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Método de Pago
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activePaymentMethods.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Nota Adicional</label>
            <Textarea
              placeholder="Notas opcionales..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="text-xs resize-none rounded-xl"
            />
          </div>

          {/* Totals */}
          <div className="pt-2 border-t border-border/60 space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>IVA (13%)</span>
              <span className="font-medium text-foreground">{formatCurrency(iva, currencySymbol)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-border/60">
              <span className="font-bold text-sm">TOTAL</span>
              <span className="font-bold text-xl text-primary">{formatCurrency(total, currencySymbol)}</span>
            </div>
          </div>

          {/* Pay button — Perfisoft pill style */}
          <button
            onClick={processSale}
            disabled={cart.length === 0 || createSale.isPending}
            className="w-full h-12 bg-primary text-white font-bold text-sm rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {createSale.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Pagar {cart.length > 0 ? formatCurrency(total, currencySymbol) : ""}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Boleta Modal — appears after successful sale */}
      <BoletaModal
        sale={completedSale}
        onClose={() => setCompletedSale(null)}
      />
    </div>
  );
}
