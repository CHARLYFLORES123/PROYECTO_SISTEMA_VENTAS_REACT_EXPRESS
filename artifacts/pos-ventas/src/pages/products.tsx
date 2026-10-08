import { useState } from "react";
import { useGetProducts, useGetCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, useGetBrands, useGetSuppliers } from "@workspace/api-client-react";
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
import { Pencil, Trash2, Plus, Search, AlertTriangle, Image as ImageIcon, FileText } from "lucide-react";
import { useCurrency, formatCurrency } from "@/contexts/currency-context";
import { ProductImageGallery } from "@/components/product-image-gallery";
import { usePermissions } from "@/hooks/use-permissions";
import { exportTablePDF } from "@/lib/export-table-pdf";

const productSchema = z.object({
  name: z.string().min(2, "Requerido"),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  season: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  supplierId: z.coerce.number().optional().nullable(),
  entryDate: z.string().min(1, "Requerido"),
  purchasePrice: z.coerce.number().min(0),
  salePrice: z.coerce.number().min(0),
  wholesalePrice: z.preprocess(value => value === "" || value == null ? null : Number(value), z.number().min(0).nullable()),
  promotionalPrice: z.preprocess(value => value === "" || value == null ? null : Number(value), z.number().min(0).nullable()),
  stock: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  categoryId: z.coerce.number().optional().nullable(),
  brandId: z.coerce.number().optional().nullable(),
  imageUrls: z.array(z.string().url("URL de imagen inválida")).max(8),
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
  const { data: suppliers } = useGetSuppliers();
  
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "", sku: "", barcode: "", description: "", size: "", color: "", subcategory: "", material: "", season: "", gender: "", supplierId: null, entryDate: new Date().toISOString().slice(0, 10), purchasePrice: 0, salePrice: 0, wholesalePrice: null, promotionalPrice: null, stock: 0, minStock: 5, categoryId: null, brandId: null, imageUrls: [], imageUrl: ""
    },
  });
  const purchasePriceValue = form.watch("purchasePrice");
  const salePriceValue = form.watch("salePrice");
  const profitMargin = salePriceValue > 0
    ? (((salePriceValue - purchasePriceValue) / salePriceValue) * 100).toFixed(2)
    : "0.00";
  const exportPDF = () => {
    exportTablePDF({
      title: "Productos",
      fileName: `Productos_${new Date().toISOString().slice(0, 10)}.pdf`,
      subtitle: `Resultados filtrados: ${products?.length ?? 0}`,
      headers: ["Producto", "SKU", "Talla", "Color", "Categoría", "Marca", "Proveedor", "Costo", "Precio", "Promo", "Stock", "Estado"],
      rows: (products ?? []).map((product) => [
        product.name,
        product.sku || "-",
        product.size || "-",
        product.color || "-",
        product.categoryName || "-",
        product.brandName || "-",
        product.supplierName || "-",
        formatCurrency(product.purchasePrice, currencySymbol),
        formatCurrency(product.salePrice, currencySymbol),
        product.promotionalPrice != null ? formatCurrency(product.promotionalPrice, currencySymbol) : "-",
        `${product.stock} (mín. ${product.minStock})`,
        product.stock <= 0 ? "Agotado" : product.stock <= product.minStock ? "Bajo" : "OK",
      ]),
    });
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    form.reset({ name: "", sku: "", barcode: "", description: "", size: "", color: "", subcategory: "", material: "", season: "", gender: "", supplierId: null, entryDate: new Date().toISOString().slice(0, 10), purchasePrice: 0, salePrice: 0, wholesalePrice: null, promotionalPrice: null, stock: 0, minStock: 5, categoryId: null, brandId: null, imageUrls: [], imageUrl: "" });
    setIsOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setEditingId(product.id);
    form.reset({ 
      name: product.name, 
      sku: product.sku || "",
      barcode: product.barcode || "", 
      description: product.description || "", 
      size: product.size || "",
      color: product.color || "",
      subcategory: product.subcategory || "",
      material: product.material || "",
      season: product.season || "",
      gender: product.gender || "",
      supplierId: product.supplierId,
      entryDate: product.entryDate,
      purchasePrice: product.purchasePrice, 
      salePrice: product.salePrice, 
      wholesalePrice: product.wholesalePrice,
      promotionalPrice: product.promotionalPrice,
      stock: product.stock, 
      minStock: product.minStock, 
      categoryId: product.categoryId,
      brandId: product.brandId,
      imageUrls: product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [],
      imageUrl: product.imageUrl || ""
    });
    setIsOpen(true);
  };

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    const data = {
      ...values,
      sku: values.sku?.trim() || null,
      categoryId: values.categoryId || null,
      brandId: values.brandId || null,
      supplierId: values.supplierId || null,
      barcode: values.barcode || null,
      description: values.description || null,
      size: values.size || null,
      color: values.color || null,
      subcategory: values.subcategory || null,
      material: values.material || null,
      season: values.season || null,
      gender: values.gender || null,
      imageUrls: values.imageUrls,
      imageUrl: values.imageUrls[0] || null
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Producto actualizado" });
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/products/inventory-report"] });
          setIsOpen(false);
        },
        onError: (error) => Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "No se pudo actualizar el producto" }),
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          Toast.fire({ icon: "success", title: "Producto creado" });
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          queryClient.invalidateQueries({ queryKey: ["/api/products/inventory-report"] });
          setIsOpen(false);
        },
        onError: (error) => Toast.fire({ icon: "error", title: error instanceof Error ? error.message : "No se pudo crear el producto" }),
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
      },
      onError: (error) => Toast.fire({
        icon: "error",
        title: error instanceof Error ? error.message : "No se pudo eliminar el producto",
      }),
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
          <Button variant="outline" onClick={exportPDF} disabled={!products?.length || isLoading}>
            <FileText className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">PDF</span>
          </Button>
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
                      <FormField control={form.control} name="sku" render={({ field }) => (
                        <FormItem><FormLabel>Código interno / SKU</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="size" render={({ field }) => (
                        <FormItem><FormLabel>Talla</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="color" render={({ field }) => (
                        <FormItem><FormLabel>Color</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="subcategory" render={({ field }) => (
                        <FormItem><FormLabel>Subcategoría</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="material" render={({ field }) => (
                        <FormItem><FormLabel>Material</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="season" render={({ field }) => (
                        <FormItem><FormLabel>Temporada</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Género</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="supplierId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proveedor</FormLabel>
                          <Select onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))} value={field.value?.toString() || "none"}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="none">Ninguno</SelectItem>
                              {suppliers?.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="entryDate" render={({ field }) => (
                        <FormItem><FormLabel>Fecha de ingreso</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem className="md:col-span-2"><FormLabel>Descripción</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
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
                      <FormField control={form.control} name="wholesalePrice" render={({ field }) => (
                        <FormItem><FormLabel>Precio Mayorista</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="promotionalPrice" render={({ field }) => (
                        <FormItem><FormLabel>Precio Promocional</FormLabel><FormControl><Input type="number" min="0" step="0.01" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Margen de ganancia</label>
                        <Input value={`${profitMargin}%`} readOnly aria-label="Margen de ganancia calculado" />
                        <p className="text-xs text-muted-foreground">Calculado sobre el precio de venta regular.</p>
                      </div>
                      <FormField control={form.control} name="stock" render={({ field }) => (
                        <FormItem><FormLabel>Stock Actual</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="minStock" render={({ field }) => (
                        <FormItem><FormLabel>Stock Mínimo</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="imageUrls" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Fotos del Producto</FormLabel>
                          <FormControl>
                            <ProductImageGallery value={field.value} onChange={field.onChange} />
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
                    {(p.imageUrls?.[0] || p.imageUrl) ? (
                      <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={p.imageUrls?.[0] || p.imageUrl || ""} alt={p.name} className="max-w-full max-h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku ? `SKU: ${p.sku}` : "Sin SKU"}{p.barcode ? ` · ${p.barcode}` : ""}</div>
                    {(p.size || p.color) && (
                      <div className="text-xs text-muted-foreground">
                        {[p.size && `Talla ${p.size}`, p.color].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {[p.subcategory, p.material, p.season, p.gender, p.supplierName].filter(Boolean).length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {[p.subcategory, p.material, p.season, p.gender, p.supplierName].filter(Boolean).join(" · ")}
                      </div>
                    )}
                    {p.description && <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{p.brandName || "-"}</div>
                    <div className="text-xs text-muted-foreground">{p.categoryName || "-"}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-medium">{formatCurrency(p.salePrice, currencySymbol)}</div>
                    {p.promotionalPrice != null && <div className="text-xs text-destructive">Promo: {formatCurrency(p.promotionalPrice, currencySymbol)}</div>}
                    {p.wholesalePrice != null && <div className="text-xs text-muted-foreground">Mayorista: {formatCurrency(p.wholesalePrice, currencySymbol)}</div>}
                    <div className="text-xs text-muted-foreground">Margen: {p.profitMargin.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">Ingreso: {p.entryDate}</div>
                  </TableCell>
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
                  <FormField control={form.control} name="imageUrls" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Fotos del Producto</FormLabel>
                      <FormControl><ProductImageGallery value={field.value} onChange={field.onChange} /></FormControl>
                      <FormMessage />
                    </FormItem>
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
