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

    console.log(`[whatsapp-connect] Getting config for tenant ${tenant_id}`);

    // Get WhatsApp config for tenant
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do WhatsApp não encontrada. Salve as credenciais primeiro.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.instance_id || !config.instance_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Instance ID e Token não configurados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Z-API endpoints
    const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
    
    // First check if already connected
    console.log(`[whatsapp-connect] Checking connection status...`);
    const statusRes = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (statusRes.ok) {
      const statusData = await statusRes.json();
      console.log(`[whatsapp-connect] Status response:`, statusData);
      
      if (statusData.connected) {
        // Already connected, update config
        await supabase
          .from('whatsapp_configs')
          .update({
            connection_status: 'connected',
            phone_number: statusData.phoneNumber || statusData.phone,
            last_connected_at: new Date().toISOString(),
            qr_code: null,
          })
          .eq('id', config.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'connected',
            phone_number: statusData.phoneNumber || statusData.phone
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Not connected, get QR code
    console.log(`[whatsapp-connect] Getting QR code...`);
    const qrRes = await fetch(`${baseUrl}/qr-code/image`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!qrRes.ok) {
      const errorText = await qrRes.text();
      console.error(`[whatsapp-connect] QR code error:`, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao gerar QR Code: ${qrRes.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qrData = await qrRes.json();
    console.log(`[whatsapp-connect] QR code response:`, qrData);

    if (!qrData.value) {
      return new Response(
        JSON.stringify({ success: false, error: 'QR Code não disponível. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update config with QR code and status
    await supabase
      .from('whatsapp_configs')
      .update({
        connection_status: 'qr_pending',
        qr_code: qrData.value, // Base64 or URL of QR code image
      })
      .eq('id', config.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        qr_code: qrData.value,
        status: 'qr_pending'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[whatsapp-connect] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
