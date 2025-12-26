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
        JSON.stringify({ success: false, status: 'not_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.instance_id || !config.instance_token) {
      return new Response(
        JSON.stringify({ success: false, status: 'not_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Z-API status endpoint
    const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
    
    console.log(`[whatsapp-status] Checking status for tenant ${tenant_id}`);
    
    const statusRes = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!statusRes.ok) {
      console.error(`[whatsapp-status] Status check failed: ${statusRes.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: config.connection_status,
          error: `Z-API error: ${statusRes.status}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusData = await statusRes.json();
    console.log(`[whatsapp-status] Status response:`, statusData);

    const isConnected = statusData.connected === true;
    const phoneNumber = statusData.phoneNumber || statusData.phone || null;

    // Update local status if changed
    if (isConnected && config.connection_status !== 'connected') {
      await supabase
        .from('whatsapp_configs')
        .update({
          connection_status: 'connected',
          phone_number: phoneNumber,
          last_connected_at: new Date().toISOString(),
          qr_code: null,
        })
        .eq('id', config.id);
    } else if (!isConnected && config.connection_status === 'connected') {
      await supabase
        .from('whatsapp_configs')
        .update({
          connection_status: 'disconnected',
        })
        .eq('id', config.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: isConnected ? 'connected' : 'disconnected',
        phone_number: phoneNumber
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[whatsapp-status] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
