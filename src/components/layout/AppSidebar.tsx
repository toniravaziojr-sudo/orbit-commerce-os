import { useState, useMemo, ReactNode, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { platformBranding } from "@/lib/branding";
import { LogoIcon } from "@/components/branding/Logo";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { useTenantType } from "@/hooks/useTenantType";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useAuth } from "@/hooks/useAuth";
import { useIsSpecialTenant } from "@/hooks/useIsSpecialTenant";
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
  Building2,
  CreditCard,
  UserCheck,
  Handshake,
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
}

interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  collapsible?: boolean;
}

// Full navigation for tenant users - with collapsible groups
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
    collapsible: true,
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
    collapsible: true,
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
    collapsible: true,
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
    collapsible: true,
    items: [
      { title: "Notificações", href: "/notifications", icon: Bell },
      { title: "Atendimento", href: "/support", icon: MessageSquare },
      { title: "Emails", href: "/emails", icon: Mail },
    ],
  },
  {
    label: "ERP",
    collapsible: true,
    items: [
      { title: "Fiscal", href: "/fiscal", icon: FileText },
      { title: "Financeiro", href: "/finance", icon: DollarSign },
      { title: "Compras", href: "/purchases", icon: ShoppingBag },
      { title: "Logística", href: "/shipping", icon: Truck },
    ],
  },
  {
    label: "Parcerias",
    collapsible: true,
    items: [
      { title: "Influencers", href: "/influencers", icon: UserCheck },
      { title: "Fornecedores", href: "/suppliers", icon: Building2 },
      { title: "Afiliados", href: "/affiliates", icon: Handshake },
    ],
  },
  {
    label: "Sistema",
    collapsible: true,
    items: [
      { title: "Integrações", href: "/integrations", icon: Plug },
      { title: "Marketplaces", href: "/marketplaces", icon: Building2 },
      { title: "Arquivos", href: "/files", icon: FolderOpen },
      { title: "Importar Dados", href: "/import", icon: Upload },
      { title: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

// Navigation for Platform Admin (Comando Central) - REDUCED MENU
const platformAdminNavigation: NavGroup[] = [
  {
    label: "Plataforma",
    items: [
      { title: "Health Monitor", href: "/platform/health-monitor", icon: Activity },
      { title: "Integrações da Plataforma", href: "/platform/integrations", icon: Plug },
      { title: "Sugestões de Blocos", href: "/platform/block-suggestions", icon: Sparkles },
      { title: "Assinaturas", href: "/platform/billing", icon: CreditCard },
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
  const { isPlatformTenant, isLoading: isTenantTypeLoading } = useTenantType();
  const { currentTenant, tenants } = useAuth();
  const { isSpecialTenant } = useIsSpecialTenant();

  // Persist open groups state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Determine which navigation to show based on tenant type
  const { navigation, showPlatformSection } = useMemo(() => {
    if (isPlatformTenant) {
      return { navigation: platformAdminNavigation, showPlatformSection: false };
    }
    return { navigation: fullNavigation, showPlatformSection: isPlatformOperator };
  }, [isPlatformTenant, isPlatformOperator]);

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

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const status = isSpecialTenant ? getModuleStatus(item.href) : undefined;

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

    return <li key={item.href}>{gatedContent}</li>;
  };

  const renderNavGroup = (group: NavGroup) => {
    const groupActive = isGroupActive(group);
    const open = isGroupOpen(group);

    if (group.collapsible && !collapsed) {
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
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">{group.label}</span>
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
                {group.items.map(renderNavItem)}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    }

    return (
      <div key={group.label} className="mb-3">
        {!collapsed && (
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
            {group.label}
          </p>
        )}
        <ul className="space-y-0.5">{group.items.map(renderNavItem)}</ul>
      </div>
    );
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
