import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useGetProducts, useGetCustomers, useCreateSale, useGetCategories, useGetPaymentMethods, useGetBusinessSettings } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Minus, Trash2, ShoppingCart, Package, User, CreditCard, CheckCircle2, ScanLine, PauseCircle, PlayCircle, Clock, Percent, Tag, Banknote, Star, Gift, Zap } from "lucide-react";
import { TierBadge } from "@/pages/loyalty";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { BoletaModal } from "@/components/boleta-modal";
import { Toast, Swal } from "@/lib/swal";
import { getToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers ?? {}) },
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).message ?? "Error"); }
  return res.json();
}

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  stock: number;
  imageUrl?: string | null;
}

interface SuspendedSale {
  id: string;
  label: string;
  cart: CartItem[];
  customerId: string;
  customerSearch: string;
  paymentMethod: string;
  notes: string;
  suspendedAt: Date;
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
  const [cashReceived, setCashReceived] = useState<string>("");
  const [pendingQty, setPendingQty] = useState(1);
  const [suspendedSales, setSuspendedSales] = useState<SuspendedSale[]>([]);
  const [showSuspended, setShowSuspended] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [redeemingPoints, setRedeemingPoints] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();

  const { data: products, isLoading: productsLoading } = useGetProducts({
    search: search || undefined,
    categoryId: categoryId ?? undefined,
  });
  const { data: customers } = useGetCustomers();
  const { data: categories } = useGetCategories();
  const { data: paymentMethods } = useGetPaymentMethods();
  const { data: settings } = useGetBusinessSettings();
  const createSale = useCreateSale();

  // Loyalty balance for selected customer
  const customerIdNum = customerId !== "none" ? parseInt(customerId) : null;
  const { data: loyaltyBalance, refetch: refetchBalance } = useQuery<{
    points: number; discountValue: number; redemptionRate: number; pointsPerUnit: number; loyaltyEnabled: boolean;
    tier: string; tierLabel: string; tierMultiplier: number; tierColor: string;
    nextTier: { name: string; label: string; min: number } | null;
    progressToNext: number; pointsToNext: number;
  }>({
    queryKey: ["/api/loyalty/balance", customerIdNum],
    queryFn: () => apiFetch(`/api/loyalty/balance/${customerIdNum}`),
    enabled: customerIdNum !== null && !!(settings as any)?.loyaltyEnabled,
  });

  // Reset points when customer changes
  useEffect(() => { setPointsToRedeem(0); }, [customerId]);

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

  const subtotal = useMemo(() => cart.reduce((acc, i) =>
    acc + i.quantity * i.unitPrice * (1 - i.discount / 100), 0), [cart]);
  const totalDiscount = useMemo(() => cart.reduce((acc, i) =>
    acc + i.quantity * i.unitPrice * (i.discount / 100), 0), [cart]);
  const loyaltyDiscount = useMemo(() => {
    if (!pointsToRedeem || !loyaltyBalance) return 0;
    return +(pointsToRedeem * loyaltyBalance.redemptionRate).toFixed(2);
  }, [pointsToRedeem, loyaltyBalance]);
  const iva = (subtotal - loyaltyDiscount) * 0.13;
  const total = Math.max(0, subtotal - loyaltyDiscount + iva);

