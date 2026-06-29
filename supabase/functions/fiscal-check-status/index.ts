import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getNFeStatus, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";
import { mapFocusStatusToInternal } from "../_shared/focus-nfe-adapter.ts";
import { persistAuthorizedState } from "../_shared/fiscal-persist-authorized.ts";
import { fireAuthorizedSideEffects } from "../_shared/fiscal-authorized-side-effects.ts";
import { chargeAfter } from "../_shared/credits/charge-after.ts";


import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build full URL for Focus NFe paths
function buildFocusUrl(path: string | undefined, ambiente: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = ambiente === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
  return `${baseUrl}${path}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Token resolvido por tenant + ambiente mais abaixo (operação fiscal de NF).

  try {
    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Obter invoice_id do body ou query
    let invoiceId: string | null = null;
    
    if (req.method === 'POST') {
      const body = await req.json();
      invoiceId = body.invoice_id;
    } else {
      const url = new URL(req.url);
      invoiceId = url.searchParams.get('invoice_id');
    }

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fiscal-check-status] Verificando status da NF-e ${invoiceId}`);

    // Buscar NF-e
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se tem referência Focus NFe
    if (!invoice.focus_ref) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não foi enviada para Focus NFe' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações fiscais
    const { data: settings } = await supabaseClient
      .from('fiscal_settings')
      .select('focus_ambiente, ambiente')
      .eq('tenant_id', tenantId)
      .single();

    const ambiente = (settings?.focus_ambiente || settings?.ambiente || 'homologacao') as 'homologacao' | 'producao';
    const tenantTok = await loadFocusTenantToken(supabaseClient, tenantId, ambiente);
    const creds = resolveFocusCredentials({
      ambiente,
      operationKind: 'nfe_op',
      tenantTokenForAmbiente: tenantTok.token,
    });
    if (!creds.ok || !creds.token) {
      return new Response(
        JSON.stringify({ success: false, error: creds.error, code: creds.errorCode }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configuração Focus NFe
    const focusConfig: FocusNFeConfig = {
      token: creds.token,
      ambiente,
    };

    // Consultar status na Focus NFe
    const result = await getNFeStatus(focusConfig, invoice.focus_ref);

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mapear status
    const focusStatus = result.data?.status || 'processando_autorizacao';
    const internalStatus = mapFocusStatusToInternal(focusStatus);

    // CAMINHO CANÔNICO para autorizado: persistAuthorizedState + side-effects.
    if (focusStatus === 'autorizado' && result.data?.chave_nfe) {
      const persistResult = await persistAuthorizedState({
        supabaseClient,
        invoiceId,
        tenantId,
        ambiente,
        callerModule: 'fiscal-check-status',
        focusStatusData: {
          status: 'autorizado',
          chave_nfe: result.data.chave_nfe,
          numero: result.data.numero,
          serie: result.data.serie,
          caminho_xml_nota_fiscal: result.data.caminho_xml_nota_fiscal,
          caminho_danfe: result.data.caminho_danfe,
          mensagem_sefaz: result.data?.mensagem_sefaz,
          status_sefaz: result.data?.status_sefaz,
          protocolo: result.data?.protocolo,
        },
        focusRef: invoice.focus_ref,
      });

      // Log do evento authorized para o reconciliador poder reaplicar se algo der errado.
      await supabaseClient
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoiceId,
          tenant_id: tenantId,
          event_type: 'authorized',
          event_data: { focus_response: result.data, source: 'fiscal-check-status' },
        });

      if (persistResult.persisted && persistResult.invoice) {
        await fireAuthorizedSideEffects({
          supabaseClient,
          invoice: { id: invoiceId, tenant_id: tenantId, order_id: invoice.order_id },
          chaveAcesso: result.data.chave_nfe,
          supabaseUrl,
          supabaseServiceKey,
          callerModule: 'fiscal-check-status',
        });
      }
    } else if (invoice.status !== internalStatus) {
      // Não autorizado: atualiza estado simples (sem side-effects).
      const updateData: any = {
        status: internalStatus,
        mensagem_sefaz: result.data?.mensagem_sefaz,
        status_sefaz: result.data?.status_sefaz,
        updated_at: new Date().toISOString(),
      };

      // Idempotência: nunca sobrescrever status terminal
      const TERMINAL = new Set(['authorized', 'cancelled', 'rejected']);
      const wouldDemoteTerminal = TERMINAL.has(invoice.status) && invoice.status !== internalStatus;
      if (wouldDemoteTerminal) {
        console.warn(`[fiscal-check-status] preservando status terminal ${invoice.status}`);
      } else {
        await supabaseClient
          .from('fiscal_invoices')
          .update(updateData)
          .eq('id', invoiceId)
          .eq('tenant_id', tenantId);

        await supabaseClient
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoiceId,
            tenant_id: tenantId,
            event_type: 'status_check',
            event_data: result.data,
          });
      }
    }


    chargeAfter({
      tenantId,
      serviceKey: "nfe-status-query",
      units: { count: 1 },
      jobId: `status-${invoiceId}-${Date.now()}`,
      feature: "fiscal-check-status",
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        status: internalStatus,
        focus_status: focusStatus,
        chave_acesso: result.data?.chave_nfe || invoice.chave_acesso,
        numero: result.data?.numero || invoice.numero,
        serie: result.data?.serie || invoice.serie,
        mensagem_sefaz: result.data?.mensagem_sefaz,
        xml_url: result.data?.caminho_xml_nota_fiscal,
        danfe_url: result.data?.caminho_danfe,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'check-status' });
  }
});
