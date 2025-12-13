import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
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
  CreditCard,
  Truck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  FileText,
  ShoppingBag,
  Command,
  Store,
  FolderTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TenantSwitcher } from "./TenantSwitcher";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
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
    ],
  },
  {
    label: "Loja Online",
    items: [
      { title: "Configurações", href: "/storefront", icon: Store },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "Notificações", href: "/notifications", icon: Bell },
      { title: "Atendimento", href: "/support", icon: MessageSquare },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Mídias", href: "/media", icon: Image },
      { title: "Campanhas", href: "/campaigns", icon: Megaphone },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Integrações", href: "/integrations", icon: Plug },
      { title: "Pagamentos", href: "/payments", icon: CreditCard },
      { title: "Envios", href: "/shipping", icon: Truck },
      { title: "Financeiro", href: "/finance", icon: DollarSign },
      { title: "Fiscal", href: "/fiscal", icon: FileText },
      { title: "Compras", href: "/purchases", icon: ShoppingBag },
      { title: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Logo & Tenant Switcher */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        {collapsed ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Command className="h-5 w-5 text-primary-foreground" />
          </div>
        ) : (
          <TenantSwitcher />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {navigation.map((group) => (
          <div key={group.label} className="mb-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                const linkContent = (
                  <NavLink
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        active ? "text-sidebar-primary" : ""
                      )}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );

                if (collapsed) {
                  return (
                    <li key={item.href}>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.title}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                }

                return <li key={item.href}>{linkContent}</li>;
              })}
            </ul>
          </div>
        ))}
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
