// ============================================================================
// FOCUS TENANT TOKEN LOADER
// ----------------------------------------------------------------------------
// Lê o token da empresa do tenant para o ambiente solicitado, usando o
// service client (bypass de RLS / column GRANTs). NUNCA expõe o valor.
// ============================================================================
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { FocusAmbiente } from "./focus-credentials.ts";

export interface TenantTokenLoadResult {
  ok: boolean;
  token?: string;
  errorCode?: 'NO_SETTINGS' | 'NO_TOKEN';
  error?: string;
}

export async function loadFocusTenantToken(
  serviceClient: SupabaseClient,
  tenantId: string,
  ambiente: FocusAmbiente,
): Promise<TenantTokenLoadResult> {
  const col = ambiente === 'producao' ? 'focus_token_producao' : 'focus_token_homologacao';
  const { data, error } = await serviceClient
    .from('fiscal_settings')
    .select(col)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      errorCode: 'NO_SETTINGS',
      error: 'Configuração fiscal não encontrada para esta loja.',
    };
  }
  // deno-lint-ignore no-explicit-any
  const raw = ((data as any)[col] || '').trim();
  if (!raw) {
    return { ok: false, errorCode: 'NO_TOKEN' };
  }
  return { ok: true, token: raw };
}
