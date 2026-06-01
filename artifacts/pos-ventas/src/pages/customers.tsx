import { useState } from "react";
import { useGetCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@workspace/api-client-react";
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
import { Pencil, Trash2, Plus, Search, FileBarChart2 } from "lucide-react";
import { useLocation } from "wouter";
import { usePermissions } from "@/hooks/use-permissions";

const customerSchema = z.object({
  name: z.string().min(2, "Requerido"),
  nitCi: z.string().optional().nullable(),
  email: z.string().email("Inválido").optional().or(z.literal("")).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export default function Customers() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const { data: customers, isLoading } = useGetCustomers({ search: search || undefined });
  const { can } = usePermissions();
  
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", nitCi: "", email: "", phone: "", address: "" },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.reset({ name: "", nitCi: "", email: "", phone: "", address: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (customer: any) => {
    setEditingId(customer.id);
    form.reset({ 
      name: customer.name, 
      nitCi: customer.nitCi || "", 
      email: customer.email || "", 
      phone: customer.phone || "", 
      address: customer.address || "" 
    });
    setIsOpen(true);
  };

  const onSubmit = (values: z.infer<typeof customerSchema>) => {
    const data = {
      ...values,
      nitCi: values.nitCi || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Cliente actualizado" });
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
          setIsOpen(false);
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Cliente registrado" });
          queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
          setIsOpen(false);
        }
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await confirmDelete("este cliente");
    if (!result.isConfirmed) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: "Cliente eliminado" });
        queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      }
    });
  };

  const canCreate = can("customers", "create");
  const canUpdate = can("customers", "update");
  const canDelete = can("customers", "delete");

  const FormContent = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Nombre o Razón Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="nitCi" render={({ field }) => (
          <FormItem><FormLabel>NIT / CI</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="phone" render={({ field }) => (
          <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Guardar</Button>
        </div>
      </form>
    </Form>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Clientes</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          {canCreate && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Nuevo</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
                </DialogHeader>
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
                <TableHead>Cliente</TableHead>
                <TableHead>NIT/CI</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-4">Cargando...</TableCell></TableRow>
              ) : customers?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><span className="font-mono text-sm bg-muted px-2 py-1 rounded">{c.nitCi || "S/N"}</span></TableCell>
                  <TableCell>
                    <div className="text-sm">{c.phone || "-"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{c.totalPurchases}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 text-xs px-2"
                      onClick={() => navigate(`/customers/${c.id}/statement`)}
                    >
                      <FileBarChart2 className="h-3.5 w-3.5" />
                      Extracto
                    </Button>
                    {canUpdate && (
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {customers?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No se encontraron clientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog for when canCreate is false but canUpdate is true */}
      {canUpdate && !canCreate && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            <FormContent />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
