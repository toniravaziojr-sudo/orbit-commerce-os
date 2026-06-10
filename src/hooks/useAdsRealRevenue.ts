import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Receita Real de Ads (pagos) — soma do total de pedidos efetivados no período
 * cuja atribuição last-click é de mídia paga (Meta / Google / TikTok).
 *
 * Critério "venda realizada": status em
 *   (paid, processing, ready_to_invoice, shipped, delivered)
 *
 * Critério "veio de Ads" (last-click):
 *   - fbclid presente  → Meta Ads
 *   - gclid presente   → Google Ads
 *   - ttclid presente  → TikTok Ads
 *   - OU utm_medium em (cpc, paid, paid_social, ads)
 *
 * Pedidos orgânicos / direto / e-mail / WhatsApp / marketplaces ficam de fora.
 */
const PAID_STATUSES = ["paid", "processing", "ready_to_invoice", "shipped", "delivered"] as const;

export interface AdsRealRevenueBreakdown {
  total_cents: number;
  meta_cents: number;
  google_cents: number;
  tiktok_cents: number;
  paid_orders: number;
  total_paid_orders: number;
  coverage_pct: number;
}

export function useAdsRealRevenue(startDate?: Date, endDate?: Date) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery<AdsRealRevenueBreakdown>({
    queryKey: ["ads-real-revenue", tenantId, startDate?.toISOString(), endDate?.toISOString()],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const empty: AdsRealRevenueBreakdown = {
        total_cents: 0,
        meta_cents: 0,
        google_cents: 0,
        tiktok_cents: 0,
        paid_orders: 0,
        total_paid_orders: 0,
        coverage_pct: 0,
      };
      if (!tenantId) return empty;

      // 1) Count total paid orders in the period (denominator for coverage)
      let totalQuery = supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", PAID_STATUSES);
      if (startDate) totalQuery = totalQuery.gte("created_at", startDate.toISOString());
      if (endDate) totalQuery = totalQuery.lte("created_at", endDate.toISOString());
      const { count: totalPaidOrders, error: totalErr } = await totalQuery;
      if (totalErr) throw totalErr;

      // 2) Paid orders with Ads attribution (last-click)
      let query = supabase
        .from("order_attribution")
        .select("fbclid, gclid, ttclid, utm_medium, orders!inner(id, total, status, created_at, tenant_id)")
        .eq("tenant_id", tenantId)
        .eq("orders.tenant_id", tenantId)
        .in("orders.status", PAID_STATUSES);

      if (startDate) query = query.gte("orders.created_at", startDate.toISOString());
      if (endDate) query = query.lte("orders.created_at", endDate.toISOString());

      const { data, error } = await query;
      if (error) throw error;

      const acc = { ...empty, total_paid_orders: totalPaidOrders || 0 };
      const paidMediumSet = new Set(["cpc", "paid", "paid_social", "ads"]);

      for (const row of (data || []) as any[]) {
        const order = row.orders;
        if (!order) continue;
        const totalReais = Number(order.total || 0);
        if (!Number.isFinite(totalReais) || totalReais <= 0) continue;
        const cents = Math.round(totalReais * 100);

        let bucket: "meta" | "google" | "tiktok" | null = null;
        if (row.fbclid) bucket = "meta";
        else if (row.gclid) bucket = "google";
        else if (row.ttclid) bucket = "tiktok";
        else if (row.utm_medium && paidMediumSet.has(String(row.utm_medium).toLowerCase())) {
          bucket = "meta";
        } else {
          continue;
        }

        acc.total_cents += cents;
        acc.paid_orders += 1;
        if (bucket === "meta") acc.meta_cents += cents;
        else if (bucket === "google") acc.google_cents += cents;
        else if (bucket === "tiktok") acc.tiktok_cents += cents;
      }

      acc.coverage_pct = acc.total_paid_orders > 0
        ? Math.round((acc.paid_orders / acc.total_paid_orders) * 1000) / 10
        : 0;

      return acc;
    },
  });
}
