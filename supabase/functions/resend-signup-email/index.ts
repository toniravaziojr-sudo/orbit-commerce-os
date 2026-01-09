import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Send email via Resend REST API
async function sendEmailViaResend(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  from: string = 'Comando Central <noreply@comandocentral.com.br>'
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Resend API error:', response.status, errorData);
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('Resend fetch error:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'https://app.comandocentral.com.br';

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'session_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('billing_checkout_sessions')
      .select('*')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only allow resend for 'paid' sessions
    if (session.status !== 'paid') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: session.status === 'completed' 
            ? 'Esta sessão já foi concluída. Faça login na sua conta.'
            : 'Pagamento ainda não confirmado.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit: check last email sent (using updated_at as proxy)
    // Allow max 1 email per minute
    const lastUpdate = new Date(session.updated_at);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
    
    // If we just updated recently AND token exists, enforce rate limit
    if (diffSeconds < 60 && session.token_hash) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Aguarde ${Math.ceil(60 - diffSeconds)} segundos para reenviar.`,
          code: 'RATE_LIMITED'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate new token if needed
    let token: string | null = null;
    
    if (!session.token_hash || !session.token_expires_at) {
      // Token doesn't exist, generate new one
      const { data: tokenData, error: tokenError } = await supabase.rpc(
        'generate_billing_checkout_token',
        { p_session_id: session.id }
      );

      if (tokenError) {
        console.error('Error generating token:', tokenError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao gerar token de acesso' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      token = tokenData;
      console.log('Generated new token for session:', session.id);
    } else {
      // Token exists but may be expired, regenerate
      const tokenExpires = new Date(session.token_expires_at);
      if (tokenExpires < now) {
        // Token expired, generate new
        const { data: tokenData, error: tokenError } = await supabase.rpc(
          'generate_billing_checkout_token',
          { p_session_id: session.id }
        );

        if (tokenError) {
          console.error('Error regenerating token:', tokenError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao renovar token de acesso' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        token = tokenData;
        console.log('Regenerated expired token for session:', session.id);
      } else {
        // Token still valid, regenerate anyway to get the raw value
        // (we only store hash, so we need to generate new to send in email)
        const { data: tokenData, error: tokenError } = await supabase.rpc(
          'generate_billing_checkout_token',
          { p_session_id: session.id }
        );

        if (tokenError) {
          console.error('Error regenerating token for resend:', tokenError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao gerar novo link de acesso' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        token = tokenData;
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao gerar token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email
    const completeUrl = `${appUrl}/complete-signup?token=${token}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a1a1a;">Crie sua conta 🎉</h1>
        <p style="color: #4a4a4a; font-size: 16px;">
          Olá <strong>${session.owner_name}</strong>,
        </p>
        <p style="color: #4a4a4a; font-size: 16px;">
          Seu pagamento já foi confirmado! Clique no botão abaixo para criar sua conta e começar a usar o Comando Central.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${completeUrl}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold;
                    display: inline-block;">
            Criar minha conta
          </a>
        </div>
        <p style="color: #6a6a6a; font-size: 14px;">
          Este link é válido por 24 horas. Se você não solicitou isso, ignore este email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #9a9a9a; font-size: 12px; text-align: center;">
          Comando Central — Gestão completa para e-commerce
        </p>
      </div>
    `;

    const emailResult = await sendEmailViaResend(
      resendApiKey,
      session.email,
      'Crie sua conta — Comando Central',
      emailHtml
    );

    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Falha ao enviar email. Tente novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session updated_at for rate limiting
    await supabase
      .from('billing_checkout_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', session.id);

    console.log('Email resent to:', session.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email reenviado com sucesso!',
        email: session.email
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
