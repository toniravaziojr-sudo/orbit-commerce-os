import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageParams {
  tenant_id: string;
  phone: string;
  message: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, phone, message }: SendMessageParams = await req.json();

    if (!tenant_id || !phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id, phone e message são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[whatsapp-send] Sending to ${phone} for tenant ${tenant_id}`);

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
        JSON.stringify({ success: false, error: 'Credenciais do WhatsApp não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (config.connection_status !== 'connected') {
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp não está conectado. Conecte primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number (remove non-digits, ensure country code)
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Add Brazil country code if not present
    if (cleanPhone.length === 11 || cleanPhone.length === 10) {
      cleanPhone = '55' + cleanPhone;
    }
    
    if (cleanPhone.length < 12) {
      return new Response(
        JSON.stringify({ success: false, error: `Número de telefone inválido: ${phone}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Z-API send text message endpoint
    const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
    
    console.log(`[whatsapp-send] Sending to ${cleanPhone}...`);
    
    const sendRes = await fetch(`${baseUrl}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });

    const sendData = await sendRes.json();
    console.log(`[whatsapp-send] Send response:`, sendData);

    if (!sendRes.ok || sendData.error) {
      const errorMsg = sendData.error || sendData.message || `Erro ao enviar: ${sendRes.status}`;
      
      // Log the failed attempt
      await supabase.from('whatsapp_messages').insert({
        tenant_id,
        recipient_phone: cleanPhone,
        message_content: message.substring(0, 500),
        status: 'failed',
        error_message: errorMsg,
        provider_response: sendData,
      });

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful send
    await supabase.from('whatsapp_messages').insert({
      tenant_id,
      recipient_phone: cleanPhone,
      message_content: message.substring(0, 500),
      status: 'sent',
      provider_message_id: sendData.messageId || sendData.zapiMessageId,
      provider_response: sendData,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso',
        message_id: sendData.messageId || sendData.zapiMessageId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[whatsapp-send] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
