// ============================================================================
// LOAD PLATFORM CREDENTIALS — Bulk Loader (Single Source of Truth)
// ============================================================================
// Carrega todas as credenciais ativas da tabela `platform_credentials` para
// um cache em memória do processo da Edge Function, e transparentemente
// intercepta `Deno.env.get` para que qualquer caller (novo ou legado) receba
// automaticamente o valor mais recente cadastrado pelo painel.
//
// POR QUE ASSIM:
//   O runtime de Edge Functions da Supabase (Deno em ambiente serverless)
//   NÃO permite `Deno.env.set` — a operação falha silenciosamente com
//   "The operation is not supported". A abordagem antiga tentava reescrever
//   env vars e por isso toda troca de chave pelo painel era ignorada até um
//   redeploy manual.
//
//   A solução é manter um cache em memória (Map) do processo e substituir
//   `Deno.env.get` por um wrapper que consulta o cache primeiro e cai no
//   valor real de ambiente como fallback. É rápido (nanossegundos),
//   seguro (isolado ao processo), e mantém compatibilidade total com
//   os ~90 callers existentes.
//
// USO (1 linha no início de cada handler — já existente):
//   import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
//   await loadPlatformCredentials();
//
// REGRA DE OURO:
//   - Banco de dados (`platform_credentials`) = fonte de verdade
//   - Variável de ambiente = fallback (usada quando a chave não está no banco)
//   - Cache em memória de 60s + invalidação sob demanda pelo painel
// ============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const CACHE_TTL_MS = 60_000; // 60 segundos
let lastLoadAt = 0;
let loadInFlight: Promise<void> | null = null;

// Cache global do processo. Cada instância de Edge Function tem o seu.
const credentialsCache = new Map<string, string>();

// Referência ao Deno.env.get original — capturada UMA vez para evitar loop.
let originalEnvGet: ((key: string) => string | undefined) | null = null;
let envGetPatched = false;

/**
 * Instala o interceptador de `Deno.env.get` idempotentemente.
 * Depois de instalado, qualquer chamada a `Deno.env.get(key)` consulta
 * primeiro o cache em memória e cai no valor real da env como fallback.
 *
 * Se o runtime não permitir substituir `Deno.env.get`, mantém o
 * comportamento original e emite um único warning — nesse caso os
 * callers precisam usar `getPlatformCredential(key)` explicitamente.
 */
function patchEnvGetOnce(): void {
  if (envGetPatched) return;
  envGetPatched = true; // marca antes para nunca retentar

  try {
    const desc = Object.getOwnPropertyDescriptor(Deno.env, "get");
    if (desc && desc.writable === false && !desc.configurable) {
      console.warn(
        "[load-platform-credentials] Deno.env.get is non-writable/non-configurable — using explicit getPlatformCredential() only",
      );
      // Ainda captura a referência original para o getPlatformCredential
      try {
        originalEnvGet = Deno.env.get.bind(Deno.env);
      } catch (_) { /* noop */ }
      return;
    }

    // Captura referência original ligada ao objeto Deno.env
    const original = Deno.env.get.bind(Deno.env);
    originalEnvGet = original;

    // Substitui o método via defineProperty (mais robusto que atribuição)
    Object.defineProperty(Deno.env, "get", {
      value: (key: string) => {
        const cached = credentialsCache.get(key);
        if (cached !== undefined) return cached;
        return original(key);
      },
      writable: true,
      configurable: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[load-platform-credentials] Could not patch Deno.env.get (${msg}). ` +
        `Callers must use getPlatformCredential() explicitly for fresh values.`,
    );
    // Garante que originalEnvGet exista para o fallback do getPlatformCredential
    if (!originalEnvGet) {
      try {
        originalEnvGet = Deno.env.get.bind(Deno.env);
      } catch (_) { /* noop */ }
    }
  }
}

/**
 * Leitor explícito. Retorna o valor do cache (banco) ou o valor real
 * da variável de ambiente como fallback. Sempre seguro contra o loop
 * do próprio patch (usa a referência original quando disponível).
 */
export function getPlatformCredential(key: string): string | undefined {
  const cached = credentialsCache.get(key);
  if (cached !== undefined) return cached;
  if (originalEnvGet) return originalEnvGet(key);
  return Deno.env.get(key);
}

/**
 * Carrega todas as credenciais ativas da tabela `platform_credentials`
 * para o cache em memória. Idempotente e seguro para chamar múltiplas
 * vezes. Falha silenciosamente para não quebrar funções que dependem
 * de credenciais já baked-in na env.
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
      // Usa a referência original se o patch já foi instalado, para
      // garantir que SUPABASE_URL/SERVICE_ROLE_KEY venham da env real.
      const envGet = originalEnvGet ?? Deno.env.get.bind(Deno.env);
      const supabaseUrl = envGet("SUPABASE_URL");
      const serviceKey = envGet("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !serviceKey) {
        console.warn(
          "[load-platform-credentials] Missing SUPABASE_URL or SERVICE_ROLE_KEY — skipping bulk load",
        );
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

      // Instala o patch ANTES de popular o cache — ordem correta para
      // que qualquer leitura concorrente já enxergue os valores frescos.
      patchEnvGetOnce();

      // Reconstrói o cache a partir do snapshot do banco. Chaves
      // removidas/desativadas somem do cache automaticamente.
      credentialsCache.clear();
      let count = 0;
      for (const row of data ?? []) {
        if (!row.credential_key || !row.credential_value) continue;
        credentialsCache.set(row.credential_key, row.credential_value as string);
        count++;
      }

      lastLoadAt = Date.now();
      console.log(
        `[load-platform-credentials] v2 cache ready — ${count} credential(s) from DB (patched=${envGetPatched && originalEnvGet ? "yes" : "no"})`,
      );
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
 * Força recarregamento imediato (ignora TTL). Usado pelo painel de
 * Integrações da Plataforma logo após salvar/limpar uma credencial,
 * para propagar a mudança sem esperar 60s.
 */
export function invalidatePlatformCredentialsCache(): void {
  lastLoadAt = 0;
}
