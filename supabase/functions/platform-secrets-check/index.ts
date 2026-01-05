import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Check which secrets are configured (without exposing values)
    const secrets: Record<string, IntegrationConfig> = {
      focus_nfe: {
        name: 'Focus NFe',
        description: 'Emissão de NF-e para todos os tenants',
        icon: 'FileText',
        docs: 'https://focusnfe.com.br/doc/',
        secrets: {
          FOCUS_NFE_TOKEN: !!Deno.env.get('FOCUS_NFE_TOKEN'),
        }
      },
      sendgrid: {
        name: 'SendGrid',
        description: 'Emails transacionais (autenticação, notificações)',
        icon: 'Mail',
        docs: 'https://docs.sendgrid.com/',
        secrets: {
          SENDGRID_API_KEY: !!Deno.env.get('SENDGRID_API_KEY'),
        }
      },
      cloudflare: {
        name: 'Cloudflare',
        description: 'Domínios custom e SSL automático',
        icon: 'Cloud',
        docs: 'https://developers.cloudflare.com/',
        secrets: {
          CLOUDFLARE_API_TOKEN: !!Deno.env.get('CLOUDFLARE_API_TOKEN'),
          CLOUDFLARE_ZONE_ID: !!Deno.env.get('CLOUDFLARE_ZONE_ID'),
        }
      },
      loggi: {
        name: 'Loggi',
        description: 'OAuth para entregas Loggi (tenant fornece company_id)',
        icon: 'Truck',
        docs: 'https://docs.loggi.com/',
        secrets: {
          LOGGI_CLIENT_ID: !!Deno.env.get('LOGGI_CLIENT_ID'),
          LOGGI_CLIENT_SECRET: !!Deno.env.get('LOGGI_CLIENT_SECRET'),
          LOGGI_EXTERNAL_SERVICE_ID: !!Deno.env.get('LOGGI_EXTERNAL_SERVICE_ID'),
        }
      },
      firecrawl: {
        name: 'Firecrawl',
        description: 'Web scraping para importação de lojas',
        icon: 'Flame',
        docs: 'https://docs.firecrawl.dev/',
        secrets: {
          FIRECRAWL_API_KEY: !!Deno.env.get('FIRECRAWL_API_KEY'),
        }
      },
      lovable_ai: {
        name: 'Lovable AI',
        description: 'Gateway de IA (assistente)',
        icon: 'Bot',
        docs: 'https://docs.lovable.dev/',
        isSystem: true,
        secrets: {
          LOVABLE_API_KEY: !!Deno.env.get('LOVABLE_API_KEY'),
        }
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
