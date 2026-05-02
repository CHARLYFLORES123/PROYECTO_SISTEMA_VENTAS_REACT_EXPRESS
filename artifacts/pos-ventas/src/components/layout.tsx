import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe, useGetBusinessSettings } from "@workspace/api-client-react";
import { clearToken, getToken } from "@/lib/auth";
import {
  LayoutDashboard,
  MonitorPlay,
  Package,
  Tags,
  Users,
  ShoppingCart,
  ClipboardList,
  LogOut,
  Menu,
  X,
  Truck,
  FileText,
  BarChart2,
  CreditCard,
  UserCog,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/currency-context";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: MonitorPlay },
  { href: "/products", label: "Productos", icon: Package },
  { href: "/categories", label: "Categorías", icon: Tags },
  { href: "/brands", label: "Marcas", icon: Tags },
  { href: "/customers", label: "Clientes", icon: Users },
  { href: "/suppliers", label: "Proveedores", icon: Truck },
  { href: "/sales", label: "Ventas", icon: ShoppingCart },
  { href: "/quotes", label: "Cotizaciones", icon: FileText },
  { href: "/inventory", label: "Inventario", icon: ClipboardList },
  { href: "/reports", label: "Reportes", icon: BarChart2 },
  { href: "/payment-methods", label: "Métodos de Pago", icon: CreditCard },
];

const ADMIN_ITEMS = [
  { href: "/users", label: "Usuarios", icon: UserCog },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { retry: false } });
  const { data: settings } = useGetBusinessSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currencySymbol } = useCurrency();

  useEffect(() => {
    const handleUnauthorized = () => {
      setLocation("/");
    };
    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, [setLocation]);

  useEffect(() => {
    if (!getToken() || isError) {
      clearToken();
      setLocation("/");
    }
  }, [isError, setLocation]);

  const handleLogout = () => {
    clearToken();
    setLocation("/");
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } flex flex-col`}
      >
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar-accent/50">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Logo" className="h-8 max-w-full object-contain mr-3" onError={(e) => (e.currentTarget.style.display = 'none')} />
          ) : (
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold mr-3 shrink-0">
              P
            </div>
          )}
          <span className="text-xl font-bold text-sidebar-foreground truncate" title={settings?.companyName || "POS Ventas"}>
            {settings?.companyName || "POS Ventas"}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="ml-auto md:hidden text-sidebar-foreground shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {NAV_ITEMS.map((item) => {
              const active = location.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href}>
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                      active 
                        ? "bg-primary text-primary-foreground font-medium" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          
          {user.role === "Admin" && (
            <>
              <div className="px-6 py-2 mt-4 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                Admin
              </div>
              <ul className="space-y-1 px-3">
                {ADMIN_ITEMS.map((item) => {
                  const active = location.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link href={item.href}>
                        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
                          active 
                            ? "bg-primary text-primary-foreground font-medium" 
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}>
                          <item.icon className="w-5 h-5" />
                          <span>{item.label}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-medium shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">{user.role}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full mt-2 justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-card border-b z-30">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold hidden sm:block">
              {NAV_ITEMS.find(item => location.startsWith(item.href))?.label || 
               ADMIN_ITEMS.find(item => location.startsWith(item.href))?.label || "POS"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-sm bg-muted">{currencySymbol}</Badge>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl h-full animate-in fade-in duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
