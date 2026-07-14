import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetUsers } from "@workspace/api-client-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, RefreshCw, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { getToken } from "@/lib/auth";
import * as XLSX from "xlsx";

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  login:     "bg-blue-100 text-blue-800",
  created:   "bg-green-100 text-green-800",
  updated:   "bg-yellow-100 text-yellow-800",
  deleted:   "bg-red-100 text-red-800",
  cancelled: "bg-orange-100 text-orange-800",
  converted: "bg-purple-100 text-purple-800",
};

const ENTITY_COLORS: Record<string, string> = {
  product:  "bg-indigo-50 text-indigo-700",
  category: "bg-slate-100 text-slate-700",
  brand:    "bg-slate-100 text-slate-700",
  customer: "bg-teal-50 text-teal-700",
  supplier: "bg-cyan-50 text-cyan-700",
  sale:     "bg-emerald-50 text-emerald-700",
  quote:    "bg-violet-50 text-violet-700",
  user:     "bg-pink-50 text-pink-700",
  settings: "bg-gray-100 text-gray-700",
};

const ROLE_LABELS: Record<string, string> = {
  admin:      "Admin",
  vendedor:   "Vendedor",
  inventario: "Inventario",
  compras:    "Compras",
};

async function fetchAuditLogs(params: Record<string, string | number>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v !== undefined && v !== null) qs.set(k, String(v));
  }
  const res = await fetch(`/api/audit-logs?${qs}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error al cargar auditoría");
  return res.json() as Promise<{
    total: number;
    limit: number;
    offset: number;
    data: {
      id: number;
      userId: number | null;
      userName: string | null;
      userRole: string | null;
      action: string;
      actionLabel: string;
      entity: string;
      entityLabel: string;
      entityId: number | null;
      entityName: string | null;
      details: unknown;
      ip: string | null;
      createdAt: string;
    }[];
  }>;
}

export default function Audit() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [userId, setUserId]     = useState("all");
  const [action, setAction]     = useState("all");
  const [entity, setEntity]     = useState("all");
  const [offset, setOffset]     = useState(0);
  const [exporting, setExporting] = useState(false);

  const [appliedFilters, setAppliedFilters] = useState<Record<string, string | number>>({ limit: PAGE_SIZE, offset: 0 });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit-logs", appliedFilters],
    queryFn: () => fetchAuditLogs(appliedFilters),
    staleTime: 30_000,
  });

  const { data: users } = useGetUsers();

  const applyFilters = useCallback(() => {
    const f: Record<string, string | number> = { limit: PAGE_SIZE, offset: 0 };
    if (dateFrom)          f.dateFrom = dateFrom;
    if (dateTo)            f.dateTo   = dateTo;
    if (userId !== "all")  f.userId   = userId;
    if (action !== "all")  f.action   = action;
    if (entity !== "all")  f.entity   = entity;
    setOffset(0);
    setAppliedFilters(f);
  }, [dateFrom, dateTo, userId, action, entity]);

  const goPage = (newOffset: number) => {
    const f = { ...appliedFilters, offset: newOffset };
    setOffset(newOffset);
    setAppliedFilters(f);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const allData = await fetchAuditLogs({ ...appliedFilters, limit: 10000, offset: 0 });
      const rows = allData.data.map(log => ({
        "Fecha y Hora": format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es }),
        "Usuario":       log.userName ?? `#${log.userId}`,
        "Rol":           ROLE_LABELS[log.userRole ?? ""] ?? log.userRole ?? "",
        "Acción":        log.actionLabel,
        "Módulo":        log.entityLabel,
        "Elemento":      log.entityName ?? (log.entityId ? `#${log.entityId}` : ""),
        "IP":            log.ip ?? "",
        "Detalles":      log.details ? JSON.stringify(log.details) : "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 40 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auditoría");
      const filename = `auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch {
      alert("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Registro de Auditoría</h2>
          <p className="text-sm text-muted-foreground">Historial completo de acciones realizadas en el sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || isLoading}>
            <FileDown className={`h-4 w-4 mr-2 ${exporting ? "animate-bounce" : ""}`} />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Desde</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Hasta</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Usuario</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {users?.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Acción</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="login">Ingresó</SelectItem>
                  <SelectItem value="created">Creó</SelectItem>
                  <SelectItem value="updated">Actualizó</SelectItem>
                  <SelectItem value="deleted">Eliminó</SelectItem>
                  <SelectItem value="cancelled">Canceló</SelectItem>
                  <SelectItem value="converted">Convirtió</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Módulo</label>
              <Select value={entity} onValueChange={setEntity}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sale">Venta</SelectItem>
                  <SelectItem value="quote">Cotización</SelectItem>
                  <SelectItem value="product">Producto</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="supplier">Proveedor</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="category">Categoría</SelectItem>
                  <SelectItem value="brand">Marca</SelectItem>
                  <SelectItem value="settings">Configuración</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="w-full h-8" onClick={applyFilters}>
                <Search className="h-3.5 w-3.5 mr-1.5" /> Filtrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Fecha y Hora</TableHead>
                <TableHead className="w-40">Usuario</TableHead>
                <TableHead className="w-28">Acción</TableHead>
                <TableHead className="w-28">Módulo</TableHead>
                <TableHead>Elemento</TableHead>
                <TableHead className="w-28 hidden lg:table-cell">IP</TableHead>
                <TableHead className="w-48 hidden xl:table-cell">Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : !data?.data.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay registros</TableCell></TableRow>
              ) : data.data.map(log => (
                <TableRow key={log.id} className="text-sm">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd/MM/yy HH:mm:ss", { locale: es })}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-[150px]" title={log.userName ?? `#${log.userId}`}>
                        {log.userName ?? `Usuario #${log.userId}`}
                      </span>
                      {log.userRole && (
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {ROLE_LABELS[log.userRole] ?? log.userRole}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                      {log.actionLabel}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ENTITY_COLORS[log.entity] ?? "bg-gray-100 text-gray-700"}`}>
                      {log.entityLabel}
                    </span>
                  </TableCell>
                  <TableCell>
                    {log.entityName ? (
                      <span className="font-medium">{log.entityName}</span>
                    ) : log.entityId ? (
                      <span className="text-muted-foreground">#{log.entityId}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                    {log.ip ?? "—"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {log.details ? (
                      <span className="text-xs text-muted-foreground truncate max-w-[180px] block" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} registro{total !== 1 ? "s" : ""} en total</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1}
              onClick={() => goPage(offset - PAGE_SIZE)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs">Página {currentPage} de {totalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages}
              onClick={() => goPage(offset + PAGE_SIZE)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
