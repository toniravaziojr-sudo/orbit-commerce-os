// Gate de sincronização obrigatória do emitente antes de transmitir/reemitir NF-e.
//
// Regra (rev 2026-05-20d):
//   Se o cadastro fiscal local (`fiscal_settings.updated_at`) for mais novo que o
//   último snapshot confirmado pelo provedor (`focus_ultima_sincronizacao`), o
//   sistema deve sincronizar o emitente no provedor ANTES de transmitir a NF-e.
//   Se a sincronização falhar, a transmissão é bloqueada para não enviar
//   cadastro defasado para a SEFAZ (causa típica de rejeição 481 — regime
//   tributário divergente após mudança de CRT/regime).
//
// Constraint: mem://constraints/fiscal-emitente-must-be-synced-before-emit

export interface EmitenteSyncGateInput {
  settings: {
    updated_at?: string | null;
    focus_ultima_sincronizacao?: string | null;
    focus_empresa_id?: number | string | null;
  };
  tenantId: string;
  authHeader: string;
  logPrefix: string;
}

export interface EmitenteSyncGateResult {
  ok: boolean;
  attempted: boolean;
  refreshedSettings?: any;
  error?: string;
  code?: string;
}

function toMs(ts: string | null | undefined): number {
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

export async function ensureEmitenteSynced(
  supabaseClient: any,
  input: EmitenteSyncGateInput,
): Promise<EmitenteSyncGateResult> {
  const { settings, tenantId, authHeader, logPrefix } = input;

  const localUpdatedMs = toMs(settings.updated_at);
  const lastSyncMs = toMs(settings.focus_ultima_sincronizacao);

  // Se nunca sincronizou OU se cadastro local é mais novo que o snapshot externo,
  // dispara sync antes de transmitir.
  const needsSync = !settings.focus_empresa_id
    || lastSyncMs === 0
    || localUpdatedMs > lastSyncMs;

  if (!needsSync) {
    return { ok: true, attempted: false };
  }

  console.log(
    `${logPrefix} Cadastro fiscal local mais novo que o snapshot externo ` +
    `(local=${settings.updated_at} | sync=${settings.focus_ultima_sincronizacao}). ` +
    `Sincronizando emitente antes de transmitir.`,
  );

  let syncJson: any = null;
  try {
    const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fiscal-sync-focus-nfe`;
    const apikey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const r = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "apikey": apikey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    syncJson = await r.json().catch(() => ({}));
  } catch (e) {
    const msg = (e as any)?.message || "Falha ao sincronizar cadastro fiscal com o provedor.";
    console.error(`${logPrefix} Erro de rede ao sincronizar emitente:`, msg);
    return {
      ok: false,
      attempted: true,
      code: "emitente_sync_failed",
      error: "Não foi possível atualizar o cadastro fiscal no provedor antes de transmitir a nota. Tente novamente em instantes.",
    };
  }

  if (!syncJson?.success) {
    const detail = syncJson?.error || syncJson?.message || "erro desconhecido na sincronização do emitente";
    console.error(`${logPrefix} Sync do emitente falhou: ${detail}`);
    return {
      ok: false,
      attempted: true,
      code: "emitente_sync_failed",
      error: "O cadastro fiscal da loja não pôde ser atualizado no provedor antes da emissão. Verifique as Configurações Fiscais (regime, CNAE, endereço) e tente novamente.",
    };
  }

  // Recarrega settings e confirma que o snapshot avançou.
  const { data: refreshed } = await supabaseClient
    .from("fiscal_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  const newSyncMs = toMs(refreshed?.focus_ultima_sincronizacao);
  if (refreshed && newSyncMs >= localUpdatedMs) {
    console.log(`${logPrefix} Emitente sincronizado com sucesso (sync=${refreshed.focus_ultima_sincronizacao}).`);
    return { ok: true, attempted: true, refreshedSettings: refreshed };
  }

  console.error(
    `${logPrefix} Sync retornou sucesso mas snapshot externo não avançou ` +
    `(local=${settings.updated_at} | sync=${refreshed?.focus_ultima_sincronizacao}).`,
  );
  return {
    ok: false,
    attempted: true,
    code: "emitente_sync_stale",
    error: "O cadastro fiscal não foi confirmado pelo provedor após a atualização. Tente novamente em instantes.",
    refreshedSettings: refreshed,
  };
}
