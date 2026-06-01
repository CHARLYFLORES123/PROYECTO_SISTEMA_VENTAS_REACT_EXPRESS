import { useState } from "react";
import { useGetProducts, useGetCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, useGetBrands } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toast, confirmDelete } from "@/lib/swal";
import { Pencil, Trash2, Plus, Search, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { ImageUpload } from "@/components/image-upload";
import { usePermissions } from "@/hooks/use-permissions";

const productSchema = z.object({
  name: z.string().min(2, "Requerido"),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  purchasePrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  stock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  categoryId: z.coerce.number().optional().nullable(),
  brandId: z.coerce.number().optional().nullable(),
  imageUrl: z.string().url("URL inválida").optional().or(z.literal("")).nullable(),
});

export default function Products() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const { currencySymbol } = useCurrency();
  const { can } = usePermissions();
  
  const { data: products, isLoading } = useGetProducts({ 
    search: search || undefined, 
    categoryId: filterCategory !== "all" ? parseInt(filterCategory) : undefined,
    brandId: filterBrand !== "all" ? parseInt(filterBrand) : undefined
  });
  const { data: categories } = useGetCategories();
  const { data: brands } = useGetBrands();
  
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", barcode: "", description: "", purchasePrice: 0, salePrice: 0, stock: 0, minStock: 5, categoryId: null, brandId: null, imageUrl: ""
    },
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    form.reset({ name: "", barcode: "", description: "", purchasePrice: 0, salePrice: 0, stock: 0, minStock: 5, categoryId: null, brandId: null, imageUrl: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setEditingId(product.id);
    form.reset({ 
      name: product.name, 
      barcode: product.barcode || "", 
      description: product.description || "", 
      purchasePrice: product.purchasePrice, 
      salePrice: product.salePrice, 
      stock: product.stock, 
      minStock: product.minStock, 
      categoryId: product.categoryId,
      brandId: product.brandId,
      imageUrl: product.imageUrl || ""
    });
    setIsOpen(true);
  };

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    const data = {
      ...values,
      categoryId: values.categoryId || null,
      brandId: values.brandId || null,
      barcode: values.barcode || null,
      description: values.description || null,
      imageUrl: values.imageUrl || null
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Producto actualizado" });
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          setIsOpen(false);
        }
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Producto creado" });
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          setIsOpen(false);
        }
      });
    }
  };

  const handleDelete = async (id: number) => {
    const result = await confirmDelete("este producto");
    if (!result.isConfirmed) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: "Producto eliminado" });
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      }
    });
  };

  const canCreate = can("products", "create");
  const canUpdate = can("products", "update");
  const canDelete = can("products", "delete");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold tracking-tight">Productos</h2>
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
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las marcas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las marcas</SelectItem>
              {brands?.map(b => (
                <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Nuevo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] p-4 -m-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-4 md:col-span-2">
                        <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      <FormField control={form.control} name="barcode" render={({ field }) => (
                        <FormItem><FormLabel>Código de Barras</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="categoryId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} value={field.value?.toString() || "none"}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Ninguna</SelectItem>
                              {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="brandId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marca</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} value={field.value?.toString() || "none"}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Ninguna</SelectItem>
                              {brands?.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                        <FormItem><FormLabel>Precio Compra</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="salePrice" render={({ field }) => (
                        <FormItem><FormLabel>Precio Venta</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="stock" render={({ field }) => (
                        <FormItem><FormLabel>Stock Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="minStock" render={({ field }) => (
                        <FormItem><FormLabel>Stock Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="imageUrl" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Imagen del Producto</FormLabel>
                          <FormControl>
                            <ImageUpload
                              value={field.value}
                              onChange={(val) => field.onChange(val ?? "")}
                              maxWidthPx={500}
                              maxHeightPx={500}
                              label="Subir imagen desde mis archivos"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>Guardar</Button>
                      </div>
                    </form>
                  </Form>
                </ScrollArea>
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
                <TableHead className="w-[60px]"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Marca/Categoría</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                {(canUpdate || canDelete) && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canUpdate || canDelete ? 7 : 6} className="text-center py-4">Cargando...</TableCell></TableRow>
              ) : products?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.imageUrl ? (
                      <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={p.imageUrl} alt={p.name} className="max-w-full max-h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.barcode}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{p.brandName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{p.categoryName || "-"}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.salePrice, currencySymbol)}</TableCell>
                  <TableCell className="text-right">{p.stock}</TableCell>
                  <TableCell className="text-center">
                    {p.stock <= 0 ? (
                      <Badge variant="destructive">Agotado</Badge>
                    ) : p.stock <= p.minStock ? (
                      <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10"><AlertTriangle className="w-3 h-3 mr-1" /> Bajo</Badge>
                    ) : (
                      <Badge variant="outline" className="border-success text-success-foreground bg-success/10">OK</Badge>
                    )}
                  </TableCell>
                  {(canUpdate || canDelete) && (
                    <TableCell className="text-right space-x-2">
                      {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {products?.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={canUpdate || canDelete ? 7 : 6} className="text-center py-8 text-muted-foreground">
                    No se encontraron productos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog (opened when canCreate is false but canUpdate is true) */}
      {canUpdate && !canCreate && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Editar Producto</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh] p-4 -m-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4 md:col-span-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="barcode" render={({ field }) => (
                    <FormItem><FormLabel>Código de Barras</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} value={field.value?.toString() || "none"}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
                          {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="brandId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} value={field.value?.toString() || "none"}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
                          {brands?.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                    <FormItem><FormLabel>Precio Compra</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="salePrice" render={({ field }) => (
                    <FormItem><FormLabel>Precio Venta</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem><FormLabel>Stock Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="minStock" render={({ field }) => (
                    <FormItem><FormLabel>Stock Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={updateMutation.isPending}>Guardar</Button>
                  </div>
                </form>
              </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
