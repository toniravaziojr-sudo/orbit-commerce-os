import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to configure Z-API webhooks automatically
async function configureZapiWebhook(baseUrl: string, headers: Record<string, string>, webhookUrl: string, traceId: string): Promise<boolean> {
  try {
    console.log(`[whatsapp-connect][${traceId}] Configuring Z-API webhook: ${webhookUrl}`);
    
    // Z-API webhook configuration endpoint
    const webhookConfig = {
      webhookUrl: webhookUrl,
      msgReceivedUrl: webhookUrl,
      onMessageReceived: true,
      onMessageSent: false,
      onMessageStatusChange: true,
    };
    
    const response = await fetch(`${baseUrl}/update-webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookConfig),
    });
    
    const responseText = await response.text();
    console.log(`[whatsapp-connect][${traceId}] Webhook config response (${response.status}): ${responseText.substring(0, 200)}`);
    
    if (!response.ok) {
      console.warn(`[whatsapp-connect][${traceId}] Failed to configure webhook, but continuing...`);
      return false;
    }
    
    console.log(`[whatsapp-connect][${traceId}] Webhook configured successfully`);
    return true;
  } catch (error: any) {
    console.error(`[whatsapp-connect][${traceId}] Webhook configuration error:`, error.message);
    // Don't fail the whole connection for webhook config error
    return false;
  }
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[whatsapp-connect][${traceId}] Request started`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      console.error(`[whatsapp-connect][${traceId}] Missing environment variables`);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do servidor inválida', trace_id: traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access whatsapp_configs (contains secrets)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Authorization header to validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log(`[whatsapp-connect][${traceId}] Missing authorization header`);
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado', trace_id: traceId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[whatsapp-connect][${traceId}] Invalid request body:`, e);
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição inválido', trace_id: traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenant_id } = body;

    if (!tenant_id) {
      console.log(`[whatsapp-connect][${traceId}] Missing tenant_id`);
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório', trace_id: traceId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-connect][${traceId}] tenant_id=${tenant_id}`);

    // Validate user has access to this tenant
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error(`[whatsapp-connect][${traceId}] Auth error:`, userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado', trace_id: traceId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-connect][${traceId}] User authenticated: ${userData.user.id}`);

    // Verify user belongs to this tenant
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (roleError) {
      console.error(`[whatsapp-connect][${traceId}] Role check error:`, roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar permissões', trace_id: traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.log(`[whatsapp-connect][${traceId}] User has no access to tenant`);
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso negado ao tenant', trace_id: traceId }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-connect][${traceId}] User role: ${roleData.role}`);

    // Get WhatsApp config for tenant using service role (can read secrets)
    const { data: config, error: configError } = await supabase
      .from('whatsapp_configs')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (configError) {
      console.error(`[whatsapp-connect][${traceId}] Config fetch error:`, configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar configuração', trace_id: traceId }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config) {
      console.log(`[whatsapp-connect][${traceId}] No config found for tenant`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não está disponível para esta loja. Entre em contato com o suporte.',
          code: 'NO_CONFIG',
          trace_id: traceId
        }),
        { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.instance_id || !config.instance_token) {
      console.log(`[whatsapp-connect][${traceId}] Config exists but credentials missing`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não está configurado. Entre em contato com o suporte.',
          code: 'NO_CREDENTIALS',
          trace_id: traceId
        }),
        { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if client_token is configured (required by Z-API)
    if (!config.client_token) {
      console.log(`[whatsapp-connect][${traceId}] Config exists but client_token missing`);
      await supabase
        .from('whatsapp_configs')
        .update({ 
          last_error: 'Client Token Z-API não configurado. Contate o operador.',
        })
        .eq('id', config.id);
        
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Client Token Z-API não configurado. Contate o suporte.',
          code: 'NO_CLIENT_TOKEN',
          trace_id: traceId
        }),
        { status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-connect][${traceId}] Config found, instance_id starts with: ${config.instance_id.substring(0, 8)}...`);

    // Z-API endpoints
    const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
    
    // Z-API requires Client-Token header for authentication
    const zapiHeaders = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Client-Token': config.client_token
    };

    // Webhook URL for this tenant
    const webhookUrl = `${supabaseUrl}/functions/v1/support-webhook?channel=whatsapp&tenant=${tenant_id}`;
    
    // First check if already connected
    console.log(`[whatsapp-connect][${traceId}] Checking connection status...`);
    
    try {
      const statusRes = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: zapiHeaders
      });

      const statusText = await statusRes.text();
      console.log(`[whatsapp-connect][${traceId}] Status response (${statusRes.status}): ${statusText.substring(0, 200)}`);

      if (statusRes.ok) {
        let statusData;
        try {
          statusData = JSON.parse(statusText);
        } catch (e) {
          console.error(`[whatsapp-connect][${traceId}] Failed to parse status response`);
          statusData = {};
        }
        
        if (statusData.connected) {
          // Already connected - configure webhook automatically
          await configureZapiWebhook(baseUrl, zapiHeaders, webhookUrl, traceId);
          
          await supabase
            .from('whatsapp_configs')
            .update({
              connection_status: 'connected',
              phone_number: statusData.phoneNumber || statusData.phone || statusData.smartphoneConnected?.phoneNumber,
              last_connected_at: new Date().toISOString(),
              qr_code: null,
              last_error: null,
              webhook_url: webhookUrl,
            })
            .eq('id', config.id);

          console.log(`[whatsapp-connect][${traceId}] Already connected, webhook configured automatically`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              status: 'connected',
              phone_number: statusData.phoneNumber || statusData.phone,
              trace_id: traceId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (statusRes.status === 401 || statusRes.status === 403) {
        console.error(`[whatsapp-connect][${traceId}] Z-API auth failed`);
        await supabase
          .from('whatsapp_configs')
          .update({ 
            last_error: `Credenciais Z-API inválidas (${statusRes.status})`,
            connection_status: 'disconnected'
          })
          .eq('id', config.id);
          
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Credenciais Z-API inválidas. Contate o suporte.',
            code: 'INVALID_CREDENTIALS',
            provider_status: statusRes.status,
            trace_id: traceId
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (statusError: any) {
      console.error(`[whatsapp-connect][${traceId}] Status check failed:`, statusError.message);
      // Continue to try getting QR code
    }

    // Not connected, get QR code
    console.log(`[whatsapp-connect][${traceId}] Getting QR code...`);
    
    try {
      const qrRes = await fetch(`${baseUrl}/qr-code/image`, {
        method: 'GET',
        headers: zapiHeaders
      });

      const qrText = await qrRes.text();
      console.log(`[whatsapp-connect][${traceId}] QR response (${qrRes.status}): ${qrText.substring(0, 200)}`);

      if (!qrRes.ok) {
        if (qrRes.status === 401 || qrRes.status === 403) {
          await supabase
            .from('whatsapp_configs')
            .update({ 
              last_error: `Credenciais Z-API inválidas (QR ${qrRes.status})`,
              connection_status: 'disconnected'
            })
            .eq('id', config.id);
            
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Credenciais Z-API inválidas. Contate o suporte.',
              code: 'INVALID_CREDENTIALS',
              provider_status: qrRes.status,
              trace_id: traceId
            }),
            { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        await supabase
          .from('whatsapp_configs')
          .update({ 
            last_error: `Erro Z-API: ${qrRes.status} - ${qrText.substring(0, 100)}`,
          })
          .eq('id', config.id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Erro ao gerar QR Code. Tente novamente.',
            code: 'QR_ERROR',
            provider_status: qrRes.status,
            trace_id: traceId
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let qrData;
      try {
        qrData = JSON.parse(qrText);
      } catch (e) {
        console.error(`[whatsapp-connect][${traceId}] Failed to parse QR response`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Resposta inválida do provedor. Tente novamente.',
            code: 'INVALID_RESPONSE',
            trace_id: traceId
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!qrData.value) {
        console.log(`[whatsapp-connect][${traceId}] QR code not available in response`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'QR Code não disponível. Aguarde alguns segundos e tente novamente.',
            code: 'QR_NOT_READY',
            trace_id: traceId
          }),
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

      console.log(`[whatsapp-connect][${traceId}] QR code generated successfully`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          qr_code: qrData.value,
          status: 'qr_pending',
          trace_id: traceId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (qrError: any) {
      console.error(`[whatsapp-connect][${traceId}] QR fetch error:`, qrError.message);
      
      await supabase
        .from('whatsapp_configs')
        .update({ 
          last_error: `Erro de rede: ${qrError.message}`,
        })
        .eq('id', config.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Serviço do WhatsApp indisponível. Tente novamente.',
          code: 'SERVICE_UNAVAILABLE',
          trace_id: traceId
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error(`[whatsapp-connect] Unhandled error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro interno. Tente novamente.',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
