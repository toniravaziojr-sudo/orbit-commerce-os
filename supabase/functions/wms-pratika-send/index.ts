import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PRATIKA_NAMESPACE = 'http://wmspratika.ddsinformatica.com.br/';

function buildSoapEnvelope(operation: string, params: Record<string, string>): string {
  const paramXml = Object.entries(params)
    .map(([key, value]) => `      <${key}>${escapeXml(value)}</${key}>`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${operation} xmlns="${PRATIKA_NAMESPACE}">
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

function parsePratikaSoapResult(body: string): { ok: boolean; message: string | null } {
  if (!body) return { ok: false, message: 'Resposta vazia' };
  const sucessoMatch = body.match(/<\s*Sucesso\s*>\s*(true|false)\s*<\s*\/\s*Sucesso\s*>/i);
  const mensagemMatch = body.match(/<\s*Mensagem\s*>([\s\S]*?)<\s*\/\s*Mensagem\s*>/i);
  const faultMatch = body.match(/<(?:\w+:)?Fault>[\s\S]*?<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);

  if (faultMatch) {
    return { ok: false, message: faultMatch[1].trim() || 'SOAP Fault' };
  }
  if (sucessoMatch) {
    const ok = sucessoMatch[1].toLowerCase() === 'true';
    const message = mensagemMatch ? mensagemMatch[1].trim() : null;
    return { ok, message };
  }
  return { ok: true, message: null };
}

async function sendSoap(url: string, operation: string, soapEnvelope: string): Promise<{ success: boolean; body: string; status: number }> {
  const soapAction = `${PRATIKA_NAMESPACE}${operation}`;
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
    console.log(`[wms-pratika] HTTP ${response.status}, body length: ${body.length}`);

    const httpOk = response.ok;
    const soapResult = parsePratikaSoapResult(body);
    const success = httpOk && soapResult.ok;

    if (httpOk && !soapResult.ok) {
      console.warn(`[wms-pratika] HTTP 200 mas SOAP rejeitou: ${soapResult.message}`);
    }

    return { success, body, status: response.status };
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
    const { action, invoice_id, order_id, tenant_id: providedTenantId } = body;
    let tenantId = providedTenantId;

    if (!tenantId) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: profile } = await supabase.from('profiles').select('current_tenant_id').eq('id', user.id).single();
      tenantId = profile?.current_tenant_id;
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: config } = await supabase
      .from('wms_pratika_configs').select('*').eq('tenant_id', tenantId).single();

    if (!config || !config.is_enabled) {
      return new Response(JSON.stringify({ success: false, error: 'WMS Pratika não está ativo', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const force = body.force === true;

    // Sanitização universal de CNPJ — Pratika indexa por 14 dígitos puros.
    const cnpj = String(config.cnpj || '').replace(/\D/g, '');
    if (action !== 'test_connection' && cnpj.length !== 14) {
      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId,
        operation: action || 'unknown',
        status: 'error',
        error_message: `CNPJ inválido (${cnpj.length} dígitos). Atualize em Aplicativos Externos.`,
      });
      return new Response(JSON.stringify({ success: false, error: 'CNPJ inválido (precisa ter 14 dígitos).' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const endpointUrl = config.endpoint_url;

    // ============= TEST CONNECTION =============
    if (action === 'test_connection') {
      if (cnpj.length !== 14) {
        return new Response(JSON.stringify({ success: false, error: 'CNPJ inválido: precisa ter 14 dígitos.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const envelope = buildSoapEnvelope('RecepcaoDocNfe', { cnpj, xmlNfe: '<test/>' });
      const result = await sendSoap(endpointUrl, 'RecepcaoDocNfe', envelope);
      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId,
        operation: 'test',
        status: result.status > 0 ? 'success' : 'error',
        response_payload: result.body?.substring(0, 2000),
        error_message: !result.success ? `HTTP ${result.status}` : null,
      });
      return new Response(JSON.stringify({ success: result.status > 0, message: result.status > 0 ? 'Endpoint acessível' : 'Endpoint inacessível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============= SEND COMBINED (oficial: NF + rastreio juntos) =============
    // Ancorado na NF FISCAL — funciona para qualquer NF de venda autorizada,
    // independentemente de ter pedido vinculado (PV manual também dispara).
    // Aceita invoice_id (preferido) ou order_id (legado).
    if (action === 'send_combined') {
      if (!invoice_id && !order_id) {
        return new Response(JSON.stringify({ success: false, error: 'invoice_id ou order_id é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // 1) Resolver a NF (ancora oficial).
      let invoiceQuery = supabase
        .from('fiscal_invoices')
        .select('id, order_id, source_order_invoice_id, chave_acesso, xml_url, status, tipo_nota, fiscal_stage')
        .eq('tenant_id', tenantId)
        .eq('status', 'authorized');

      invoiceQuery = invoice_id
        ? invoiceQuery.eq('id', invoice_id)
        : invoiceQuery.eq('order_id', order_id);

      const { data: invoice } = await invoiceQuery
        .order('authorized_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Bloquear tipos de NF que não são venda (entrada, devolução, transferência, remessa).
      const SALES_TIPO_NOTA = new Set(['', 'venda', 'saida']);
      if (invoice?.tipo_nota && !SALES_TIPO_NOTA.has(String(invoice.tipo_nota).toLowerCase())) {
        return new Response(JSON.stringify({ success: false, skipped: true, reason: `NF tipo '${invoice.tipo_nota}' não é enviada à Pratika` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Só NF (não enviar Pedido de Venda).
      if (invoice?.fiscal_stage && !['nf', 'emitida'].includes(String(invoice.fiscal_stage))) {
        return new Response(JSON.stringify({ success: false, skipped: true, reason: 'Documento não é NF (é Pedido de Venda)' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const resolvedInvoiceId = invoice?.id || null;
      const resolvedOrderId = invoice?.order_id || order_id || null;

      // 2) Resolver a Remessa (Objeto Logístico) pela NF — cascata robusta:
      //    a) shipments.invoice_id = NF.id
      //    b) shipments.nfe_key = NF.chave_acesso (44 dígitos)
      //    c) shipments.source_pedido_venda_id = NF.source_order_invoice_id (PV)
      //    d) shipments.order_id = NF.order_id (legado)
      let shipment: { id: string; tracking_code: string | null } | null = null;
      const chaveLimpaForShip = String(invoice?.chave_acesso || '').replace(/\D/g, '');
      const trackingSel = 'id, tracking_code';

      const tryLookup = async (col: string, val: string) => {
        if (shipment) return;
        const r = await supabase.from('shipments').select(trackingSel)
          .eq('tenant_id', tenantId).eq(col, val)
          .not('tracking_code', 'is', null)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (r.data) shipment = r.data;
      };

      if (resolvedInvoiceId) await tryLookup('invoice_id', resolvedInvoiceId);
      if (chaveLimpaForShip.length === 44) await tryLookup('nfe_key', chaveLimpaForShip);
      if (invoice?.source_order_invoice_id) await tryLookup('source_pedido_venda_id', invoice.source_order_invoice_id);
      if (resolvedOrderId) await tryLookup('order_id', resolvedOrderId);

      const hasNfe = !!(invoice?.id && invoice.xml_url);
      const hasTracking = !!shipment?.tracking_code;

      if (!hasNfe || !hasTracking) {
        const motivo = !hasNfe && !hasTracking
          ? 'aguardando NF autorizada e código de rastreio'
          : !hasNfe ? 'aguardando NF autorizada' : 'aguardando código de rastreio';
        console.log(`[wms-pratika] send_combined waiting invoice=${resolvedInvoiceId} order=${resolvedOrderId}: ${motivo}`);
        return new Response(JSON.stringify({ success: false, skipped: true, waiting: true, reason: motivo }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Idempotência — chave estável é a NF (invoice_id). Compat com registros antigos por order_id.
      if (!force) {
        const orFilter = resolvedOrderId
          ? `reference_id.eq.${invoice.id},reference_id.eq.${resolvedOrderId}`
          : `reference_id.eq.${invoice.id}`;
        const { data: existingCombined } = await supabase
          .from('wms_pratika_logs').select('id, created_at')
          .eq('tenant_id', tenantId)
          .eq('operation', 'combined').eq('status', 'success')
          .or(orFilter)
          .limit(1).maybeSingle();
        if (existingCombined) {
          return new Response(JSON.stringify({ success: true, already_sent: true, sent_at: existingCombined.created_at }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const chaveLimpa = String(invoice.chave_acesso || '').replace(/\D/g, '');
      if (chaveLimpa.length !== 44) {
        const msg = `Chave de acesso inválida (${chaveLimpa.length} dígitos)`;
        await supabase.from('wms_pratika_logs').insert({
          tenant_id: tenantId, operation: 'combined', reference_id: invoice.id,
          reference_type: 'invoice', status: 'error', error_message: msg,
        });
        return new Response(JSON.stringify({ success: false, stage: 'validation', error: msg }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ETAPA 1: Enviar XML da NF (pular se já enviada com sucesso)
      let nfeAlreadyOk = false;
      if (!force) {
        const { data: nfeOk } = await supabase
          .from('wms_pratika_logs').select('id')
          .eq('tenant_id', tenantId).eq('reference_id', invoice.id)
          .eq('operation', 'nfe').eq('status', 'success')
          .limit(1).maybeSingle();
        nfeAlreadyOk = !!nfeOk;
      }

      if (!nfeAlreadyOk) {
        let xmlContent = '';
        if (invoice.xml_url) {
          try {
            const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
            const headers: Record<string, string> = {};
            if (focusToken && invoice.xml_url.includes('focusnfe.com.br')) {
              headers['Authorization'] = 'Basic ' + btoa(focusToken + ':');
            }
            const resp = await fetch(invoice.xml_url, { headers });
            if (resp.ok) xmlContent = await resp.text();
          } catch (err: any) {
            console.error('[wms-pratika] Erro baixando XML:', err);
          }
        }

        if (!xmlContent) {
          await supabase.from('wms_pratika_logs').insert({
            tenant_id: tenantId, operation: 'combined', reference_id: invoice.id,
            reference_type: 'invoice', status: 'error',
            error_message: 'XML da NFe não disponível para envio combinado',
          });
          return new Response(JSON.stringify({ success: false, stage: 'nfe', error: 'XML da NFe não disponível' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const envNfe = buildSoapEnvelope('RecepcaoDocNfe', { cnpj, xmlNfe: xmlContent });
        const nfeResult = await sendSoap(endpointUrl, 'RecepcaoDocNfe', envNfe);
        const nfeSoap = nfeResult.body ? parsePratikaSoapResult(nfeResult.body) : { ok: false, message: 'sem resposta' };
        const nfeErrMsg = !nfeResult.success ? `HTTP ${nfeResult.status}${nfeSoap.message ? ` · ${nfeSoap.message}` : ''}` : null;

        await supabase.from('wms_pratika_logs').insert({
          tenant_id: tenantId, operation: 'nfe', reference_id: invoice.id,
          reference_type: 'invoice', status: nfeResult.success ? 'success' : 'error',
          request_payload: `combined · cnpj: ${cnpj}, chave: ${chaveLimpa}`,
          response_payload: nfeResult.body?.substring(0, 2000),
          error_message: nfeErrMsg,
        });

        if (!nfeResult.success) {
          await supabase.from('wms_pratika_logs').insert({
            tenant_id: tenantId, operation: 'combined', reference_id: invoice.id,
            reference_type: 'invoice', status: 'error',
            error_message: `Falha na etapa NF: ${nfeErrMsg}`,
          });
          return new Response(JSON.stringify({ success: false, stage: 'nfe', error: nfeErrMsg }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // ETAPA 2: Atualizar rastreio
      let trackingAlreadyOk = false;
      if (!force) {
        const { data: trkOk } = await supabase
          .from('wms_pratika_logs').select('id')
          .eq('tenant_id', tenantId).eq('reference_id', invoice.id)
          .eq('operation', 'tracking').eq('status', 'success')
          .limit(1).maybeSingle();
        trackingAlreadyOk = !!trkOk;
      }

      if (!trackingAlreadyOk) {
        const envTrk = buildSoapEnvelope('AtualizarCodRastreioNfe', {
          chaveAcesso: chaveLimpa,
          codRastreio: shipment.tracking_code,
        });
        const trkResult = await sendSoap(endpointUrl, 'AtualizarCodRastreioNfe', envTrk);
        const trkSoap = trkResult.body ? parsePratikaSoapResult(trkResult.body) : { ok: false, message: 'sem resposta' };
        const trkErrMsg = !trkResult.success ? `HTTP ${trkResult.status}${trkSoap.message ? ` · ${trkSoap.message}` : ''}` : null;

        await supabase.from('wms_pratika_logs').insert({
          tenant_id: tenantId, operation: 'tracking', reference_id: invoice.id,
          reference_type: 'invoice', status: trkResult.success ? 'success' : 'error',
          request_payload: `combined · chave: ${chaveLimpa}, rastreio: ${shipment.tracking_code}`,
          response_payload: trkResult.body?.substring(0, 2000),
          error_message: trkErrMsg,
        });

        if (!trkResult.success) {
          await supabase.from('wms_pratika_logs').insert({
            tenant_id: tenantId, operation: 'combined', reference_id: invoice.id,
            reference_type: 'invoice', status: 'error',
            error_message: `NF enviada, falha no rastreio: ${trkErrMsg}`,
          });
          return new Response(JSON.stringify({ success: false, stage: 'tracking', error: trkErrMsg, nfe_sent: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId, operation: 'combined', reference_id: invoice.id,
        reference_type: 'invoice', status: 'success',
        request_payload: `cnpj: ${cnpj}, invoice: ${invoice.id}, rastreio: ${shipment.tracking_code}`,
      });

      return new Response(JSON.stringify({
        success: true, combined: true, invoice_id: invoice.id, tracking_code: shipment.tracking_code
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============= AÇÕES LEGADAS (admin / reconciliação) =============
    // Bloqueio defensivo: envio isolado de NF ou rastreio só com force=true.
    if ((action === 'send_nfe' || action === 'update_tracking') && !force) {
      const msg = action === 'send_nfe'
        ? 'Envio isolado de NF bloqueado. Pratika exige NF + rastreio juntos. Use send_combined ou passe force=true (admin).'
        : 'Envio isolado de etiqueta bloqueado. Pratika exige NF + rastreio juntos. Use send_combined ou passe force=true (admin).';
      return new Response(JSON.stringify({ success: false, skipped: true, error: msg }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_nfe' && invoice_id) {
      const { data: invoice } = await supabase
        .from('fiscal_invoices').select('id, chave_acesso, xml_url, focus_ref')
        .eq('id', invoice_id).eq('tenant_id', tenantId).single();
      if (!invoice) {
        return new Response(JSON.stringify({ success: false, error: 'Nota fiscal não encontrada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      let xmlContent = '';
      if (invoice.xml_url) {
        try {
          const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
          const headers: Record<string, string> = {};
          if (focusToken && invoice.xml_url.includes('focusnfe.com.br')) {
            headers['Authorization'] = 'Basic ' + btoa(focusToken + ':');
          }
          const resp = await fetch(invoice.xml_url, { headers });
          if (resp.ok) xmlContent = await resp.text();
        } catch (err: any) {
          console.error('[wms-pratika] XML download error:', err);
        }
      }

      if (!xmlContent) {
        await supabase.from('wms_pratika_logs').insert({
          tenant_id: tenantId, operation: 'nfe', reference_id: invoice_id,
          reference_type: 'invoice', status: 'error',
          error_message: 'XML da NFe não disponível',
        });
        return new Response(JSON.stringify({ success: false, error: 'XML da NFe não disponível' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const envelope = buildSoapEnvelope('RecepcaoDocNfe', { cnpj, xmlNfe: xmlContent });
      const result = await sendSoap(endpointUrl, 'RecepcaoDocNfe', envelope);
      const soapInfo = result.body ? parsePratikaSoapResult(result.body) : { ok: false, message: 'sem resposta' };

      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId, operation: 'nfe', reference_id: invoice_id,
        reference_type: 'invoice', status: result.success ? 'success' : 'error',
        request_payload: `force · cnpj: ${cnpj}, chave: ${invoice.chave_acesso || 'N/A'}`,
        response_payload: result.body?.substring(0, 2000),
        error_message: !result.success ? `HTTP ${result.status}${soapInfo.message ? ` · ${soapInfo.message}` : ''}` : null,
      });

      return new Response(JSON.stringify({ success: result.success, status: result.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_tracking' && invoice_id) {
      const { tracking_code } = body;
      if (!tracking_code) {
        return new Response(JSON.stringify({ success: false, error: 'tracking_code é obrigatório' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: invoice } = await supabase
        .from('fiscal_invoices').select('chave_acesso')
        .eq('id', invoice_id).eq('tenant_id', tenantId).single();
      const chaveLimpa = String(invoice?.chave_acesso || '').replace(/\D/g, '');
      if (chaveLimpa.length !== 44) {
        return new Response(JSON.stringify({ success: false, error: `Chave inválida (${chaveLimpa.length} dígitos)` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const envelope = buildSoapEnvelope('AtualizarCodRastreioNfe', {
        chaveAcesso: chaveLimpa, codRastreio: tracking_code,
      });
      const result = await sendSoap(endpointUrl, 'AtualizarCodRastreioNfe', envelope);
      const soapInfo = result.body ? parsePratikaSoapResult(result.body) : { ok: false, message: 'sem resposta' };

      await supabase.from('wms_pratika_logs').insert({
        tenant_id: tenantId, operation: 'tracking', reference_id: invoice_id,
        reference_type: 'invoice', status: result.success ? 'success' : 'error',
        request_payload: `force · chave: ${chaveLimpa}, rastreio: ${tracking_code}`,
        response_payload: result.body?.substring(0, 2000),
        error_message: !result.success ? `HTTP ${result.status}${soapInfo.message ? ` · ${soapInfo.message}` : ''}` : null,
      });

      return new Response(JSON.stringify({ success: result.success }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Ação não reconhecida. Use: test_connection, send_combined (oficial), send_nfe/update_tracking (admin com force=true)',
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[wms-pratika] Error:', error);
    return errorResponse(error, corsHeaders, { module: 'wms-pratika', action: 'send' });
  }
});
