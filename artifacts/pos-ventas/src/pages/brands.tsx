import { useState } from "react";
import { useGetBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "@workspace/api-client-react";
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

const brandSchema = z.object({
  name: z.string().min(2, "Requerido"),
  description: z.string().optional().nullable(),
});

export default function Brands() {
  const [search, setSearch] = useState("");
  const { data: brands, isLoading } = useGetBrands();
  
  const createMutation = useCreateBrand();
  const updateMutation = useUpdateBrand();
  const deleteMutation = useDeleteBrand();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof brandSchema>>({
    resolver: zodResolver(brandSchema),
    defaultValues: { name: "", description: "" },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.reset({ name: "", description: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (brand: any) => {
    setEditingId(brand.id);
    form.reset({ name: brand.name, description: brand.description || "" });
    setIsOpen(true);
  };

  const onSubmit = (values: z.infer<typeof brandSchema>) => {
    const data = { ...values, description: values.description || null };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Marca actualizada" });
          queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
          setIsOpen(false);
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Marca creada" });
          queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
          setIsOpen(false);
        }
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await confirmDelete("esta marca");
    if (!result.isConfirmed) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: "Marca eliminada" });
        queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      }
    });
  };

  const filteredBrands = brands?.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Marcas</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}><Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Nueva</span></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Editar Marca" : "Nueva Marca"}</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Descripción</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Guardar</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Descripción</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={3} className="text-center py-4">Cargando...</TableCell></TableRow> : filteredBrands?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.description || "-"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}