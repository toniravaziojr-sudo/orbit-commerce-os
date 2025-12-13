import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

// Pages
import Dashboard from "@/pages/Dashboard";
import Executions from "@/pages/Executions";
import Orders from "@/pages/Orders";
import Products from "@/pages/Products";
import Customers from "@/pages/Customers";
import Notifications from "@/pages/Notifications";
import Support from "@/pages/Support";
import Media from "@/pages/Media";
import Campaigns from "@/pages/Campaigns";
import Integrations from "@/pages/Integrations";
import Finance from "@/pages/Finance";
import Fiscal from "@/pages/Fiscal";
import Purchases from "@/pages/Purchases";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/executions" element={<Executions />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/products" element={<Products />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/support" element={<Support />} />
            <Route path="/media" element={<Media />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/fiscal" element={<Fiscal />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
