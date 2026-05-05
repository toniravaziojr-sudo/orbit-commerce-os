/**
 * Prerender Retry Utility (v2 — Onda 19)
 *
 * Triggers the storefront-prerender edge function with automatic retry,
 * SCOPE-AWARE invalidation, and user-facing feedback (toast).
 *
 * SCOPE CONTRACT:
 *   - Omit scope = global publish (re-render entire site)
 *   - { type: 'home' } = only `/`
 *   - { type: 'product', ids: [...] } = only those products
 *   - { type: 'category', ids: [...] } = only those categories
 *   - { type: 'page', ids: [...] } = only those institutional pages
 *   - { type: 'post', ids: [...] } = only those blog posts
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

export type PrerenderScope =
  | { type: 'none' }
  | { type: 'global' }
  | { type: 'home' }
  | { type: 'product'; ids: string[] }
  | { type: 'category'; ids: string[] }
  | { type: 'page'; ids: string[] }
  | { type: 'post'; ids: string[] };

interface PrerenderResponse {
  success?: boolean;
  rendered?: number;
  failed?: number;
  retried?: number;
  stragglers?: number;
  total_429?: number;
  total_pages?: number;
  status?: 'completed' | 'partial' | 'failed';
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Triggers prerender with retry logic and user feedback.
 * Called after publish — runs in background, does not block the UI.
 *
 * @param tenantId Tenant ID
 * @param scope Optional scope for granular publish. If omitted, runs global.
 */
export async function triggerPrerenderWithRetry(
  tenantId: string,
  scope?: PrerenderScope
): Promise<void> {
  let lastError: string | null = null;
  const effectiveScope = scope || { type: 'global' };

  // SCOPE 'none' = no public HTML changed (e.g. checkout/cart/thank_you settings).
  // Skip prerender entirely; storefront SPA reads settings live from public-template query.
  if (effectiveScope.type === 'none') {
    console.log('[prerender-retry] Scope=none — skipping prerender (no public HTML affected)');
    return;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[prerender-retry] Attempt ${attempt + 1}/${MAX_RETRIES + 1}, waiting ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
      }

      const { data, error } = await supabase.functions.invoke('storefront-prerender', {
        body: { tenant_id: tenantId, trigger_type: 'publish', scope: effectiveScope },
      });

      if (error) {
        lastError = error.message || 'Erro desconhecido';
        console.error(`[prerender-retry] Attempt ${attempt + 1} failed:`, error);
        continue;
      }

      const result = data as PrerenderResponse;

      if (result?.success) {
        console.log(`[prerender-retry] Success on attempt ${attempt + 1}:`, result);

        // status=partial → cron reconcile will pick up; warn user softly
        if (result.status === 'partial' || (result.failed && result.failed > 0)) {
          toast.warning(
            `Loja atualizada (${result.rendered} ok, ${result.failed} pendentes — serão reprocessadas em segundo plano).`,
            { duration: 8000 }
          );
        } else {
          const scopeLabel =
            effectiveScope.type === 'global' ? 'todas as páginas' :
            effectiveScope.type === 'home' ? 'home' :
            `${result.rendered || 0} ${effectiveScope.type === 'product' ? 'produto(s)' : effectiveScope.type === 'category' ? 'categoria(s)' : 'página(s)'}`;
          toast.success(`Loja pública atualizada (${scopeLabel})`, { duration: 4000 });
        }
        return;
      }

      lastError = result?.error || 'Resposta inesperada do servidor';
      console.error(`[prerender-retry] Attempt ${attempt + 1} returned failure:`, result);
    } catch (err: any) {
      lastError = err?.message || 'Erro de conexão';
      console.error(`[prerender-retry] Attempt ${attempt + 1} exception:`, err);
    }
  }

  console.error(`[prerender-retry] All ${MAX_RETRIES + 1} attempts failed. Last error:`, lastError);
  toast.error(
    'A publicação foi salva, mas a atualização da loja pública falhou. Tente publicar novamente ou use "Limpar Cache" em Configurações > Domínios.',
    { duration: 12000 }
  );
}
