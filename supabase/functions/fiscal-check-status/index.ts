import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getNFeStatus, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { mapFocusStatusToInternal } from "../_shared/focus-nfe-adapter.ts";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');

  if (!focusToken) {
    return new Response(
      JSON.stringify({ success: false, error: 'Token Focus NFe não configurado' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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

    // Configuração Focus NFe
    const focusConfig: FocusNFeConfig = {
      token: focusToken,
      ambiente: (settings?.focus_ambiente || settings?.ambiente || 'homologacao') as 'homologacao' | 'producao',
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

    // Preparar dados de atualização
    const updateData: any = {
      status: internalStatus,
      mensagem_sefaz: result.data?.mensagem_sefaz,
      status_sefaz: result.data?.status_sefaz,
      updated_at: new Date().toISOString(),
    };

    // Se autorizado, salvar dados adicionais
    const ambiente = focusConfig.ambiente;
    if (focusStatus === 'autorizado' && result.data?.chave_nfe) {
      updateData.chave_acesso = result.data.chave_nfe;
      updateData.numero = result.data.numero;
      updateData.serie = result.data.serie;
      // Build full URLs for DANFE and XML
      updateData.xml_url = buildFocusUrl(result.data.caminho_xml_nota_fiscal, ambiente);
      updateData.danfe_url = buildFocusUrl(result.data.caminho_danfe, ambiente);
      
      if (!invoice.authorized_at) {
        updateData.authorized_at = new Date().toISOString();
      }
    }

    // Atualizar NF-e se status mudou
    const statusChanged = invoice.status !== internalStatus;
    if (statusChanged) {
      await supabaseClient
        .from('fiscal_invoices')
        .update(updateData)
        .eq('id', invoiceId);

      // Registrar log
      await supabaseClient
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoiceId,
          tenant_id: tenantId,
          event_type: focusStatus === 'autorizado' ? 'authorized' : 'status_check',
          event_data: result.data,
        });

      console.log(`[fiscal-check-status] Status atualizado: ${invoice.status} -> ${internalStatus}`);

      // Se autorizado, verificar se deve criar remessa automaticamente
      if (focusStatus === 'autorizado' && invoice.order_id) {
        const { data: fiscalSettingsShip } = await supabaseClient
          .from('fiscal_settings')
          .select('auto_create_shipment')
          .eq('tenant_id', tenantId)
          .single();

        if (fiscalSettingsShip?.auto_create_shipment) {
          console.log(`[fiscal-check-status] Auto-creating shipment for order ${invoice.order_id}`);
          
          // Call shipping-create-shipment and update order status
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            
            const shipResponse = await fetch(`${supabaseUrl}/functions/v1/shipping-create-shipment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ order_id: invoice.order_id }),
            });
            
            const shipResult = await shipResponse.json();
            console.log(`[fiscal-check-status] Shipment creation result:`, JSON.stringify(shipResult));
            
            // Se remessa criada com sucesso, atualizar pedido para shipped
            if (shipResult.success && shipResult.tracking_code) {
              await supabaseClient
                .from('orders')
                .update({ 
                  status: 'shipped',
                  shipped_at: new Date().toISOString()
                })
                .eq('id', invoice.order_id);
              
              console.log(`[fiscal-check-status] Order ${invoice.order_id} updated to shipped`);
            } else {
              // Se não criou remessa, apenas marcar como dispatched
              await supabaseClient
                .from('orders')
                .update({ status: 'dispatched' })
                .eq('id', invoice.order_id);
            }
          } catch (shipError) {
            console.error(`[fiscal-check-status] Failed to create shipment:`, shipError);
            // Fallback: marcar como dispatched
            await supabaseClient
              .from('orders')
              .update({ status: 'dispatched' })
              .eq('id', invoice.order_id);
          }
        }
      }
    }

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
    console.error('[fiscal-check-status] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
