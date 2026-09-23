import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useGetProducts, useGetCustomers, useCreateSale, useGetCategories, useGetPaymentMethods, useGetBusinessSettings, useCreateCustomer } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, Minus, Trash2, ShoppingCart, Package, User, UserPlus, CreditCard, CheckCircle2, ScanLine, PauseCircle, PlayCircle, Clock, Percent, Tag, Banknote, Star, Gift, Zap, Ticket, X } from "lucide-react";
import { TierBadge } from "@/pages/loyalty";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { BoletaModal } from "@/components/boleta-modal";
import { emailBoleta } from "@/lib/generate-boleta";
import { Toast, Swal } from "@/lib/swal";
import { getToken } from "@/lib/auth";

const API_URL = (import.meta.env.VITE_API_URL || `${window.location.origin}/api`).replace(/\/$/, "");
async function apiFetch(path: string, opts: RequestInit = {}) {
  const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_URL}${normalizedPath}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers ?? {}) },
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).message ?? "Error"); }
  return res.json();
}

function isCash(m?: string | null) {
  const lower = (m || "").toLowerCase();
  return lower === "efectivo" || lower.includes("efectivo");
}

function ProductThumbnail({ src, alt, className = "w-full h-full object-cover" }: { src?: string | null; alt: string; className?: string }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <Package className="w-8 h-8 text-muted-foreground/30" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
    />
  );
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
  customerNitCi?: string | null;
  customerPhone?: string | null;
  userName?: string | null;
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number | null;
  changeDue?: number | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  details: { id: number; productName: string; quantity: number; unitPrice: number; subtotal: number }[];
  pointsEarned?: number | null;
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
  const [couponInput, setCouponInput] = useState("");
  const [validatedCoupon, setValidatedCoupon] = useState<{
    id: number; code: string; customerId: number; customerName: string;
    discountPercent: number; tier: string; expiresAt: string;
  } | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
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
  const createCustomer = useCreateCustomer();

  const [registerCustomerOpen, setRegisterCustomerOpen] = useState(false);
  const [newClientCiNit, setNewClientCiNit] = useState("");
  const [newClientApellidos, setNewClientApellidos] = useState("");
  const [newClientNombres, setNewClientNombres] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const openRegisterCustomerModal = (initialNitCi = "") => {
    setNewClientCiNit(initialNitCi || customerSearch.trim());
    setNewClientApellidos("");
    setNewClientNombres("");
    setNewClientPhone("");
    setShowCustomerDropdown(false);
    setRegisterCustomerOpen(true);
  };

  const handleRegisterCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const apellidos = newClientApellidos.trim();
    const nombres = newClientNombres.trim();
    const fullName = [nombres, apellidos].filter(Boolean).join(" ");

    if (!fullName) {
      Toast.fire({ icon: "error", title: "Datos incompletos", text: "Ingresa el nombre o apellido del cliente" });
      return;
    }

    setIsRegisteringCustomer(true);
    createCustomer.mutate({
      data: {
        name: fullName,
        nitCi: newClientCiNit.trim() || null,
        phone: newClientPhone.trim() || null,
      }
    }, {
      onSuccess: (newCust) => {
        setIsRegisteringCustomer(false);
        setRegisterCustomerOpen(false);
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
        setCustomerId(String(newCust.id));
        setCustomerSearch("");
        Toast.fire({
          icon: "success",
          title: "Cliente registrado",
          text: `${newCust.name} ha sido registrado y seleccionado para esta venta.`
        });
      },
      onError: (err: any) => {
        setIsRegisteringCustomer(false);
        Toast.fire({
          icon: "error",
          title: "Error al registrar",
          text: err?.message || "No se pudo registrar al cliente"
        });
      }
    });
  };

  // Loyalty balance for selected customer
  const customerIdNum = customerId !== "none" ? parseInt(customerId) : null;
  const { data: loyaltyBalance, refetch: refetchBalance, isLoading: loyaltyLoading } = useQuery<{
    points: number; discountValue: number; redemptionRate: number; pointsPerUnit: number; loyaltyEnabled: boolean;
    tier: string; tierLabel: string; tierMultiplier: number; tierColor: string;
    nextTier: { name: string; label: string; min: number } | null;
    progressToNext: number; pointsToNext: number;
  }>({
    queryKey: ["/api/loyalty/balance", customerIdNum],
    queryFn: () => apiFetch(`/api/loyalty/balance/${customerIdNum}`),
    enabled: customerIdNum !== null,
  });

  // Reset points and coupon when customer changes
  useEffect(() => {
    setPointsToRedeem(0);
    setValidatedCoupon(null);
    setCouponInput("");
  }, [customerId]);

  const activePaymentMethods = useMemo(() => {
    if (!paymentMethods || paymentMethods.length === 0) return ["Efectivo", "Tarjeta", "Transferencia"];
    return paymentMethods.filter(m => m.isActive).map(m => m.name);
  }, [paymentMethods]);

  useEffect(() => {
    if (activePaymentMethods.length > 0 && !activePaymentMethods.includes(paymentMethod)) {
      setPaymentMethod(activePaymentMethods[0]);
    }
  }, [activePaymentMethods, paymentMethod]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers || [];
    const q = customerSearch.toLowerCase().trim();
    return (customers || []).filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.nitCi && c.nitCi.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      ((c as any).email && (c as any).email.toLowerCase().includes(q))
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
    const calculated = +(pointsToRedeem * loyaltyBalance.redemptionRate).toFixed(2);
    return Math.min(calculated, subtotal);
  }, [pointsToRedeem, loyaltyBalance, subtotal]);

  const availableLoyaltyPoints = useMemo(() => {
    if (!loyaltyBalance) return 0;
    return Math.max(0, loyaltyBalance.points - pointsToRedeem);
  }, [loyaltyBalance, pointsToRedeem]);

  const availableLoyaltyDiscount = useMemo(() => {
    if (!loyaltyBalance) return 0;
    return Math.max(0, +(availableLoyaltyPoints * loyaltyBalance.redemptionRate).toFixed(2));
  }, [loyaltyBalance, availableLoyaltyPoints]);
  const couponDiscount = useMemo(() => {
    if (!validatedCoupon) return 0;
    const base = subtotal - loyaltyDiscount;
    return +(base * validatedCoupon.discountPercent / 100).toFixed(2);
  }, [validatedCoupon, subtotal, loyaltyDiscount]);
  const netSubtotal = Math.max(0, subtotal - loyaltyDiscount - couponDiscount);
  const iva = 0;
  const total = Math.max(0, +netSubtotal.toFixed(2));

  const handleRedeemCustomerDiscount = () => {
    if (!loyaltyBalance || loyaltyBalance.points <= 0) {
      Toast.fire({ icon: "info", title: "Sin puntos", text: "El cliente no tiene puntos acumulados para canjear." });
      return;
    }
    if (cart.length === 0) {
      Toast.fire({ icon: "warning", title: "Carrito vacío", text: "Agrega productos a la venta para aplicar el descuento del cliente." });
      return;
    }

    const rate = loyaltyBalance.redemptionRate || 0.01;
    const maxPointsNeeded = Math.ceil(subtotal / rate);
    const pointsToApply = Math.min(loyaltyBalance.points, maxPointsNeeded);
    const discountAmount = Math.min(+(pointsToApply * rate).toFixed(2), subtotal);

    setPointsToRedeem(pointsToApply);
    Toast.fire({
      icon: "success",
      title: "Descuento aplicado",
      text: `Se ha descontado ${formatCurrency(discountAmount, currencySymbol)} (${pointsToApply} puntos) del total a pagar.`
    });
  };

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
    const selectedCustomerSnapshot = selectedCustomer;
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

    const couponSnapshot = validatedCoupon;
    const couponDiscountSnapshot = couponDiscount;

    const notesParts = [
      notes || null,
      loyaltyDiscountSnapshot > 0 ? `Desc. puntos: ${formatCurrency(loyaltyDiscountSnapshot, currencySymbol)} (${pointsToRedeemSnapshot} pts)` : null,
      couponSnapshot ? `Cupón ${couponSnapshot.code}: -${couponSnapshot.discountPercent}%` : null,
    ].filter(Boolean);
    const notesWithPoints = notesParts.length > 0 ? notesParts.join(" | ") : null;

    const totalDiscountToApply = +(loyaltyDiscountSnapshot + couponDiscountSnapshot).toFixed(2);

    const parsedCashReceived = isCash(paymentMethodSnapshot)
      ? (cashReceivedSnapshot ? parseFloat(cashReceivedSnapshot) : total)
      : null;
    const computedChange = parsedCashReceived !== null && parsedCashReceived >= total
      ? +(parsedCashReceived - total).toFixed(2)
      : (isCash(paymentMethodSnapshot) ? 0 : null);

    createSale.mutate({
      data: {
        customerId: customerIdSnapshot === "none" ? null : parseInt(customerIdSnapshot),
        paymentMethod: paymentMethodSnapshot,
        amountPaid: parsedCashReceived,
        changeDue: computedChange,
        notes: notesWithPoints,
        discount: totalDiscountToApply,
        items: cartSnapshot.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: +(i.unitPrice * (1 - (i.discount || 0) / 100)).toFixed(2),
        })),
      } as any,
    }, {
      onSuccess: async (sale) => {
        const earned = (sale as any).pointsEarned ?? (
          selectedCustomerSnapshot && (sale as any).pointsEarned !== 0
            ? Math.round(sale.total * Number(settings?.pointsPerUnit ?? 1))
            : 0
        );
        const saleForModal: CompletedSaleForModal = {
          id: sale.id,
          customerName: selectedCustomerSnapshot?.name ?? (sale as any).customerName ?? null,
          customerNitCi: selectedCustomerSnapshot?.nitCi ?? (sale as any).customerNitCi ?? null,
          customerPhone: selectedCustomerSnapshot?.phone ?? (sale as any).customerPhone ?? null,
          userName: null,
          subtotal: sale.subtotal,
          iva: sale.iva,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          amountPaid: sale.amountPaid !== undefined && sale.amountPaid !== null ? Number(sale.amountPaid) : parsedCashReceived,
          changeDue: sale.changeDue !== undefined && sale.changeDue !== null ? Number(sale.changeDue) : computedChange,
          status: sale.status,
          notes: notesWithPoints,
          createdAt: sale.createdAt,
          pointsEarned: earned,
          details: cartSnapshot.map((item, idx) => ({
            id: idx + 1,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice,
          })),
        };
        setCompletedSale(saleForModal);
        // Abrir el cajón de dinero (conectado a la impresora térmica) al confirmar la venta.
        apiFetch("/api/hardware/open-drawer", {
          method: "POST",
          body: JSON.stringify({ paymentMethod: paymentMethodSnapshot }),
        }).catch(() => {});
        if (selectedCustomerSnapshot?.email && settings) {
          emailBoleta(saleForModal, settings, API_URL, getToken())
            .then(() => Toast.fire({ icon: "success", title: "Boleta enviada al correo del cliente" }))
            .catch((err: Error) => Toast.fire({ icon: "warning", title: "Venta registrada", text: err.message }));
        }
        // Redeem coupon if one was applied
        if (couponSnapshot) {
          apiFetch("/api/coupons/redeem", {
            method: "POST",
            body: JSON.stringify({ code: couponSnapshot.code, saleId: sale.id }),
          }).catch(() => {});
        }
        setCart([]);
        setCustomerId("none");
        setCustomerSearch("");
        setNotes("");
        setCashReceived("");
        setPointsToRedeem(0);
        setValidatedCoupon(null);
        setCouponInput("");
        if (isCash(paymentMethodSnapshot) && cashReceivedSnapshot) {
          const change = parseFloat(cashReceivedSnapshot) - sale.total;
          if (change > 0) {
            Toast.fire({ icon: "success", title: "Cambio a entregar", text: formatCurrency(change, currencySymbol), timer: 4000 });
          }
        }
        // Show loyalty earned notification
        if ((sale as any).pointsEarned > 0) {
          Toast.fire({ icon: "success", title: `+${(sale as any).pointsEarned} puntos acumulados`, timer: 3000 });
        } else if (pointsToRedeemSnapshot > 0 && customerIdSnapshot !== "none") {
          Toast.fire({
            icon: "info",
            title: "Puntos en cero",
            text: "El cliente canjeó todos sus descuentos: nivel reiniciado a Bronce. En su próxima compra sin canje volverá a acumular puntos.",
            timer: 4000,
          });
        }
        if (couponSnapshot) {
          Toast.fire({ icon: "success", title: `Cupón ${couponSnapshot.code} canjeado`, text: `-${couponSnapshot.discountPercent}%`, timer: 3000 });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        queryClient.invalidateQueries({ queryKey: ["/api/loyalty"] });
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
                      <ProductThumbnail src={product.imageUrl} alt={product.name} />
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
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Cliente
              </label>
              {!selectedCustomer && (
                <button
                  type="button"
                  onClick={() => openRegisterCustomerModal(customerSearch)}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3" /> Registrar cliente
                </button>
              )}
            </div>
            {selectedCustomer ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-foreground">{selectedCustomer.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                      {selectedCustomer.nitCi ? (
                        <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.2 rounded font-semibold">
                          CI/NIT: {selectedCustomer.nitCi}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">Sin CI/NIT</span>
                      )}
                      {selectedCustomer.phone && <span>· Tel: {selectedCustomer.phone}</span>}
                    </div>
                    {loyaltyBalance ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <TierBadge tier={loyaltyBalance.tier} size="xs" />
                        <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5" /> {availableLoyaltyPoints.toLocaleString("es")} pts
                          {pointsToRedeem > 0 && (
                            <span className="text-[9px] text-emerald-700 font-medium ml-1">({pointsToRedeem.toLocaleString("es")} canjeados)</span>
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    title="Quitar cliente / Seleccionar otro"
                    className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/10 transition-colors"
                    onClick={() => { setCustomerId("none"); setCustomerSearch(""); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Loyalty & Discount Panel */}
                {loyaltyLoading ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Consultando puntos del cliente...</span>
                  </div>
                ) : loyaltyBalance ? (
                  <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50/90 via-amber-50/40 to-yellow-50/60 p-3 space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-700 shrink-0">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-600" />
                        </div>
                        <span className="text-xs font-bold text-amber-950">Puntos y Descuento del Cliente</span>
                      </div>
                      <TierBadge tier={loyaltyBalance.tier} size="xs" />
                    </div>

                    {/* Available Points and Available Discount Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-lg p-2 border shadow-2xs text-center transition-all ${
                        pointsToRedeem > 0 && availableLoyaltyPoints === 0
                          ? "bg-amber-50/70 border-amber-300"
                          : "bg-white/95 border-amber-200/80"
                      }`}>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                          Puntos Disponibles
                        </span>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <Star className={`w-3.5 h-3.5 shrink-0 ${availableLoyaltyPoints > 0 ? "text-amber-500 fill-amber-400" : "text-slate-400"}`} />
                          <span className={`text-sm font-bold ${availableLoyaltyPoints > 0 ? "text-amber-800" : "text-slate-600"}`}>
                            {availableLoyaltyPoints.toLocaleString("es")}
                          </span>
                          <span className="text-[10px] text-amber-700 font-medium">pts</span>
                        </div>
                        {pointsToRedeem > 0 ? (
                          <span className="text-[9px] text-emerald-700 font-medium block mt-0.5">
                            (-{pointsToRedeem.toLocaleString("es")} canjeados)
                          </span>
                        ) : null}
                      </div>

                      <div className={`rounded-lg p-2 border shadow-2xs text-center transition-all ${
                        pointsToRedeem > 0 && availableLoyaltyDiscount === 0
                          ? "bg-emerald-50/70 border-emerald-300"
                          : "bg-white/95 border-emerald-200/80"
                      }`}>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                          Desc. Disponible
                        </span>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <Gift className={`w-3.5 h-3.5 shrink-0 ${availableLoyaltyDiscount > 0 ? "text-emerald-600" : "text-slate-400"}`} />
                          <span className={`text-sm font-bold ${availableLoyaltyDiscount > 0 ? "text-emerald-700" : "text-slate-600"}`}>
                            {formatCurrency(availableLoyaltyDiscount, currencySymbol)}
                          </span>
                        </div>
                        {pointsToRedeem > 0 ? (
                          <span className="text-[9px] text-emerald-700 font-medium block mt-0.5">
                            (-{formatCurrency(loyaltyDiscount, currencySymbol)} canjeado)
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-600 block mt-0.5">
                            Tasa: {formatCurrency(loyaltyBalance.redemptionRate, currencySymbol)} / pt
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Botón Principal: Canjear Descuento del Total a Pagar */}
                    {pointsToRedeem > 0 ? (
                      <div className="rounded-lg bg-emerald-100/90 border border-emerald-300 p-2 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-900 leading-tight">
                              Descuento canjeado: -{formatCurrency(loyaltyDiscount, currencySymbol)}
                            </p>
                            <p className="text-[10px] text-emerald-700">
                              Se descontaron {pointsToRedeem.toLocaleString("es")} puntos del total a pagar · Disponibles: {availableLoyaltyPoints.toLocaleString("es")} pts
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPointsToRedeem(0);
                            Toast.fire({ icon: "info", title: "Descuento cancelado", text: "Se restauró el total a pagar sin descuento." });
                          }}
                          className="px-2 py-1 rounded bg-white hover:bg-destructive/10 text-destructive text-[10px] font-bold border border-destructive/20 transition-colors shrink-0"
                        >
                          Quitar canje
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={loyaltyBalance.points <= 0 || cart.length === 0}
                        onClick={handleRedeemCustomerDiscount}
                        className="w-full h-9 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        {loyaltyBalance.points <= 0
                          ? "Sin puntos disponibles para canjear"
                          : cart.length === 0
                          ? `Canjear Descuento (${formatCurrency(loyaltyBalance.discountValue, currencySymbol)}) - Agrega productos`
                          : `Canjear Descuento (${formatCurrency(Math.min(loyaltyBalance.discountValue, subtotal), currencySymbol)}) del Total a Pagar`}
                      </button>
                    )}

                    {/* Quick partial redemption options */}
                    {loyaltyBalance.points > 0 && cart.length > 0 && (
                      <div className="pt-1 border-t border-amber-200/60 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-amber-900 font-medium">
                          <span>Opciones de canje parcial:</span>
                          {pointsToRedeem > 0 && (
                            <button
                              type="button"
                              onClick={() => setPointsToRedeem(0)}
                              className="text-amber-700 hover:underline"
                            >
                              Restablecer
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[100, 200, 500].filter(v => v <= loyaltyBalance.points).map(pts => {
                            const disc = +(pts * loyaltyBalance.redemptionRate).toFixed(2);
                            const isSelected = pointsToRedeem === pts;
                            return (
                              <button
                                key={pts}
                                type="button"
                                onClick={() => setPointsToRedeem(isSelected ? 0 : pts)}
                                className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all flex-1 ${
                                  isSelected
                                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                    : "bg-white text-amber-800 border-amber-300 hover:bg-amber-100/70"
                                }`}
                              >
                                {pts} pts<br /><span className={`text-[9px] font-normal ${isSelected ? "text-white/90" : "text-amber-700"}`}>-{formatCurrency(disc, currencySymbol)}</span>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              const rate = Number(loyaltyBalance.redemptionRate || 0.01);
                              const maxPointsNeeded = Math.ceil(subtotal / rate);
                              const ptsToUse = Math.min(loyaltyBalance.points, maxPointsNeeded);
                              setPointsToRedeem(pointsToRedeem === ptsToUse ? 0 : ptsToUse);
                            }}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all flex-1 ${
                              pointsToRedeem > 0 && pointsToRedeem === Math.min(loyaltyBalance.points, Math.ceil(subtotal / (Number(loyaltyBalance.redemptionRate) || 0.01)))
                                ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                : "bg-white text-amber-800 border-amber-300 hover:bg-amber-100/70"
                            }`}
                          >
                            Todo<br />
                            <span className="text-[9px] font-normal">
                              -{formatCurrency(Math.min(loyaltyBalance.discountValue, subtotal), currencySymbol)}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}

              </div>
            ) : (
              <div className="space-y-1.5 relative" ref={customerDropdownRef}>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Buscar por CI/NIT o nombre..."
                      className="pl-8 pr-7 h-9 text-xs rounded-xl"
                    />
                    {customerSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearch("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openRegisterCustomerModal(customerSearch)}
                    className="h-9 px-2.5 text-xs rounded-xl gap-1 shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-medium"
                    title="Registrar nuevo cliente"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Nuevo</span>
                  </Button>
                </div>

                {/* Dropdown panel */}
                {showCustomerDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-popover text-popover-foreground rounded-xl border border-border shadow-2xl z-50 overflow-hidden divide-y divide-border">
                    <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                      {/* Option: Consumidor Final */}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId("none");
                          setShowCustomerDropdown(false);
                          setCustomerSearch("");
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-accent transition-colors ${
                          customerId === "none" ? "bg-accent/60 font-semibold" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold">
                            CF
                          </div>
                          <span>Consumidor Final</span>
                        </div>
                        {customerId === "none" && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      </button>

                      {/* Filtered customer list */}
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCustomerId(c.id.toString());
                              setShowCustomerDropdown(false);
                              setCustomerSearch("");
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-accent transition-colors group flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate text-foreground group-hover:text-primary">
                                {c.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                                {c.nitCi ? (
                                  <span className="font-mono bg-muted px-1.5 py-0.2 rounded font-medium text-foreground">
                                    CI/NIT: {c.nitCi}
                                  </span>
                                ) : (
                                  <span>Sin CI/NIT</span>
                                )}
                                {c.phone && <span>· Tel: {c.phone}</span>}
                              </div>
                            </div>
                            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 font-medium shrink-0 pt-0.5">
                              Seleccionar
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center space-y-2">
                          <p className="text-xs text-muted-foreground">
                            No se encontró cliente con CI/NIT o nombre: <strong className="text-foreground">"{customerSearch}"</strong>
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openRegisterCustomerModal(customerSearch)}
                            className="w-full text-xs rounded-lg gap-1.5 h-8 font-semibold shadow-sm"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Registrar "{customerSearch}" como cliente
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Footer: always offer Registrar cliente if results exist */}
                    {filteredCustomers.length > 0 && (
                      <div className="p-1 bg-muted/20">
                        <button
                          type="button"
                          onClick={() => openRegisterCustomerModal(customerSearch)}
                          className="w-full py-1.5 px-2.5 text-xs text-primary font-semibold hover:bg-primary/10 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" /> + Registrar cliente nuevo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
          {isCash(paymentMethod) && (
            <div className="space-y-2 p-3 bg-primary/5 rounded-2xl border border-primary/20">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-primary" /> Cobro en Efectivo
                </label>
                <span className="text-[10px] font-medium text-muted-foreground">
                  Total: <strong className="text-foreground">{formatCurrency(total, currencySymbol)}</strong>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {total > 0 && (() => {
                  const ceil5 = Math.ceil(total / 5) * 5;
                  return [...new Set([ceil5, ceil5 + 5, ceil5 + 10, ceil5 + 20, ceil5 + 50, ceil5 + 100])]
                    .filter(v => v >= total)
                    .slice(0, 5)
                    .map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCashReceived(amount.toFixed(2))}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors"
                      >
                        {formatCurrency(amount, currencySymbol)}
                      </button>
                    ));
                })()}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder={total > 0 ? `Ingresa monto recibido (mín. ${formatCurrency(total, currencySymbol)})` : "0.00"}
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  className="pl-8 h-10 text-sm font-semibold rounded-xl bg-white"
                />
              </div>
              {cashReceived !== "" && (
                <div className="space-y-1.5 pt-1">
                  <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                    parseFloat(cashReceived) >= total
                      ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                      : "bg-red-50 border-red-200 text-red-900"
                  }`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Monto recibido:</span>
                      <span className="font-semibold">{formatCurrency(parseFloat(cashReceived) || 0, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total a pagar:</span>
                      <span className="font-semibold">{formatCurrency(total, currencySymbol)}</span>
                    </div>
                    <div className="border-t border-current/10 pt-1.5 flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {parseFloat(cashReceived) >= total ? "Monto a devolver (Cambio):" : "Falta por pagar:"}
                      </span>
                      <span className="text-base font-extrabold">
                        {parseFloat(cashReceived) >= total
                          ? formatCurrency(parseFloat(cashReceived) - total, currencySymbol)
                          : formatCurrency(total - parseFloat(cashReceived), currencySymbol)
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
            {couponDiscount > 0 && validatedCoupon && (
              <div className="flex justify-between text-xs text-violet-700">
                <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> Cupón {validatedCoupon.code} (-{validatedCoupon.discountPercent}%)</span>
                <span className="font-semibold">-{formatCurrency(couponDiscount, currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(subtotal - loyaltyDiscount - couponDiscount, currencySymbol)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-border/60">
              <span className="font-bold text-sm">TOTAL</span>
              <span className="font-bold text-xl text-primary">{formatCurrency(total, currencySymbol)}</span>
            </div>
          </div>

          {/* Pay button — Perfisoft pill style */}
          <button
            onClick={processSale}
            disabled={cart.length === 0 || createSale.isPending || (isCash(paymentMethod) && cashReceived !== "" && parseFloat(cashReceived) < total)}
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

      {/* Modal Registrar Nuevo Cliente */}
      <Dialog open={registerCustomerOpen} onOpenChange={setRegisterCustomerOpen}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-primary px-6 pt-6 pb-4 text-primary-foreground">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <UserPlus className="w-5 h-5 text-white" />
                Registrar Nuevo Cliente
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Ingresa los datos del cliente para registrarlo y seleccionarlo automáticamente en la venta actual.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleRegisterCustomer} className="p-6 space-y-4 bg-background">
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Teléfono / Celular
              </label>
              <Input
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                placeholder="Ej. 70123456"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Apellido(s) <span className="text-destructive">*</span>
                </label>
                <Input
                  value={newClientApellidos}
                  onChange={(e) => setNewClientApellidos(e.target.value)}
                  placeholder="Ej. Pérez Flores"
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Nombre(s) <span className="text-destructive">*</span>
                </label>
                <Input
                  value={newClientNombres}
                  onChange={(e) => setNewClientNombres(e.target.value)}
                  placeholder="Ej. Juan Carlos"
                  className="h-9 text-xs rounded-xl"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                CI o NIT <span className="text-primary text-[11px] font-normal">(Identificación tributaria o cédula)</span>
              </label>
              <Input
                value={newClientCiNit}
                onChange={(e) => setNewClientCiNit(e.target.value)}
                placeholder="Ej. 8492019"
                className="h-9 text-xs rounded-xl"
                autoFocus
              />
            </div>

            

            <DialogFooter className="pt-2 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterCustomerOpen(false)}
                className="rounded-full text-xs h-9 px-4"
                disabled={isRegisteringCustomer}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isRegisteringCustomer}
                className="rounded-full text-xs h-9 px-5 gap-1.5 font-semibold"
              >
                {isRegisteringCustomer ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    Registrar y Seleccionar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
