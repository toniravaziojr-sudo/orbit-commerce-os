import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface BackfillStats {
  store_settings: number;
  product_images: number;
  categories: number;
  skipped: number;
  errors: number;
}

/**
 * Hook para executar o backfill de assets antigos no Meu Drive.
 * Chama a edge function drive-backfill que registra na tabela files
 * os assets já existentes em store_settings, product_images e categories.
 */
export function useDriveBackfill() {
  const { user, currentTenant } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<BackfillStats | null>(null);

  const runBackfill = async () => {
    if (!currentTenant?.id || !user?.id) {
      toast.error('Faça login para executar o backfill.');
      return null;
    }

    setIsRunning(true);
    setStats(null);

    try {
      const { data, error } = await supabase.functions.invoke('drive-backfill', {
        body: { tenant_id: currentTenant.id, user_id: user.id },
      });

      if (error) {
        console.error('[useDriveBackfill] Error:', error);
        toast.error('Erro ao sincronizar arquivos antigos.');
        return null;
      }

      const result = data?.stats as BackfillStats | undefined;
      if (result) {
        setStats(result);
        const total = result.store_settings + result.product_images + result.categories;
        if (total > 0) {
          toast.success(`${total} arquivo(s) antigo(s) registrado(s) no Drive.`);
        } else {
          toast.info('Todos os arquivos já estavam registrados no Drive.');
        }
      }

      return result || null;
    } catch (err) {
      console.error('[useDriveBackfill] Error:', err);
      toast.error('Erro ao sincronizar arquivos antigos.');
      return null;
    } finally {
      setIsRunning(false);
    }
  };

  return { runBackfill, isRunning, stats };
}
