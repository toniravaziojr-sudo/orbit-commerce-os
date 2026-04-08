import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

export function useTikTokShopWebhooks() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // List webhook events
  const { data: webhookEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['tiktok-shop-webhook-events', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tiktok_shop_webhook_events')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Sync stock from TikTok
  const syncStockFromTikTok = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-shop-stock-sync', {
        body: { tenantId, action: 'sync_from_tiktok' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-catalog'] });
      toast.success(`Estoque sincronizado: ${data.synced} produto(s)`);
    },
    onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'sincronizar estoque' }),
  });

  // Push stock to TikTok
  const pushStockToTikTok = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-shop-stock-sync', {
        body: { tenantId, action: 'push_to_tiktok' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Push failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-catalog'] });
      toast.success(`Estoque enviado: ${data.pushed} produto(s)`);
    },
    onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'enviar estoque' }),
  });

  return {
    webhookEvents,
    eventsLoading,
    syncStockFromTikTok,
    pushStockToTikTok,
  };
}
