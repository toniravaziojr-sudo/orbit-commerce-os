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

    // RBAC: envio de CC-e exige owner/admin (Lote 1.C.3)
    const auth = await requireFiscalRole(req, ['owner', 'admin']);
    if (!auth.ok) return auth.response;
    const { tenantId, serviceClient: supabaseClient } = auth;

    const body = await req.json().catch(() => ({}));
    const { invoice_id, correcao } = body ?? {};

    if (!invoice_id || !correcao) {
      return jsonResponse({ success: false, error: 'invoice_id e correcao são obrigatórios', code: 'missing_fields' });
    }
    if (correcao.length < 15 || correcao.length > 1000) {
      return jsonResponse({ success: false, error: 'Correção deve ter entre 15 e 1000 caracteres', code: 'invalid_correcao' });
    }

    // Tenant guard
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('fiscal_invoices')
      .select('id, tenant_id, status, focus_ref, numero')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (invoiceError || !invoice) {
      return jsonResponse({ success: false, error: 'NF-e não encontrada', code: 'invoice_not_found' });
    }
    if (invoice.status !== 'authorized') {
      return jsonResponse({ success: false, error: 'Apenas NF-e autorizadas podem receber carta de correção', code: 'invalid_status' });
    }

    const { count: existingCount } = await supabaseClient
      .from('fiscal_invoice_cces')
      .select('*', { count: 'exact', head: true })
      .eq('invoice_id', invoice_id)
      .eq('tenant_id', tenantId);

    if ((existingCount || 0) >= 20) {
      return jsonResponse({ success: false, error: 'Limite de 20 cartas de correção atingido', code: 'cce_limit' });
    }

    const numeroSequencia = (existingCount || 0) + 1;

    const { data: settings } = await supabaseClient
      .from('fiscal_settings')
      .select('focus_ambiente, ambiente')
      .eq('tenant_id', tenantId)
      .single();

    const ambiente = (settings?.focus_ambiente || settings?.ambiente) === 'producao' ? 'producao' : 'homologacao';
    const tenantTok = await loadFocusTenantToken(supabaseClient, tenantId, ambiente);
    const creds = resolveFocusCredentials({
      ambiente,
      operationKind: 'nfe_op',
      tenantTokenForAmbiente: tenantTok.token,
    });
    if (!creds.ok || !creds.token) {
      return jsonResponse({ success: false, error: creds.error, code: creds.errorCode });
    }
    const focusToken = creds.token;
    const focusBaseUrl = creds.baseUrl!;

    const ref = invoice.focus_ref || `nfe_${invoice.id.replace(/-/g, '').substring(0, 20)}`;

    console.log(`[fiscal-cce] CC-e #${numeroSequencia} invoice=${invoice_id} ref=${ref} ambiente=${ambiente}`);

    const response = await fetch(`${focusBaseUrl}/v2/nfe/${ref}/carta_correcao`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${focusToken}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ correcao }),
    });

    const responseData = await response.json().catch(() => ({}));

    const { data: savedCce, error: saveError } = await supabaseClient
      .from('fiscal_invoice_cces')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        numero_sequencia: numeroSequencia,
        correcao,
        status: response.ok ? 'authorized' : 'rejected',
        protocolo: responseData.protocolo || null,
        response_data: responseData,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[fiscal-cce] persist error:', saveError);
    }

    await supabaseClient
      .from('fiscal_invoice_events')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        event_type: response.ok ? 'cce_authorized' : 'cce_rejected',
        event_data: { numero_sequencia: numeroSequencia, response: responseData },
      });

    if (!response.ok) {
      return jsonResponse({
        success: false,
        error: responseData.mensagem || 'Erro ao enviar carta de correção',
        code: 'focus_error',
      });
    }

    chargeAfter({
      tenantId,
      serviceKey: 'nfe-cce',
      units: { count: 1 },
      jobId: `cce-${invoice_id}-${numeroSequencia}`,
      feature: 'fiscal-cce',
    }).catch(() => {});

    return jsonResponse({
      success: true,
      cce: savedCce,
      protocolo: responseData.protocolo,
    });
  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'cce' });
  }
});
