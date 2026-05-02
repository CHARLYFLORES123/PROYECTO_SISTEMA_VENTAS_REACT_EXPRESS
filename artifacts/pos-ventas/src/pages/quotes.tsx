import { useState, useMemo } from "react";
import {
  useGetProducts,
  useGetCustomers,
  useGetQuotes,
  useCreateQuote,
  useConvertQuoteToSale,
  getQuoteById,
} from "@workspace/api-client-react";
import { useGetBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  ArrowRight,
  Download,
  Printer,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Toast, Swal } from "@/lib/swal";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { format } from "date-fns";
import { downloadQuotePDF, printQuotePDF } from "@/lib/generate-quote";

interface CartItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

const STATUS_CONFIG = {
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    className: "border-amber-300 bg-amber-50 text-amber-700",
  },
  convertida: {
    label: "Convertida",
    icon: CheckCircle2,
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  },
  vencida: {
    label: "Vencida",
    icon: XCircle,
    className: "border-red-300 bg-red-50 text-red-600",
  },
} as const;

async function fetchAndPrint(
  quoteId: number,
  settings: any,
  mode: "print" | "download"
) {
  try {
    const quote = await getQuoteById(quoteId);
    if (mode === "download") {
      downloadQuotePDF(quote as any, settings);
    } else {
      printQuotePDF(quote as any, settings);
    }
  } catch {
    Toast.fire({ icon: "error", title: "Error al generar la cotización" });
  }
}

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<string>("none");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loadingQuoteId, setLoadingQuoteId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { currencySymbol } = useCurrency();
  const { data: settings } = useGetBusinessSettings();

  const { data: products } = useGetProducts({ search });
  const { data: customers } = useGetCustomers();
  const { data: quotes } = useGetQuotes();

  const createQuote = useCreateQuote();
  const convertToSale = useConvertQuoteToSale();

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0),
    [cart]
  );
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
        },
      ];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const processQuote = () => {
    if (cart.length === 0) return;
    createQuote.mutate(
      {
        data: {
          customerId: customerId === "none" ? null : parseInt(customerId),
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          validUntil: validUntil || undefined,
          notes: notes || undefined,
        } as any,
      },
      {
        onSuccess: (newQuote) => {
          Toast.fire({ icon: "success", title: "Proforma guardada exitosamente" });
          setCart([]);
          setCustomerId("none");
          setValidUntil("");
          setNotes("");
          queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });

          // Auto-offer to print the saved quote
          if (settings) {
            Swal.fire({
              title: "Proforma guardada",
              text: "¿Deseas imprimir o descargar la cotización ahora?",
              icon: "success",
              showDenyButton: true,
              showCancelButton: true,
              confirmButtonText: "🖨 Imprimir",
              denyButtonText: "⬇ Descargar PDF",
              cancelButtonText: "Ahora no",
              confirmButtonColor: "#4F46E5",
              denyButtonColor: "#f59e0b",
            }).then((result) => {
              if (result.isConfirmed) {
                fetchAndPrint(newQuote.id, settings, "print");
              } else if (result.isDenied) {
                fetchAndPrint(newQuote.id, settings, "download");
              }
            });
          }
        },
        onError: () => {
          Toast.fire({ icon: "error", title: "Error al guardar la proforma" });
        },
      }
    );
  };

  const handleConvertToSale = (quoteId: number) => {
    Swal.fire({
      title: "Convertir a Venta",
      text: "Esta acción reducirá el stock de los productos. ¿Confirmar?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, convertir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#4F46E5",
    }).then((result) => {
      if (!result.isConfirmed) return;
      convertToSale.mutate(
        { id: quoteId },
        {
          onSuccess: () => {
            Toast.fire({ icon: "success", title: "Proforma convertida a venta" });
            queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
          },
          onError: (err: any) => {
            Toast.fire({
              icon: "error",
              title: err?.response?.data?.message || "Error al convertir",
            });
          },
        }
      );
    });
  };

  const handlePrintOrDownload = async (
    quoteId: number,
    mode: "print" | "download"
  ) => {
    if (!settings) return;
    setLoadingQuoteId(quoteId);
    await fetchAndPrint(quoteId, settings, mode);
    setLoadingQuoteId(null);
  };

  return (
    <div className="space-y-6">
      {/* ── POS-style split layout ─────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row h-[65vh] gap-5">
        {/* Product catalog */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <ScrollArea className="flex-1 border rounded-xl bg-card p-3">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-3">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer transition-all hover:border-amber-400 hover:shadow-md"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3 flex flex-col gap-1">
                    <div className="font-semibold text-sm leading-tight line-clamp-2">
                      {product.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {product.barcode || "Sin código"}
                    </div>
                    <div className="font-bold text-amber-600 mt-1 text-sm">
                      {formatCurrency(product.salePrice, currencySymbol)}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {products?.length === 0 && (
                <div className="col-span-4 py-10 text-center text-sm text-muted-foreground">
                  Sin resultados para "{search}"
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Quote panel */}
        <div className="w-full lg:w-[390px] flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-amber-50">
            <h2 className="font-bold flex items-center gap-2 text-amber-700">
              <FileText className="w-4 h-4" />
              Nueva Cotización
            </h2>
          </div>

          {/* Cart items */}
          <ScrollArea className="flex-1 p-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-10">
                <FileText className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Agrega productos a la cotización</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex gap-2 p-2.5 border rounded-lg bg-background"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {item.productName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.unitPrice, currencySymbol)} c/u ·{" "}
                        <span className="font-semibold text-amber-600">
                          {formatCurrency(
                            item.unitPrice * item.quantity,
                            currencySymbol
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.productId, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.productId, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer with options */}
          <div className="p-4 border-t bg-muted/10 space-y-3">
            {/* Customer */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cliente
              </label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="rounded-lg text-sm h-8">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Consumidor Final</SelectItem>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valid Until */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Válido Hasta
              </label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="rounded-lg text-sm h-8"
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Observaciones
              </label>
              <Input
                placeholder="Condiciones, notas adicionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-lg text-sm h-8"
              />
            </div>

            {/* Totals */}
            <div className="pt-1 border-t space-y-0.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>IVA (13%)</span>
                <span>{formatCurrency(iva, currencySymbol)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>TOTAL</span>
                <span className="text-amber-600">
                  {formatCurrency(total, currencySymbol)}
                </span>
              </div>
            </div>

            <Button
              className="w-full rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white"
              disabled={cart.length === 0 || createQuote.isPending}
              onClick={processQuote}
            >
              {createQuote.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Guardar Cotización
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Saved Quotes Table ─────────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            Cotizaciones Guardadas
            {quotes && (
              <span className="text-xs text-muted-foreground font-normal">
                ({quotes.length})
              </span>
            )}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wide">N°</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Fecha</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Cliente</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Válido Hasta</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Estado</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Total</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No hay cotizaciones guardadas
                  </TableCell>
                </TableRow>
              )}
              {quotes?.map((q) => {
                const cfg =
                  STATUS_CONFIG[q.status as keyof typeof STATUS_CONFIG];
                const StatusIcon = cfg?.icon ?? Clock;
                const isLoading = loadingQuoteId === q.id;

                return (
                  <TableRow key={q.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-primary text-sm font-medium">
                      #{q.id.toString().padStart(6, "0")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(q.createdAt), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {q.customerName || (
                        <span className="text-muted-foreground italic">
                          Consumidor Final
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(q as any).validUntil
                        ? format(
                            new Date((q as any).validUntil),
                            "dd/MM/yyyy"
                          )
                        : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${cfg?.className ?? ""}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {cfg?.label ?? q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      {formatCurrency(q.total, currencySymbol)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print / Download dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg gap-1.5 h-7 px-2.5 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                              disabled={isLoading || !settings}
                            >
                              {isLoading ? (
                                <div className="w-3 h-3 border-2 border-amber-400/40 border-t-amber-600 rounded-full animate-spin" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                              Cotización
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() =>
                                handlePrintOrDownload(q.id, "print")
                              }
                              className="gap-2 text-sm"
                            >
                              <Printer className="w-4 h-4 text-primary" />
                              Imprimir PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handlePrintOrDownload(q.id, "download")
                              }
                              className="gap-2 text-sm"
                            >
                              <Download className="w-4 h-4 text-amber-600" />
                              Descargar PDF
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Convert to Sale */}
                        {q.status === "pendiente" && (
                          <Button
                            size="sm"
                            className="rounded-lg h-7 px-2.5 text-xs gap-1"
                            onClick={() => handleConvertToSale(q.id)}
                            disabled={convertToSale.isPending}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Convertir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
