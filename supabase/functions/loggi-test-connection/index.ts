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

    const clientId = Deno.env.get('LOGGI_CLIENT_ID');
    const clientSecret = Deno.env.get('LOGGI_CLIENT_SECRET');
    const externalServiceId = Deno.env.get('LOGGI_EXTERNAL_SERVICE_ID');
    
    const results = {
      clientId: { configured: !!clientId, preview: '' },
      clientSecret: { configured: !!clientSecret },
      externalServiceId: { configured: !!externalServiceId, value: '' },
      oauth: { success: false, error: '' }
    };

    if (clientId) {
      results.clientId.preview = `${clientId.substring(0, 4)}...`;
    }
    if (externalServiceId) {
      results.externalServiceId.value = externalServiceId;
    }

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          results,
          error: 'Credenciais OAuth Loggi não configuradas completamente' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Testar autenticação OAuth
    console.log('[loggi-test-connection] Testando autenticação OAuth...');
    
    const oauthResponse = await fetch('https://auth.loggi.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        audience: 'https://api.loggi.com',
      }),
    });

    if (!oauthResponse.ok) {
      const errorData = await oauthResponse.text();
      console.error('[loggi-test-connection] OAuth error:', errorData);
      results.oauth.error = 'Falha na autenticação OAuth';
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          results,
          error: 'Credenciais OAuth inválidas' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const oauthData = await oauthResponse.json();
    results.oauth.success = !!oauthData.access_token;
    
    console.log('[loggi-test-connection] OAuth bem sucedido');

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: 'Conexão com Loggi estabelecida com sucesso',
        tokenType: oauthData.token_type,
        expiresIn: oauthData.expires_in
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[loggi-test-connection] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
