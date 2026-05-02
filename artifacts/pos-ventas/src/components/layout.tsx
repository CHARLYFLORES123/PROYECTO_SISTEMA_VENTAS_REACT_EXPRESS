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
  Settings,
  ChevronRight,
  Building2,
  LockKeyhole,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/currency-context";

const NAV_GROUPS = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/pos", label: "Nueva Venta", icon: MonitorPlay },
    ],
  },
  {
    label: "Ventas",
    items: [
      { href: "/sales", label: "Historial", icon: ShoppingCart },
      { href: "/cierre-caja", label: "Cierre de Caja", icon: LockKeyhole },
      { href: "/quotes", label: "Cotizaciones", icon: FileText },
      { href: "/reports", label: "Reportes", icon: BarChart2 },
    ],
  },
  {
    label: "Inventario",
    items: [
      { href: "/products", label: "Productos", icon: Package },
      { href: "/categories", label: "Categorías", icon: Tags },
      { href: "/brands", label: "Marcas", icon: Tags },
      { href: "/inventory", label: "Inv. General", icon: ClipboardList },
    ],
  },
  {
    label: "Contactos",
    items: [
      { href: "/customers", label: "Clientes", icon: Users },
      { href: "/suppliers", label: "Proveedores", icon: Truck },
      { href: "/loyalty", label: "Fidelización", icon: Star },
    ],
  },
];

const ADMIN_GROUP = {
  label: "Administración",
  items: [
    { href: "/users", label: "Usuarios", icon: UserCog },
    { href: "/payment-methods", label: "Métodos de Pago", icon: CreditCard },
    { href: "/settings", label: "Configuración", icon: Settings },
  ],
};

const ALL_NAV_ITEMS = [
  ...NAV_GROUPS.flatMap(g => g.items),
  ...ADMIN_GROUP.items,
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { retry: false } as any });
  const { data: settings } = useGetBusinessSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currencySymbol } = useCurrency();

  useEffect(() => {
    const handleUnauthorized = () => setLocation("/");
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const currentNavItem = ALL_NAV_ITEMS.find(item => location.startsWith(item.href));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border shrink-0">
        {settings?.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt="Logo"
            className="h-8 max-w-[120px] object-contain"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sidebar-foreground truncate text-sm" title={settings?.companyName || "POS Ventas"}>
              {settings?.companyName || "POS Ventas"}
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto md:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = location === item.href || location.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={() => setSidebarOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer group ${
                        active
                          ? "bg-primary text-white font-medium shadow-sm shadow-primary/20"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}>
                        <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}`} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0" />}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Admin section */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">
            {ADMIN_GROUP.label}
          </p>
          <ul className="space-y-0.5">
            {ADMIN_GROUP.items.map((item) => {
              const active = location === item.href || location.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={() => setSidebarOpen(false)}>
                    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer group ${
                      active
                        ? "bg-primary text-white font-medium shadow-sm shadow-primary/20"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}>
                      <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0" />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.role}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0"
            onClick={handleLogout}
            title="Cerrar Sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } flex flex-col shadow-sm`}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-card border-b border-border z-30 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden w-8 h-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <nav className="flex items-center text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {currentNavItem?.label || "POS Ventas"}
                </span>
              </nav>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold">
              <span>{currencySymbol}</span>
              <span className="text-primary/70">{settings?.currency || "BOB"}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground">{user.name}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-[1400px] h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
