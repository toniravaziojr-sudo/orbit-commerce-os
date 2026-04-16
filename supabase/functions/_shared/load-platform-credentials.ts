// ============================================================================
// LOAD PLATFORM CREDENTIALS — Bulk Loader (Single Source of Truth)
// ============================================================================
// Carrega TODAS as credenciais ativas da tabela `platform_credentials` para
// `Deno.env`, sobrescrevendo valores anteriores. Isso garante que qualquer
// alteração feita pelo painel de Integrações da Plataforma seja propagada
// automaticamente para TODAS as Edge Functions sem necessidade de redeploy.
//
// USO (1 linha no início de cada handler):
//   import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
//   await loadPlatformCredentials();
//
// REGRA DE OURO:
//   - Banco de dados (`platform_credentials`) = fonte de verdade
//   - Variável de ambiente = fallback inicial (apenas se a credencial não
//     estiver no banco)
//   - Cache em memória de 60s para evitar consultas repetidas no mesmo boot
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// Cache em memória (válido durante o "warm" da edge function — geralmente
// alguns minutos). Evita martelar o banco a cada invocação enquanto ainda
// garante propagação rápida quando o admin troca uma chave.
const CACHE_TTL_MS = 60_000; // 60 segundos
let lastLoadAt = 0;
let loadInFlight: Promise<void> | null = null;

/**
 * Carrega todas as credenciais ativas da tabela `platform_credentials` para
 * `Deno.env`. Idempotente e seguro para chamar múltiplas vezes.
 *
 * Falha silenciosamente em caso de erro (mantém valores existentes em env)
 * para não quebrar funções que dependem de credenciais já presentes.
 */
export async function loadPlatformCredentials(): Promise<void> {
  // Cache hit — não recarrega
  const now = Date.now();
  if (now - lastLoadAt < CACHE_TTL_MS) {
    return;
  }

  // Coalescing: se já há um carregamento em andamento, aguarda ele
  if (loadInFlight) {
    return loadInFlight;
  }

  loadInFlight = (async () => {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !serviceKey) {
        console.warn("[load-platform-credentials] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping bulk load");
        return;
      }

      const supabase = createClient(supabaseUrl, serviceKey);

      const { data, error } = await supabase
        .from("platform_credentials")
        .select("credential_key, credential_value, is_active")
        .eq("is_active", true);

      if (error) {
        console.warn("[load-platform-credentials] DB load failed:", error.message);
        return;
      }

      if (!data || data.length === 0) {
        return;
      }

      let overridden = 0;
      for (const row of data) {
        if (!row.credential_key || !row.credential_value) continue;
        const current = Deno.env.get(row.credential_key);
        if (current !== row.credential_value) {
          Deno.env.set(row.credential_key, row.credential_value);
          overridden++;
        }
      }

      lastLoadAt = Date.now();
      if (overridden > 0) {
        console.log(`[load-platform-credentials] Synced ${overridden} credential(s) from DB → env`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[load-platform-credentials] Unexpected error:", msg);
    } finally {
      loadInFlight = null;
    }
  })();

  return loadInFlight;
}

/**
 * Força recarregamento imediato (ignora cache). Útil em cenários onde a
 * função sabe que uma credencial acabou de ser alterada.
 */
export function invalidatePlatformCredentialsCache(): void {
  lastLoadAt = 0;
}
