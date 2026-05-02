import { useEffect } from "react";
import { useGetBusinessSettings, useUpdateBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Toast } from "@/lib/swal";
import { useCurrency } from "@/contexts/currency-context";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUpload } from "@/components/image-upload";
import { Star } from "lucide-react";

const currencies = [
  { code: "BOB", symbol: "Bs" },
  { code: "USD", symbol: "$" },
  { code: "MXN", symbol: "MX$" },
  { code: "COP", symbol: "COP$" },
  { code: "PEN", symbol: "S/" },
  { code: "ARS", symbol: "AR$" }
];

const schema = z.object({
  companyName: z.string().min(2, "Requerido"),
  rucNit: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  logoUrl: z.string().url("URL inválida").optional().or(z.literal("")).nullable(),
  currency: z.string(),
  currencySymbol: z.string(),
  loyaltyEnabled: z.boolean().default(false),
  pointsPerUnit: z.coerce.number().int().min(1, "Mínimo 1").max(1000),
  pointsRedemptionRate: z.coerce.number().min(0.001).max(100),
});

export default function Settings() {
  const { data: settings, isLoading } = useGetBusinessSettings();
  const updateMutation = useUpdateBusinessSettings();
  const { setCurrency, currencySymbol } = useCurrency();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: "", rucNit: "", phone: "", email: "", address: "", logoUrl: "",
      currency: "BOB", currencySymbol: "Bs",
      loyaltyEnabled: false, pointsPerUnit: 1, pointsRedemptionRate: 0.01,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName,
        rucNit: settings.rucNit || "",
        phone: settings.phone || "",
        email: settings.email || "",
        address: settings.address || "",
        logoUrl: settings.logoUrl || "",
        currency: settings.currency || "BOB",
        currencySymbol: settings.currencySymbol || "Bs",
        loyaltyEnabled: (settings as any).loyaltyEnabled ?? false,
        pointsPerUnit: (settings as any).pointsPerUnit ?? 1,
        pointsRedemptionRate: (settings as any).pointsRedemptionRate ?? 0.01,
      });
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof schema>) => {
    updateMutation.mutate({
      data: {
        ...values,
        rucNit: values.rucNit || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        logoUrl: values.logoUrl || null,
      } as any
    }, {
      onSuccess: () => {
        Toast.fire({ icon: "success", title: "Configuración guardada exitosamente" });
        setCurrency(values.currency, values.currencySymbol);
        queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      }
    });
  };

  const watchedLoyalty = form.watch("loyaltyEnabled");
  const watchedPPU = form.watch("pointsPerUnit") || 1;
  const watchedRate = form.watch("pointsRedemptionRate") || 0.01;

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Empresa ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Negocio</CardTitle>
              <CardDescription>Actualiza los datos de tu empresa, logo y moneda preferida.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Razón Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rucNit" render={({ field }) => (
                  <FormItem><FormLabel>RUC / NIT</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Correo</FormLabel><FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <Select value={field.value} onValueChange={(val) => {
                      const selected = currencies.find(c => c.code === val);
                      field.onChange(val);
                      if (selected) form.setValue("currencySymbol", selected.symbol);
                    }}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Dirección</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="logoUrl" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logo de la Empresa</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value}
                        onChange={(val) => field.onChange(val ?? "")}
                        maxWidthPx={400}
                        maxHeightPx={400}
                        label="Subir logo desde mis archivos"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* ── Fidelización ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                Programa de Fidelización
              </CardTitle>
              <CardDescription>
                Premia a tus clientes frecuentes con puntos que pueden canjear por descuentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Enable toggle */}
              <FormField control={form.control} name="loyaltyEnabled" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/20">
                  <div>
                    <FormLabel className="text-sm font-semibold cursor-pointer">Activar programa de puntos</FormLabel>
                    <FormDescription className="text-xs mt-0.5">Los clientes acumularán puntos en cada venta</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              {watchedLoyalty && (
                <div className="space-y-4 pl-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="pointsPerUnit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puntos por {currencySymbol}1 gastado</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={1000} step={1} {...field} />
                        </FormControl>
                        <FormDescription className="text-[11px]">Puntos que se otorgan por cada unidad de moneda</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="pointsRedemptionRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor por punto ({currencySymbol})</FormLabel>
                        <FormControl>
                          <Input type="number" min={0.001} step={0.001} {...field} />
                        </FormControl>
                        <FormDescription className="text-[11px]">Cuánto vale cada punto en moneda local</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1">
                    <p className="text-xs font-semibold text-primary">Vista previa de la configuración</p>
                    <p className="text-sm text-muted-foreground">
                      Por cada <b>{currencySymbol}100</b> de compra → <b>{watchedPPU * 100} puntos</b>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      100 puntos equivalen a <b>{currencySymbol}{(100 * watchedRate).toFixed(2)}</b> de descuento
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Para un descuento de <b>{currencySymbol}1</b> se necesitan{" "}
                      <b>{watchedRate > 0 ? Math.ceil(1 / watchedRate) : "—"} puntos</b>
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending} className="px-8">
              {updateMutation.isPending ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
