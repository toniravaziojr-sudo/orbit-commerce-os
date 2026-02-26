import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AdminToaster } from "@/components/ui/admin-sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { GatedRoute, FeatureGatedRoute } from "@/components/layout/GatedRoute";
import { CommandAssistantProvider, CommandAssistantPanel } from "@/components/command-assistant";

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
import MediaCampaignDetail from "@/pages/MediaCampaignDetail";
import Campaigns from "@/pages/Campaigns";
import AdsManager from "@/pages/AdsManager";
import Creatives from "@/pages/Creatives";
import Integrations from "@/pages/Integrations";
import Marketing from "@/pages/Marketing";
import Finance from "@/pages/Finance";
import Fiscal from "@/pages/Fiscal";
import FiscalProductsConfig from "@/pages/FiscalProductsConfig";
import OperationNaturesSettings from "@/pages/OperationNaturesSettings";
import Purchases from "@/pages/Purchases";
import Settings from "@/pages/Settings";
import Domains from "@/pages/Domains";
import StorefrontSettings from "@/pages/StorefrontSettings";
import StorefrontBuilder from "@/pages/StorefrontBuilder";
import PageBuilder from "@/pages/PageBuilder";
import PageTemplates from "@/pages/PageTemplates";
import TemplateBuilder from "@/pages/TemplateBuilder";
import LandingPages from "@/pages/LandingPages";
import LandingPageEditor from "@/pages/LandingPageEditor";
import BillingSettings from "@/pages/settings/BillingSettings";
import AddPaymentMethod from "@/pages/settings/AddPaymentMethod";


import Reviews from "@/pages/Reviews";
import Offers from "@/pages/Offers";
import Discounts from "@/pages/Discounts";
import AbandonedCheckouts from "@/pages/AbandonedCheckouts";
import StoreConfigSettings from "@/pages/StoreConfigSettings";
import CartAndCheckout from "@/pages/CartAndCheckout";
import UrlDiagnostics from "@/pages/UrlDiagnostics";
import HealthMonitor from "@/pages/HealthMonitor";
import Shipments from "@/pages/Shipments";
import ShippingDashboard from "@/pages/ShippingDashboard";
import ShippingSettings from "@/pages/ShippingSettings";
import Auth from "@/pages/Auth";
import AwaitingConfirmation from "@/pages/AwaitingConfirmation";
import AcceptInvite from "@/pages/AcceptInvite";
import SystemUsers from "@/pages/SystemUsers";
import CreateStore from "@/pages/CreateStore";
import NoAccess from "@/pages/NoAccess";
import ResetPassword from "@/pages/ResetPassword";
import StartPlan from "@/pages/start/StartPlan";
import StartInfo from "@/pages/start/StartInfo";
import StartPending from "@/pages/start/StartPending";
import CompleteSignup from "@/pages/start/CompleteSignup";
import GettingStarted from "@/pages/GettingStarted";
import SystemEmails from "@/pages/SystemEmails";
import PlatformIntegrations from "@/pages/PlatformIntegrations";
import Attribution from "@/pages/Attribution";
import Emails from "@/pages/Emails";
import EmailMarketing from "@/pages/EmailMarketing";
import EmailMarketingListDetail from "@/pages/EmailMarketingListDetail";
import Import from "@/pages/Import";
import Blog from "@/pages/Blog";
import BlogCampaigns from "@/pages/BlogCampaigns";
import BlogCampaignDetail from "@/pages/BlogCampaignDetail";
import BlogPostEditor from "@/pages/BlogPostEditor";
import Quizzes from "@/pages/Quizzes";
import { QuizEditor } from "@/components/quizzes";
import BlockSuggestions from "@/pages/BlockSuggestions";
import DemoEstruturaPage from "@/pages/DemoEstruturaPage";

import MetaOAuthCallback from "@/pages/MetaOAuthCallback";
import MeliOAuthCallback from "@/pages/MeliOAuthCallback";
import YouTubeCallback from "@/pages/integrations/YouTubeCallback";
import TikTokOAuthCallback from "@/pages/TikTokOAuthCallback";
import NotFound from "@/pages/NotFound";
import Marketplaces from "@/pages/Marketplaces";
import MercadoLivre from "@/pages/marketplaces/MercadoLivre";
import Shopee from "@/pages/marketplaces/Shopee";
import Olist from "@/pages/marketplaces/Olist";
import TikTokShop from "@/pages/marketplaces/TikTokShop";
import Files from "@/pages/Files";
import Reports from "@/pages/Reports";

