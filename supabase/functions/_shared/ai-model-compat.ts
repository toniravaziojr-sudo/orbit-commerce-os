// ============================================================
// Cache PERSISTENTE de incompatibilidade de parâmetros por modelo.
// Substitui o cache em-memória que se perdia a cada cold start
// e fazia o turno pagar ~5–8s de erro+retry todo dia.
//
// Tabela: public.ai_model_param_compat (PK: model + param_name)
// TTL padrão: 24h (configurável via opts).
//
// Camada dupla:
//   1. Memória do isolate (TTL curto, 10 min) — evita SELECT a cada chamada.
//   2. Banco (TTL 24h) — sobrevive a cold start.
//
// Tolerância a falha:
//   - Qualquer erro de leitura/escrita é apenas logado (warn).
//   - Falha NUNCA quebra o pipeline; no pior caso degrada para o
//     comportamento antigo (paga o retry de novo).
// ============================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const MEM_TTL_MS = 10 * 60 * 1000; // 10 minutos
const DB_TTL_HOURS = 24;

type MemEntry = { incompatible: boolean; expiresAt: number };
const memCache = new Map<string, MemEntry>();

function key(model: string, paramName: string): string {
  return `${model}::${paramName}`;
}

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  try {
    const url = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return null;
    _admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    return _admin;
  } catch {
    return null;
  }
}

/**
 * Verifica se um parâmetro é incompatível com o modelo.
 *
 * - Hit em memória: retorna instantâneo (zero latência).
 * - Miss em memória: faz SELECT no banco (com TTL).
 * - Erro: retorna false (comportamento conservador — vai tentar o param).
 */
export async function isParamIncompatible(
  model: string,
  paramName: string,
): Promise<{ incompatible: boolean; source: "mem" | "db" | "miss" | "error" }> {
  const k = key(model, paramName);
  const now = Date.now();

  // 1. Memória primeiro
  const mem = memCache.get(k);
  if (mem && mem.expiresAt > now) {
    return { incompatible: mem.incompatible, source: "mem" };
  }

  // 2. Banco
  const admin = getAdmin();
  if (!admin) {
    return { incompatible: false, source: "error" };
  }

  try {
    const { data, error } = await admin
      .from("ai_model_param_compat")
      .select("incompatible, expires_at")
      .eq("model", model)
      .eq("param_name", paramName)
      .maybeSingle();

    if (error) {
      console.warn(`[ai-model-compat] db_read_error model=${model} param=${paramName}`, error.message);
      return { incompatible: false, source: "error" };
    }

    if (!data) {
      // Cacheia "não incompatível" por 5 min (assume default seguro)
      memCache.set(k, { incompatible: false, expiresAt: now + 5 * 60 * 1000 });
      return { incompatible: false, source: "miss" };
    }

    const expiresAt = Date.parse(String(data.expires_at));
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      // Expirado — trata como não-cacheado
      memCache.set(k, { incompatible: false, expiresAt: now + 5 * 60 * 1000 });
      return { incompatible: false, source: "miss" };
    }

    // Espelha em memória até o min(expira_db, +10min)
    const memExpires = Math.min(expiresAt, now + MEM_TTL_MS);
    memCache.set(k, { incompatible: !!data.incompatible, expiresAt: memExpires });
    return { incompatible: !!data.incompatible, source: "db" };
  } catch (e) {
    console.warn(`[ai-model-compat] db_read_exception model=${model} param=${paramName}`, (e as Error).message);
    return { incompatible: false, source: "error" };
  }
}

/**
 * Marca um parâmetro como incompatível (chamado após retry bem-sucedido sem o param).
 * Persiste no banco por 24h e espelha em memória por 10 min.
 */
export async function markParamIncompatible(
  model: string,
  paramName: string,
): Promise<void> {
  const k = key(model, paramName);
  const now = Date.now();
  memCache.set(k, { incompatible: true, expiresAt: now + MEM_TTL_MS });

  const admin = getAdmin();
  if (!admin) {
    console.warn(`[ai-model-compat] mark_skipped_no_admin model=${model} param=${paramName}`);
    return;
  }

  try {
    const expiresAt = new Date(now + DB_TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from("ai_model_param_compat")
      .upsert(
        {
          model,
          param_name: paramName,
          incompatible: true,
          last_seen_at: new Date(now).toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: "model,param_name" },
      );
    if (error) {
      console.warn(`[ai-model-compat] db_write_error model=${model} param=${paramName}`, error.message);
    } else {
      console.log(`[ai-model-compat] persisted_incompatibility model=${model} param=${paramName} ttl_hours=${DB_TTL_HOURS}`);
    }
  } catch (e) {
    console.warn(`[ai-model-compat] db_write_exception model=${model} param=${paramName}`, (e as Error).message);
  }
}

// Helper opcional para testes / limpeza manual.
export function _clearMemCache() {
  memCache.clear();
}
