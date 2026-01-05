import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista fechada de credenciais editáveis pela plataforma
const EDITABLE_CREDENTIALS = [
  'FOCUS_NFE_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID',
  'LOGGI_CLIENT_ID',
  'LOGGI_CLIENT_SECRET',
  'LOGGI_EXTERNAL_SERVICE_ID',
  'SENDGRID_API_KEY',
  'PAGARME_API_KEY',
  'PAGARME_PUBLIC_KEY',
  'PAGARME_ACCOUNT_ID',
  'FRENET_TOKEN',
  'FRENET_PASSWORD',
  'FRENET_KEY',
  'FIRECRAWL_API_KEY',
  'ZAPI_CLIENT_TOKEN',
];

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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

    const { credentialKey, credentialValue }: { credentialKey: string; credentialValue: string } = await req.json();

    if (!credentialKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome da credencial é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que é uma credencial permitida
    if (!EDITABLE_CREDENTIALS.includes(credentialKey)) {
      return new Response(
        JSON.stringify({ success: false, error: `Credencial '${credentialKey}' não é editável` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar service role para atualizar
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Se credentialValue está vazio ou null, limpar (volta a usar env var)
    if (!credentialValue) {
      const { error } = await supabaseAdmin
        .from('platform_credentials')
        .update({ 
          credential_value: null, 
          updated_at: new Date().toISOString(),
          updated_by: user.id 
        })
        .eq('credential_key', credentialKey);

      if (error) {
        console.error('[platform-credentials-update] Error clearing:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[platform-credentials-update] Cleared ${credentialKey}, will use env var fallback`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${credentialKey} limpo. Usando variável de ambiente como fallback.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar ou inserir credencial
    const { error } = await supabaseAdmin
      .from('platform_credentials')
      .upsert({
        credential_key: credentialKey,
        credential_value: credentialValue,
        is_active: true,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, {
        onConflict: 'credential_key'
      });

    if (error) {
      console.error('[platform-credentials-update] Error updating:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[platform-credentials-update] Updated ${credentialKey} by user ${user.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${credentialKey} atualizado com sucesso!` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[platform-credentials-update] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
