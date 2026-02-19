import { useState, useMemo, ReactNode, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { platformBranding } from "@/lib/branding";
import { LogoIcon } from "@/components/branding/Logo";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useTenantType } from "@/hooks/useTenantType";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useAllModuleAccess, AccessLevel } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useIsSpecialTenant } from "@/hooks/useIsSpecialTenant";
import { useDemoMode } from "@/hooks/useDemoMode";
import { usePermissions } from "@/hooks/usePermissions";
import { useAdminModeSafe } from "@/contexts/AdminModeContext";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { FeatureGate } from "@/components/layout/FeatureGate";
import { getModuleStatus, ModuleStatus } from "@/config/module-status";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Bell,
  MessageSquare,
  Image,
  Megaphone,
  Plug,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Activity,
  FileText,
  ShoppingBag,
  Store,
  FolderTree,
  Menu,
  Star,
  TrendingUp,
  Percent,
  Truck,
  Mail,
  Upload,
  BookOpen,
  Sparkles,
  FolderOpen,
  BarChart3,
  Building2,
  LifeBuoy,
  CreditCard,
  UserCheck,
  Cpu,
  Handshake,
  UsersRound,
  Lock,
   Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TenantSwitcher } from "./TenantSwitcher";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  featureKey?: string;
  adminOnly?: boolean;
  ownerOnly?: boolean; // Only visible to tenant owner
  locked?: boolean; // Module is locked and shows "Em breve" tag
  blockedFeature?: string; // Feature key that blocks this item if in blocked_features
}

interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  collapsible?: boolean;
  moduleKey?: string; // Maps to plan_module_access.module_key
}

