import { useEffect } from "react";
import { useGetBusinessSettings, useUpdateBusinessSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/currency-context";
import { useQueryClient } from "@tanstack/react-query";

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
  nit: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  logoUrl: z.string().url("URL inválida").optional().or(z.literal("")).nullable(),
  currency: z.string(),
  currencySymbol: z.string(),
});

export default function Settings() {
  const { data: settings, isLoading } = useGetBusinessSettings();
  const updateMutation = useUpdateBusinessSettings();
  const { setCurrency } = useCurrency();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: "", nit: "", phone: "", email: "", address: "", logoUrl: "", currency: "BOB", currencySymbol: "Bs" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName,
        nit: settings.nit || "",
        phone: settings.phone || "",
        email: settings.email || "",
        address: settings.address || "",
        logoUrl: settings.logoUrl || "",
        currency: settings.currency || "BOB",
        currencySymbol: settings.currencySymbol || "Bs",
      });
    }
  }, [settings, form]);

  const onSubmit = (values: z.infer<typeof schema>) => {
    updateMutation.mutate({
      data: {
        ...values,
        nit: values.nit || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        logoUrl: values.logoUrl || null
      }
    }, {
      onSuccess: () => {
        toast({ title: "Configuración guardada exitosamente" });
        setCurrency(values.currency, values.currencySymbol);
        queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      }
    });
  };

  const watchLogoUrl = form.watch("logoUrl");

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración del Negocio</CardTitle>
          <CardDescription>Actualiza los datos de tu empresa, logo y moneda preferida.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>Razón Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nit" render={({ field }) => (
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
                    <FormLabel>URL del Logo</FormLabel>
                    <div className="flex gap-4 items-start">
                      <div className="flex-1">
                        <FormControl><Input {...field} value={field.value || ""} placeholder="https://ejemplo.com/logo.png" /></FormControl>
                        <FormMessage />
                      </div>
                      {watchLogoUrl && (
                        <div className="w-16 h-16 border rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          <img src={watchLogoUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                      )}
                    </div>
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>Guardar Configuración</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}