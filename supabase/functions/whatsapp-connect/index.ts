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
    
    // Use service role to access whatsapp_configs (contains secrets)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Authorization header to validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user has access to this tenant
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to this tenant
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[whatsapp-connect] User role check failed:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado ao tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-connect] User ${userData.user.id} authorized for tenant ${tenant_id}`);

    // Get WhatsApp config for tenant using service role (can read secrets)
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (configError) {
      console.error('[whatsapp-connect] Config fetch error:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar configuração' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não está disponível para esta loja. Entre em contato com o suporte.' 
        }),
        { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.instance_id || !config.instance_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não está configurado. Entre em contato com o suporte.' 
        }),
        { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Z-API endpoints
    const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
    
    // First check if already connected
    console.log(`[whatsapp-connect] Checking connection status for tenant ${tenant_id}...`);
    
    try {
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
              phone_number: statusData.phoneNumber || statusData.phone || statusData.smartphoneConnected?.phoneNumber,
              last_connected_at: new Date().toISOString(),
              qr_code: null,
              last_error: null,
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
      } else if (statusRes.status === 401) {
        console.error('[whatsapp-connect] Z-API auth failed - invalid credentials');
        await supabase
          .from('whatsapp_configs')
          .update({ last_error: 'Credenciais Z-API inválidas' })
          .eq('id', config.id);
          
        return new Response(
          JSON.stringify({ success: false, error: 'Credenciais Z-API inválidas. Contate o suporte.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (statusError) {
      console.error('[whatsapp-connect] Status check failed:', statusError);
      // Continue to try getting QR code
    }

    // Not connected, get QR code
    console.log(`[whatsapp-connect] Getting QR code for tenant ${tenant_id}...`);
    
    try {
      const qrRes = await fetch(`${baseUrl}/qr-code/image`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!qrRes.ok) {
        const errorText = await qrRes.text();
        console.error(`[whatsapp-connect] QR code error (${qrRes.status}):`, errorText);
        
        if (qrRes.status === 401) {
          await supabase
            .from('whatsapp_configs')
            .update({ last_error: 'Credenciais Z-API inválidas' })
            .eq('id', config.id);
            
          return new Response(
            JSON.stringify({ success: false, error: 'Credenciais Z-API inválidas. Contate o suporte.' }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao gerar QR Code. Tente novamente.` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const qrData = await qrRes.json();
      console.log(`[whatsapp-connect] QR code response keys:`, Object.keys(qrData));

      if (!qrData.value) {
        console.log(`[whatsapp-connect] QR code not available, full response:`, JSON.stringify(qrData));
        return new Response(
          JSON.stringify({ success: false, error: 'QR Code não disponível. Tente novamente em alguns segundos.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update config with QR code and status
      await supabase
        .from('whatsapp_configs')
        .update({
          connection_status: 'qr_pending',
          qr_code: qrData.value,
          last_error: null,
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
      
    } catch (qrError: any) {
      console.error('[whatsapp-connect] QR fetch error:', qrError);
      return new Response(
        JSON.stringify({ success: false, error: 'Serviço do WhatsApp indisponível. Tente novamente.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('[whatsapp-connect] Unhandled error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
