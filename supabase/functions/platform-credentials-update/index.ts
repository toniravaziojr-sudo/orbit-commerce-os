import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista fechada de secrets editáveis pela plataforma
const EDITABLE_SECRETS = [
  'FOCUS_NFE_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ZONE_ID',
  'LOGGI_CLIENT_ID',
  'LOGGI_CLIENT_SECRET',
  'LOGGI_EXTERNAL_SERVICE_ID',
  'ZAPI_CLIENT_TOKEN',
  'SENDGRID_API_KEY',
  'FRENET_TOKEN',
  'FRENET_PASSWORD',
  'FRENET_KEY',
  'PAGARME_API_KEY',
  'PAGARME_PUBLIC_KEY',
  'PAGARME_ACCOUNT_ID',
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

    const { secretName, secretValue }: { secretName: string; secretValue: string } = await req.json();

    if (!secretName || !secretValue) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome e valor do secret são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que é um secret permitido
    if (!EDITABLE_SECRETS.includes(secretName)) {
      return new Response(
        JSON.stringify({ success: false, error: `Secret '${secretName}' não é editável via painel` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NOTA: Supabase Edge Functions não podem atualizar secrets programaticamente
    // Esta é uma limitação da plataforma. Os secrets são configurados via Dashboard ou CLI.
    // Esta função serve como placeholder para quando a funcionalidade estiver disponível
    // ou para usar com Vault no futuro.
    
    // Por enquanto, retornamos instruções para o admin
    console.log(`[platform-credentials-update] Admin ${user.email} solicitou atualização de ${secretName}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Para atualizar ${secretName}, use o painel Lovable Cloud > Secrets ou a CLI do Supabase.`,
        instruction: `supabase secrets set ${secretName}="${secretValue}"`,
        note: 'A atualização de secrets via API ainda não é suportada nativamente pelo Supabase.'
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