// Full navigation for tenant users - with collapsible groups
const fullNavigation: NavGroup[] = [
  {
    label: "Principal",
    moduleKey: "central",
    items: [
      { title: "Central de Comando", href: "/command-center", icon: LayoutDashboard },
      { title: "ChatGPT", href: "/chatgpt", icon: Sparkles, blockedFeature: "assistant" },
    ],
  },
  {
    label: "E-commerce",
    moduleKey: "ecommerce",
    collapsible: true,
    items: [
      { title: "Pedidos", href: "/orders", icon: ShoppingCart },
      { title: "Checkout Abandonado", href: "/abandoned-checkouts", icon: ShoppingBag },
      { title: "Produtos", href: "/products", icon: Package },
      { title: "Clientes", href: "/customers", icon: Users },
    ],
  },
  {
    label: "Loja Online",
    moduleKey: "loja_online",
    collapsible: true,
    items: [
      { title: "Loja Virtual", href: "/storefront", icon: Store },
      { title: "Landing Pages", href: "/landing-pages", icon: Sparkles },
      { title: "Categorias", href: "/categories", icon: FolderTree },
      { title: "Menus", href: "/menus", icon: Menu },
      { title: "Páginas da Loja", href: "/pages", icon: FileText },
    ],
  },
  {
    label: "Marketing Básico",
    moduleKey: "marketing_basico",
    collapsible: true,
    items: [
      { title: "Blog", href: "/blog", icon: BookOpen },
      { title: "Atribuição de venda", href: "/marketing/atribuicao", icon: TrendingUp, blockedFeature: "attribution" },
      { title: "Descontos", href: "/discounts", icon: Percent },
      { title: "Aumentar Ticket", href: "/offers", icon: TrendingUp },
    ],
  },
  {
    label: "Marketing Avançado",
    moduleKey: "marketing_avancado",
    collapsible: true,
    items: [
      { title: "Email Marketing", href: "/email-marketing", icon: Mail, blockedFeature: "email_marketing" },
      { title: "Quizzes", href: "/quizzes", icon: FileText, blockedFeature: "quizzes" },
      { title: "Gestor de Tráfego IA", href: "/ads", icon: Megaphone },
    ],
  },
  {
    label: "Central de Conteúdo",
    moduleKey: "central_conteudo",
    collapsible: true,
    items: [
      { title: "Calendário de Conteúdo", href: "/media", icon: Image },
      { title: "Estúdio de Criativos", href: "/creatives", icon: Sparkles },
    ],
  },
  {
    label: "CRM",
    moduleKey: "crm",
    collapsible: true,
    items: [
      { title: "Notificações", href: "/notifications", icon: Bell, blockedFeature: "whatsapp_notifications" },
      { title: "Atendimento", href: "/support", icon: MessageSquare, blockedFeature: "support_chat" },
      { title: "Emails", href: "/emails", icon: Mail, blockedFeature: "emails" },
      { title: "Avaliações", href: "/reviews", icon: Star },
    ],
  },
  {
    label: "ERP",
    moduleKey: "erp_logistica",
    collapsible: true,
    items: [
      { title: "Fiscal", href: "/fiscal", icon: FileText },
      { title: "Financeiro", href: "/finance", icon: DollarSign, blockedFeature: "erp_financeiro" },
      { title: "Compras", href: "/purchases", icon: ShoppingBag, blockedFeature: "erp_compras" },
      { title: "Logística", href: "/shipping", icon: Truck, blockedFeature: "remessas" },
    ],
  },
  {
    label: "Parcerias",
    moduleKey: "parcerias",
    collapsible: true,
    items: [
      { title: "Influencers", href: "/influencers", icon: UserCheck, blockedFeature: "influencers" },
      { title: "Afiliados", href: "/affiliates", icon: Handshake },
    ],
  },
  {
    label: "Marketplaces",
    moduleKey: "marketplaces",
    collapsible: true,
    items: [
      { title: "Mercado Livre", href: "/marketplaces/mercadolivre", icon: Building2, blockedFeature: "mercadolivre" },
      { title: "Shopee", href: "/marketplaces/shopee", icon: ShoppingBag, blockedFeature: "shopee" },
      { title: "Olist", href: "/marketplaces/olist", icon: Package },
    ],
  },
  {
    label: "Sistema",
    moduleKey: "sistema_integracoes",
    collapsible: true,
    items: [
      { title: "Integrações", href: "/integrations", icon: Plug },
      { title: "Importar Dados", href: "/import", icon: Upload, blockedFeature: "sistema_importacao" },
      { title: "Usuários e Permissões", href: "/system/users", icon: UsersRound, ownerOnly: true, blockedFeature: "sistema_usuarios" },
    ],
  },
  {
    label: "Utilitários",
    moduleKey: "central",
    collapsible: true,
    items: [
      { title: "Meu Drive", href: "/files", icon: FolderOpen },
      { title: "Relatórios", href: "/reports", icon: BarChart3, blockedFeature: "reports" },
    ],
  },
  {
    label: "Suporte",
    moduleKey: "suporte",
    items: [
      { title: "Suporte", href: "/support-center", icon: LifeBuoy },
      { title: "Pacotes IA", href: "/ai-packages", icon: Cpu },
    ],
  },
];

// Navigation for Platform Admin (Comando Central) - ONLY PLATFORM MODULES
// Client modules (Marketing, CRM, ERP, etc.) are accessed via "Minha Loja" mode
const platformAdminNavigation: NavGroup[] = [
  {
    label: "Plataforma",
    items: [
      { title: "Health Monitor", href: "/platform/health-monitor", icon: Activity },
      { title: "Integrações da Plataforma", href: "/platform/integrations", icon: Plug },
      { title: "Sugestões de Blocos", href: "/platform/block-suggestions", icon: Sparkles },
      { title: "Assinaturas", href: "/platform/billing", icon: CreditCard },
      { title: "Emails do Sistema", href: "/platform/emails", icon: Mail },
      { title: "Avisos da Plataforma", href: "/platform/announcements", icon: Bell },
      { title: "Tutoriais por Módulo", href: "/platform/tutorials", icon: BookOpen },
       { title: "Tenants", href: "/platform/tenants", icon: Store },
       { title: "Ferramentas", href: "/platform/tools", icon: Wrench },
    ],
  },
];

