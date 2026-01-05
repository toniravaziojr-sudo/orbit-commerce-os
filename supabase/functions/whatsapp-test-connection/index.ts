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

    // Usar service role para buscar configurações de WhatsApp
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Contar instâncias de WhatsApp configuradas
    const { data: whatsappConfigs, error: configError } = await supabaseAdmin
      .from('whatsapp_configs')
      .select('id, tenant_id, connection_status, phone_number, provider');

    if (configError) {
      console.error('[whatsapp-test-connection] Error fetching configs:', configError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao buscar configurações de WhatsApp' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats = {
      totalInstances: whatsappConfigs?.length || 0,
      connected: whatsappConfigs?.filter(c => c.connection_status === 'connected').length || 0,
      disconnected: whatsappConfigs?.filter(c => c.connection_status === 'disconnected').length || 0,
      pending: whatsappConfigs?.filter(c => !c.connection_status || c.connection_status === 'pending').length || 0,
    };

    console.log('[whatsapp-test-connection] Stats:', stats);

    // Z-API usa client token por instância, não global
    // Aqui verificamos a saúde geral das instâncias
    const hasActiveInstances = stats.connected > 0;

    return new Response(
      JSON.stringify({ 
        success: true, 
        provider: 'z-api',
        stats,
        message: hasActiveInstances 
          ? `${stats.connected} instância(s) conectada(s)` 
          : 'Nenhuma instância conectada',
        note: 'Z-API usa tokens por instância (tenant). Configure em WhatsApp > Configurações de cada loja.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[whatsapp-test-connection] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
