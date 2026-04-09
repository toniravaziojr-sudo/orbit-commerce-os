// =============================================
// USE EXECUTION COUNTS — Central hook for all execution pendencies
// Aggregates counts from orders, fiscal, support, integrations, ads, insights,
// storefront health, content calendar, and communications
// =============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFiscalStats, useFiscalAlerts, useOrdersPendingInvoice } from "@/hooks/useFiscal";
import { useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { useConversations } from "@/hooks/useConversations";
import { useViolationsStats } from "@/hooks/useRuntimeViolations";
import { useHealthCheckStats } from "@/hooks/useHealthChecks";
import { useAdsInsights } from "@/hooks/useAdsInsights";
import { useAdsBalanceMonitor } from "@/hooks/useAdsBalanceMonitor";
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
  name: string;
  error: string;
  navigateTo: string;
}

function useOrderExecutionCounts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-order-counts", tenantId],
    queryFn: async (): Promise<{
      awaitingPayment: number;
      awaitingShipment: number;
      chargebacks: number;
      returns: number;
    }> => {
      if (!tenantId) return { awaitingPayment: 0, awaitingShipment: 0, chargebacks: 0, returns: 0 };

      const [paymentRes, shipmentRes, chargebackRes, returnsRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("payment_status", "pending" as any)
          .not("payment_gateway_id", "is", null),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "paid")
          .not("payment_gateway_id", "is", null),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).in("status", ["chargeback_detected", "chargeback_lost"]),
        supabase.from("orders").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("status", "returning"),
      ]);

      return {
        awaitingPayment: paymentRes.count || 0,
        awaitingShipment: shipmentRes.count || 0,
        chargebacks: chargebackRes.count || 0,
        returns: returnsRes.count || 0,
      };
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

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
          found.push({ id: "meta-expired", name: "Meta", error: "Token expirado", navigateTo: "/integrations?tab=social" });
        } else if (metaGrant.last_error) {
          found.push({ id: "meta-error", name: "Meta", error: metaGrant.last_error.substring(0, 60), navigateTo: "/integrations?tab=social" });
        }
      }

      const { data: waData } = await supabase.rpc("get_whatsapp_config_for_tenant", { p_tenant_id: tenantId });
      const waConfig = Array.isArray(waData) && waData.length > 0 ? waData[0] : null;
      if (waConfig) {
        if (waConfig.connection_status === "awaiting_verification" || waConfig.connection_status === "pending_registration") {
          found.push({ id: "whatsapp-pending", name: "WhatsApp", error: "Pendente de verificação", navigateTo: "/integrations?tab=social" });
        } else if (waConfig.is_enabled && waConfig.connection_status !== "connected" && waConfig.last_error) {
          found.push({ id: "whatsapp-error", name: "WhatsApp", error: waConfig.last_error.substring(0, 60), navigateTo: "/integrations?tab=social" });
        }
      }

      const { data: emailData } = await supabase
        .from("email_provider_configs")
        .select("is_verified, verification_status, from_email, dns_all_ok")
        .eq("tenant_id", tenantId).maybeSingle();

      if (emailData?.from_email && !emailData.is_verified && emailData.verification_status !== "verified" && !emailData.dns_all_ok) {
        found.push({ id: "email-dns", name: "Email", error: "DNS pendente de verificação", navigateTo: "/integrations?tab=domain-email" });
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

function useLowStockCount() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-low-stock", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await (supabase
        .from("products") as any)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .not("stock", "is", null)
        .not("min_stock", "is", null)
        .filter("stock", "lte", "min_stock" as any);

      if (error) {
        console.error("Low stock query error:", error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

function useAbandonedCheckoutsCount() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-abandoned-checkouts", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("checkout_sessions")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "abandoned")
        .is("order_id", null)
        .gte("created_at", today.toISOString());

      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

function useFailedSocialPostsCount() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ["execution-failed-social-posts", tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "failed");
      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });
}

