// =============================================
// CENTRAL DE EXECUÇÕES — Unified operational queue
// Auto-arranges cards in a responsive grid. Small cards
// sit side-by-side; larger ones span full width.
// =============================================

import {
  ShoppingCart,
  FileText,
  Plug,
  Megaphone,
  MessageSquare,
  Star,
  CalendarClock,
  Store,
  Package,
  Bell,
  BookOpen,
  Truck,
  Cpu,
  HardDrive,
} from "lucide-react";
import { ExecutionCard } from "./ExecutionCard";
import { useExecutionCounts } from "@/hooks/useExecutionCounts";
import { useMemo } from "react";

export function ExecutionsQueue() {
  const {
    orders,
    fiscal,
    ads,
    reviews,
    integrations,
    contentCalendar,
    marketplaces,
    communications,
    notifications,
    blog,
    products,
    tracking,
    aiPackages,
    storage,
    totalPending,
    isLoading,
  } = useExecutionCounts();

  // Build the list of visible cards (only those with stats)
  const allCards = useMemo(() => {
    const cards = [
      { key: "orders", title: "Pedidos", icon: ShoppingCart, stats: orders.stats },
      { key: "fiscal", title: "Notas Fiscais", icon: FileText, stats: fiscal.stats },
      { key: "communications", title: "Comunicações", icon: MessageSquare, stats: communications.stats },
      { key: "integrations", title: "Integrações", icon: Plug, stats: integrations.stats },
      { key: "ads", title: "Anúncios", icon: Megaphone, stats: ads.stats },
      { key: "reviews", title: "Avaliações", icon: Star, stats: reviews.stats },
      { key: "contentCalendar", title: "Calendário de Conteúdo", icon: CalendarClock, stats: contentCalendar.stats },
      { key: "marketplaces", title: "Marketplaces", icon: Store, stats: marketplaces.stats },
      { key: "notifications", title: "Notificações", icon: Bell, stats: notifications.stats },
      { key: "blog", title: "Blog", icon: BookOpen, stats: blog.stats },
      { key: "products", title: "Produtos", icon: Package, stats: products.stats },
      { key: "tracking", title: "Rastreio", icon: Truck, stats: tracking.stats },
      { key: "storage", title: "Meu Drive", icon: HardDrive, stats: storage.stats },
      { key: "aiPackages", title: "Pacotes de IA", icon: Cpu, stats: aiPackages.stats },
    ];
    return cards.filter((c) => c.stats.length > 0);
  }, [orders, fiscal, communications, integrations, ads, reviews, contentCalendar, marketplaces, notifications, blog, products, tracking, storage, aiPackages]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (totalPending === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground animate-fade-in">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="text-lg font-medium">Tudo em dia!</p>
        <p className="text-sm">Nenhuma ação pendente no momento.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
      {allCards.map((card) => {
        // Cards with 3+ stats span full width for readability
        const spanFull = card.stats.length >= 3;
        return (
          <div key={card.key} className={spanFull ? "md:col-span-2" : ""}>
            <ExecutionCard
              title={card.title}
              icon={card.icon}
              stats={card.stats}
            />
          </div>
        );
      })}
    </div>
  );
}
