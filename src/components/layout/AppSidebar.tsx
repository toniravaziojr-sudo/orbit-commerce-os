import { useState, useMemo, ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { platformBranding } from "@/lib/branding";
import { LogoIcon } from "@/components/branding/Logo";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useTenantType } from "@/hooks/useTenantType";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useAuth } from "@/hooks/useAuth";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { FeatureGate } from "@/components/layout/FeatureGate";
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
  Activity,
  FileText,
  ShoppingBag,
  Store,
  FolderTree,
  Menu,
  Rocket,
  Star,
  TrendingUp,
  Percent,
  Truck,
  Shield,
  Mail,
  Upload,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TenantSwitcher } from "./TenantSwitcher";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  /** Feature key for gating - if set, item is wrapped in FeatureGate */
  featureKey?: string;
  /** If true, item is only shown to platform admins via PlatformAdminGate */
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** If true, entire group is only shown to platform admins */
  adminOnly?: boolean;
}

// Full navigation for tenant users
const fullNavigation: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard },
      { title: "Central de Execuções", href: "/executions", icon: Activity },
    ],
  },
  {
    label: "E-commerce",
    items: [
      { title: "Pedidos", href: "/orders", icon: ShoppingCart },
      { title: "Produtos", href: "/products", icon: Package },
      { title: "Categorias", href: "/categories", icon: FolderTree },
      { title: "Clientes", href: "/customers", icon: Users },
      { title: "Descontos", href: "/discounts", icon: Percent },
    ],
  },
  {
    label: "Loja Online",
    items: [
      { title: "Loja Virtual", href: "/storefront", icon: Store },
      { title: "Carrinho e Checkout", href: "/cart-checkout", icon: ShoppingBag },
      { title: "Menus", href: "/menus", icon: Menu },
      { title: "Páginas da Loja", href: "/pages", icon: FileText },
      { title: "Blog", href: "/blog", icon: BookOpen },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Integrações Marketing", href: "/marketing", icon: TrendingUp },
      { title: "Atribuição de venda", href: "/marketing/atribuicao", icon: TrendingUp },
      { title: "Aumentar Ticket", href: "/offers", icon: TrendingUp },
      { title: "Avaliações", href: "/reviews", icon: Star },
      { title: "Gestão de Mídias", href: "/media", icon: Image },
      { title: "Criador de campanhas", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    label: "CRM",
    items: [
      { title: "Notificações", href: "/notifications", icon: Bell },
      { title: "Atendimento", href: "/support", icon: MessageSquare },
      { title: "Emails", href: "/emails", icon: Mail },
    ],
  },
  {
    label: "ERP",
    items: [
      { title: "Fiscal", href: "/fiscal", icon: FileText },
      { title: "Financeiro", href: "/finance", icon: DollarSign },
      { title: "Compras", href: "/purchases", icon: ShoppingBag },
      { title: "Logística", href: "/shipping", icon: Truck },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Integrações", href: "/integrations", icon: Plug },
      { title: "Importar Dados", href: "/import", icon: Upload },
      { title: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

// Navigation for Platform Admin (Comando Central) - REDUCED MENU
// Only the 13 modules defined for admin operation
const platformAdminNavigation: NavGroup[] = [
  {
    label: "Plataforma",
    items: [
      { title: "Health Monitor", href: "/platform/health-monitor", icon: Activity },
      { title: "Integrações da Plataforma", href: "/platform/integrations", icon: Plug },
      { title: "Sugestões de Blocos", href: "/platform/block-suggestions", icon: Sparkles },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Integrações Marketing", href: "/marketing", icon: TrendingUp },
      { title: "Atribuição de venda", href: "/marketing/atribuicao", icon: TrendingUp },
    ],
  },
  {
    label: "CRM",
    items: [
      { title: "Notificações", href: "/notifications", icon: Bell },
      { title: "Atendimento", href: "/support", icon: MessageSquare },
      { title: "Emails", href: "/emails", icon: Mail },
    ],
  },
  {
    label: "ERP",
    items: [
      { title: "Fiscal", href: "/fiscal", icon: FileText },
      { title: "Financeiro", href: "/finance", icon: DollarSign },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Integrações", href: "/integrations", icon: Plug },
      { title: "Configurações", href: "/settings", icon: Settings },
    ],
  },
  {
    label: "Negócio",
    items: [
      { title: "Clientes", href: "/customers", icon: Users },
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
  ],
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { isPlatformOperator } = usePlatformOperator();
  const { isPlatformTenant, isLoading: isTenantTypeLoading } = useTenantType();
  const { currentTenant, tenants } = useAuth();

  // Determine which navigation to show based on tenant type
  const { navigation, showPlatformSection } = useMemo(() => {
    // While loading tenant type, default to customer menu to avoid flash
    // But if we know it's platform, show platform menu
    if (isPlatformTenant) {
      console.log('[AppSidebar] Showing platform admin navigation');
      return { navigation: platformAdminNavigation, showPlatformSection: false };
    }
    
    // Customer tenant: show full e-commerce menu
    // Platform operators with customer tenants also get the platform section
    console.log('[AppSidebar] Showing full navigation, isPlatformOperator:', isPlatformOperator);
    return { navigation: fullNavigation, showPlatformSection: isPlatformOperator };
  }, [isPlatformTenant, isPlatformOperator]);
  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    
    // Special handling for pages routes
    if (href === "/pages") {
      return location.pathname === "/pages" || 
        location.pathname.startsWith("/pages/");
    }
    
    // Special handling for /storefront - only exact match, not children
    // This prevents /storefront from highlighting when on /storefront/conversao
    if (href === "/storefront") {
      return location.pathname === "/storefront" || 
        location.pathname.startsWith("/storefront/builder");
    }
    
    // Special handling for /marketing - only exact match to avoid conflicts with /marketing/atribuicao
    if (href === "/marketing") {
      return location.pathname === "/marketing";
    }
    
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[60px]" : "w-48"
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
        {/* Regular navigation */}
        {navigation.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

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
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        active ? "text-sidebar-primary" : ""
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.badge && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );

                // Wrap with tooltip if collapsed
                const wrappedLink = collapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  linkContent
                );

                // Apply gating based on item properties
                let gatedContent: ReactNode = wrappedLink;

                // Admin-only items use PlatformAdminGate
                if (item.adminOnly) {
                  gatedContent = (
                    <PlatformAdminGate>
                      {wrappedLink}
                    </PlatformAdminGate>
                  );
                }
                // Feature-gated items use FeatureGate
                else if (item.featureKey) {
                  gatedContent = (
                    <FeatureGate feature={item.featureKey}>
                      {wrappedLink}
                    </FeatureGate>
                  );
                }

                return <li key={item.href}>{gatedContent}</li>;
              })}
            </ul>
          </div>
        ))}

        {/* Platform admin navigation - only for platform operators WITH tenant context */}
        {/* Double-protected: showPlatformSection + PlatformAdminGate */}
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
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          active ? "text-primary" : "text-primary/70"
                        )}
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.title}</span>
                      )}
                    </NavLink>
                  );

                  const wrappedLink = collapsed ? (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.title}
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
            "w-full justify-center text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
