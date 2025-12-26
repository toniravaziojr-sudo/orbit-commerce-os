import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get WhatsApp config for tenant
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do WhatsApp não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.instance_id || !config.instance_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Z-API disconnect/logout endpoint
    const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
    
    console.log(`[whatsapp-disconnect] Disconnecting for tenant ${tenant_id}`);
    
    const disconnectRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log(`[whatsapp-disconnect] Logout response: ${disconnectRes.status}`);

    // Update local status regardless of API response
    await supabase
      .from('whatsapp_configs')
      .update({
        connection_status: 'disconnected',
        qr_code: null,
      })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({ success: true, message: 'WhatsApp desconectado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[whatsapp-disconnect] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
