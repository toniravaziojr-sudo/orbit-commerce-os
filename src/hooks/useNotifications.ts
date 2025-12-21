import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type NotificationStatus = 'scheduled' | 'retrying' | 'sending' | 'sent' | 'failed' | 'canceled';

export interface Notification {
  id: string;
  tenant_id: string;
  event_id: string | null;
  rule_id: string | null;
  channel: string;
  recipient: string;
  template_key: string | null;
  payload: Record<string, unknown> | null;
  status: NotificationStatus;
  scheduled_for: string;
  next_attempt_at: string;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  dedupe_key: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationAttempt {
  id: string;
  notification_id: string;
  tenant_id: string;
  attempt_no: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
  provider_response: Record<string, unknown> | null;
}

export interface NotificationsFilter {
  status?: NotificationStatus[];
  channel?: string;
  template_key?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface NotificationsStats {
  scheduled: number;
  retrying: number;
  sending: number;
  sent: number;
  failed: number;
  canceled: number;
}

const PAGE_SIZE = 20;

export function useNotifications() {
  const { profile } = useAuth();
  const tenantId = profile?.current_tenant_id;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationsStats>({
    scheduled: 0,
    retrying: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    canceled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<NotificationsFilter>({});

  const fetchStats = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('status')
        .eq('tenant_id', tenantId);

      if (error) throw error;

      const counts: NotificationsStats = {
        scheduled: 0,
        retrying: 0,
        sending: 0,
        sent: 0,
        failed: 0,
        canceled: 0,
      };

      data?.forEach(row => {
        const status = row.status as NotificationStatus;
        if (status in counts) {
          counts[status]++;
        }
      });

      setStats(counts);
    } catch (err) {
      console.error('[useNotifications] Error fetching stats:', err);
    }
  }, [tenantId]);

  const fetchNotifications = useCallback(async (resetPage = false) => {
    if (!tenantId) return;
    
    setIsLoading(true);
    const currentPage = resetPage ? 0 : page;
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      // Apply filters
      if (filter.status && filter.status.length > 0) {
        query = query.in('status', filter.status);
      }
      if (filter.channel) {
        query = query.eq('channel', filter.channel);
      }
      if (filter.template_key) {
        query = query.eq('template_key', filter.template_key);
      }
      if (filter.search) {
        query = query.or(`recipient.ilike.%${filter.search}%,id.ilike.%${filter.search}%`);
      }
      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate);
      }
      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []) as unknown as Notification[];
      
      if (resetPage) {
        setNotifications(typedData);
        setPage(0);
      } else {
        setNotifications(prev => currentPage === 0 ? typedData : [...prev, ...typedData]);
      }
      
      setHasMore(typedData.length === PAGE_SIZE);
    } catch (err) {
      console.error('[useNotifications] Error fetching notifications:', err);
      toast.error('Erro ao carregar notificações');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, page, filter]);

  const fetchAttempts = useCallback(async (notificationId: string): Promise<NotificationAttempt[]> => {
    if (!tenantId) return [];

    try {
      const { data, error } = await supabase
        .from('notification_attempts')
        .select('*')
        .eq('notification_id', notificationId)
        .eq('tenant_id', tenantId)
        .order('attempt_no', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as NotificationAttempt[];
    } catch (err) {
      console.error('[useNotifications] Error fetching attempts:', err);
      return [];
    }
  }, [tenantId]);

  const cancelNotification = useCallback(async (id: string) => {
    if (!tenantId) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .in('status', ['scheduled', 'retrying']);

      if (error) throw error;
      
      toast.success('Notificação cancelada');
      await fetchNotifications(true);
      await fetchStats();
      return true;
    } catch (err) {
      console.error('[useNotifications] Error canceling notification:', err);
      toast.error('Erro ao cancelar notificação');
      return false;
    }
  }, [tenantId, fetchNotifications, fetchStats]);

  const rescheduleNotification = useCallback(async (id: string, scheduledFor: Date) => {
    if (!tenantId) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          scheduled_for: scheduledFor.toISOString(),
          next_attempt_at: scheduledFor.toISOString(),
          status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .in('status', ['scheduled', 'retrying']);

      if (error) throw error;
      
      toast.success('Notificação reagendada');
      await fetchNotifications(true);
      await fetchStats();
      return true;
    } catch (err) {
      console.error('[useNotifications] Error rescheduling notification:', err);
      toast.error('Erro ao reagendar notificação');
      return false;
    }
  }, [tenantId, fetchNotifications, fetchStats]);

  const reprocessNotification = useCallback(async (id: string) => {
    if (!tenantId) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'scheduled',
          next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .in('status', ['failed', 'retrying']);

      if (error) throw error;
      
      toast.success('Notificação reagendada para reprocessamento');
      await fetchNotifications(true);
      await fetchStats();
      return true;
    } catch (err) {
      console.error('[useNotifications] Error reprocessing notification:', err);
      toast.error('Erro ao reprocessar notificação');
      return false;
    }
  }, [tenantId, fetchNotifications, fetchStats]);

  useEffect(() => {
    if (tenantId) {
      fetchNotifications(true);
      fetchStats();
    }
  }, [tenantId, filter]);

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setPage(p => p + 1);
    }
  }, [isLoading, hasMore]);

  useEffect(() => {
    if (page > 0) {
      fetchNotifications();
    }
  }, [page]);

  return {
    notifications,
    stats,
    isLoading,
    hasMore,
    filter,
    setFilter,
    loadMore,
    refetch: () => {
      fetchNotifications(true);
      fetchStats();
    },
    fetchAttempts,
    cancelNotification,
    rescheduleNotification,
    reprocessNotification,
  };
}
