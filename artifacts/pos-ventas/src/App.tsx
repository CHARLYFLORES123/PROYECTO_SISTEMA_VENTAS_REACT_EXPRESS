import React, { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/currency-context";
import NotFound from "@/pages/not-found";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Se produjo una incidencia</h2>
            <p className="text-sm text-slate-600 mb-4">
              La vista encontró un detalle inesperado (posiblemente por una extensión del navegador o traducción).
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import Login from "@/pages/login";
import Register from "@/pages/register";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import POS from "@/pages/pos";
import Products from "@/pages/products";
import Categories from "@/pages/categories";
import Customers from "@/pages/customers";
import Sales from "@/pages/sales";
import SaleDetail from "@/pages/sale-detail";
import Inventory from "@/pages/inventory";
import Brands from "@/pages/brands";
import Suppliers from "@/pages/suppliers";
import Quotes from "@/pages/quotes";
import Settings from "@/pages/settings";
import PaymentMethods from "@/pages/payment-methods";
import Users from "@/pages/users";
import Reports from "@/pages/reports";
import CierreCaja from "@/pages/cierre-caja";
import CustomerStatement from "@/pages/customer-statement";
import Loyalty from "@/pages/loyalty";
import LoyaltySummary from "@/pages/loyalty-summary";
import Audit from "@/pages/audit";

const queryClient = new QueryClient();

function AuthenticatedRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/pos" component={POS} />
        <Route path="/products" component={Products} />
        <Route path="/categories" component={Categories} />
        <Route path="/customers" component={Customers} />
        <Route path="/sales" component={Sales} />
        <Route path="/sales/:id" component={SaleDetail} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/brands" component={Brands} />
        <Route path="/suppliers" component={Suppliers} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/quotes/:id" component={Quotes} />
        <Route path="/settings" component={Settings} />
        <Route path="/payment-methods" component={PaymentMethods} />
        <Route path="/users" component={Users} />
        <Route path="/reports" component={Reports} />
        <Route path="/cierre-caja" component={CierreCaja} />
        <Route path="/customers/:id/statement" component={CustomerStatement} />
        <Route path="/loyalty" component={Loyalty} />
        <Route path="/loyalty/:id/summary" component={LoyaltySummary} />
        <Route path="/audit" component={Audit} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/register" component={Register} />
      <Route component={AuthenticatedRoutes} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const baseApiUrl = apiUrl.replace(/\/$/, "");

    fetch(`${baseApiUrl}/business-settings/public`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const companyName = data?.companyName || "POS Ventas";
        document.title = companyName;

        if (data?.logoUrl) {
          let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
          if (!favicon) {
            favicon = document.createElement("link");
            favicon.rel = "icon";
            favicon.type = "image/png";
            document.head.appendChild(favicon);
          }
          favicon.href = data.logoUrl;
        }
      })
      .catch(() => {
        document.title = "POS Ventas";
      });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="pos-theme">
        <CurrencyProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "") }>
              <ErrorBoundary>
                <Router />
              </ErrorBoundary>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
