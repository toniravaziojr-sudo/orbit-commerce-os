// ============================================================================
// PLATFORM RECEIVER CREDENTIALS — Tenant Admin Payment Gateway
// ============================================================================
// O tenant admin (type='platform') tem dupla função:
//   1) Administrador da plataforma (Sistema → Integrações da Plataforma)
//      → credenciais de INTEGRADOR (Client ID/Secret OAuth do app MP)
//   2) Loja própria (Minha Loja → Integrações → Pagamentos)
//      → credenciais de RECEBEDOR (access_token/public_key/webhook_secret)
//
// Este helper lê as credenciais de RECEBEDOR do tenant admin a partir da
// tabela `payment_providers` — mesmo lugar que qualquer lojista usa. Isso
// garante UM ÚNICO modelo de armazenamento de gateway recebedor.
//
// USO:
//   const creds = await getPlatformReceiverCredentials(supabaseUrl, serviceKey, 'mercadopago');
//   if (!creds?.access_token) return error('Gateway não configurado');
//   const token = creds.access_token;
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// Tenant admin fixo (type='platform' — único na base)
export const PLATFORM_TENANT_ID = "cc000000-0000-0000-0000-000000000001";

interface CacheEntry {
  data: Record<string, string> | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60s
const cache = new Map<string, CacheEntry>();

/**
 * Lê credenciais de recebedor do gateway do tenant admin.
 * Retorna o objeto `credentials` (ex: { access_token, public_key, webhook_secret }).
 * Retorna null se gateway não configurado ou desabilitado.
 */
export async function getPlatformReceiverCredentials(
  supabaseUrl: string,
  serviceKey: string,
  provider: "mercadopago" | "pagarme" | "stripe" | string,
): Promise<Record<string, string> | null> {
  const cacheKey = `${provider}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from("payment_providers")
      .select("credentials, is_enabled, environment")
      .eq("tenant_id", PLATFORM_TENANT_ID)
      .eq("provider", provider)
      .maybeSingle();

    if (error) {
      console.error(
        `[platform-receiver-credentials] DB error for ${provider}:`,
        error.message,
      );
      cache.set(cacheKey, { data: null, expiresAt: now + 5_000 }); // cache curto em erro
      return null;
    }

    if (!data || !data.is_enabled || !data.credentials) {
      cache.set(cacheKey, { data: null, expiresAt: now + CACHE_TTL_MS });
      return null;
    }

    const creds = data.credentials as Record<string, string>;
    cache.set(cacheKey, { data: creds, expiresAt: now + CACHE_TTL_MS });
    return creds;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[platform-receiver-credentials] Unexpected error:`, msg);
    return null;
  }
}

/** Força recarregamento. Útil quando admin acabou de salvar credenciais. */
export function invalidatePlatformReceiverCache(provider?: string): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}
