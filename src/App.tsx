import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

// Admin Pages
import Dashboard from "@/pages/Dashboard";
import Executions from "@/pages/Executions";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Notifications from "@/pages/Notifications";
import Support from "@/pages/Support";
import Media from "@/pages/Media";
import Campaigns from "@/pages/Campaigns";
import Integrations from "@/pages/Integrations";
import Finance from "@/pages/Finance";
import Payments from "@/pages/Payments";
import Shipping from "@/pages/Shipping";
import Fiscal from "@/pages/Fiscal";
import Purchases from "@/pages/Purchases";
import Settings from "@/pages/Settings";
import StorefrontSettings from "@/pages/StorefrontSettings";
import Auth from "@/pages/Auth";
import CreateStore from "@/pages/CreateStore";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Storefront Pages
import { StorefrontLayout } from "@/components/storefront/StorefrontLayout";
import StorefrontHome from "@/pages/storefront/StorefrontHome";
import StorefrontCategory from "@/pages/storefront/StorefrontCategory";
import StorefrontProduct from "@/pages/storefront/StorefrontProduct";
import StorefrontCart from "@/pages/storefront/StorefrontCart";
import StorefrontCheckout from "@/pages/storefront/StorefrontCheckout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />

            {/* Public Storefront routes */}
            <Route path="/store/:tenantSlug" element={<StorefrontLayout />}>
              <Route index element={<StorefrontHome />} />
              <Route path="c/:categorySlug" element={<StorefrontCategory />} />
              <Route path="p/:productSlug" element={<StorefrontProduct />} />
              <Route path="cart" element={<StorefrontCart />} />
              <Route path="checkout" element={<StorefrontCheckout />} />
            </Route>

            {/* Protected route without tenant requirement */}
            <Route
              path="/create-store"
              element={
                <ProtectedRoute requireTenant={false}>
                  <CreateStore />
                </ProtectedRoute>
              }
            />

            {/* Protected routes with tenant requirement */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/executions" element={<Executions />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/support" element={<Support />} />
              <Route path="/media" element={<Media />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/shipping" element={<Shipping />} />
              <Route path="/fiscal" element={<Fiscal />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/storefront" element={<StorefrontSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
