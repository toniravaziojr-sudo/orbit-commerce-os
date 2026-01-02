// =============================================
// FISCAL GET STATUS - Consulta status de NF-e no provedor
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No tenant selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-get-status] Checking status for invoice:', invoice_id);

    // Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not pending, just return current status
    if (invoice.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: invoice.status,
          chave_acesso: invoice.chave_acesso,
          protocolo: invoice.protocolo,
          danfe_url: invoice.danfe_url,
          status_motivo: invoice.status_motivo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get fiscal settings
    const { data: settings } = await supabase
      .from('fiscal_settings')
      .select('provider_token, ambiente')
      .eq('tenant_id', tenantId)
      .single();

    if (!settings?.provider_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token do provedor não configurado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Query Focus NFe for status
    const baseUrl = settings.ambiente === 'producao' 
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    const refId = `${tenantId.substring(0, 8)}-${invoice.serie}-${invoice.numero}`;

    console.log('[fiscal-get-status] Querying Focus NFe:', refId);

    try {
      const response = await fetch(`${baseUrl}/v2/nfe/${refId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(settings.provider_token + ':')}`,
        },
      });

      const responseData = await response.json();
      console.log('[fiscal-get-status] Focus NFe response:', responseData.status);

      if (responseData.status === 'autorizado') {
        // Update to authorized
        await supabase
          .from('fiscal_invoices')
          .update({
            status: 'authorized',
            chave_acesso: responseData.chave_nfe,
            protocolo: responseData.protocolo,
            xml_autorizado: responseData.caminho_xml_nota_fiscal,
            danfe_url: responseData.caminho_danfe,
          })
          .eq('id', invoice_id);

        await supabase
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoice_id,
            tenant_id: tenantId,
            event_type: 'authorized',
            event_data: { 
              chave_acesso: responseData.chave_nfe,
              source: 'status_check' 
            },
            user_id: user.id,
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'authorized',
            chave_acesso: responseData.chave_nfe,
            protocolo: responseData.protocolo,
            danfe_url: responseData.caminho_danfe,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else if (responseData.status === 'erro_autorizacao' || responseData.status === 'rejeitado') {
        const errorMessage = responseData.mensagem_sefaz || responseData.mensagem || 'Erro desconhecido';
        
        await supabase
          .from('fiscal_invoices')
          .update({ 
            status: 'rejected',
            status_motivo: errorMessage,
          })
          .eq('id', invoice_id);

        await supabase
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoice_id,
            tenant_id: tenantId,
            event_type: 'rejected',
            event_data: { motivo: errorMessage, source: 'status_check' },
            user_id: user.id,
          });

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'rejected',
            status_motivo: errorMessage,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Still processing
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'pending',
            message: 'NF-e ainda em processamento.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (providerError: any) {
      console.error('[fiscal-get-status] Provider error:', providerError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao consultar provedor: ${providerError.message}` 
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-get-status] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
