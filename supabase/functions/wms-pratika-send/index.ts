import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Monta envelope SOAP para operações do WMS Pratika
 */
function buildSoapEnvelope(operation: string, params: Record<string, string>): string {
  const paramXml = Object.entries(params)
    .map(([key, value]) => `      <${key}>${escapeXml(value)}</${key}>`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${operation} xmlns="http://tempuri.org/">
${paramXml}
    </${operation}>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Envia requisição SOAP ao WMS Pratika
 */
async function sendSoap(url: string, operation: string, soapEnvelope: string): Promise<{ success: boolean; body: string; status: number }> {
  const soapAction = `http://tempuri.org/${operation}`;

  console.log(`[wms-pratika] Sending SOAP ${operation} to ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
      },
      body: soapEnvelope,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const body = await response.text();

    console.log(`[wms-pratika] Response status: ${response.status}, body length: ${body.length}`);

    return { success: response.ok, body, status: response.status };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return { success: false, body: '', status: 408 };
    }
    return { success: false, body: error.message || 'Erro de comunicação', status: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action, invoice_id, shipment_id, tenant_id: providedTenantId } = body;

    let tenantId = providedTenantId;

    // If no tenant_id provided, resolve from auth
    if (!tenantId) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_tenant_id')
        .eq('id', user.id)
        .single();

      tenantId = profile?.current_tenant_id;
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WMS config
    const { data: config } = await supabase
      .from('wms_pratika_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!config || !config.is_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'WMS Pratika não está ativo para este tenant', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gate por tipo de operação + force flag
    const force = body.force === true;
    if (action === 'send_nfe' && config.auto_send_nfe === false && !force) {
      return new Response(
        JSON.stringify({ success: false, error: 'Envio automático de NFe desativado', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (action === 'update_tracking' && config.auto_send_label === false && !force) {
      return new Response(
        JSON.stringify({ success: false, error: 'Envio automático de etiqueta desativado', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotência: se já houve sucesso para este invoice+operation, não reenviar
    if ((action === 'send_nfe' || action === 'update_tracking') && invoice_id && !force) {
      const operationName = action === 'send_nfe' ? 'nfe' : 'tracking';
      const { data: existingOk } = await supabase
        .from('wms_pratika_logs')
        .select('id, created_at')
        .eq('tenant_id', tenantId)
        .eq('reference_id', invoice_id)
        .eq('operation', operationName)
        .eq('status', 'success')
        .limit(1)
        .maybeSingle();

      if (existingOk) {
        console.log(`[wms-pratika] Skip (já enviado com sucesso): ${operationName} ${invoice_id}`);
        return new Response(
          JSON.stringify({ success: true, already_sent: true, sent_at: existingOk.created_at }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const endpointUrl = config.endpoint_url;
    const cnpj = config.cnpj || '';

    // === TEST CONNECTION ===
    if (action === 'test_connection') {
      // Simple SOAP call to check if endpoint responds
      const envelope = buildSoapEnvelope('RecepcaoDocNfe', {
        XmlNfe: '<test/>',
        CnpjDestinatario: cnpj,
      });
      const result = await sendSoap(endpointUrl, 'RecepcaoDocNfe', envelope);
      
      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId,
        operation: 'test',
        status: result.status > 0 ? 'success' : 'error',
        response_payload: result.body?.substring(0, 2000),
        error_message: !result.success ? `HTTP ${result.status}` : null,
      });

      return new Response(
        JSON.stringify({ success: result.status > 0, message: result.status > 0 ? 'Endpoint acessível' : 'Endpoint inacessível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === SEND NFE XML ===
    if (action === 'send_nfe' && invoice_id) {
      console.log(`[wms-pratika] Sending NFe XML for invoice ${invoice_id}`);

      // Get invoice with xml_url
      const { data: invoice } = await supabase
        .from('fiscal_invoices')
        .select('id, chave_acesso, xml_url, focus_ref')
        .eq('id', invoice_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!invoice) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nota fiscal não encontrada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let xmlContent = '';

      // Try to download XML from Focus NFe via persisted xml_url (already absolute)
      if (invoice.xml_url) {
        try {
          const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
          const headers: Record<string, string> = {};
          if (focusToken && invoice.xml_url.includes('focusnfe.com.br')) {
            headers['Authorization'] = 'Basic ' + btoa(focusToken + ':');
          }
          const resp = await fetch(invoice.xml_url, { headers });
          if (resp.ok) {
            xmlContent = await resp.text();
          }
        } catch (err: any) {
          console.error('[wms-pratika] Error downloading XML from Focus NFe:', err);
        }
      }


      if (!xmlContent) {
        await supabase.from('wms_pratika_logs').insert({
          tenant_id: tenantId,
          operation: 'nfe',
          reference_id: invoice_id,
          reference_type: 'invoice',
          status: 'error',
          error_message: 'XML da NFe não disponível',
        });

        return new Response(
          JSON.stringify({ success: false, error: 'XML da NFe não disponível' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Send to WMS
      const envelope = buildSoapEnvelope('RecepcaoDocNfe', {
        XmlNfe: xmlContent,
        CnpjDestinatario: cnpj,
      });

      const result = await sendSoap(endpointUrl, 'RecepcaoDocNfe', envelope);

      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId,
        operation: 'nfe',
        reference_id: invoice_id,
        reference_type: 'invoice',
        status: result.success ? 'success' : 'error',
        request_payload: `invoice_id: ${invoice_id}, chave: ${invoice.chave_acesso || 'N/A'}`,
        response_payload: result.body?.substring(0, 2000),
        error_message: !result.success ? `HTTP ${result.status}: ${result.body?.substring(0, 500)}` : null,
      });

      return new Response(
        JSON.stringify({ success: result.success, status: result.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === UPDATE TRACKING ===
    if (action === 'update_tracking' && invoice_id) {
      const { tracking_code } = body;
      if (!tracking_code) {
        return new Response(
          JSON.stringify({ success: false, error: 'tracking_code é obrigatório' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invoice } = await supabase
        .from('fiscal_invoices')
        .select('chave_acesso')
        .eq('id', invoice_id)
        .eq('tenant_id', tenantId)
        .single();

      const envelope = buildSoapEnvelope('AtualizarCodRastreioNfe', {
        ChaveNfe: invoice?.chave_acesso || '',
        CodRastreio: tracking_code,
        CnpjDestinatario: cnpj,
      });

      const result = await sendSoap(endpointUrl, 'AtualizarCodRastreioNfe', envelope);

      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId,
        operation: 'tracking',
        reference_id: invoice_id,
        reference_type: 'invoice',
        status: result.success ? 'success' : 'error',
        response_payload: result.body?.substring(0, 2000),
        error_message: !result.success ? `HTTP ${result.status}` : null,
      });

      return new Response(
        JSON.stringify({ success: result.success }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida. Use: test_connection, send_nfe, update_tracking' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[wms-pratika] Error:', error);
    return errorResponse(error, corsHeaders, { module: 'wms-pratika', action: 'send' });
  }
});
