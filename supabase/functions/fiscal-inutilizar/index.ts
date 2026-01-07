import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');

    if (!focusToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token Focus NFe não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Parse request body
    const { serie, numero_inicial, numero_final, justificativa } = await req.json();

    if (!serie || !numero_inicial || !numero_final || !justificativa) {
      return new Response(
        JSON.stringify({ success: false, error: 'Todos os campos são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate
    if (numero_inicial > numero_final) {
      return new Response(
        JSON.stringify({ success: false, error: 'Número inicial deve ser menor ou igual ao final' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (justificativa.length < 15 || justificativa.length > 255) {
      return new Response(
        JSON.stringify({ success: false, error: 'Justificativa deve ter entre 15 e 255 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get fiscal settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('fiscal_settings')
      .select('cnpj, ambiente')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings?.cnpj) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cnpj = settings.cnpj.replace(/\D/g, '');
    const ambiente = settings.ambiente === 'producao' ? 'producao' : 'homologacao';
    const focusBaseUrl = ambiente === 'producao'
      ? 'https://api.focusnfe.com.br'
      : 'https://homologacao.focusnfe.com.br';

    console.log(`[fiscal-inutilizar] Inutilizing ${numero_inicial}-${numero_final} serie ${serie}`);

    // Send to Focus NFe
    const response = await fetch(`${focusBaseUrl}/v2/nfe/inutilizacao`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${focusToken}:`)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cnpj,
        serie: String(serie),
        numero_inicial: String(numero_inicial),
        numero_final: String(numero_final),
        justificativa,
      }),
    });

    const responseData = await response.json();
    console.log('[fiscal-inutilizar] Focus response:', responseData);

    // Save record
    const inutRecord = {
      tenant_id: tenantId,
      serie: String(serie),
      numero_inicial,
      numero_final,
      justificativa,
      status: response.ok ? 'authorized' : 'rejected',
      protocolo: responseData.protocolo || null,
      response_data: responseData,
    };

    const { data: savedRecord, error: saveError } = await supabaseClient
      .from('fiscal_inutilizacoes')
      .insert(inutRecord)
      .select()
      .single();

    if (saveError) {
      console.error('[fiscal-inutilizar] Error saving record:', saveError);
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: responseData.mensagem || 'Erro ao inutilizar numeração',
          details: responseData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        record: savedRecord,
        protocolo: responseData.protocolo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fiscal-inutilizar] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
