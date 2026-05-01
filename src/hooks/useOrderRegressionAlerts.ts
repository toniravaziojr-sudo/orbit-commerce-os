// =============================================
// USE ORDER REGRESSION ALERTS
// Fetch fiscal_invoices and shipments flagged with requires_action
// for a given order. Powers the regression banner in OrderDetail.
// Source of truth: orders → triggers (handle_order_fiscal_alert /
// handle_order_shipping_alert) and order-regression-handler edge fn.
// =============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegressionInvoice {
  id: string;
  numero: number | null;
  serie: number | null;
  status: string;
  requires_action: boolean;
  action_reason: string | null;
  updated_at: string | null;
}

export interface RegressionShipment {
  id: string;
  delivery_status: string | null;
  tracking_code: string | null;
  requires_action: boolean;
  action_reason: string | null;
  delivered_at: string | null;
  updated_at: string | null;
}

export interface OrderRegressionAlerts {
  invoices: RegressionInvoice[];
  shipments: RegressionShipment[];
  hasAny: boolean;
}

export function useOrderRegressionAlerts(orderId?: string) {
  return useQuery({
    queryKey: ["order-regression-alerts", orderId],
    queryFn: async (): Promise<OrderRegressionAlerts> => {
      if (!orderId) return { invoices: [], shipments: [], hasAny: false };

      const [invRes, shipRes] = await Promise.all([
        supabase
          .from("fiscal_invoices")
          .select(
            "id, numero, serie, status, requires_action, action_reason, updated_at",
          )
          .eq("order_id", orderId)
          .eq("requires_action", true),
        supabase
          .from("shipments")
          .select(
            "id, delivery_status, tracking_code, requires_action, action_reason, delivered_at, updated_at",
          )
          .eq("order_id", orderId)
          .eq("requires_action", true),
      ]);

      const invoices = ((invRes.data ?? []) as unknown) as RegressionInvoice[];
      const shipments = ((shipRes.data ?? []) as unknown) as RegressionShipment[];

      return {
        invoices,
        shipments,
        hasAny: invoices.length > 0 || shipments.length > 0,
      };
    },
    enabled: !!orderId,
    staleTime: 15_000,
  });
}
