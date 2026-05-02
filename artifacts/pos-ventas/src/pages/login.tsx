import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { setToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Building2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@demo.com", password: "admin123" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setLocation("/dashboard");
          toast({ title: "✓ Bienvenido", description: "Has iniciado sesión exitosamente." });
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Error al iniciar sesión",
            description: error.message || "Credenciales incorrectas.",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "hsl(220 20% 95%)" }}>
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-md shadow-primary/30">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Iniciar sesión</h1>
            <p className="text-sm text-muted-foreground mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email field with floating label style */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-muted-foreground z-10">
                Correo electrónico *
              </label>
              <Input
                {...register("email")}
                type="email"
                placeholder="admin@ejemplo.com"
                className="h-12 border-2 rounded-xl focus:border-primary focus-visible:ring-0 transition-colors"
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-muted-foreground z-10">
                Contraseña *
              </label>
              <div className="relative">
                <Input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 border-2 rounded-xl focus:border-primary focus-visible:ring-0 transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded accent-primary" />
                <span className="text-muted-foreground">Recuérdame</span>
              </label>
            </div>

            {/* Submit button — pill shaped like Perfisoft */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-12 bg-primary text-white font-semibold rounded-full hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-primary/30 mt-2"
            >
              {loginMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Iniciando...
                </>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Regístrate
            </Link>
          </div>
        </div>

        {/* Demo hint */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Demo: <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">admin@demo.com</span> / <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">admin123</span>
        </p>
      </div>
    </div>
  );
}