  const addToCart = (product: any, qty = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > product.stock) {
          Toast.fire({ icon: "error", title: "Stock insuficiente", text: `Solo quedan ${product.stock} unidades` });
          return prev;
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: newQty } : i);
      }
      if (product.stock <= 0) {
        Toast.fire({ icon: "error", title: "Sin stock disponible" });
        return prev;
      }
      if (qty > product.stock) {
        Toast.fire({ icon: "error", title: "Stock insuficiente", text: `Solo quedan ${product.stock} unidades` });
        return prev;
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: product.salePrice,
        discount: 0,
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
          Toast.fire({ icon: "error", title: "Stock insuficiente" });
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

  const applyDiscount = async (productId: number, productName: string, unitPrice: number) => {
    const { isConfirmed, value } = await Swal.fire({
      title: "Descuento rápido",
      html: `
        <p class="text-sm text-gray-500 mb-4">${productName}</p>
        <div class="flex gap-2 mb-4" id="disc-type-btns">
          <button type="button" id="btn-pct"
            class="flex-1 py-2 text-sm font-semibold rounded-lg border-2 border-indigo-600 bg-indigo-600 text-white transition-all"
            onclick="window._dtype='pct';
              document.getElementById('btn-pct').className='flex-1 py-2 text-sm font-semibold rounded-lg border-2 border-indigo-600 bg-indigo-600 text-white transition-all';
              document.getElementById('btn-fixed').className='flex-1 py-2 text-sm font-semibold rounded-lg border-2 border-gray-200 text-gray-500 transition-all';
              document.getElementById('disc-label').textContent='Porcentaje (0–100)'">
            % Porcentaje
          </button>
          <button type="button" id="btn-fixed"
            class="flex-1 py-2 text-sm font-semibold rounded-lg border-2 border-gray-200 text-gray-500 transition-all"
            onclick="window._dtype='fixed';
              document.getElementById('btn-fixed').className='flex-1 py-2 text-sm font-semibold rounded-lg border-2 border-indigo-600 bg-indigo-600 text-white transition-all';
              document.getElementById('btn-pct').className='flex-1 py-2 text-sm font-semibold rounded-lg border-2 border-gray-200 text-gray-500 transition-all';
              document.getElementById('disc-label').textContent='Monto fijo (${currencySymbol})'">
            $ Monto fijo
          </button>
        </div>
        <label id="disc-label" class="block text-xs text-gray-400 mb-1 text-left">Porcentaje (0–100)</label>
        <input id="disc-val" type="number" min="0" step="0.01"
          class="swal2-input !mt-0"
          placeholder="Ej: 10">
      `,
      confirmButtonText: "Aplicar",
      confirmButtonColor: "#4F46E5",
      cancelButtonText: "Cancelar",
      showCancelButton: true,
      focusConfirm: false,
      didOpen: () => { (window as any)._dtype = "pct"; },
      preConfirm: () => {
        const val = parseFloat((document.getElementById("disc-val") as HTMLInputElement).value);
        const dtype = (window as any)._dtype || "pct";
        if (isNaN(val) || val < 0) { Swal.showValidationMessage("Ingresa un valor válido mayor a 0"); return false; }
        if (dtype === "pct" && val > 100) { Swal.showValidationMessage("El porcentaje no puede superar 100%"); return false; }
        if (dtype === "fixed" && val > unitPrice) { Swal.showValidationMessage(`El descuento no puede superar el precio (${formatCurrency(unitPrice, currencySymbol)})`); return false; }
        return { dtype, val };
      },
    });
    if (!isConfirmed || !value) return;
    const discountPct = value.dtype === "pct" ? value.val : (value.val / unitPrice) * 100;
    setCart(prev => prev.map(item =>
      item.productId === productId ? { ...item, discount: Math.min(discountPct, 100) } : item
    ));
    Toast.fire({ icon: "success", title: `Descuento ${value.dtype === "pct" ? `${value.val}%` : formatCurrency(value.val, currencySymbol)} aplicado` });
  };

  const suspendSale = () => {
    if (cart.length === 0) return;
    const newSuspended: SuspendedSale = {
      id: Date.now().toString(),
      label: `Venta #${suspendedSales.length + 1} — ${cart.length} producto${cart.length !== 1 ? "s" : ""}`,
      cart: [...cart],
      customerId,
      customerSearch,
      paymentMethod,
      notes,
      suspendedAt: new Date(),
    };
    setSuspendedSales(prev => [...prev, newSuspended]);
    setCart([]);
    setCustomerId("none");
    setCustomerSearch("");
    setNotes("");
    setPendingQty(1);
    setBarcodeInput("");
    Toast.fire({ icon: "info", title: "Venta suspendida", text: `${newSuspended.label} guardada` });
  };

  const recoverSale = (id: string) => {
    const suspended = suspendedSales.find(s => s.id === id);
    if (!suspended) return;
    if (cart.length > 0) suspendSale();
    setCart(suspended.cart);
    setCustomerId(suspended.customerId);
    setCustomerSearch(suspended.customerSearch);
    setPaymentMethod(suspended.paymentMethod);
    setNotes(suspended.notes);
    setSuspendedSales(prev => prev.filter(s => s.id !== id));
    setShowSuspended(false);
    Toast.fire({ icon: "success", title: "Venta recuperada", text: suspended.label });
  };

  const discardSuspended = async (id: string) => {
    const result = await Swal.fire({
      title: "¿Descartar esta venta?",
      text: "Se eliminarán los productos del carrito en espera.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, descartar",
    });
    if (!result.isConfirmed) return;
    setSuspendedSales(prev => prev.filter(s => s.id !== id));
    Toast.fire({ icon: "info", title: "Venta descartada" });
  };

  // Kiosk mode: auto-focus barcode input when cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      const t = setTimeout(() => barcodeRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [cart.length]);

  // Escape key: clear search, pending qty and return focus to barcode scanner
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearch("");
        setBarcodeInput("");
        setPendingQty(1);
        barcodeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const handleBarcodeScan = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed || !products) return;
    const product = products.find(
      p => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
    );
    if (!product) {
      Toast.fire({ icon: "error", title: "Código no encontrado", text: `Barcode: ${trimmed}` });
      return;
    }
    const qty = pendingQty;
    setPendingQty(1);
    addToCart(product, qty);
    Toast.fire({ icon: "success", title: `✓ ${product.name}`, text: qty > 1 ? `${qty} unidades añadidas` : "Añadido al carrito" });
  }, [products, pendingQty]);

  const processSale = async () => {
    if (cart.length === 0) return;
    const cartSnapshot = [...cart];
    const customerIdSnapshot = customerId;
    const paymentMethodSnapshot = paymentMethod;
    const loyaltyDiscountSnapshot = loyaltyDiscount;
    const pointsToRedeemSnapshot = pointsToRedeem;
    const cashReceivedSnapshot = cashReceived;

    // If redeeming points, deduct them first
    if (pointsToRedeemSnapshot > 0 && customerIdSnapshot !== "none") {
      setRedeemingPoints(true);
      try {
        await apiFetch("/api/loyalty/redeem", {
          method: "POST",
          body: JSON.stringify({ customerId: parseInt(customerIdSnapshot), pointsToRedeem: pointsToRedeemSnapshot }),
        });
      } catch (err: any) {
        setRedeemingPoints(false);
        Swal.fire({ icon: "error", title: "Error al canjear puntos", text: err.message, confirmButtonColor: "#4F46E5" });
        return;
      }
      setRedeemingPoints(false);
    }

    const notesWithPoints = loyaltyDiscountSnapshot > 0
      ? [notes, `Descuento por puntos: ${formatCurrency(loyaltyDiscountSnapshot, currencySymbol)} (${pointsToRedeemSnapshot} pts)`].filter(Boolean).join(" | ")
      : (notes || null);

    createSale.mutate({
      data: {
        customerId: customerIdSnapshot === "none" ? null : parseInt(customerIdSnapshot),
        paymentMethod: paymentMethodSnapshot,
        notes: notesWithPoints,
        items: cartSnapshot.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
      },
    }, {
      onSuccess: (sale) => {
        const saleForModal: CompletedSaleForModal = {
          id: sale.id,
          customerName: selectedCustomer?.name ?? null,
          userName: null,
          subtotal: sale.subtotal,
          iva: sale.iva,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          status: sale.status,
          notes: notesWithPoints,
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
        setCashReceived("");
        setPointsToRedeem(0);
        if (paymentMethodSnapshot === "Efectivo" && cashReceivedSnapshot) {
          const change = parseFloat(cashReceivedSnapshot) - sale.total;
          if (change > 0) {
            Toast.fire({ icon: "success", title: "Cambio a entregar", text: formatCurrency(change, currencySymbol), timer: 4000 });
          }
        }
        // Show loyalty earned notification
        if ((sale as any).pointsEarned > 0) {
          Toast.fire({ icon: "success", title: `+${(sale as any).pointsEarned} puntos acumulados`, timer: 3000 });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loyalty/balance", parseInt(customerIdSnapshot)] });
        queryClient.invalidateQueries({ queryKey: ["/api/loyalty/leaderboard"] });
      },
      onError: (err: any) => {
        Swal.fire({ icon: "error", title: "Error al procesar venta", text: err.message, confirmButtonColor: "#4F46E5" });
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
              ref={searchRef}
              placeholder="Buscar producto por nombre o código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-border shadow-sm rounded-xl"
            />
          </div>
          {/* Barcode scanner input */}
          <div className="relative w-52 shrink-0">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none z-10" />
            {pendingQty > 1 && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-md z-10 pointer-events-none">
                ×{pendingQty}
              </span>
            )}
            <Input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={e => {
                const val = e.target.value;
                // Detect quantity shortcut: e.g. "3*" or "5×"
                const match = val.match(/^(\d+)[*×]$/);
                if (match) {
                  const qty = Math.min(parseInt(match[1], 10), 999);
                  if (qty >= 1) {
                    setPendingQty(qty);
                    setBarcodeInput("");
                    Toast.fire({ icon: "info", title: `Cantidad: ×${qty}`, text: "Escanea el producto ahora" });
                    return;
                  }
                }
                setBarcodeInput(val);
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  handleBarcodeScan(barcodeInput);
                  setBarcodeInput("");
                } else if (e.key.length === 1 && /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]/u.test(e.key) && !barcodeInput) {
                  // Letter key with empty scanner → redirect to search box
                  e.preventDefault();
                  setSearch(e.key);
                  searchRef.current?.focus();
                }
              }}
              placeholder={pendingQty > 1 ? `×${pendingQty} — Escanear...` : "Escanear código..."}
              className={`pl-9 h-11 bg-white shadow-sm rounded-xl text-sm ${pendingQty > 1 ? "border-primary border-2 pr-10" : "border-primary/30 focus:border-primary"}`}
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
            <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cart.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Suspended sales toggle */}
            {suspendedSales.length > 0 && (
              <button
                onClick={() => setShowSuspended(v => !v)}
                className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-all ${
                  showSuspended
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100"
                }`}
                title="Ver ventas suspendidas"
              >
                <Clock className="w-3 h-3" />
                {suspendedSales.length}
              </button>
            )}
            {/* Suspend current cart */}
            {cart.length > 0 && (
              <button
                onClick={suspendSale}
                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-all"
                title="Suspender venta"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Pausar
              </button>
            )}
          </div>
        </div>

        {/* Suspended sales panel */}
        {showSuspended && suspendedSales.length > 0 && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Ventas en espera
            </p>
            {suspendedSales.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-amber-200 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.suspendedAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    {s.customerId !== "none" ? " · con cliente" : ""}
                  </p>
                </div>
                <button
                  onClick={() => recoverSale(s.id)}
                  className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-lg transition-colors shrink-0"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Recuperar
                </button>
                <button
                  onClick={() => discardSuspended(s.id)}
                  className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive rounded-lg transition-colors shrink-0"
                  title="Descartar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

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
              {cart.map(item => {
                const lineBase = item.quantity * item.unitPrice;
                const lineFinal = lineBase * (1 - item.discount / 100);
                return (
                <div key={item.productId} className={`p-2.5 rounded-xl border transition-all ${item.discount > 0 ? "bg-green-50 border-green-200" : "bg-muted/30 border-border/50"}`}>
                  <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold leading-tight line-clamp-1">{item.productName}</p>
                        {item.discount > 0 && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-600 text-white">
                            -{Math.round(item.discount)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.discount > 0 ? (
                          <>
                            <span className="text-[10px] text-muted-foreground line-through">{formatCurrency(item.unitPrice, currencySymbol)}</span>
                            <span className="text-[10px] font-semibold text-green-700">{formatCurrency(item.unitPrice * (1 - item.discount / 100), currencySymbol)} c/u</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{formatCurrency(item.unitPrice, currencySymbol)} c/u</span>
                        )}
                      </div>
                    </div>
                    {/* Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Discount button */}
                      <button
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors border ${item.discount > 0 ? "bg-green-600 border-green-600 text-white" : "border-border hover:bg-green-50 hover:border-green-400 hover:text-green-700 text-muted-foreground"}`}
                        onClick={() => applyDiscount(item.productId, item.productName, item.unitPrice)}
                        title="Aplicar descuento"
                      >
                        <Tag className="w-3 h-3" />
                      </button>
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
                        className="w-6 h-6 ml-0.5 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {/* Line total */}
                  <div className="flex justify-end mt-1.5">
                    <span className="text-[11px] font-bold text-foreground">{formatCurrency(lineFinal, currencySymbol)}</span>
                  </div>
                </div>
                );
              })}
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
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{selectedCustomer.name}</p>
                    {loyaltyBalance?.loyaltyEnabled ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <TierBadge tier={loyaltyBalance.tier} size="xs" />
                        <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> {loyaltyBalance.points.toLocaleString("es")} pts
                        </p>
                        {loyaltyBalance.tierMultiplier > 1 && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5 text-yellow-500" />×{loyaltyBalance.tierMultiplier}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground truncate">{(selectedCustomer as any).email || ""}</p>
                    )}
                  </div>
                  <button
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => { setCustomerId("none"); setCustomerSearch(""); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Loyalty redemption panel */}
                {loyaltyBalance?.loyaltyEnabled && loyaltyBalance.points > 0 && cart.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Canjear puntos
                      </p>
                      {pointsToRedeem > 0 && (
                        <button onClick={() => setPointsToRedeem(0)} className="text-[10px] text-amber-600 hover:text-amber-800 underline">
                          Quitar
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {[100, 200, 500].filter(v => v <= loyaltyBalance.points).map(pts => {
                        const disc = +(pts * loyaltyBalance.redemptionRate).toFixed(2);
                        return (
                          <button
                            key={pts}
                            onClick={() => setPointsToRedeem(pointsToRedeem === pts ? 0 : pts)}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all flex-1 ${
                              pointsToRedeem === pts
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white text-amber-700 border-amber-300 hover:bg-amber-100"
                            }`}
                          >
                            {pts}pts<br /><span className="text-[9px] font-normal">-{formatCurrency(disc, currencySymbol)}</span>
                          </button>
                        );
                      })}
                      {loyaltyBalance.points >= 1000 && (
                        <button
                          onClick={() => setPointsToRedeem(pointsToRedeem === loyaltyBalance.points ? 0 : loyaltyBalance.points)}
                          className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all flex-1 ${
                            pointsToRedeem === loyaltyBalance.points
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-white text-amber-700 border-amber-300 hover:bg-amber-100"
                          }`}
                        >
                          Todo<br /><span className="text-[9px] font-normal">-{formatCurrency(loyaltyBalance.discountValue, currencySymbol)}</span>
                        </button>
                      )}
                    </div>
                    {pointsToRedeem > 0 && (
                      <p className="text-[11px] font-semibold text-amber-800 text-center bg-amber-100 rounded-lg py-1">
                        Descuento: -{formatCurrency(loyaltyDiscount, currencySymbol)} ({pointsToRedeem} pts)
                      </p>
                    )}
                  </div>
                )}
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

          {/* Cash received calculator — only for Efectivo */}
          {paymentMethod === "Efectivo" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5" /> Efectivo recibido
              </label>
              <div className="flex flex-wrap gap-1.5">
                {total > 0 && (() => {
                  const ceil5 = Math.ceil(total / 5) * 5;
                  return [...new Set([ceil5, ceil5 + 5, ceil5 + 10, ceil5 + 20, ceil5 + 50])]
                    .filter(v => v >= total)
                    .slice(0, 5)
                    .map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCashReceived(amount.toFixed(2))}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                      >
                        {formatCurrency(amount, currencySymbol)}
                      </button>
                    ));
                })()}
              </div>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder={total > 0 ? `Mín. ${formatCurrency(total, currencySymbol)}` : "0.00"}
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                className="h-9 text-sm rounded-xl"
              />
              {cashReceived !== "" && (
                <div className={`flex justify-between items-center px-3 py-2 rounded-xl ${
                  parseFloat(cashReceived) >= total
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}>
                  <span className={`text-xs font-medium ${parseFloat(cashReceived) >= total ? "text-green-700" : "text-red-600"}`}>
                    {parseFloat(cashReceived) >= total ? "Cambio" : "Faltan"}
                  </span>
                  <span className={`text-base font-bold ${parseFloat(cashReceived) >= total ? "text-green-700" : "text-red-600"}`}>
                    {parseFloat(cashReceived) >= total
                      ? formatCurrency(parseFloat(cashReceived) - total, currencySymbol)
                      : formatCurrency(total - parseFloat(cashReceived), currencySymbol)
                    }
                  </span>
                </div>
              )}
            </div>
          )}

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
              <span>Subtotal bruto</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal + totalDiscount, currencySymbol)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-xs text-green-700">
                <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> Descuentos</span>
                <span className="font-semibold">-{formatCurrency(totalDiscount, currencySymbol)}</span>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-xs text-amber-700">
                <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Puntos ({pointsToRedeem} pts)</span>
                <span className="font-semibold">-{formatCurrency(loyaltyDiscount, currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal neto</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal - loyaltyDiscount, currencySymbol)}</span>
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
            disabled={cart.length === 0 || createSale.isPending || (paymentMethod === "Efectivo" && cashReceived !== "" && parseFloat(cashReceived) < total)}
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
