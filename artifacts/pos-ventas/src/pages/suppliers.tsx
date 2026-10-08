import { useEffect, useState } from "react";
import { customFetch, useGetSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from "@workspace/api-client-react";
import type { Supplier } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Toast, confirmDelete } from "@/lib/swal";
import { Pencil, Trash2, Plus, Search, History, FileText } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { exportTablePDF } from "@/lib/export-table-pdf";

type SupplierPurchase = {
  id: number;
  type: "purchase" | "supplier_order";
  reference: string | null;
  total: number;
  amountPaid: number | null;
  balancePending: number | null;
  paymentMethod: string | null;
  paymentType: "contado" | "credito" | null;
  createdAt: string;
  items: Array<{ productName: string; quantity: number }>;
};

const schema = z.object({
  name: z.string().min(2, "Requerido"),
  nitCi: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  whatsapp: z.string().max(30, "Máximo 30 caracteres").optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().max(150, "Máximo 150 caracteres").optional().nullable(),
});

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const { currencySymbol } = useCurrency();
  const { data: suppliers, isLoading } = useGetSuppliers();
  const { can } = usePermissions();
  
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<SupplierPurchase[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", nitCi: "", contactName: "", email: "", phone: "", whatsapp: "", address: "", city: "" },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.reset({ name: "", nitCi: "", contactName: "", email: "", phone: "", whatsapp: "", address: "", city: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (supplier: any) => {
    setEditingId(supplier.id);
    form.reset({ 
      name: supplier.name, 
      nitCi: supplier.nitCi || "", 
      contactName: supplier.contactName || "", 
      email: supplier.email || "", 
      phone: supplier.phone || "", 
      whatsapp: supplier.whatsapp || "",
      address: supplier.address || "",
      city: supplier.city || "",
    });
    setIsOpen(true);
  };

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = { 
      ...values, 
      nitCi: values.nitCi || null,
      contactName: values.contactName || null,
      email: values.email || null,
      phone: values.phone || null,
      whatsapp: values.whatsapp || null,
      address: values.address || null,
      city: values.city || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Proveedor actualizado" });
          queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
          setIsOpen(false);
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Proveedor creado" });
          queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
          setIsOpen(false);
        }
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await confirmDelete("este proveedor");
    if (!result.isConfirmed) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: "Proveedor eliminado" });
        queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      }
    });
  };

  useEffect(() => {
    if (!historySupplier) return;
    let active = true;
    setPurchaseHistory([]);
    setHistoryLoading(true);
    setHistoryError(null);
    customFetch<SupplierPurchase[]>(`/api/suppliers/${historySupplier.id}/purchases`)
      .then((purchases) => {
        if (active) setPurchaseHistory(purchases);
      })
      .catch((error: unknown) => {
        if (active) setHistoryError(error instanceof Error ? error.message : "No se pudo cargar el historial");
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, [historySupplier]);

  const canCreate = can("suppliers", "create");
  const canUpdate = can("suppliers", "update");
  const canDelete = can("suppliers", "delete");

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.contactName && s.contactName.toLowerCase().includes(search.toLowerCase())) ||
    (s.city && s.city.toLowerCase().includes(search.toLowerCase()))
  );
  const exportPDF = () => {
    exportTablePDF({
      title: "Proveedores",
      fileName: `Proveedores_${new Date().toISOString().slice(0, 10)}.pdf`,
      subtitle: `Resultados filtrados: ${filteredSuppliers?.length ?? 0}`,
      headers: ["Proveedor", "NIT/CI", "Contacto", "WhatsApp", "Ciudad", "Dirección", "Total comprado", "Deuda pendiente", "Productos"],
      rows: (filteredSuppliers ?? []).map((supplier) => [
        supplier.name,
        supplier.nitCi || "-",
        supplier.contactName || "-",
        supplier.whatsapp || supplier.phone || "-",
        supplier.city || "-",
        supplier.address || "-",
        formatCurrency(supplier.totalPurchased, currencySymbol),
        formatCurrency(supplier.pendingDebt, currencySymbol),
        supplier.productsProvided?.join(", ") || "-",
      ]),
    });
  };

  const FormContent = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem className="md:col-span-2"><FormLabel>Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="nitCi" render={({ field }) => (
          <FormItem><FormLabel>NIT/CI</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="contactName" render={({ field }) => (
          <FormItem><FormLabel>Contacto</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="whatsapp" render={({ field }) => (
          <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="city" render={({ field }) => (
          <FormItem><FormLabel>Ciudad</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem className="md:col-span-2"><FormLabel>Dirección</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="md:col-span-2 flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Guardar</Button>
        </div>
      </form>
    </Form>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Proveedores</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Button variant="outline" onClick={exportPDF} disabled={!filteredSuppliers?.length || isLoading}>
            <FileText className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">PDF</span>
          </Button>
          {canCreate && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}><Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Nuevo</span></Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingId ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle></DialogHeader>
                <FormContent />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>NIT/CI</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Ciudad / dirección</TableHead>
                <TableHead>Compras / deuda</TableHead>
                <TableHead>Historial</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canUpdate || canDelete ? 8 : 7} className="text-center py-4">Cargando...</TableCell></TableRow>
              ) : filteredSuppliers?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.nitCi || "-"}</TableCell>
                  <TableCell>{s.contactName || "-"}</TableCell>
                  <TableCell>{s.whatsapp || s.phone || "-"}</TableCell>
                  <TableCell>{[s.city, s.address].filter(Boolean).join(" · ") || "-"}</TableCell>
                  <TableCell className="text-xs">
                    <div>Total: {formatCurrency(s.totalPurchased, currencySymbol)}</div>
                    <div className={s.pendingDebt > 0 ? "font-semibold text-destructive" : ""}>Deuda: {formatCurrency(s.pendingDebt, currencySymbol)}</div>
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="outline" size="sm" onClick={() => setHistorySupplier(s)}>
                      <History className="mr-1 h-4 w-4" /> Ver
                    </Button>
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right space-x-2">
                      {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog for when canCreate is false but canUpdate is true */}
      {canUpdate && !canCreate && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Editar Proveedor</DialogTitle></DialogHeader>
            <FormContent />
          </DialogContent>
        </Dialog>
      )}
      <Dialog open={historySupplier !== null} onOpenChange={(open) => { if (!open) setHistorySupplier(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Compras de {historySupplier?.name}</DialogTitle></DialogHeader>
          {historySupplier && <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
              <div><span className="font-medium">Productos que proporciona:</span><div className="text-muted-foreground">{historySupplier.productsProvided?.join(", ") || "Sin productos vinculados"}</div></div>
              <div><span className="font-medium">Total comprado:</span><div>{formatCurrency(historySupplier.totalPurchased, currencySymbol)}</div></div>
              <div><span className="font-medium">Deuda pendiente:</span><div className={historySupplier.pendingDebt > 0 ? "font-semibold text-destructive" : ""}>{formatCurrency(historySupplier.pendingDebt, currencySymbol)}</div></div>
            </div>
            {historyError ? <p role="alert" className="text-sm text-destructive">{historyError}</p>
              : historyLoading ? <p className="py-5 text-center text-sm text-muted-foreground">Cargando historial...</p>
              : purchaseHistory.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Este proveedor aún no tiene compras registradas.</p>
              : <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Fecha</TableHead><TableHead>Referencia</TableHead><TableHead>Productos</TableHead>
                    <TableHead className="text-right">Total</TableHead><TableHead>Pago</TableHead><TableHead className="text-right">Saldo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>{purchaseHistory.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>{new Date(purchase.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{purchase.type === "supplier_order" ? "Pedido recibido" : "Compra"} · {purchase.reference || `#${purchase.id}`}</TableCell>
                      <TableCell>{purchase.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ") || "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(purchase.total, currencySymbol)}</TableCell>
                      <TableCell>{purchase.paymentMethod ? `${purchase.paymentMethod} · ${purchase.paymentType === "credito" ? "Crédito" : "Contado"}` : "-"}</TableCell>
                      <TableCell className={`text-right ${purchase.balancePending ? "font-semibold text-destructive" : ""}`}>{formatCurrency(purchase.balancePending ?? 0, currencySymbol)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>}
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