import CommandCenter from "@/pages/CommandCenter";
import ChatGPT from "@/pages/ChatGPT";
import AIMemories from "@/pages/AIMemories";
import AccountData from "@/pages/account/AccountData";
import AccountBilling from "@/pages/account/Billing";
import PlatformBilling from "@/pages/platform/PlatformBilling";
import PlatformAnnouncements from "@/pages/platform/PlatformAnnouncements";
import PlatformTutorials from "@/pages/platform/PlatformTutorials";
 import PlatformTools from "@/pages/platform/PlatformTools";
import PlatformTenants from "@/pages/platform/PlatformTenants";
import Influencers from "@/pages/Influencers";

import Affiliates from "@/pages/Affiliates";
import SupportCenter from "@/pages/SupportCenter";
import AIPackages from "@/pages/AIPackages";
import QAStorefront from "@/pages/admin/QAStorefront";

// Storefront Pages
import { StorefrontLayout } from "@/components/storefront/StorefrontLayout";
import { TenantStorefrontLayout } from "@/components/storefront/TenantStorefrontLayout";
import StorefrontHome from "@/pages/storefront/StorefrontHome";
import StorefrontCategory from "@/pages/storefront/StorefrontCategory";
import StorefrontProduct from "@/pages/storefront/StorefrontProduct";
import StorefrontPage from "@/pages/storefront/StorefrontPage";
import StorefrontLandingPage from "@/pages/storefront/StorefrontLandingPage";
import StorefrontAILandingPage from "@/pages/storefront/StorefrontAILandingPage";
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
import StorefrontBlog from "@/pages/storefront/StorefrontBlog";
import StorefrontTracking from "@/pages/storefront/StorefrontTracking";
import StorefrontQuiz from "@/pages/storefront/StorefrontQuiz";
import StorefrontReview from "@/pages/storefront/StorefrontReview";

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
        {/* Admin usa AdminToaster (azul), Storefront usa Sonner (tema do tenant) */}
        {shouldUseTenantRootRoutes ? <Sonner /> : <AdminToaster />}
        <BrowserRouter>
          <AuthProvider>
            <CommandAssistantProvider>
              <CommandAssistantPanel />
              <Routes>
              {/* Public routes (always available) */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/aguardando-confirmacao" element={<AwaitingConfirmation />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              {/* Billing checkout flow (public) */}
              <Route path="/start" element={<StartPlan />} />
              <Route path="/start/info" element={<StartInfo />} />
              <Route path="/start/pending" element={<StartPending />} />
              <Route path="/complete-signup" element={<CompleteSignup />} />
              {/* Meta OAuth callback - handles Meta connection result */}
              <Route path="/integrations/meta/callback" element={<MetaOAuthCallback />} />
              {/* Mercado Livre OAuth callback - forwards to edge function */}
              <Route path="/integrations/meli/callback" element={<MeliOAuthCallback />} />
              {/* YouTube OAuth callback - handles YouTube connection result */}
              <Route path="/integrations/youtube/callback" element={<YouTubeCallback />} />
              {/* TikTok OAuth callback - handles TikTok connection result */}
              <Route path="/integrations/tiktok/callback" element={<TikTokOAuthCallback />} />
              <Route path="/demo-estrutura" element={<DemoEstruturaPage />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              {/* Preview route for review page (development only) */}
              <Route path="/avaliar/:token" element={<StorefrontReview />} />

              {/* 
                Storefront routes - When on tenant host (custom domain / platform subdomain),
                routes are at root. Otherwise, use /store/:tenantSlug prefix.
              */}
              
              {/* AI Landing Pages - standalone, no layout (full-page HTML) */}
              {shouldUseTenantRootRoutes && (
                <Route path="/ai-lp/:lpSlug" element={<StorefrontAILandingPage />} />
              )}

              {/* Root routes for custom/platform domains */}
              {shouldUseTenantRootRoutes && (
                <Route path="/" element={<TenantStorefrontLayout />}>
                  <Route index element={<StorefrontHome />} />
                  <Route path="c/:categorySlug" element={<StorefrontCategory />} />
                  <Route path="p/:productSlug" element={<StorefrontProduct />} />
                  <Route path="page/:pageSlug" element={<StorefrontPage />} />
                  <Route path="lp/:pageSlug" element={<StorefrontLandingPage />} />
                  <Route path="rastreio" element={<StorefrontTracking />} />
                  <Route path="blog" element={<StorefrontBlog />} />
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
                  <Route path="quiz/:quizSlug" element={<StorefrontQuiz />} />
                  <Route path="avaliar/:token" element={<StorefrontReview />} />
                </Route>
              )}

              {/* AI Landing Pages - standalone for /store/ routes (full-page HTML) */}
              <Route path="/store/:tenantSlug/ai-lp/:lpSlug" element={<StorefrontAILandingPage />} />

              {/* Legacy storefront routes with /store/:tenantSlug prefix (for app domain / fallback) */}
              <Route path="/store/:tenantSlug" element={<StorefrontLayout />}>
                <Route index element={<StorefrontHome />} />
                <Route path="c/:categorySlug" element={<StorefrontCategory />} />
                <Route path="p/:productSlug" element={<StorefrontProduct />} />
                <Route path="page/:pageSlug" element={<StorefrontPage />} />
                <Route path="lp/:pageSlug" element={<StorefrontLandingPage />} />
                <Route path="rastreio" element={<StorefrontTracking />} />
                <Route path="blog" element={<StorefrontBlog />} />
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
                <Route path="quiz/:quizSlug" element={<StorefrontQuiz />} />
                <Route path="avaliar/:token" element={<StorefrontReview />} />
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

              {/* No access page for removed invited users */}
              <Route
                path="/no-access"
                element={
                  <ProtectedRoute requireTenant={false}>
                    <NoAccess />
                  </ProtectedRoute>
                }
              />

              {/* QA Storefront - Platform admin only, no tenant required */}
              <Route
                path="/admin/qa/storefront"
                element={
                  <ProtectedRoute requireTenant={false}>
                    <QAStorefront />
                  </ProtectedRoute>
                }
              />


              {!shouldUseTenantRootRoutes && (
                <Route
                  element={
                    <ProtectedRoute>
                      <Outlet />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/storefront/builder" element={<StorefrontBuilder />} />
                  <Route path="/pages/:pageId/builder" element={<PageBuilder />} />
                  <Route path="/page-templates/:templateId/builder" element={<TemplateBuilder />} />
                  <Route path="/blog/:postId/editor" element={<BlogPostEditor />} />
                </Route>
              )}

              {/* Protected routes with tenant requirement (admin panel) */}
              {!shouldUseTenantRootRoutes && (
                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                {/* Redirect root to command-center */}
                  <Route path="/" element={<Navigate to="/command-center" replace />} />
                  <Route path="/command-center" element={<CommandCenter />} />
                  <Route path="/chatgpt" element={<FeatureGatedRoute moduleKey="central" featureKey="assistant" featureName="ChatGPT" featureDescription="Assistente IA para atendimento e suporte"><ChatGPT /></FeatureGatedRoute>} />
                  <Route path="/getting-started" element={<GettingStarted />} />
                  {/* Redirect old executions route to command-center tab */}
                  <Route path="/executions" element={<Navigate to="/command-center?tab=executions" replace />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/orders/new" element={<OrderNew />} />
                  <Route path="/orders/:id" element={<OrderDetail />} />
                  <Route path="/abandoned-checkouts" element={<AbandonedCheckouts />} />
                  {/* Shipping / Remessas Logísticas */}
                  <Route path="/shipping" element={<ShippingDashboard />} />
                  <Route path="/shipping/shipments" element={<FeatureGatedRoute moduleKey="erp_logistica" featureKey="remessas" featureName="Remessas" featureDescription="Gestão de remessas e etiquetas"><Shipments /></FeatureGatedRoute>} />
                  <Route path="/shipping/settings" element={<ShippingSettings />} />
                  <Route path="/shipments" element={<Navigate to="/shipping/shipments" replace />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/discounts" element={<Discounts />} />
                  <Route path="/menus" element={<Menus />} />
                  <Route path="/pages" element={<Pages />} />
                  <Route path="/page-templates" element={<PageTemplates />} />
                  <Route path="/landing-pages" element={<LandingPages />} />
                  <Route path="/landing-pages/:id" element={<LandingPageEditor />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/campaigns/:campaignId" element={<BlogCampaignDetail />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id" element={<CustomerDetail />} />
                  <Route path="/notifications" element={<FeatureGatedRoute moduleKey="crm" featureKey="whatsapp_notifications" featureName="Notificações WhatsApp" featureDescription="Envie notificações via WhatsApp"><Notifications /></FeatureGatedRoute>} />
                  <Route path="/support" element={<FeatureGatedRoute moduleKey="crm" featureKey="support_chat" featureName="Atendimento" featureDescription="Inbox unificado e chat com IA"><Support /></FeatureGatedRoute>} />
                  <Route path="/media" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado" moduleDescription="Gestor de Mídias IA para campanhas de conteúdo"><Media /></GatedRoute>} />
                  <Route path="/media/campaign/:campaignId" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado"><MediaCampaignDetail /></GatedRoute>} />
                  <Route path="/campaigns" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado" moduleDescription="Gestor de Tráfego IA para campanhas"><Campaigns /></GatedRoute>} />
                  <Route path="/creatives" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado" moduleDescription="Gestão de Criativos IA"><Creatives /></GatedRoute>} />
                  <Route path="/ads" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado" moduleDescription="Gestor de Tráfego Meta Ads"><AdsManager /></GatedRoute>} />
                  <Route path="/offers" element={<Offers />} />
                  <Route path="/buy-together" element={<Navigate to="/offers" replace />} />
                  <Route path="/reviews" element={<Reviews />} />
                  <Route path="/emails" element={<FeatureGatedRoute moduleKey="crm" featureKey="emails" featureName="Gestão de Emails" featureDescription="Caixas de email e inbox"><Emails /></FeatureGatedRoute>} />
                  <Route path="/integrations" element={<Integrations />} />
                  <Route path="/marketplaces" element={<Marketplaces />} />
                  <Route path="/marketplaces/mercadolivre" element={<FeatureGatedRoute moduleKey="marketplaces" featureKey="mercadolivre" featureName="Mercado Livre" featureDescription="Integração com Mercado Livre"><MercadoLivre /></FeatureGatedRoute>} />
                  <Route path="/marketplaces/shopee" element={<FeatureGatedRoute moduleKey="marketplaces" featureKey="shopee" featureName="Shopee" featureDescription="Integração com Shopee"><Shopee /></FeatureGatedRoute>} />
                  <Route path="/marketplaces/olist" element={<Olist />} />
                  <Route path="/marketplaces/tiktokshop" element={<FeatureGatedRoute moduleKey="marketplaces" featureKey="tiktokshop" featureName="TikTok Shop" featureDescription="Integração com TikTok Shop"><TikTokShop /></FeatureGatedRoute>} />
                  <Route path="/files" element={<Files />} />
                  <Route path="/reports" element={<FeatureGatedRoute moduleKey="central" featureKey="reports" featureName="Relatórios" featureDescription="Relatórios avançados"><Reports /></FeatureGatedRoute>} />
                  
                  <Route path="/marketing" element={<Navigate to="/integrations?tab=social" replace />} />
                  <Route path="/marketing/atribuicao" element={<FeatureGatedRoute moduleKey="marketing_basico" featureKey="attribution" featureName="Atribuição de Vendas" featureDescription="Atribuição de vendas por canal"><Attribution /></FeatureGatedRoute>} />
                  <Route path="/email-marketing" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado" moduleDescription="Email Marketing para campanhas"><EmailMarketing /></GatedRoute>} />
                  <Route path="/email-marketing/list/:listId" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado"><EmailMarketingListDetail /></GatedRoute>} />
                  <Route path="/quizzes" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado" moduleDescription="Quizzes interativos"><Quizzes /></GatedRoute>} />
                  <Route path="/quizzes/:quizId" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado"><QuizEditor /></GatedRoute>} />
                  <Route path="/finance" element={<GatedRoute moduleKey="erp_financeiro" moduleName="ERP Financeiro" moduleDescription="Gestão financeira e contas"><Finance /></GatedRoute>} />
                  <Route path="/payments" element={<Navigate to="/integrations" replace />} />
                  <Route path="/shipping" element={<Navigate to="/integrations" replace />} />
                  <Route path="/fiscal" element={<Fiscal />} />
                  <Route path="/fiscal/products" element={<FiscalProductsConfig />} />
                  <Route path="/fiscal/operation-natures" element={<OperationNaturesSettings />} />
                  <Route path="/import" element={<GatedRoute moduleKey="sistema_importacao" moduleName="Importação de Dados" moduleDescription="Importe produtos, clientes e pedidos de outras plataformas"><Import /></GatedRoute>} />
                  <Route path="/purchases" element={<GatedRoute moduleKey="erp_compras" moduleName="ERP Compras" moduleDescription="Gestão de compras e fornecedores"><Purchases /></GatedRoute>} />
                  <Route path="/influencers" element={<GatedRoute moduleKey="parcerias" moduleName="Parcerias" moduleDescription="Gestão de influencers"><Influencers /></GatedRoute>} />
                  
                  <Route path="/affiliates" element={<GatedRoute moduleKey="parcerias" moduleName="Parcerias" moduleDescription="Programa de afiliados"><Affiliates /></GatedRoute>} />
                  <Route path="/support-center" element={<SupportCenter />} />
                  <Route path="/ai-packages" element={<AIPackages />} />
                  <Route path="/ai-memories" element={<AIMemories />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/domains" element={<Domains />} />
                  <Route path="/settings/billing" element={<BillingSettings />} />
                  <Route path="/settings/add-payment-method" element={<AddPaymentMethod />} />
                  <Route path="/settings/fiscal" element={<Navigate to="/fiscal?tab=configuracoes" replace />} />
                  {/* Account routes */}
                  <Route path="/account/personal" element={<Navigate to="/account/data" replace />} />
                  <Route path="/account/company" element={<Navigate to="/account/data" replace />} />
                  <Route path="/account/data" element={<AccountData />} />
                  <Route path="/account/billing" element={<AccountBilling />} />
                  <Route path="/storefront" element={<StorefrontSettings />} />
                  <Route path="/storefront/conversao" element={<Navigate to="/abandoned-checkouts" replace />} />
                  <Route path="/cart-checkout" element={<Navigate to="/abandoned-checkouts" replace />} />
                  <Route path="/abandoned-checkouts" element={<AbandonedCheckouts />} />
                  <Route path="/dev/url-diagnostics" element={<UrlDiagnostics />} />
                  {/* Platform admin routes */}
                  <Route path="/platform/integrations" element={<PlatformIntegrations />} />
                  <Route path="/platform/health-monitor" element={<HealthMonitor />} />
                  <Route path="/platform/block-suggestions" element={<BlockSuggestions />} />
                  <Route path="/platform/billing" element={<PlatformBilling />} />
                  <Route path="/platform/emails" element={<SystemEmails />} />
                  <Route path="/platform/announcements" element={<PlatformAnnouncements />} />
                  <Route path="/platform/tutorials" element={<PlatformTutorials />} />
                   <Route path="/platform/tenants" element={<PlatformTenants />} />
                   <Route path="/platform/tools" element={<PlatformTools />} />
                  {/* System routes - Owner only */}
                  <Route path="/system/users" element={<GatedRoute moduleKey="sistema_usuarios" moduleName="Usuários e Permissões" moduleDescription="Gerencie usuários e permissões da sua loja"><SystemUsers /></GatedRoute>} />
                  {/* Legacy redirects */}
                  <Route path="/health-monitor" element={<Navigate to="/platform/health-monitor" replace />} />
                  <Route path="/settings/emails" element={<Navigate to="/platform/integrations" replace />} />
                </Route>
              )}

              <Route path="*" element={<NotFound />} />
            </Routes>
            </CommandAssistantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