export function useExecutionCounts() {
  // Orders
  const { data: orderCounts, isLoading: ordersLoading } = useOrderExecutionCounts();

  // Fiscal
  const { data: fiscalStats, isLoading: fiscalStatsLoading } = useFiscalStats();
  const { alerts: fiscalAlerts, isLoading: fiscalAlertsLoading } = useFiscalAlerts();
  const { data: pendingInvoiceOrders, isLoading: pendingInvoiceLoading } = useOrdersPendingInvoice();

  // Support / Communications
  const { stats: conversationStats, isLoading: conversationsLoading } = useConversations();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

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

  // Integrations
  const { errors: integrationErrors, isLoading: integrationsLoading } = useIntegrationErrors();

  // Ads
  const { pendingActions: adsPending, isLoading: adsLoading } = useAdsPendingActions();
  const { insights: adsInsights } = useAdsInsights();
  const adsBalance = useAdsBalanceMonitor();

  // Storefront health
  const violationStats = useViolationsStats();
  const healthStats = useHealthCheckStats();

  // Content calendar
  const { data: failedSocialPosts = 0 } = useFailedSocialPostsCount();

  // Insights
  const { data: abandonedCheckouts = 0 } = useAbandonedCheckoutsCount();
  const { data: lowStock = 0 } = useLowStockCount();

  // ── Build categories ──

  const orders: ExecutionCategory = {
    stats: [
      orderCounts?.awaitingPayment ? { count: orderCounts.awaitingPayment, label: "Pagamento pendente", navigateTo: "/orders?paymentStatus=awaiting_payment", color: "info" as const } : null,
      orderCounts?.awaitingShipment ? { count: orderCounts.awaitingShipment, label: "Aguardando envio", navigateTo: "/orders?status=paid", color: "warning" as const } : null,
      orderCounts?.chargebacks ? { count: orderCounts.chargebacks, label: "Chargebacks", navigateTo: "/orders?status=chargeback_detected", color: "destructive" as const } : null,
      orderCounts?.returns ? { count: orderCounts.returns, label: "Devoluções", navigateTo: "/orders?status=returning", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: (orderCounts?.awaitingPayment || 0) + (orderCounts?.awaitingShipment || 0) + (orderCounts?.chargebacks || 0) + (orderCounts?.returns || 0),
  };

  const pendingInvoiceCount = pendingInvoiceOrders?.length || 0;
  const rejectedCount = fiscalStats?.rejected || 0;
  const alertsCount = fiscalAlerts?.length || 0;

  const fiscal: ExecutionCategory = {
    stats: [
      pendingInvoiceCount ? { count: pendingInvoiceCount, label: "Emitir NF-e", navigateTo: "/fiscal?tab=open-orders", color: "warning" as const } : null,
      rejectedCount ? { count: rejectedCount, label: "Rejeitadas SEFAZ", navigateTo: "/fiscal?tab=invoices", color: "destructive" as const } : null,
      alertsCount ? { count: alertsCount, label: "Alertas fiscais", navigateTo: "/fiscal?tab=invoices", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: pendingInvoiceCount + rejectedCount + alertsCount,
  };

  const needsAttention = conversationStats?.needsAttention || 0;
  const inProgress = conversationStats?.inProgress || 0;

  const communications: ExecutionCategory = {
    stats: [
      needsAttention ? { count: needsAttention, label: "Aguardando agente", navigateTo: "/support?status=waiting_agent", color: "warning" as const } : null,
      inProgress ? { count: inProgress, label: "Em andamento", navigateTo: "/support", color: "info" as const } : null,
      notificationErrors ? { count: notificationErrors, label: "Erros notificação", navigateTo: "/notifications", color: "destructive" as const } : null,
      unreadEmails ? { count: unreadEmails, label: "Emails não lidos", navigateTo: "/emails", color: "info" as const } : null,
      failedSocialPosts ? { count: failedSocialPosts, label: "Posts com falha", navigateTo: "/content-calendar", color: "destructive" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: needsAttention + inProgress + notificationErrors + unreadEmails + failedSocialPosts,
  };

  const integrations: ExecutionCategory = {
    stats: integrationErrors.map(err => ({
      count: 1,
      label: err.name,
      navigateTo: err.navigateTo,
      color: "destructive" as const,
    })),
    totalPending: integrationErrors.length,
  };

  const adsPendingCount = adsPending?.length || 0;
  const openInsightsCount = (adsInsights || []).filter((i: any) => i.status === "open").length;
  const zeroBalanceCount = adsBalance.zeroBalanceCount || 0;
  const lowBalanceCount = adsBalance.lowBalanceCount || 0;

  const ads: ExecutionCategory = {
    stats: [
      adsPendingCount ? { count: adsPendingCount, label: "Pendentes aprovação", navigateTo: "/ads?tab=autopilot", color: "warning" as const } : null,
      openInsightsCount ? { count: openInsightsCount, label: "Insights abertos", navigateTo: "/ads?tab=insights", color: "info" as const } : null,
      zeroBalanceCount ? { count: zeroBalanceCount, label: "Contas sem saldo", navigateTo: "/ads?tab=accounts", color: "destructive" as const } : null,
      lowBalanceCount ? { count: lowBalanceCount, label: "Saldo baixo", navigateTo: "/ads?tab=accounts", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: adsPendingCount + openInsightsCount + zeroBalanceCount + lowBalanceCount,
  };

  const unresolvedViolations = violationStats.unresolved || 0;
  const failedHealthChecks = healthStats.failed || 0;

  const alerts: ExecutionCategory = {
    stats: [
      unresolvedViolations ? { count: unresolvedViolations, label: "Violações storefront", navigateTo: "/health-monitor", color: "destructive" as const } : null,
      failedHealthChecks ? { count: failedHealthChecks, label: "Health checks falhos", navigateTo: "/health-monitor", color: "destructive" as const } : null,
      abandonedCheckouts ? { count: abandonedCheckouts, label: "Carrinhos abandonados", navigateTo: "/orders?status=abandoned", color: "info" as const } : null,
      lowStock ? { count: lowStock, label: "Estoque baixo", navigateTo: "/products?stock=low", color: "warning" as const } : null,
    ].filter(Boolean) as ExecutionStat[],
    totalPending: unresolvedViolations + failedHealthChecks + abandonedCheckouts + lowStock,
  };

  const totalPending = orders.totalPending + fiscal.totalPending + communications.totalPending +
    integrations.totalPending + ads.totalPending + alerts.totalPending;

  const isLoading = ordersLoading || fiscalStatsLoading || fiscalAlertsLoading ||
    pendingInvoiceLoading || conversationsLoading || integrationsLoading || adsLoading;

  return {
    orders,
    fiscal,
    communications,
    integrations,
    ads,
    alerts,
    totalPending,
    isLoading,
  };
}
