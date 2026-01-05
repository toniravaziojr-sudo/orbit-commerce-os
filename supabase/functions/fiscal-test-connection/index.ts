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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é platform admin
    const { data: isPlatformAdmin } = await supabase.rpc('is_platform_admin');
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado. Apenas operadores da plataforma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN');
    
    if (!focusToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          configured: false,
          error: 'Token Focus NFe não configurado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Testar conexão com Focus NFe
    // Usando endpoint de homologação para teste
    const isProduction = !focusToken.includes('homolog');
    const baseUrl = isProduction 
      ? 'https://api.focusnfe.com.br' 
      : 'https://homologacao.focusnfe.com.br';
    
    console.log(`[fiscal-test-connection] Testando conexão com Focus NFe (${isProduction ? 'Produção' : 'Homologação'})`);
    
    // Fazer uma requisição de teste - listar NFes (retornará vazio ou erro de auth)
    const testResponse = await fetch(`${baseUrl}/v2/nfe?ref=test_connection`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(focusToken + ':')}`,
        'Content-Type': 'application/json',
      },
    });

    const statusCode = testResponse.status;
    
    // 401 = token inválido, 200/404 = token válido (endpoint pode não encontrar a ref)
    if (statusCode === 401) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          configured: true,
          environment: isProduction ? 'production' : 'homologation',
          error: 'Token inválido ou expirado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Qualquer outro status indica que o token é válido
    console.log(`[fiscal-test-connection] Conexão bem sucedida, status: ${statusCode}`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        configured: true,
        environment: isProduction ? 'production' : 'homologation',
        message: 'Conexão com Focus NFe estabelecida com sucesso',
        tokenPreview: `${focusToken.substring(0, 4)}...${focusToken.substring(focusToken.length - 4)}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[fiscal-test-connection] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
