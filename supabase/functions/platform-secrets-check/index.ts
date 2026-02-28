import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IntegrationConfig {
  name: string;
  description: string;
  icon: string;
  docs: string;
  isSystem?: boolean;
  secrets: Record<string, boolean>;
}

// Helper para verificar se credencial existe (banco OU env var)
async function checkCredential(
  supabaseUrl: string,
  supabaseServiceKey: string,
  key: string
): Promise<{ exists: boolean; source: 'db' | 'env' | null; preview?: string }> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Primeiro verificar no banco
  const { data, error } = await supabase
    .from('platform_credentials')
    .select('credential_value, is_active')
    .eq('credential_key', key)
    .single();
  
  if (!error && data && data.is_active && data.credential_value) {
    const value = data.credential_value as string;
    const preview = value.length > 8 
      ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
      : '••••••••';
    return { exists: true, source: 'db', preview };
  }
  
  // Fallback para env var
  const envValue = Deno.env.get(key);
  if (envValue) {
    const preview = envValue.length > 8 
      ? `${envValue.substring(0, 4)}...${envValue.substring(envValue.length - 4)}`
      : '••••••••';
    return { exists: true, source: 'env', preview };
  }
  
  return { exists: false, source: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
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

    // Check if user is platform admin
    const { data: isPlatformAdmin } = await supabase.rpc('is_platform_admin');
    if (!isPlatformAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado. Apenas operadores da plataforma.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which secrets are configured (database OR env vars)
    const focusNfeToken = await checkCredential(supabaseUrl, supabaseServiceKey, 'FOCUS_NFE_TOKEN');
    const sendgridApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'SENDGRID_API_KEY');
    const cloudflareApiToken = await checkCredential(supabaseUrl, supabaseServiceKey, 'CLOUDFLARE_API_TOKEN');
    const cloudflareZoneId = await checkCredential(supabaseUrl, supabaseServiceKey, 'CLOUDFLARE_ZONE_ID');
    const loggiClientId = await checkCredential(supabaseUrl, supabaseServiceKey, 'LOGGI_CLIENT_ID');
    const loggiClientSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'LOGGI_CLIENT_SECRET');
    const loggiExternalServiceId = await checkCredential(supabaseUrl, supabaseServiceKey, 'LOGGI_EXTERNAL_SERVICE_ID');
    const firecrawlApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'FIRECRAWL_API_KEY');
    const lovableApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'LOVABLE_API_KEY');
    const zapiClientToken = await checkCredential(supabaseUrl, supabaseServiceKey, 'ZAPI_CLIENT_TOKEN');
    const openaiApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'OPENAI_API_KEY');
    const metaAppId = await checkCredential(supabaseUrl, supabaseServiceKey, 'META_APP_ID');
    const metaAppSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'META_APP_SECRET');
    const lateApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'LATE_API_KEY');
    const meliAppId = await checkCredential(supabaseUrl, supabaseServiceKey, 'MELI_APP_ID');
    const meliClientSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'MELI_CLIENT_SECRET');
    // Mercado Pago Platform (SaaS Billing)
    const mpAccessToken = await checkCredential(supabaseUrl, supabaseServiceKey, 'MP_ACCESS_TOKEN');
    const mpPublicKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'MP_PUBLIC_KEY');
    const mpWebhookSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'MP_WEBHOOK_SECRET');
    // Nuvem Fiscal
    const nuvemFiscalClientId = await checkCredential(supabaseUrl, supabaseServiceKey, 'NUVEM_FISCAL_CLIENT_ID');
    const nuvemFiscalClientSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'NUVEM_FISCAL_CLIENT_SECRET');
    // Fal.AI (Geração de Imagens e Vídeos)
    const falApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'FAL_API_KEY');
    // Google Gemini (Geração de Imagens Nativa)
    const geminiApiKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'GEMINI_API_KEY');
    // Google (Ads, Analytics, YouTube, etc.)
    const googleClientId = await checkCredential(supabaseUrl, supabaseServiceKey, 'GOOGLE_CLIENT_ID');
    const googleClientSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'GOOGLE_CLIENT_SECRET');
    // TikTok Ads
    const tiktokAppId = await checkCredential(supabaseUrl, supabaseServiceKey, 'TIKTOK_APP_ID');
    const tiktokAppSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'TIKTOK_APP_SECRET');
    // TikTok Shop
    const tiktokShopAppKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'TIKTOK_SHOP_APP_KEY');
    const tiktokShopAppSecret = await checkCredential(supabaseUrl, supabaseServiceKey, 'TIKTOK_SHOP_APP_SECRET');
    // Shopee
    const shopeePartnerId = await checkCredential(supabaseUrl, supabaseServiceKey, 'SHOPEE_PARTNER_ID');
    const shopeePartnerKey = await checkCredential(supabaseUrl, supabaseServiceKey, 'SHOPEE_PARTNER_KEY');
    
    const secrets: Record<string, IntegrationConfig & { previews?: Record<string, string>; sources?: Record<string, string> }> = {
      nuvem_fiscal: {
        name: 'Nuvem Fiscal',
        description: 'Emissão de NF-e para todos os tenants',
        icon: 'Cloud',
        docs: 'https://dev.nuvemfiscal.com.br/',
        secrets: {
          NUVEM_FISCAL_CLIENT_ID: nuvemFiscalClientId.exists,
          NUVEM_FISCAL_CLIENT_SECRET: nuvemFiscalClientSecret.exists,
        },
        previews: {
          NUVEM_FISCAL_CLIENT_ID: nuvemFiscalClientId.preview || '',
          NUVEM_FISCAL_CLIENT_SECRET: nuvemFiscalClientSecret.preview || '',
        },
        sources: {
          NUVEM_FISCAL_CLIENT_ID: nuvemFiscalClientId.source || '',
          NUVEM_FISCAL_CLIENT_SECRET: nuvemFiscalClientSecret.source || '',
        },
      },
      focus_nfe: {
        name: 'Focus NFe (Legado)',
        description: 'Emissão de NF-e (migrado para Nuvem Fiscal)',
        icon: 'FileText',
        docs: 'https://focusnfe.com.br/doc/',
        secrets: {
          FOCUS_NFE_TOKEN: focusNfeToken.exists,
        },
        previews: {
          FOCUS_NFE_TOKEN: focusNfeToken.preview || '',
        },
        sources: {
          FOCUS_NFE_TOKEN: focusNfeToken.source || '',
        },
      },
      sendgrid: {
        name: 'SendGrid',
        description: 'Emails transacionais (autenticação, notificações)',
        icon: 'Mail',
        docs: 'https://docs.sendgrid.com/',
        secrets: {
          SENDGRID_API_KEY: sendgridApiKey.exists,
        },
        previews: {
          SENDGRID_API_KEY: sendgridApiKey.preview || '',
        },
        sources: {
          SENDGRID_API_KEY: sendgridApiKey.source || '',
        },
      },
      cloudflare: {
        name: 'Cloudflare',
        description: 'Domínios custom e SSL automático',
        icon: 'Cloud',
        docs: 'https://developers.cloudflare.com/',
        secrets: {
          CLOUDFLARE_API_TOKEN: cloudflareApiToken.exists,
          CLOUDFLARE_ZONE_ID: cloudflareZoneId.exists,
        },
        previews: {
          CLOUDFLARE_API_TOKEN: cloudflareApiToken.preview || '',
          CLOUDFLARE_ZONE_ID: cloudflareZoneId.preview || '',
        },
        sources: {
          CLOUDFLARE_API_TOKEN: cloudflareApiToken.source || '',
          CLOUDFLARE_ZONE_ID: cloudflareZoneId.source || '',
        },
      },
      loggi: {
        name: 'Loggi',
        description: 'OAuth para entregas Loggi (tenant fornece company_id)',
        icon: 'Truck',
        docs: 'https://docs.loggi.com/',
        secrets: {
          LOGGI_CLIENT_ID: loggiClientId.exists,
          LOGGI_CLIENT_SECRET: loggiClientSecret.exists,
          LOGGI_EXTERNAL_SERVICE_ID: loggiExternalServiceId.exists,
        },
        previews: {
          LOGGI_CLIENT_ID: loggiClientId.preview || '',
          LOGGI_CLIENT_SECRET: loggiClientSecret.preview || '',
          LOGGI_EXTERNAL_SERVICE_ID: loggiExternalServiceId.preview || '',
        },
        sources: {
          LOGGI_CLIENT_ID: loggiClientId.source || '',
          LOGGI_CLIENT_SECRET: loggiClientSecret.source || '',
          LOGGI_EXTERNAL_SERVICE_ID: loggiExternalServiceId.source || '',
        },
      },
      firecrawl: {
        name: 'Firecrawl',
        description: 'Web scraping para importação de lojas',
        icon: 'Flame',
        docs: 'https://www.firecrawl.dev/',
        secrets: {
          FIRECRAWL_API_KEY: firecrawlApiKey.exists,
        },
        previews: {
          FIRECRAWL_API_KEY: firecrawlApiKey.preview || '',
        },
        sources: {
          FIRECRAWL_API_KEY: firecrawlApiKey.source || '',
        },
      },
      lovable_ai: {
        name: 'Lovable AI',
        description: 'Gateway de IA (assistente)',
        icon: 'Bot',
        docs: 'https://docs.lovable.dev/',
        isSystem: true,
        secrets: {
          LOVABLE_API_KEY: lovableApiKey.exists,
        },
        previews: {
          LOVABLE_API_KEY: lovableApiKey.preview || '',
        },
        sources: {
          LOVABLE_API_KEY: lovableApiKey.source || '',
        },
      },
      openai: {
        name: 'OpenAI',
        description: 'Geração de imagens e criativos (DALL-E / GPT Image)',
        icon: 'Sparkles',
        docs: 'https://platform.openai.com/docs',
        secrets: {
          OPENAI_API_KEY: openaiApiKey.exists,
        },
        previews: {
          OPENAI_API_KEY: openaiApiKey.preview || '',
        },
        sources: {
          OPENAI_API_KEY: openaiApiKey.source || '',
        },
      },
      zapi: {
        name: 'Z-API',
        description: 'WhatsApp Business API (Client Token da conta gerenciadora)',
        icon: 'MessageSquare',
        docs: 'https://developer.z-api.io/',
        secrets: {
          ZAPI_CLIENT_TOKEN: zapiClientToken.exists,
        },
        previews: {
          ZAPI_CLIENT_TOKEN: zapiClientToken.preview || '',
        },
        sources: {
          ZAPI_CLIENT_TOKEN: zapiClientToken.source || '',
        },
      },
      whatsapp_meta: {
        name: 'WhatsApp Meta',
        description: 'WhatsApp Cloud API Oficial (Integrador)',
        icon: 'MessageSquare',
        docs: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
        secrets: {
          META_APP_ID: metaAppId.exists,
          META_APP_SECRET: metaAppSecret.exists,
        },
        previews: {
          META_APP_ID: metaAppId.preview || '',
          META_APP_SECRET: metaAppSecret.preview || '',
        },
        sources: {
          META_APP_ID: metaAppId.source || '',
          META_APP_SECRET: metaAppSecret.source || '',
        },
      },
      late: {
        name: 'Late',
        description: 'Agendamento de publicações em redes sociais (Facebook/Instagram)',
        icon: 'Calendar',
        docs: 'https://getlate.dev/docs',
        secrets: {
          LATE_API_KEY: lateApiKey.exists,
        },
        previews: {
          LATE_API_KEY: lateApiKey.preview || '',
        },
        sources: {
          LATE_API_KEY: lateApiKey.source || '',
        },
      },
      mercadolivre: {
        name: 'Mercado Livre',
        description: 'Integração com marketplace Mercado Livre',
        icon: 'ShoppingBag',
        docs: 'https://developers.mercadolivre.com.br/',
        secrets: {
          MELI_APP_ID: meliAppId.exists,
          MELI_CLIENT_SECRET: meliClientSecret.exists,
        },
        previews: {
          MELI_APP_ID: meliAppId.preview || '',
          MELI_CLIENT_SECRET: meliClientSecret.preview || '',
        },
        sources: {
          MELI_APP_ID: meliAppId.source || '',
          MELI_CLIENT_SECRET: meliClientSecret.source || '',
        },
      },
      mercadopago_platform: {
        name: 'Mercado Pago (Billing)',
        description: 'Credenciais para cobrar assinaturas do SaaS',
        icon: 'CreditCard',
        docs: 'https://www.mercadopago.com.br/developers',
        secrets: {
          MP_ACCESS_TOKEN: mpAccessToken.exists,
          MP_PUBLIC_KEY: mpPublicKey.exists,
          MP_WEBHOOK_SECRET: mpWebhookSecret.exists,
        },
        previews: {
          MP_ACCESS_TOKEN: mpAccessToken.preview || '',
          MP_PUBLIC_KEY: mpPublicKey.preview || '',
          MP_WEBHOOK_SECRET: mpWebhookSecret.preview || '',
        },
        sources: {
          MP_ACCESS_TOKEN: mpAccessToken.source || '',
          MP_PUBLIC_KEY: mpPublicKey.source || '',
          MP_WEBHOOK_SECRET: mpWebhookSecret.source || '',
        },
      },
      fal_ai: {
        name: 'Fal.AI',
        description: 'Geração de imagens e vídeos com IA (Flux, Kling, Runway)',
        icon: 'Wand2',
        docs: 'https://fal.ai/docs',
        secrets: {
          FAL_API_KEY: falApiKey.exists,
        },
        previews: {
          FAL_API_KEY: falApiKey.preview || '',
        },
        sources: {
          FAL_API_KEY: falApiKey.source || '',
        },
      },
      gemini: {
        name: 'Google Gemini',
        description: 'Geração de imagens nativa via Google AI Studio',
        icon: 'Sparkles',
        docs: 'https://ai.google.dev/',
        secrets: {
          GEMINI_API_KEY: geminiApiKey.exists,
        },
        previews: {
          GEMINI_API_KEY: geminiApiKey.preview || '',
        },
        sources: {
          GEMINI_API_KEY: geminiApiKey.source || '',
        },
      },
      meta_platform: {
        name: 'Meta (Facebook/Instagram)',
        description: 'OAuth, Pixel, Catálogo, Ads e WhatsApp Cloud API',
        icon: 'Globe',
        docs: 'https://developers.facebook.com/',
        secrets: {
          META_APP_ID: metaAppId.exists,
          META_APP_SECRET: metaAppSecret.exists,
        },
        previews: {
          META_APP_ID: metaAppId.preview || '',
          META_APP_SECRET: metaAppSecret.preview || '',
        },
        sources: {
          META_APP_ID: metaAppId.source || '',
          META_APP_SECRET: metaAppSecret.source || '',
        },
      },
      google_platform: {
        name: 'Google (Ads, YouTube, Analytics)',
        description: 'OAuth para Google Ads, YouTube, Analytics, Merchant, Search Console',
        icon: 'Globe',
        docs: 'https://console.cloud.google.com/',
        secrets: {
          GOOGLE_CLIENT_ID: googleClientId.exists,
          GOOGLE_CLIENT_SECRET: googleClientSecret.exists,
        },
        previews: {
          GOOGLE_CLIENT_ID: googleClientId.preview || '',
          GOOGLE_CLIENT_SECRET: googleClientSecret.preview || '',
        },
        sources: {
          GOOGLE_CLIENT_ID: googleClientId.source || '',
          GOOGLE_CLIENT_SECRET: googleClientSecret.source || '',
        },
      },
      tiktok_platform: {
        name: 'TikTok (Ads + Shop)',
        description: 'OAuth para TikTok Ads (Pixel/CAPI) e TikTok Shop (Catálogo/Pedidos)',
        icon: 'Music',
        docs: 'https://partner.tiktokshop.com/',
        secrets: {
          TIKTOK_APP_ID: tiktokAppId.exists,
          TIKTOK_APP_SECRET: tiktokAppSecret.exists,
          TIKTOK_SHOP_APP_KEY: tiktokShopAppKey.exists,
          TIKTOK_SHOP_APP_SECRET: tiktokShopAppSecret.exists,
        },
        previews: {
          TIKTOK_APP_ID: tiktokAppId.preview || '',
          TIKTOK_APP_SECRET: tiktokAppSecret.preview || '',
          TIKTOK_SHOP_APP_KEY: tiktokShopAppKey.preview || '',
          TIKTOK_SHOP_APP_SECRET: tiktokShopAppSecret.preview || '',
        },
        sources: {
          TIKTOK_APP_ID: tiktokAppId.source || '',
          TIKTOK_APP_SECRET: tiktokAppSecret.source || '',
          TIKTOK_SHOP_APP_KEY: tiktokShopAppKey.source || '',
          TIKTOK_SHOP_APP_SECRET: tiktokShopAppSecret.source || '',
        },
      },
      shopee_platform: {
        name: 'Shopee',
        description: 'OAuth para marketplace Shopee (Partner ID + Partner Key)',
        icon: 'Store',
        docs: 'https://open.shopee.com/',
        secrets: {
          SHOPEE_PARTNER_ID: shopeePartnerId.exists,
          SHOPEE_PARTNER_KEY: shopeePartnerKey.exists,
        },
        previews: {
          SHOPEE_PARTNER_ID: shopeePartnerId.preview || '',
          SHOPEE_PARTNER_KEY: shopeePartnerKey.preview || '',
        },
        sources: {
          SHOPEE_PARTNER_ID: shopeePartnerId.source || '',
          SHOPEE_PARTNER_KEY: shopeePartnerKey.source || '',
        },
      },
    };

    // Calculate overall status for each integration
    const integrations = Object.entries(secrets).map(([key, config]) => {
      const allConfigured = Object.values(config.secrets).every(Boolean);
      const someConfigured = Object.values(config.secrets).some(Boolean);
      
      return {
        key,
        ...config,
        status: config.isSystem ? 'system' : allConfigured ? 'configured' : someConfigured ? 'partial' : 'pending',
        configuredCount: Object.values(config.secrets).filter(Boolean).length,
        totalCount: Object.values(config.secrets).length,
      };
    });

    console.log('[platform-secrets-check] Returning status for', integrations.length, 'integrations');

    return new Response(
      JSON.stringify({ success: true, integrations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[platform-secrets-check] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
