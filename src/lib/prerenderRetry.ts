/**
 * Prerender Retry Utility
 * 
 * Triggers the storefront-prerender edge function with automatic retry
 * and user-facing feedback (toast) on success or failure.
 * 
 * MAX_RETRIES: 2 (total attempts: 3)
 * RETRY_DELAY: 5 seconds between attempts
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

interface PrerenderResponse {
  success?: boolean;
  rendered?: number;
  failed?: number;
  total_pages?: number;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Triggers prerender with retry logic and user feedback.
 * Called after publish — runs in background, does not block the UI.
 */
export async function triggerPrerenderWithRetry(tenantId: string): Promise<void> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[prerender-retry] Attempt ${attempt + 1}/${MAX_RETRIES + 1}, waiting ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }

      const { data, error } = await supabase.functions.invoke('storefront-prerender', {
        body: { tenant_id: tenantId, trigger_type: 'publish' },
      });

      if (error) {
        lastError = error.message || 'Erro desconhecido';
        console.error(`[prerender-retry] Attempt ${attempt + 1} failed:`, error);
        continue;
      }

      const result = data as PrerenderResponse;

      if (result?.success) {
        console.log(`[prerender-retry] Success on attempt ${attempt + 1}:`, result);
        
        if (result.failed && result.failed > 0) {
          toast.warning(
            `Loja atualizada com ${result.rendered} páginas, mas ${result.failed} falharam. Tente publicar novamente.`,
            { duration: 8000 }
          );
        } else {
          toast.success(
            `Loja pública atualizada (${result.rendered || 0} páginas)`,
            { duration: 4000 }
          );
        }
        return; // Success — exit
      }

      // Response came back but success=false
      lastError = result?.error || 'Resposta inesperada do servidor';
      console.error(`[prerender-retry] Attempt ${attempt + 1} returned failure:`, result);
      
    } catch (err: any) {
      lastError = err?.message || 'Erro de conexão';
      console.error(`[prerender-retry] Attempt ${attempt + 1} exception:`, err);
    }
  }

  // All attempts exhausted
  console.error(`[prerender-retry] All ${MAX_RETRIES + 1} attempts failed. Last error:`, lastError);
  toast.error(
    'A publicação foi salva, mas a atualização da loja pública falhou. Tente publicar novamente ou use "Limpar Cache" em Configurações > Domínios.',
    { duration: 12000 }
  );
}