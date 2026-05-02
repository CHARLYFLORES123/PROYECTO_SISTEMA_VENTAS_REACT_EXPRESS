import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useGetCustomers, useGetBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Download, Printer, User, ShoppingCart,
  TrendingUp, Calendar, Receipt, Search,
} from "lucide-react";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from "date-fns";
import { Toast } from "@/lib/swal";
import { downloadStatementPDF, printStatementPDF, type CustomerStatement, type StatementSale } from "@/lib/generate-statement";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function fetchCustomerSales(customerId: number): Promise<StatementSale[]> {
  const res = await fetch(`${BASE}/api/sales?customerId=${customerId}&limit=500`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("pos_token")}` },
  });
  if (!res.ok) throw new Error("Error al cargar ventas");
  const data = await res.json();
  return (data.sales ?? data).map((s: any) => ({
    id: s.id,
    createdAt: s.createdAt,
    paymentMethod: s.paymentMethod,
    status: s.status,
    subtotal: Number(s.subtotal),
    iva: Number(s.iva),
    total: Number(s.total),
  }));
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  completada: { label: "Completada", className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  cancelada: { label: "Cancelada", className: "border-red-300 bg-red-50 text-red-600" },
  pendiente: { label: "Pendiente", className: "border-amber-300 bg-amber-50 text-amber-700" },
};

const PERIOD_OPTIONS = [
  { label: "Todo el historial", value: "all" },
  { label: "Este mes", value: "this_month" },
  { label: "Mes anterior", value: "last_month" },
  { label: "Últimos 3 meses", value: "3months" },
  { label: "Últimos 6 meses", value: "6months" },
  { label: "Este año", value: "this_year" },
];

export default function CustomerStatement() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const customerId = Number(id);

  const { currencySymbol } = useCurrency();
  const { data: settings } = useGetBusinessSettings();
  const { data: customers } = useGetCustomers();

  const [sales, setSales] = useState<StatementSale[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const customer = customers?.find((c) => c.id === customerId);

  // Load sales on first render
  const loadSales = async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const data = await fetchCustomerSales(customerId);
      setSales(data);
      setLoaded(true);
    } catch {
      Toast.fire({ icon: "error", title: "Error al cargar historial de compras" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load
  useMemo(() => {
    if (!loaded && !loading) loadSales();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // Filter by period
  const filteredSales = useMemo(() => {
    if (!sales) return [];
    const now = new Date();
    let filtered = [...sales];

    if (period === "this_month") {
      filtered = filtered.filter((s) => isWithinInterval(parseISO(s.createdAt), { start: startOfMonth(now), end: endOfMonth(now) }));
    } else if (period === "last_month") {
      const lm = subMonths(now, 1);
      filtered = filtered.filter((s) => isWithinInterval(parseISO(s.createdAt), { start: startOfMonth(lm), end: endOfMonth(lm) }));
    } else if (period === "3months") {
      filtered = filtered.filter((s) => parseISO(s.createdAt) >= subMonths(now, 3));
    } else if (period === "6months") {
      filtered = filtered.filter((s) => parseISO(s.createdAt) >= subMonths(now, 6));
    } else if (period === "this_year") {
      filtered = filtered.filter((s) => parseISO(s.createdAt).getFullYear() === now.getFullYear());
    }

    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(
        (s) => s.id.toString().includes(q) || s.paymentMethod.toLowerCase().includes(q) || s.status.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [sales, period, searchText]);

  // Stats
  const completedSales = filteredSales.filter((s) => s.status === "completada");
  const totalSpent = completedSales.reduce((acc, s) => acc + s.total, 0);
  const saleCount = completedSales.length;
  const averageTicket = saleCount > 0 ? totalSpent / saleCount : 0;
  const lastPurchase = completedSales.length > 0
    ? completedSales.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
    : null;
  const firstPurchase = completedSales.length > 0
    ? [...completedSales].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].createdAt
    : null;

  const statementData: CustomerStatement | null = customer
    ? {
        id: customer.id,
        name: customer.name,
        nitCi: customer.nitCi,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        totalSpent,
        saleCount,
        averageTicket,
        firstPurchase,
        lastPurchase,
        sales: filteredSales,
      }
    : null;

  const pdfSettings = settings
    ? {
        companyName: settings.companyName,
        rucNit: settings.rucNit,
        phone: settings.phone,
        email: settings.email,
        address: settings.address,
        currencySymbol: settings.currencySymbol || currencySymbol,
      }
    : null;

  const handleDownload = async () => {
    if (!statementData || !pdfSettings) return;
    setPdfLoading(true);
    try {
      downloadStatementPDF(statementData, pdfSettings);
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!statementData || !pdfSettings) return;
    setPdfLoading(true);
    try {
      printStatementPDF(statementData, pdfSettings);
    } finally {
      setPdfLoading(false);
    }
  };

  const STAT_CARDS = [
    {
      label: "Total Gastado",
      value: formatCurrency(totalSpent, currencySymbol),
      icon: TrendingUp,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
    },
    {
      label: "N° Compras",
      value: String(saleCount),
      icon: ShoppingCart,
      color: "text-teal-600",
      bg: "bg-teal-50",
      border: "border-teal-200",
    },
    {
      label: "Ticket Promedio",
      value: formatCurrency(averageTicket, currencySymbol),
      icon: Receipt,
      color: "text-violet-600",
      bg: "bg-violet-50",
      border: "border-violet-200",
    },
    {
      label: "Última Compra",
      value: lastPurchase ? format(parseISO(lastPurchase), "dd/MM/yyyy") : "—",
      icon: Calendar,
      color: "text-slate-600",
      bg: "bg-slate-50",
      border: "border-slate-200",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/customers")}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <User className="w-5 h-5 text-teal-500" />
              {customer?.name ?? "Cargando..."}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extracto de cuenta · {customer?.nitCi ? `NIT/CI: ${customer.nitCi}` : "Sin NIT/CI"}
              {customer?.email && ` · ${customer.email}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={handlePrint}
            disabled={pdfLoading || !statementData || saleCount === 0}
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={handleDownload}
            disabled={pdfLoading || !statementData || saleCount === 0}
          >
            <Download className="w-4 h-4" />
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STAT_CARDS.map((card) => (
          <Card key={card.label} className={`border ${card.border} shadow-sm`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-52 rounded-xl text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por N°, método de pago, estado..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Transactions table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-500" />
            Historial de Compras
            <span className="text-xs text-muted-foreground font-normal">
              ({filteredSales.length} transacciones)
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs font-semibold uppercase tracking-wide">#</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">N° Venta</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Fecha</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Método de Pago</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">Estado</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Subtotal</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">IVA</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                      Cargando historial...
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    {period !== "all"
                      ? "Sin transacciones en el período seleccionado"
                      : "Este cliente no tiene compras registradas"}
                  </TableCell>
                </TableRow>
              )}
              {filteredSales.map((s, i) => {
                const badge = STATUS_BADGE[s.status] ?? { label: s.status, className: "" };
                return (
                  <TableRow key={s.id} className="hover:bg-muted/20">
                    <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                    <TableCell className="font-mono text-primary text-sm font-medium">
                      #{String(s.id).padStart(6, "0")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(s.createdAt), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm">{s.paymentMethod}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(s.subtotal, currencySymbol)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatCurrency(s.iva, currencySymbol)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm text-indigo-700">
                      {formatCurrency(s.total, currencySymbol)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals row */}
              {filteredSales.length > 0 && (
                <TableRow className="bg-indigo-50/60 font-semibold border-t-2 border-indigo-100">
                  <TableCell colSpan={5} className="text-sm text-indigo-700 font-bold">
                    TOTAL PERÍODO ({saleCount} compras completadas)
                  </TableCell>
                  <TableCell className="text-right text-sm text-indigo-700">
                    {formatCurrency(completedSales.reduce((a, s) => a + s.subtotal, 0), currencySymbol)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-indigo-700">
                    {formatCurrency(completedSales.reduce((a, s) => a + s.iva, 0), currencySymbol)}
                  </TableCell>
                  <TableCell className="text-right text-base font-bold text-indigo-700">
                    {formatCurrency(totalSpent, currencySymbol)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
