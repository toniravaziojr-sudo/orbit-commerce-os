import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  'OPENAI_API_KEY',
  'LATE_API_KEY',
  'LATE_WEBHOOK_SECRET',
  // Mercado Livre (Marketplace)
  'MELI_APP_ID',
  'MELI_CLIENT_SECRET',
  // Mercado Pago (Platform Billing)
  'MP_ACCESS_TOKEN',
  'MP_PUBLIC_KEY',
  'MP_WEBHOOK_SECRET',
  // Meta (Facebook/Instagram/WhatsApp)
  'META_APP_ID',
  'META_APP_SECRET',
  // Fal.AI (Geração de Imagens e Vídeos)
  'FAL_API_KEY',
  // Google Gemini (Geração de Imagens Nativa)
  'GEMINI_API_KEY',
  // Google Platform (OAuth)
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  // TikTok Shop (Partner API)
  'TIKTOK_SHOP_APP_KEY',
  'TIKTOK_SHOP_APP_SECRET',
  // TikTok Ads (Business API)
  'TIKTOK_ADS_APP_ID',
  'TIKTOK_ADS_APP_SECRET',
  // Shopee (Marketplace)
  'SHOPEE_PARTNER_ID',
  'SHOPEE_PARTNER_KEY',
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

    const body = await req.json();
    const { credentialKey, credentialValue, action } = body as { 
      credentialKey: string; 
      credentialValue?: string | null;
      action?: 'update' | 'delete';
    };

    if (!credentialKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome da credencial é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que é uma credencial permitida
    if (!EDITABLE_CREDENTIALS.includes(credentialKey)) {
      return new Response(
        JSON.stringify({ success: false, error: `Credencial '${credentialKey}' não é editável` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar service role para atualizar
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Ação de delete - remove completamente o registro
    if (action === 'delete') {
      const { error } = await supabaseAdmin
        .from('platform_credentials')
        .delete()
        .eq('credential_key', credentialKey);

      if (error) {
        console.error('[platform-credentials-update] Error deleting:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[platform-credentials-update] Deleted ${credentialKey} by user ${user.email}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${credentialKey} removido com sucesso!` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se credentialValue está vazio ou null, limpar (volta a usar env var)
    if (!credentialValue) {
      const { error } = await supabaseAdmin
        .from('platform_credentials')
        .update({ 
          credential_value: null, 
          is_active: false,
          updated_at: new Date().toISOString(),
          updated_by: user.id 
        })
        .eq('credential_key', credentialKey);

      if (error) {
        console.error('[platform-credentials-update] Error clearing:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
