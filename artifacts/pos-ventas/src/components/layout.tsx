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
  Shield,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts/currency-context";
import { NotificationBell } from "@/components/notification-bell";

// ── Role definitions ──────────────────────────────────────────────────────────

const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  admin:      "/dashboard",
  vendedor:   "/pos",
  inventario: "/products",
  compras:    "/suppliers",
};

/** Paths a role is allowed to visit. Empty array = all allowed (admin). */
const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  admin:      [],
  vendedor:   ["/pos", "/sales", "/customers"],
  inventario: ["/products", "/categories", "/brands", "/inventory"],
  compras:    ["/suppliers", "/quotes"],
};

function isAllowed(role: string, path: string): boolean {
  const prefixes = ROLE_ALLOWED_PREFIXES[role];
  if (!prefixes || prefixes.length === 0) return true; // admin
  return prefixes.some(p => path === p || path.startsWith(p + "/"));
}

// ── Navigation structure ──────────────────────────────────────────────────────

const ALL_NAV_GROUPS = [
  {
    label: "Principal",
    roles: ["admin"],
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
      { href: "/pos",       label: "Nueva Venta", icon: MonitorPlay,    roles: ["admin", "vendedor"] },
    ],
  },
  {
    label: "Ventas",
    roles: ["admin", "vendedor"],
    items: [
      { href: "/sales",       label: "Historial",     icon: ShoppingCart, roles: ["admin", "vendedor"] },
      { href: "/cierre-caja", label: "Cierre de Caja", icon: LockKeyhole, roles: ["admin"] },
      { href: "/quotes",      label: "Cotizaciones",  icon: FileText,     roles: ["admin", "compras"] },
      { href: "/reports",     label: "Reportes",      icon: BarChart2,    roles: ["admin"] },
    ],
  },
  {
    label: "Inventario",
    roles: ["admin", "inventario"],
    items: [
      { href: "/products",   label: "Productos",   icon: Package,      roles: ["admin", "inventario"] },
      { href: "/categories", label: "Categorías",  icon: Tags,         roles: ["admin", "inventario"] },
      { href: "/brands",     label: "Marcas",      icon: Tags,         roles: ["admin", "inventario"] },
      { href: "/inventory",  label: "Inv. General", icon: ClipboardList, roles: ["admin", "inventario"] },
    ],
  },
  {
    label: "Contactos",
    roles: ["admin", "vendedor", "compras"],
    items: [
      { href: "/customers",  label: "Clientes",      icon: Users, roles: ["admin", "vendedor"] },
      { href: "/suppliers",  label: "Proveedores",   icon: Truck, roles: ["admin", "compras"] },
      { href: "/loyalty",    label: "Fidelización",  icon: Star,  roles: ["admin"] },
    ],
  },
];

const ADMIN_GROUP = {
  label: "Administración",
  roles: ["admin"],
  items: [
    { href: "/users",           label: "Usuarios",          icon: UserCog  },
    { href: "/payment-methods", label: "Métodos de Pago",   icon: CreditCard },
    { href: "/settings",        label: "Configuración",     icon: Settings },
    { href: "/audit",           label: "Auditoría",         icon: Shield },
  ],
};

const ALL_NAV_ITEMS: { href: string; label: string; icon: React.ElementType }[] = [
  ...ALL_NAV_GROUPS.flatMap(g => g.items),
  ...ADMIN_GROUP.items,
];

// ── Layout component ──────────────────────────────────────────────────────────

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user, isError } = useGetMe({ query: { retry: false } as any });
  const { data: settings } = useGetBusinessSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const { currencySymbol } = useCurrency();

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await fetch("/api/backup", { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error("Error al generar backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-pos-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al generar el backup");
    } finally {
      setBackupLoading(false);
    }
  };

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

  // Role-based route guard
  useEffect(() => {
    if (!user) return;
    const role = (user.role ?? "admin").toLowerCase();
    if (role === "admin") return;
    if (!isAllowed(role, location)) {
      setLocation(ROLE_DEFAULT_ROUTE[role] ?? "/pos");
    }
  }, [user, location, setLocation]);

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

  const userRole = (user.role ?? "admin").toLowerCase();
  const currentNavItem = ALL_NAV_ITEMS.find(item => location === item.href || location.startsWith(item.href + "/"));

  // Filter nav groups for current role
  const visibleGroups = ALL_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole)),
  })).filter(group => group.items.length > 0);

  const showAdminGroup = userRole === "admin";

  const NavItem = ({ item, onClick }: { item: { href: string; label: string; icon: React.ElementType }; onClick?: () => void }) => {
    const active = location === item.href || location.startsWith(item.href + "/");
    return (
      <li>
        <Link href={item.href} onClick={onClick}>
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
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border shrink-0">
        {settings?.logoUrl ? (
          <img src={settings.logoUrl} alt="Logo" className="h-8 max-w-[120px] object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
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
        <Button variant="ghost" size="icon" className="ml-auto md:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => <NavItem key={item.href} item={item} onClick={() => setSidebarOpen(false)} />)}
            </ul>
          </div>
        ))}

        {showAdminGroup && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1">{ADMIN_GROUP.label}</p>
            <ul className="space-y-0.5">
              {ADMIN_GROUP.items.map((item) => <NavItem key={item.href} item={item} onClick={() => setSidebarOpen(false)} />)}
            </ul>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3 shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate capitalize">{user.role}</p>
          </div>
          {userRole === "admin" && (
            <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-primary shrink-0" onClick={handleBackup} disabled={backupLoading} title="Descargar Backup">
              <Download className={`w-3.5 h-3.5 ${backupLoading ? "animate-bounce" : ""}`} />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-destructive shrink-0" onClick={handleLogout} title="Cerrar Sesión">
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-60 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } flex flex-col shadow-sm`}>
        <SidebarContent />
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 bg-card border-b border-border z-30 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden w-8 h-8" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-4 h-4" />
            </Button>
            <nav className="flex items-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{currentNavItem?.label || "POS Ventas"}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold">
              <span>{currencySymbol}</span>
              <span className="text-primary/70">{settings?.currency || "BOB"}</span>
            </div>
            {userRole === "admin" && <NotificationBell />}
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
