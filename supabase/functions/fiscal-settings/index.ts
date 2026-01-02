// =============================================
// FISCAL SETTINGS - CRUD das Configurações Fiscais
// GET: Retorna config do tenant (token mascarado)
// POST: Salva/atualiza configuração
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user token for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      console.error('[fiscal-settings] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
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

    // GET - Fetch settings
    if (req.method === 'GET') {
      console.log('[fiscal-settings] GET for tenant:', tenantId);
      
      const { data: settings, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('[fiscal-settings] Query error:', error);
        throw error;
      }

      // Mask token if exists
      let maskedSettings = settings;
      if (settings?.provider_token) {
        maskedSettings = {
          ...settings,
          provider_token: settings.provider_token.substring(0, 8) + '****'
        };
      }

      return new Response(
        JSON.stringify({ success: true, settings: maskedSettings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Save/update settings
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[fiscal-settings] POST for tenant:', tenantId, 'body keys:', Object.keys(body));

      // Validate required fields for configuration
      const {
        razao_social,
        cnpj,
        inscricao_estadual,
        ie_isento,
        endereco_logradouro,
        endereco_numero,
        endereco_bairro,
        endereco_municipio,
        endereco_municipio_codigo,
        endereco_uf,
        endereco_cep,
        crt,
        cfop_intrastadual,
        cfop_interestadual,
        csosn_padrao,
        cst_padrao,
        serie_nfe,
        numero_nfe_atual,
        provider,
        provider_token,
        ambiente,
        emissao_automatica,
        emitir_apos_status,
        nome_fantasia,
        endereco_complemento,
        cnae,
      } = body;

      // Check if is_configured based on required fields
      const is_configured = !!(
        razao_social &&
        cnpj &&
        (ie_isento || inscricao_estadual) &&
        endereco_logradouro &&
        endereco_numero &&
        endereco_municipio &&
        endereco_uf &&
        endereco_cep &&
        serie_nfe &&
        provider_token
      );

      // Check if record exists
      const { data: existing } = await supabase
        .from('fiscal_settings')
        .select('id, provider_token')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Determine token to save (keep existing if masked token sent)
      let tokenToSave = provider_token;
      if (provider_token && provider_token.includes('****') && existing?.provider_token) {
        // User sent masked token, keep the existing one
        tokenToSave = existing.provider_token;
      }

      const settingsData = {
        tenant_id: tenantId,
        razao_social,
        nome_fantasia,
        cnpj,
        inscricao_estadual,
        ie_isento: ie_isento || false,
        cnae,
        endereco_logradouro,
        endereco_numero,
        endereco_complemento,
        endereco_bairro,
        endereco_municipio,
        endereco_municipio_codigo,
        endereco_uf,
        endereco_cep,
        crt: crt || 1,
        cfop_intrastadual: cfop_intrastadual || '5102',
        cfop_interestadual: cfop_interestadual || '6102',
        csosn_padrao,
        cst_padrao,
        serie_nfe: serie_nfe || 1,
        numero_nfe_atual: numero_nfe_atual || 1,
        provider: provider || 'focusnfe',
        provider_token: tokenToSave,
        ambiente: ambiente || 'homologacao',
        emissao_automatica: emissao_automatica || false,
        emitir_apos_status: emitir_apos_status || 'paid',
        is_configured,
      };

      let result;
      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('fiscal_settings')
          .update(settingsData)
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('fiscal_settings')
          .insert(settingsData)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }

      // Mask token in response
      if (result?.provider_token) {
        result.provider_token = result.provider_token.substring(0, 8) + '****';
      }

      console.log('[fiscal-settings] Saved successfully, is_configured:', is_configured);

      return new Response(
        JSON.stringify({ success: true, settings: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-settings] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
