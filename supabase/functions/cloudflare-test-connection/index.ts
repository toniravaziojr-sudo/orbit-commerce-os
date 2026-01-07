import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    const cfToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cfZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
    
    const results = {
      apiToken: { configured: !!cfToken, valid: false, preview: '' },
      zoneId: { configured: !!cfZoneId, valid: false, zoneName: '' }
    };

    if (!cfToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          results,
          error: 'API Token Cloudflare não configurado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    results.apiToken.preview = `${cfToken.substring(0, 4)}...${cfToken.substring(cfToken.length - 4)}`;

    // Verificar token
    console.log('[cloudflare-test-connection] Verificando API Token...');
    const tokenVerifyResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
    });

    const tokenVerifyData = await tokenVerifyResponse.json();
    results.apiToken.valid = tokenVerifyData.success === true;

    if (!results.apiToken.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          results,
          error: 'API Token inválido ou expirado'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar Zone ID se configurado
    if (cfZoneId) {
      console.log('[cloudflare-test-connection] Verificando Zone ID...');
      const zoneResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${cfZoneId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
      });

      const zoneData = await zoneResponse.json();
      results.zoneId.valid = zoneData.success === true;
      if (zoneData.result?.name) {
        results.zoneId.zoneName = zoneData.result.name;
      }
    }

    const allValid = results.apiToken.valid && (!cfZoneId || results.zoneId.valid);
    
    console.log(`[cloudflare-test-connection] Resultado: ${allValid ? 'Sucesso' : 'Falha parcial'}`);

    return new Response(
      JSON.stringify({ 
        success: allValid, 
        results,
        message: allValid 
          ? 'Conexão com Cloudflare estabelecida com sucesso' 
          : 'Conexão parcial - verifique os resultados'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[cloudflare-test-connection] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
