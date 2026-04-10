// =============================================
// USE EXECUTION COUNTS — Central hook for all execution pendencies
// Aggregates counts across all operational modules
// Only shows items that REQUIRE human action
// =============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalStats, useFiscalAlerts, useOrdersPendingInvoice } from "@/hooks/useFiscal";
import { useAdsBalanceMonitor } from "@/hooks/useAdsBalanceMonitor";
import { useConversations } from "@/hooks/useConversations";
import { useOrderLimitCheck } from "@/hooks/usePlans";
import { useCallback, useEffect, useState } from "react";

export interface ExecutionStat {
  count: number;
  label: string;
  navigateTo: string;
  color: "warning" | "destructive" | "info" | "default";
}

export interface ExecutionCategory {
  stats: ExecutionStat[];
  totalPending: number;
}

interface IntegrationError {
  id: string;
  label: string;
  navigateTo: string;
}

// ── Pedidos: chargebacks, limite mensal (90%+), aguardando NF ──
function useOrderExecutionCounts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-order-counts", tenantId],
    queryFn: async () => {
      if (!tenantId) return { chargebacks: 0, awaitingInvoice: 0 };

      const [chargebackRes, invoiceRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).in("status", ["chargeback_detected", "chargeback_lost"]),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "ready_to_invoice"),
      ]);

      return {
        chargebacks: chargebackRes.count || 0,
        awaitingInvoice: invoiceRes.count || 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

// ── Integrações com falha ──
function useIntegrationErrors() {
  const { currentTenant, profile } = useAuth();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  const [errors, setErrors] = useState<IntegrationError[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchErrors = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    const found: IntegrationError[] = [];

    try {
      const { data: metaGrant } = await supabase
        .from("tenant_meta_auth_grants")
        .select("status, token_expires_at, last_error")
        .eq("tenant_id", tenantId).eq("status", "active")
        .order("granted_at", { ascending: false }).limit(1).maybeSingle();

      if (metaGrant) {
        const isExpired = metaGrant.token_expires_at ? new Date(metaGrant.token_expires_at) < new Date() : false;
        if (isExpired) {
          found.push({ id: "meta-expired", label: "Meta — Token expirado", navigateTo: "/integrations?tab=social" });
        } else if (metaGrant.last_error) {
          found.push({ id: "meta-error", label: "Meta — Erro de conexão", navigateTo: "/integrations?tab=social" });
        }
      }

      const { data: waData } = await supabase.rpc("get_whatsapp_config_for_tenant", { p_tenant_id: tenantId });
      const waConfig = Array.isArray(waData) && waData.length > 0 ? waData[0] : null;
      if (waConfig) {
        if (waConfig.connection_status === "awaiting_verification" || waConfig.connection_status === "pending_registration") {
          found.push({ id: "whatsapp-pending", label: "WhatsApp — Verificação pendente", navigateTo: "/integrations?tab=social" });
        } else if (waConfig.is_enabled && waConfig.connection_status !== "connected" && waConfig.last_error) {
          found.push({ id: "whatsapp-error", label: "WhatsApp — Desconectado", navigateTo: "/integrations?tab=social" });
        }
      }

      const { data: emailData } = await supabase
        .from("email_provider_configs")
        .select("is_verified, verification_status, from_email, dns_all_ok")
        .eq("tenant_id", tenantId).maybeSingle();

      if (emailData?.from_email && !emailData.is_verified && emailData.verification_status !== "verified" && !emailData.dns_all_ok) {
        found.push({ id: "email-dns", label: "Email — DNS pendente", navigateTo: "/integrations?tab=domain-email" });
      }
    } catch (e) {
      console.error("useIntegrationErrors fetch error:", e);
    } finally {
      setErrors(found);
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  return { errors, isLoading, errorCount: errors.length };
}

// ── Produtos: estoque baixo ──
function useLowStockCount() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-low-stock", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { data, error } = await (supabase.from("products") as any)
        .select("id, stock, min_stock")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .not("stock", "is", null)
        .not("min_stock", "is", null)
        .limit(500);
      if (error) return 0;
      return (data || []).filter((p: any) => p.stock <= p.min_stock).length;
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

// ── Avaliações pendentes de aprovação ──
function usePendingReviewsCount() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-pending-reviews", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count } = await supabase.from("product_reviews")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("status", "pending");
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

// ── Calendário de conteúdo: posts com falha + último agendamento acabando ──
function useContentCalendarAlerts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-content-calendar", tenantId],
    queryFn: async () => {
      if (!tenantId) return { failedPosts: 0, schedulingEndingSoon: false };

      const [failedRes, lastScheduledRes] = await Promise.all([
        supabase.from("social_posts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "failed"),
        supabase.from("social_posts")
          .select("scheduled_at")
          .eq("tenant_id", tenantId).in("status", ["scheduled", "pending"])
          .order("scheduled_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const failedPosts = failedRes.count || 0;
      let schedulingEndingSoon = false;
      if (lastScheduledRes.data?.scheduled_at) {
        const lastDate = new Date(lastScheduledRes.data.scheduled_at);
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        schedulingEndingSoon = lastDate <= threeDaysFromNow;
      }

      return { failedPosts, schedulingEndingSoon };
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

// ── Blog: posts com falha + último agendamento acabando ──
function useBlogAlerts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-blog-alerts", tenantId],
    queryFn: async () => {
      if (!tenantId) return { failedPosts: 0, schedulingEndingSoon: false };

      const [failedRes, lastScheduledRes] = await Promise.all([
        supabase.from("blog_posts")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "failed"),
        supabase.from("blog_posts")
          .select("published_at")
          .eq("tenant_id", tenantId).eq("status", "scheduled")
          .order("published_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const failedPosts = failedRes.count || 0;
      let schedulingEndingSoon = false;
      if (lastScheduledRes.data?.published_at) {
        const lastDate = new Date(lastScheduledRes.data.published_at);
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        schedulingEndingSoon = lastDate <= threeDaysFromNow;
      }

      return { failedPosts, schedulingEndingSoon };
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

// ── Marketplaces: conexões com erro ou syncs com falha ──
function useMarketplaceAlerts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-marketplace-alerts", tenantId],
    queryFn: async () => {
      if (!tenantId) return { connectionErrors: 0, syncErrors: 0 };

      const [connRes, syncRes] = await Promise.all([
        supabase.from("marketplace_connections")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("is_active", true)
          .not("last_error", "is", null),
        supabase.from("marketplace_sync_logs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "failed")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      return {
        connectionErrors: connRes.count || 0,
        syncErrors: syncRes.count || 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

// ── Rastreio: entregas problemáticas ──
function useProblematicShipments() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-problematic-shipments", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count } = await supabase.from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("delivery_status", ["failed", "returned", "unknown"]);
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

// ── Pacotes de IA: créditos abaixo de 10% ──
function useAiCreditsAlert() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-ai-credits-alert", tenantId],
    queryFn: async () => {
      if (!tenantId) return { isLow: false, remaining: 0, total: 0 };

      const { data: sub } = await supabase
        .from("tenant_ai_subscriptions")
        .select("credits_remaining, package_id")
        .eq("tenant_id", tenantId).eq("status", "active")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (!sub) return { isLow: false, remaining: 0, total: 0 };

      const { data: pkg } = await supabase
        .from("ai_packages")
        .select("credits")
        .eq("id", sub.package_id).maybeSingle();

      const total = pkg?.credits || 0;
      const remaining = sub.credits_remaining || 0;
      const isLow = total > 0 && remaining <= total * 0.1;

      return { isLow, remaining, total };
    },
    enabled: !!tenantId,
    refetchInterval: 120000,
  });
}

// ── Meu Drive: espaço de armazenamento acabando (>90% usado) ──
function useStorageAlert() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-storage-alert", tenantId],
    queryFn: async () => {
      if (!tenantId) return { isLow: false, usedPct: 0 };

      const { data } = await supabase
        .from("tenant_storage_usage")
        .select("used_bytes, limit_bytes")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!data || !data.limit_bytes) return { isLow: false, usedPct: 0 };

      const usedPct = Math.round((data.used_bytes / data.limit_bytes) * 100);
      return { isLow: usedPct >= 90, usedPct };
    },
    enabled: !!tenantId,
    refetchInterval: 120000,
  });
}

export function useExecutionCounts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  // Orders
  const { data: orderCounts, isLoading: ordersLoading } = useOrderExecutionCounts();
  const { data: limitCheck } = useOrderLimitCheck();

  // Fiscal
  const { data: fiscalStats, isLoading: fiscalStatsLoading } = useFiscalStats();
  const { alerts: fiscalAlerts, isLoading: fiscalAlertsLoading } = useFiscalAlerts();
  const { data: pendingInvoiceOrders, isLoading: pendingInvoiceLoading } = useOrdersPendingInvoice();

  // Communications
  const { stats: conversationStats, isLoading: conversationsLoading } = useConversations();

  const { data: unreadEmails = 0 } = useQuery({
    queryKey: ["execution-unread-emails", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count } = await supabase.from("email_messages")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_read", false);
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Notifications with errors
  const { data: notificationErrors = 0 } = useQuery({
    queryKey: ["execution-notification-errors", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count } = await supabase.from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("status", "failed");
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  // Integrations
  const { errors: integrationErrors, isLoading: integrationsLoading } = useIntegrationErrors();

  // Ads
  const adsBalance = useAdsBalanceMonitor();

  // New modules
  const { data: lowStock = 0 } = useLowStockCount();
  const { data: pendingReviews = 0 } = usePendingReviewsCount();
  const { data: contentCalendar } = useContentCalendarAlerts();
  const { data: blogAlerts } = useBlogAlerts();
  const { data: marketplaceAlerts } = useMarketplaceAlerts();
  const { data: problematicShipments = 0 } = useProblematicShipments();
  const { data: aiCredits } = useAiCreditsAlert();
  const { data: storageAlert } = useStorageAlert();

  // ── Build categories ──

  // Pedidos: chargebacks + limite mensal (90%+) + aguardando NF
  const orderLimitNear = limitCheck?.order_limit
    ? (limitCheck.current_count / limitCheck.order_limit) >= 0.9
    : false;

  const orders: ExecutionCategory = {
    stats: [
      orderCounts?.chargebacks ? { count: orderCounts.chargebacks, label: "Chargebacks", navigateTo: "/orders?status=chargeback_detected", color: "destructive" as const } : null,
      orderLimitNear && limitCheck ? { count: limitCheck.order_limit! - limitCheck.current_count, label: "Limite mensal acabando", navigateTo: "/settings/billing", color: "warning" as const } : null,
      orderCounts?.awaitingInvoice ? { count: orderCounts.awaitingInvoice, label: "Aguardando NF", navigateTo: "/orders?status=ready_to_invoice", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: 0,
  };
  orders.totalPending = orders.stats.reduce((s, st) => s + st.count, 0);

  // Notas Fiscais: pendentes emissão + rejeitadas
  const pendingInvoiceCount = pendingInvoiceOrders?.length || 0;
  const rejectedCount = fiscalStats?.rejected || 0;

  const fiscal: ExecutionCategory = {
    stats: [
      pendingInvoiceCount ? { count: pendingInvoiceCount, label: "Emitir NF-e", navigateTo: "/fiscal?tab=open-orders", color: "warning" as const } : null,
      rejectedCount ? { count: rejectedCount, label: "Pendências emissão", navigateTo: "/fiscal?tab=invoices", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: pendingInvoiceCount + rejectedCount,
  };

  // Anúncios: contas sem saldo
  const zeroBalanceCount = adsBalance.zeroBalanceCount || 0;
  const ads: ExecutionCategory = {
    stats: [
      zeroBalanceCount ? { count: zeroBalanceCount, label: "Contas sem saldo", navigateTo: "/ads?tab=accounts", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: zeroBalanceCount,
  };

  // Avaliações: pendentes de aprovação
  const reviews: ExecutionCategory = {
    stats: [
      pendingReviews ? { count: pendingReviews, label: "Pendentes aprovação", navigateTo: "/reviews", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: pendingReviews,
  };

  // Integrações: falhas
  const integrations: ExecutionCategory = {
    stats: integrationErrors.map(err => ({
      count: 1,
      label: err.label,
      navigateTo: err.navigateTo,
      color: "destructive" as const,
    })),
    totalPending: integrationErrors.length,
  };

  // Calendário de conteúdo
  const failedSocial = contentCalendar?.failedPosts || 0;
  const calendarEndingSoon = contentCalendar?.schedulingEndingSoon || false;
  const contentCalendarCategory: ExecutionCategory = {
    stats: [
      failedSocial ? { count: failedSocial, label: "Posts com falha", navigateTo: "/content-calendar", color: "destructive" as const } : null,
      calendarEndingSoon ? { count: 1, label: "Agendamentos acabando", navigateTo: "/content-calendar", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: failedSocial + (calendarEndingSoon ? 1 : 0),
  };

  // Marketplaces
  const mktConnErrors = marketplaceAlerts?.connectionErrors || 0;
  const mktSyncErrors = marketplaceAlerts?.syncErrors || 0;
  const marketplaces: ExecutionCategory = {
    stats: [
      mktConnErrors ? { count: mktConnErrors, label: "Conexões com erro", navigateTo: "/marketplaces", color: "destructive" as const } : null,
      mktSyncErrors ? { count: mktSyncErrors, label: "Falhas de sincronização", navigateTo: "/marketplaces", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: mktConnErrors + mktSyncErrors,
  };

  // Comunicações: atendimentos aguardando agente + emails não lidos
  const needsAttention = conversationStats?.needsAttention || 0;
  const communications: ExecutionCategory = {
    stats: [
      needsAttention ? { count: needsAttention, label: "Aguardando agente", navigateTo: "/support?status=waiting_agent", color: "warning" as const } : null,
      unreadEmails ? { count: unreadEmails, label: "Emails não lidos", navigateTo: "/emails", color: "info" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: needsAttention + unreadEmails,
  };

  // Notificações com erros
  const notifications: ExecutionCategory = {
    stats: [
      notificationErrors ? { count: notificationErrors, label: "Notificações com erro", navigateTo: "/notifications", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: notificationErrors,
  };

  // Blog
  const failedBlog = blogAlerts?.failedPosts || 0;
  const blogEndingSoon = blogAlerts?.schedulingEndingSoon || false;
  const blog: ExecutionCategory = {
    stats: [
      failedBlog ? { count: failedBlog, label: "Posts com falha", navigateTo: "/blog", color: "destructive" as const } : null,
      blogEndingSoon ? { count: 1, label: "Agendamentos acabando", navigateTo: "/blog", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: failedBlog + (blogEndingSoon ? 1 : 0),
  };

  // Produtos: estoque baixo
  const products: ExecutionCategory = {
    stats: [
      lowStock ? { count: lowStock, label: "Estoque baixo", navigateTo: "/products?stock=low", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: lowStock,
  };

  // Rastreio
  const tracking: ExecutionCategory = {
    stats: [
      problematicShipments ? { count: problematicShipments, label: "Entregas problemáticas", navigateTo: "/shipping", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: problematicShipments,
  };

  // Pacotes de IA
  const aiLow = aiCredits?.isLow || false;
  const aiPackages: ExecutionCategory = {
    stats: [
      aiLow ? { count: aiCredits?.remaining || 0, label: "Créditos acabando", navigateTo: "/ai-packages", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: aiLow ? 1 : 0,
  };

  const totalPending = orders.totalPending + fiscal.totalPending + ads.totalPending +
    reviews.totalPending + integrations.totalPending + contentCalendarCategory.totalPending +
    marketplaces.totalPending + communications.totalPending + notifications.totalPending +
    blog.totalPending + products.totalPending + tracking.totalPending + aiPackages.totalPending;

  const isLoading = ordersLoading || fiscalStatsLoading || fiscalAlertsLoading ||
    pendingInvoiceLoading || conversationsLoading || integrationsLoading;

  return {
    orders,
    fiscal,
    ads,
    reviews,
    integrations,
    contentCalendar: contentCalendarCategory,
    marketplaces,
    communications,
    notifications,
    blog,
    products,
    tracking,
    aiPackages,
    totalPending,
    isLoading,
  };
}
