import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationLog {
  id: string;
  tenant_id: string;
  notification_id: string | null;
  rule_id: string | null;
  rule_type: string;
  channel: string;
  order_id: string | null;
  customer_id: string | null;
  checkout_session_id: string | null;
  recipient: string | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  content_preview: string | null;
  attachments: any | null;
  attempt_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  rule_name?: string;
}

interface UseNotificationLogsOptions {
  orderId?: string;
  customerId?: string;
  checkoutSessionId?: string;
}

export function useNotificationLogs(options: UseNotificationLogsOptions) {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;

  const { orderId, customerId, checkoutSessionId } = options;

  const queryKey = ['notification-logs', tenantId, orderId, customerId, checkoutSessionId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('notification_logs')
        .select(`
          *,
          notification_rules (
            name
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (checkoutSessionId) {
        query = query.eq('checkout_session_id', checkoutSessionId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((log: any) => ({
        ...log,
        rule_name: log.notification_rules?.name || null,
      })) as NotificationLog[];
    },
    enabled: !!tenantId && !!(orderId || customerId || checkoutSessionId),
  });

  return {
    logs: data || [],
    isLoading,
    error,
    refetch,
  };
}
