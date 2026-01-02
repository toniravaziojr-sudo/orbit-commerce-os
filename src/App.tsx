import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

// Admin Pages
import Dashboard from "@/pages/Dashboard";
import Executions from "@/pages/Executions";
import Orders from "@/pages/Orders";
import OrderNew from "@/pages/OrderNew";
import OrderDetail from "@/pages/OrderDetail";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Menus from "@/pages/Menus";
import Pages from "@/pages/Pages";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Notifications from "@/pages/Notifications";
import Support from "@/pages/Support";
import Media from "@/pages/Media";
import Campaigns from "@/pages/Campaigns";
import Integrations from "@/pages/Integrations";
import Marketing from "@/pages/Marketing";
import Finance from "@/pages/Finance";
import Fiscal from "@/pages/Fiscal";
import Purchases from "@/pages/Purchases";
import Settings from "@/pages/Settings";
import Domains from "@/pages/Domains";
import StorefrontSettings from "@/pages/StorefrontSettings";
import StorefrontBuilder from "@/pages/StorefrontBuilder";
import PageBuilder from "@/pages/PageBuilder";
import PageTemplates from "@/pages/PageTemplates";
import TemplateBuilder from "@/pages/TemplateBuilder";


import Reviews from "@/pages/Reviews";
import Offers from "@/pages/Offers";
import Discounts from "@/pages/Discounts";
import AbandonedCheckouts from "@/pages/AbandonedCheckouts";
import StoreConfigSettings from "@/pages/StoreConfigSettings";
import UrlDiagnostics from "@/pages/UrlDiagnostics";
import HealthMonitor from "@/pages/HealthMonitor";
import Shipments from "@/pages/Shipments";
import Auth from "@/pages/Auth";
import AwaitingConfirmation from "@/pages/AwaitingConfirmation";
import CreateStore from "@/pages/CreateStore";
import ResetPassword from "@/pages/ResetPassword";
import SystemEmails from "@/pages/SystemEmails";
import PlatformIntegrations from "@/pages/PlatformIntegrations";
import Attribution from "@/pages/Attribution";
import Emails from "@/pages/Emails";
import Import from "@/pages/Import";
import Blog from "@/pages/Blog";
import BlogPostEditor from "@/pages/BlogPostEditor";
import BlockSuggestions from "@/pages/BlockSuggestions";
import DemoEstruturaPage from "@/pages/DemoEstruturaPage";
import NotFound from "@/pages/NotFound";

// Storefront Pages
import { StorefrontLayout } from "@/components/storefront/StorefrontLayout";
import { TenantStorefrontLayout } from "@/components/storefront/TenantStorefrontLayout";
import StorefrontHome from "@/pages/storefront/StorefrontHome";
import StorefrontCategory from "@/pages/storefront/StorefrontCategory";
import StorefrontProduct from "@/pages/storefront/StorefrontProduct";
import StorefrontPage from "@/pages/storefront/StorefrontPage";
import StorefrontLandingPage from "@/pages/storefront/StorefrontLandingPage";
import StorefrontCart from "@/pages/storefront/StorefrontCart";
import StorefrontCheckout from "@/pages/storefront/StorefrontCheckout";
import StorefrontThankYou from "@/pages/storefront/StorefrontThankYou";
import StorefrontMyOrders from "@/pages/storefront/StorefrontMyOrders";
import StorefrontAccount from "@/pages/storefront/StorefrontAccount";
import StorefrontAccountLogin from "@/pages/storefront/StorefrontAccountLogin";
import StorefrontAccountForgotPassword from "@/pages/storefront/StorefrontAccountForgotPassword";
import StorefrontOrdersList from "@/pages/storefront/StorefrontOrdersList";
import StorefrontOrderDetail from "@/pages/storefront/StorefrontOrderDetail";
import StorefrontResetPassword from "@/pages/storefront/StorefrontResetPassword";
import StorefrontBlogPost from "@/pages/storefront/StorefrontBlogPost";

// Helper to check if we're on a tenant host (custom domain or platform subdomain)
import { isPlatformSubdomain, isAppDomain, SAAS_CONFIG } from "@/lib/canonicalDomainService";

function isOnTenantHost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // If on platform subdomain (tenant.shops.comandocentral.com.br) → tenant host
  if (isPlatformSubdomain(hostname)) return true;
  
  // If on app domain → NOT tenant host (admin panel)
  if (isAppDomain(hostname)) return false;
  
  // If on fallback origin (lovable preview) → NOT tenant host
  const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).hostname;
  if (hostname === fallbackHost) return false;
  
  // If on ANY lovable hosted preview/build domains → NOT tenant host
  // - id-preview--*.lovable.app
  // - *.lovableproject.com
  if (hostname.endsWith('.lovable.app')) return false;
  if (hostname.endsWith('.lovableproject.com')) return false;
  
  // If on localhost → NOT tenant host (development)
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  
  // Any other domain is considered a custom tenant domain
  // This includes domains like loja.respeiteohomem.com.br
  return true;
}


const queryClient = new QueryClient();

