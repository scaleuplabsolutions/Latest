import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SystemProvider } from "@/context/SystemContext";
import Layout from "@/components/Layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Container from "@/pages/Container";
import ExpiryAlerts from "@/pages/ExpiryAlerts";
import Reports from "@/pages/Reports";
import Overview from "@/pages/Overview";
import StockDeduction from "@/pages/StockDeduction";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/container" component={Container} />
        <Route path="/expiry-alerts" component={ExpiryAlerts} />
        <Route path="/reports" component={Reports} />
        <Route path="/overview" component={Overview} />
        <Route path="/stock-deduction" component={StockDeduction} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SystemProvider>
          <Toaster />
          <Router />
        </SystemProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
