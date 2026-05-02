import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/currency-context";
import NotFound from "@/pages/not-found";

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
      <Route path="/:rest*" component={AuthenticatedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
