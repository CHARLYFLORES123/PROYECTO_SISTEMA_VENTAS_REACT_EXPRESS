import { useState } from "react";
import { useGetSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from "@workspace/api-client-react";
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
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

const schema = z.object({
  name: z.string().min(2, "Requerido"),
  nitCi: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const { data: suppliers, isLoading } = useGetSuppliers();
  const { can } = usePermissions();
  
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", nitCi: "", contactName: "", email: "", phone: "", address: "" },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.reset({ name: "", nitCi: "", contactName: "", email: "", phone: "", address: "" });
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
      address: supplier.address || "" 
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
      address: values.address || null
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

  const canCreate = can("suppliers", "create");
  const canUpdate = can("suppliers", "update");
  const canDelete = can("suppliers", "delete");

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.contactName && s.contactName.toLowerCase().includes(search.toLowerCase()))
  );

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
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canUpdate || canDelete ? 6 : 5} className="text-center py-4">Cargando...</TableCell></TableRow>
              ) : filteredSuppliers?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.nitCi || "-"}</TableCell>
                  <TableCell>{s.contactName || "-"}</TableCell>
                  <TableCell>{s.email || "-"}</TableCell>
                  <TableCell>{s.phone || "-"}</TableCell>
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
    </div>
  );
}