// Platform section for users who have tenant AND are platform admins
const platformNavigation: NavGroup = {
  label: "Plataforma",
  items: [
    { title: "Health Monitor", href: "/platform/health-monitor", icon: Activity },
    { title: "Integrações da Plataforma", href: "/platform/integrations", icon: Plug },
    { title: "Sugestões de Blocos", href: "/platform/block-suggestions", icon: Sparkles },
    { title: "Emails do Sistema", href: "/platform/emails", icon: Mail },
  ],
};

const STORAGE_KEY = 'sidebar-collapsed-groups';

function getInitialOpenGroups(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function ModuleStatusIndicator({ status }: { status: ModuleStatus }) {
  if (status === 'ready') {
    return <span className="text-green-500 text-xs ml-1" title="100% funcional">✅</span>;
  }
  return <span className="text-amber-500 text-xs ml-1" title="Em construção">🟧</span>;
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(getInitialOpenGroups);
  const location = useLocation();
  const { isPlatformOperator } = usePlatformOperator();
  const { isPlatformTenant, isUnlimited, isLoading: isTenantTypeLoading } = useTenantType();
  const { currentTenant, tenants } = useAuth();
  const { isSpecialTenant } = useIsSpecialTenant();
  const { isDemoMode } = useDemoMode();
  const { isOwner, isSidebarItemVisible, isPlatformOperator: isPlatformOp } = usePermissions();
  
  // Get module access info for all modules
  const { data: moduleAccess, isLoading: moduleAccessLoading } = useAllModuleAccess();
  
  // Admin Mode context - for platform operators to switch between Platform and Store views
  // Using safe version that works even outside AdminModeProvider
  const adminMode = useAdminModeSafe();

  // Persist open groups state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Helper function to check if a module is accessible
  const isModuleAccessible = (moduleKey?: string): boolean => {
    // Platform operators have full access
    if (isPlatformOperator) return true;
    // Unlimited/special tenants have full access (no module blocking)
    if (isUnlimited) return true;
    // If no moduleKey specified or no access data, allow
    if (!moduleKey || !moduleAccess) return true;
    // Check module access
    const access = moduleAccess[moduleKey];
    return !access || access.hasAccess;
  };

  // Helper function to check if a feature is blocked
  const isFeatureBlocked = (moduleKey?: string, featureKey?: string): boolean => {
    // Platform operators have full access
    if (isPlatformOperator) return false;
    // Unlimited/special tenants have full access (no upgrade badges)
    if (isUnlimited) return false;
    // If no feature specified, not blocked
    if (!featureKey) return false;
    
    // Check module-specific blocked features first
    if (moduleKey && moduleAccess) {
      const access = moduleAccess[moduleKey];
      // If module has access_level 'none', all features are blocked
      if (access?.accessLevel === 'none') {
        return true;
      }
      // Check specific blocked features for this module
      if (access?.blockedFeatures?.includes(featureKey)) {
        return true;
      }
      // Check wildcard - means all features are blocked
      if (access?.blockedFeatures?.includes('*')) {
        return true;
      }
    }
    
    // Check if the featureKey itself is a module with its own access config
    // This handles cases like 'erp_financeiro', 'sistema_importacao', etc.
    const moduleAccessEntry = moduleAccess?.[featureKey];
    if (moduleAccessEntry) {
      if (moduleAccessEntry.accessLevel === 'none') {
        return true;
      }
      if (moduleAccessEntry.blockedFeatures?.includes('*')) {
        return true;
      }
    }
    
    return false;
  };

  // Determine which navigation to show based on:
  // 1. For platform operators: use AdminMode toggle (platform vs store)
  // 2. For platform tenants (without toggle): always show platform nav
  // 3. For regular users: always show full client nav
  const { navigation, showPlatformSection } = useMemo(() => {
    // Platform operator using toggle
    if (isPlatformOperator) {
      if (adminMode.isPlatformMode) {
        // Platform mode: show platform admin navigation
        return { navigation: platformAdminNavigation, showPlatformSection: false };
      } else {
        // Store mode: show full client navigation (no separate platform section)
        return { navigation: fullNavigation, showPlatformSection: false };
      }
    }
    
    // Regular platform tenant (not operator) - show platform nav
    if (isPlatformTenant) {
      return { navigation: platformAdminNavigation, showPlatformSection: false };
    }
    
    // Regular customer tenant - show full navigation
    return { navigation: fullNavigation, showPlatformSection: false };
  }, [isPlatformTenant, isPlatformOperator, adminMode.isPlatformMode]);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/pages") return location.pathname === "/pages" || location.pathname.startsWith("/pages/");
    if (href === "/storefront") return location.pathname === "/storefront" || location.pathname.startsWith("/storefront/builder");
    if (href === "/marketing") return location.pathname === "/marketing";
    return location.pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isActive(item.href));
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isGroupOpen = (group: NavGroup) => {
    if (!group.collapsible) return true;
    // Default to open if has active item
    if (openGroups[group.label] === undefined) {
      return isGroupActive(group);
    }
    return openGroups[group.label];
  };

  // Modules that should be locked for non-admin users
  const COMING_SOON_MODULES = ['/marketplaces/shopee'];
  
  const renderNavItem = (item: NavItem, groupModuleKey?: string) => {
    // Owner-only items visibility check
    if (item.ownerOnly && !isOwner && !isPlatformOp) {
      return null;
    }
    
    // Permission-based visibility (for non-platform tenant navigation)
    if (!isPlatformTenant && !item.ownerOnly && !isSidebarItemVisible(item.href)) {
      return null;
    }
    
    const Icon = item.icon;
    const active = isActive(item.href);
    // Hide module status indicators for demo users (e.g., Shopee reviewers)
    const status = (isSpecialTenant && !isDemoMode) ? getModuleStatus(item.href) : undefined;

    // Determine if item should be locked:
    // 1. If item has locked=true in definition, always lock
    // 2. If item is in COMING_SOON_MODULES and user is NOT platform operator, lock it
    const isComingSoon = COMING_SOON_MODULES.includes(item.href);
    const shouldBeLocked = item.locked || (isComingSoon && !isPlatformOperator);

    // Check if feature is blocked by plan
    const isBlockedByPlan = !isPlatformOperator && isFeatureBlocked(groupModuleKey, item.blockedFeature);

    // Locked items render differently - no navigation
    if (shouldBeLocked) {
      const lockedContent = (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium cursor-not-allowed",
            "text-sidebar-foreground/70"
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.title}</span>
              <span className="text-[10px] font-semibold bg-amber-500/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                Em breve
              </span>
            </>
          )}
        </div>
      );

      return (
        <li key={item.href}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>{lockedContent}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {item.title}
                <span className="ml-1 text-amber-500">Em breve</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            lockedContent
          )}
        </li>
      );
    }

    // Blocked by plan - allow navigation but show Upgrade badge
    if (isBlockedByPlan) {
      const blockedContent = (
        <NavLink
          to={item.href}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-sidebar-primary" : "")} />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.title}</span>
              <span className="text-[10px] font-semibold bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                Upgrade
              </span>
            </>
          )}
        </NavLink>
      );

      return (
        <li key={item.href}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>{blockedContent}</TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {item.title}
                <span className="ml-1 text-primary text-xs">Upgrade necessário</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            blockedContent
          )}
        </li>
      );
    }

    const linkContent = (
      <NavLink
        to={item.href}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-sidebar-primary" : "")} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.title}</span>
            {status && <ModuleStatusIndicator status={status} />}
            {item.badge && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {item.badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );

    const wrappedLink = collapsed ? (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.title}
          {status && <ModuleStatusIndicator status={status} />}
        </TooltipContent>
      </Tooltip>
    ) : (
      linkContent
    );

    let gatedContent: ReactNode = wrappedLink;
    if (item.adminOnly) {
      gatedContent = <PlatformAdminGate>{wrappedLink}</PlatformAdminGate>;
    } else if (item.featureKey) {
      gatedContent = <FeatureGate feature={item.featureKey}>{wrappedLink}</FeatureGate>;
    }

    if (!gatedContent) return null;
    
    return <li key={item.href}>{gatedContent}</li>;
  };

  const renderNavGroup = (group: NavGroup) => {
    // Check if the entire module is blocked (access_level = 'none')
    const moduleBlocked = !isPlatformOperator && group.moduleKey && !isModuleAccessible(group.moduleKey);
    
    // Filter items based on permissions - THIS IS CRITICAL FOR RBAC
    const visibleItems = group.items.filter(item => {
      if (item.ownerOnly && !isOwner && !isPlatformOp) return false;
      if (!isPlatformTenant && !item.ownerOnly && !isSidebarItemVisible(item.href)) return false;
      return true;
    });
    
    // Don't render group if no visible items
    if (visibleItems.length === 0) return null;
    
    const groupActive = visibleItems.some((item) => isActive(item.href));
    const open = isGroupOpen(group);

    // When collapsed, show only icons for visible items (no collapsible groups)
    if (collapsed) {
      return (
        <div key={group.label} className="mb-2">
          <ul className="space-y-0.5">{visibleItems.map(item => renderNavItem(item, group.moduleKey))}</ul>
        </div>
      );
    }

    // If entire module is blocked, show locked group
    if (moduleBlocked) {
      return (
        <div key={group.label} className="mb-1">
          <div
            className={cn(
              "flex w-full items-center justify-between px-2 py-2 rounded-md",
              "bg-muted/30 text-sidebar-foreground/50 cursor-not-allowed"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide truncate">{group.label}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded cursor-help">
                  Upgrade
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">Módulo bloqueado</p>
                <p className="text-xs text-muted-foreground">Disponível em planos superiores</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      );
    }

    // When expanded and collapsible, use Collapsible component
    if (group.collapsible) {
      return (
        <div key={group.label} className="mb-1">
          <Collapsible open={open} onOpenChange={() => toggleGroup(group.label)}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center justify-between px-2 py-2 rounded-md transition-all duration-200",
                  "hover:bg-sidebar-accent/50",
                  open 
                    ? "bg-sidebar-accent/30 text-sidebar-foreground" 
                    : "text-sidebar-foreground/80",
                  groupActive && !open && "text-sidebar-primary"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide truncate">{group.label}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    open ? "rotate-180" : ""
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="space-y-0.5 mt-1 ml-2 pl-4 border-l border-sidebar-border/50">
                {visibleItems.map(item => renderNavItem(item, group.moduleKey))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    }

    // Non-collapsible expanded groups
    return (
      <div key={group.label} className="mb-3">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          {group.label}
        </p>
        <ul className="space-y-0.5">{visibleItems.map(item => renderNavItem(item, group.moduleKey))}</ul>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[60px]" : "w-60"
      )}
    >
      {/* Logo & Tenant Switcher */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center">
                <LogoIcon size={36} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              {platformBranding.productName}
            </TooltipContent>
          </Tooltip>
        ) : (
          <TenantSwitcher />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {navigation.map(renderNavGroup)}

        {/* Platform admin navigation - only for platform operators WITH tenant context */}
        {showPlatformSection && (
          <PlatformAdminGate>
            <div className="mb-4">
              {!collapsed && (
                <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-primary">
                  {platformNavigation.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {platformNavigation.items.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname.startsWith(item.href);
                  const status = isSpecialTenant ? getModuleStatus(item.href) : undefined;

                  const linkContent = (
                    <NavLink
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all border border-primary/20",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-primary" : "text-primary/70")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {status && <ModuleStatusIndicator status={status} />}
                        </>
                      )}
                    </NavLink>
                  );

                  const wrappedLink = collapsed ? (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.title}
                        {status && <ModuleStatusIndicator status={status} />}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    linkContent
                  );

                  return <li key={item.href}>{wrappedLink}</li>;
                })}
              </ul>
            </div>
          </PlatformAdminGate>
        )}
      </nav>

      {/* Collapse Button */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent/50",
            !collapsed && "justify-start"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Recolher</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
