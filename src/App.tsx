import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { AdminToaster } from "@/components/ui/admin-sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GatedRoute, FeatureGatedRoute } from "@/components/layout/GatedRoute";
import { CommandAssistantProvider, CommandAssistantPanel } from "@/components/command-assistant";
import { lazy, Suspense } from "react";

// =============================================
// LAZY LOADED PAGES — Code splitting for performance
// Admin pages are lazy-loaded so storefront visitors don't download admin code
// Storefront pages are lazy-loaded so admin visitors don't download storefront code
// =============================================

// Auth & Public Pages (always needed, small — keep static)
import Auth from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

// Admin Shell — lazy loaded (heavy: sidebar, navigation, providers)
const AppShell = lazy(() => import("@/components/layout/AppShell").then(m => ({ default: m.AppShell })));

// Admin Pages — LAZY LOADED (isolated from storefront bundle)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Executions = lazy(() => import("@/pages/Executions"));
const Orders = lazy(() => import("@/pages/Orders"));
const OrderNew = lazy(() => import("@/pages/OrderNew"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const Products = lazy(() => import("@/pages/Products"));
const Categories = lazy(() => import("@/pages/Categories"));
const Menus = lazy(() => import("@/pages/Menus"));
const Pages = lazy(() => import("@/pages/Pages"));
const Customers = lazy(() => import("@/pages/Customers"));
const CustomerDetail = lazy(() => import("@/pages/CustomerDetail"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const Support = lazy(() => import("@/pages/Support"));
const Media = lazy(() => import("@/pages/Media"));
const MediaCampaignDetail = lazy(() => import("@/pages/MediaCampaignDetail"));
const Campaigns = lazy(() => import("@/pages/Campaigns"));
const AdsManager = lazy(() => import("@/pages/AdsManager"));
const Creatives = lazy(() => import("@/pages/Creatives"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const Finance = lazy(() => import("@/pages/Finance"));
const Fiscal = lazy(() => import("@/pages/Fiscal"));
const FiscalProductsConfig = lazy(() => import("@/pages/FiscalProductsConfig"));
const OperationNaturesSettings = lazy(() => import("@/pages/OperationNaturesSettings"));
const Purchases = lazy(() => import("@/pages/Purchases"));
const Settings = lazy(() => import("@/pages/Settings"));
const Domains = lazy(() => import("@/pages/Domains"));
const StorefrontSettings = lazy(() => import("@/pages/StorefrontSettings"));
const StorefrontBuilder = lazy(() => import("@/pages/StorefrontBuilder"));
const PageBuilder = lazy(() => import("@/pages/PageBuilder"));
const PageTemplates = lazy(() => import("@/pages/PageTemplates"));
const TemplateBuilder = lazy(() => import("@/pages/TemplateBuilder"));
const LandingPageEditor = lazy(() => import("@/pages/LandingPageEditor"));
const BillingSettings = lazy(() => import("@/pages/settings/BillingSettings"));
const AddPaymentMethod = lazy(() => import("@/pages/settings/AddPaymentMethod"));
const Reviews = lazy(() => import("@/pages/Reviews"));
const Offers = lazy(() => import("@/pages/Offers"));
const Discounts = lazy(() => import("@/pages/Discounts"));
const AbandonedCheckouts = lazy(() => import("@/pages/AbandonedCheckouts"));
const UrlDiagnostics = lazy(() => import("@/pages/UrlDiagnostics"));
const HealthMonitor = lazy(() => import("@/pages/HealthMonitor"));
const Shipments = lazy(() => import("@/pages/Shipments"));
const ShippingDashboard = lazy(() => import("@/pages/ShippingDashboard"));
const ShippingSettings = lazy(() => import("@/pages/ShippingSettings"));
const AwaitingConfirmation = lazy(() => import("@/pages/AwaitingConfirmation"));
const AcceptInvite = lazy(() => import("@/pages/AcceptInvite"));
const SystemUsers = lazy(() => import("@/pages/SystemUsers"));
const CreateStore = lazy(() => import("@/pages/CreateStore"));
const NoAccess = lazy(() => import("@/pages/NoAccess"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const StartPlan = lazy(() => import("@/pages/start/StartPlan"));
const StartInfo = lazy(() => import("@/pages/start/StartInfo"));
const StartPending = lazy(() => import("@/pages/start/StartPending"));
const CompleteSignup = lazy(() => import("@/pages/start/CompleteSignup"));
const GettingStarted = lazy(() => import("@/pages/GettingStarted"));
const SystemEmails = lazy(() => import("@/pages/SystemEmails"));
const PlatformIntegrations = lazy(() => import("@/pages/PlatformIntegrations"));
const Attribution = lazy(() => import("@/pages/Attribution"));
const Emails = lazy(() => import("@/pages/Emails"));
const EmailMarketing = lazy(() => import("@/pages/EmailMarketing"));
const EmailMarketingListDetail = lazy(() => import("@/pages/EmailMarketingListDetail"));
const EmailMarketingCampaignBuilder = lazy(() => import("@/pages/EmailMarketingCampaignBuilder"));
const EmailMarketingAutomationBuilder = lazy(() => import("@/pages/EmailMarketingAutomationBuilder"));
const Import = lazy(() => import("@/pages/Import"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogCampaignDetail = lazy(() => import("@/pages/BlogCampaignDetail"));
const BlogPostEditor = lazy(() => import("@/pages/BlogPostEditor"));
const Quizzes = lazy(() => import("@/pages/Quizzes"));
const QuizEditor = lazy(() => import("@/components/quizzes").then(m => ({ default: m.QuizEditor })));
const BlockSuggestions = lazy(() => import("@/pages/BlockSuggestions"));
const DemoEstruturaPage = lazy(() => import("@/pages/DemoEstruturaPage"));
const DemoLandingPage = lazy(() => import("@/pages/DemoLandingPage"));
const MetaOAuthCallback = lazy(() => import("@/pages/MetaOAuthCallback"));
const MeliOAuthCallback = lazy(() => import("@/pages/MeliOAuthCallback"));
const YouTubeCallback = lazy(() => import("@/pages/integrations/YouTubeCallback"));
const TikTokOAuthCallback = lazy(() => import("@/pages/TikTokOAuthCallback"));
const Marketplaces = lazy(() => import("@/pages/Marketplaces"));
const MercadoLivre = lazy(() => import("@/pages/marketplaces/MercadoLivre"));
const Shopee = lazy(() => import("@/pages/marketplaces/Shopee"));
const Olist = lazy(() => import("@/pages/marketplaces/Olist"));
const TikTokShop = lazy(() => import("@/pages/marketplaces/TikTokShop"));
const Files = lazy(() => import("@/pages/Files"));
const Reports = lazy(() => import("@/pages/Reports"));
const CommandCenter = lazy(() => import("@/pages/CommandCenter"));
const ChatGPT = lazy(() => import("@/pages/ChatGPT"));
const AIMemories = lazy(() => import("@/pages/AIMemories"));
const AccountData = lazy(() => import("@/pages/account/AccountData"));
const AccountBilling = lazy(() => import("@/pages/account/Billing"));
const PlatformBilling = lazy(() => import("@/pages/platform/PlatformBilling"));
const PlatformAnnouncements = lazy(() => import("@/pages/platform/PlatformAnnouncements"));
const PlatformTutorials = lazy(() => import("@/pages/platform/PlatformTutorials"));
const PlatformTools = lazy(() => import("@/pages/platform/PlatformTools"));
const PlatformTenants = lazy(() => import("@/pages/platform/PlatformTenants"));
const Influencers = lazy(() => import("@/pages/Influencers"));
const Affiliates = lazy(() => import("@/pages/Affiliates"));
const SupportCenter = lazy(() => import("@/pages/SupportCenter"));
const AIPackages = lazy(() => import("@/pages/AIPackages"));
const QAStorefront = lazy(() => import("@/pages/admin/QAStorefront"));

// Storefront Pages — LAZY LOADED (isolated from admin bundle)
// NOTE: Content pages (Home, Category, Product, Blog, Page, LP) are Edge-only.
// Only interactive SPA pages are loaded here.
const StorefrontLayout = lazy(() => import("@/components/storefront/StorefrontLayout").then(m => ({ default: m.StorefrontLayout })));
const TenantStorefrontLayout = lazy(() => import("@/components/storefront/TenantStorefrontLayout").then(m => ({ default: m.TenantStorefrontLayout })));

const StorefrontAILandingPage = lazy(() => import("@/pages/storefront/StorefrontAILandingPage"));
const StorefrontCart = lazy(() => import("@/pages/storefront/StorefrontCart"));
const StorefrontCheckout = lazy(() => import("@/pages/storefront/StorefrontCheckout"));
const StorefrontThankYou = lazy(() => import("@/pages/storefront/StorefrontThankYou"));
const StorefrontMyOrders = lazy(() => import("@/pages/storefront/StorefrontMyOrders"));
const StorefrontAccount = lazy(() => import("@/pages/storefront/StorefrontAccount"));
const StorefrontAccountLogin = lazy(() => import("@/pages/storefront/StorefrontAccountLogin"));
const StorefrontAccountForgotPassword = lazy(() => import("@/pages/storefront/StorefrontAccountForgotPassword"));
const StorefrontOrdersList = lazy(() => import("@/pages/storefront/StorefrontOrdersList"));
const StorefrontOrderDetail = lazy(() => import("@/pages/storefront/StorefrontOrderDetail"));
const StorefrontResetPassword = lazy(() => import("@/pages/storefront/StorefrontResetPassword"));
const StorefrontTracking = lazy(() => import("@/pages/storefront/StorefrontTracking"));
const StorefrontQuiz = lazy(() => import("@/pages/storefront/StorefrontQuiz"));
const StorefrontReview = lazy(() => import("@/pages/storefront/StorefrontReview"));
const StorefrontSearch = lazy(() => import("@/pages/storefront/StorefrontSearch"));

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
              <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
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
              <Route path="/demo-lp" element={<DemoLandingPage />} />
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
                  <Route path="busca" element={<StorefrontSearch />} />
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
                <Route path="busca" element={<StorefrontSearch />} />
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
                  <Route path="/landing-pages" element={<Navigate to="/pages" replace />} />
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
                  <Route path="/email-marketing/campaign/new" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado"><EmailMarketingCampaignBuilder /></GatedRoute>} />
                  <Route path="/email-marketing/automation/new" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado"><EmailMarketingAutomationBuilder /></GatedRoute>} />
                  <Route path="/email-marketing/automation/:flowId" element={<GatedRoute moduleKey="marketing_avancado" moduleName="Marketing Avançado"><EmailMarketingAutomationBuilder /></GatedRoute>} />
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
              </Suspense>
            </CommandAssistantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