// Determine if we should render tenant routes at root (for custom/platform domains)
const shouldUseTenantRootRoutes = isOnTenantHost();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes (always available) */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/aguardando-confirmacao" element={<AwaitingConfirmation />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />

              {/* 
                Storefront routes - When on tenant host (custom domain / platform subdomain),
                routes are at root. Otherwise, use /store/:tenantSlug prefix.
              */}
              
              {/* Root routes for custom/platform domains */}
              {shouldUseTenantRootRoutes && (
                <Route path="/" element={<TenantStorefrontLayout />}>
                  <Route index element={<StorefrontHome />} />
                  <Route path="c/:categorySlug" element={<StorefrontCategory />} />
                  <Route path="p/:productSlug" element={<StorefrontProduct />} />
                  <Route path="page/:pageSlug" element={<StorefrontPage />} />
                  <Route path="lp/:pageSlug" element={<StorefrontLandingPage />} />
                  <Route path="rastreio" element={<StorefrontPage />} />
                  <Route path="blog" element={<StorefrontPage />} />
                  <Route path="blog/:postSlug" element={<StorefrontBlogPost />} />
                  <Route path="cart" element={<StorefrontCart />} />
                  <Route path="checkout" element={<StorefrontCheckout />} />
                  <Route path="obrigado" element={<StorefrontThankYou />} />
                  <Route path="minhas-compras" element={<StorefrontMyOrders />} />
                  <Route path="conta" element={<StorefrontAccount />} />
                  <Route path="conta/login" element={<StorefrontAccountLogin />} />
                  <Route path="conta/esqueci-senha" element={<StorefrontAccountForgotPassword />} />
                  <Route path="conta/redefinir-senha" element={<StorefrontResetPassword />} />
                  <Route path="minha-conta/redefinir-senha" element={<StorefrontResetPassword />} />
                  <Route path="conta/pedidos" element={<StorefrontOrdersList />} />
                  <Route path="conta/pedidos/:orderId" element={<StorefrontOrderDetail />} />
                </Route>
              )}

              {/* Legacy storefront routes with /store/:tenantSlug prefix (for app domain / fallback) */}
              <Route path="/store/:tenantSlug" element={<StorefrontLayout />}>
                <Route index element={<StorefrontHome />} />
                <Route path="c/:categorySlug" element={<StorefrontCategory />} />
                <Route path="p/:productSlug" element={<StorefrontProduct />} />
                <Route path="page/:pageSlug" element={<StorefrontPage />} />
                <Route path="lp/:pageSlug" element={<StorefrontLandingPage />} />
                <Route path="rastreio" element={<StorefrontPage />} />
                <Route path="blog" element={<StorefrontPage />} />
                <Route path="blog/:postSlug" element={<StorefrontBlogPost />} />
                <Route path="cart" element={<StorefrontCart />} />
                <Route path="checkout" element={<StorefrontCheckout />} />
                <Route path="obrigado" element={<StorefrontThankYou />} />
                <Route path="minhas-compras" element={<StorefrontMyOrders />} />
                <Route path="conta" element={<StorefrontAccount />} />
                <Route path="conta/login" element={<StorefrontAccountLogin />} />
                <Route path="conta/esqueci-senha" element={<StorefrontAccountForgotPassword />} />
                <Route path="conta/redefinir-senha" element={<StorefrontResetPassword />} />
                <Route path="minha-conta/redefinir-senha" element={<StorefrontResetPassword />} />
                <Route path="conta/pedidos" element={<StorefrontOrdersList />} />
                <Route path="conta/pedidos/:orderId" element={<StorefrontOrderDetail />} />
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

              {/* Protected routes with tenant requirement (admin panel) */}
              {!shouldUseTenantRootRoutes && (
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
                  <Route path="/orders/new" element={<OrderNew />} />
                  <Route path="/orders/:id" element={<OrderDetail />} />
                  <Route path="/shipments" element={<Shipments />} />
                  <Route path="/abandoned-checkouts" element={<AbandonedCheckouts />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/discounts" element={<Discounts />} />
                  <Route path="/menus" element={<Menus />} />
                  <Route path="/pages" element={<Pages />} />
                  <Route path="/pages/:pageId/builder" element={<PageBuilder />} />
                  <Route path="/page-templates" element={<PageTemplates />} />
                  <Route path="/page-templates/:templateId/builder" element={<TemplateBuilder />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/:postId/editor" element={<BlogPostEditor />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/media" element={<Media />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/buy-together" element={<Navigate to="/offers" replace />} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/emails" element={<Emails />} />
                  <Route path="/integrations" element={<Integrations />} />
                  <Route path="/marketing" element={<Marketing />} />
                  <Route path="/marketing/atribuicao" element={<Attribution />} />
                  <Route path="/finance" element={<Finance />} />
                  <Route path="/payments" element={<Navigate to="/integrations" replace />} />
                  <Route path="/shipping" element={<Navigate to="/integrations" replace />} />
                  <Route path="/fiscal" element={<Fiscal />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/purchases" element={<Purchases />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/domains" element={<Domains />} />
                  <Route path="/storefront" element={<StorefrontSettings />} />
                  <Route path="/storefront/builder" element={<StorefrontBuilder />} />
                  <Route path="/storefront/conversao" element={<StoreConfigSettings />} />
                  <Route path="/dev/url-diagnostics" element={<UrlDiagnostics />} />
                  {/* Platform admin routes */}
                  <Route path="/platform/integrations" element={<PlatformIntegrations />} />
                  <Route path="/platform/health-monitor" element={<HealthMonitor />} />
                  <Route path="/platform/block-suggestions" element={<BlockSuggestions />} />
                  <Route path="/demo-estrutura" element={<DemoEstruturaPage />} />
                  {/* Legacy redirects */}
                  <Route path="/health-monitor" element={<Navigate to="/platform/health-monitor" replace />} />
                  <Route path="/settings/emails" element={<Navigate to="/platform/integrations" replace />} />
                </Route>
              )}

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
