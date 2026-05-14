import { errorResponse } from "../_shared/error-response.ts";
import { chargeAfter } from "../_shared/credits/charge-after.ts";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
import { requireFiscalRole } from "../_shared/fiscal-role-check.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!focusToken) {
      return jsonResponse({ success: false, error: 'Token Focus NFe não configurado', code: 'no_focus_token' });
    }

    // RBAC: inutilização de numeração exige owner/admin (Lote 1.C.3)
    const auth = await requireFiscalRole(req, ['owner', 'admin']);
    if (!auth.ok) return auth.response;
    const { tenantId, serviceClient: supabaseClient } = auth;

    const body = await req.json().catch(() => ({}));
    const { serie, numero_inicial, numero_final, justificativa } = body ?? {};

    if (!serie || !numero_inicial || !numero_final || !justificativa) {
      return jsonResponse({ success: false, error: 'Todos os campos são obrigatórios', code: 'missing_fields' });
    }
    const ni = Number(numero_inicial);
    const nf = Number(numero_final);
    if (!Number.isInteger(ni) || !Number.isInteger(nf) || ni <= 0 || nf <= 0) {
      return jsonResponse({ success: false, error: 'Numeração inválida', code: 'invalid_numeration' });
    }
    if (ni > nf) {
      return jsonResponse({ success: false, error: 'Número inicial deve ser menor ou igual ao final', code: 'invalid_range' });
    }
    if (justificativa.length < 15 || justificativa.length > 255) {
      return jsonResponse({ success: false, error: 'Justificativa deve ter entre 15 e 255 caracteres', code: 'invalid_justificativa' });
    }

    const { data: settings, error: settingsError } = await supabaseClient
      .from('fiscal_settings')
      .select('cnpj, ambiente, focus_ambiente')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings?.cnpj) {
      return jsonResponse({ success: false, error: 'Configurações fiscais não encontradas', code: 'no_settings' });
    }

    // Idempotência: já existe inutilização autorizada para essa faixa neste tenant?
    const { data: existing } = await supabaseClient
      .from('fiscal_inutilizacoes')
      .select('id, status, protocolo')
      .eq('tenant_id', tenantId)
      .eq('serie', String(serie))
      .eq('numero_inicial', ni)
      .eq('numero_final', nf)
      .eq('status', 'authorized')
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        success: true,
        noop: true,
        record: existing,
        message: 'Faixa já inutilizada anteriormente',
      });
    }

    const cnpj = settings.cnpj.replace(/\D/g, '');
    const ambiente = (settings.focus_ambiente || settings.ambiente) === 'producao' ? 'producao' : 'homologacao';
    const focusBaseUrl = ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    console.log(`[fiscal-inutilizar] tenant=${tenantId} serie=${serie} ${ni}-${nf}`);

    const response = await fetch(`${focusBaseUrl}/v2/nfe/inutilizacao`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${focusToken}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cnpj,
        serie: String(serie),
        numero_inicial: String(ni),
        numero_final: String(nf),
        justificativa,
      }),
    });

    const responseData = await response.json().catch(() => ({}));

    const { data: savedRecord, error: saveError } = await supabaseClient
      .from('fiscal_inutilizacoes')
      .insert({
        tenant_id: tenantId,
        serie: String(serie),
        numero_inicial: ni,
        numero_final: nf,
        justificativa,
        status: response.ok ? 'authorized' : 'rejected',
        protocolo: responseData.protocolo || null,
        response_data: responseData,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[fiscal-inutilizar] persist error:', saveError);
    }

    if (!response.ok) {
      return jsonResponse({
        success: false,
        error: responseData.mensagem || 'Erro ao inutilizar numeração',
        code: 'focus_error',
      });
    }

    chargeAfter({
      tenantId,
      serviceKey: 'nfe-inutilizar',
      units: { count: 1 },
      jobId: `inut-${tenantId}-${serie}-${ni}-${nf}`,
      feature: 'fiscal-inutilizar',
    }).catch(() => {});

    return jsonResponse({
      success: true,
      record: savedRecord,
      protocolo: responseData.protocolo,
    });
  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'inutilizar' });
  }
});
