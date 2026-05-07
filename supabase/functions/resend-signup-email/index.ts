import { createClient } from "npm:@supabase/supabase-js@2";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
import { recordPlatformCost } from "../_shared/credits/charge.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// SHA-256 truncado (16 chars) — usado em metadata para evitar PII (email completo).
async function hashRecipient(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// Send email via SendGrid REST API (provedor padrão da plataforma).
// Domínio comandocentral.com.br é verified no SendGrid (system_email_config),
// então o remetente visível atual `noreply@comandocentral.com.br` é preservado.
async function sendEmailViaSendGrid(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  fromEmail: string,
  fromName: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: fromName },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('SendGrid API error:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const messageId = response.headers.get('X-Message-Id') ?? undefined;
    return { success: true, messageId };
  } catch (error) {
    console.error('SendGrid fetch error:', error);
    return { success: false, error: String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'https://app.comandocentral.com.br';

    if (!sendgridApiKey) {
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

    // Remetente preservado: domínio comandocentral.com.br é verified no SendGrid.
    const fromEmail = 'noreply@comandocentral.com.br';
    const fromName = 'Comando Central';

    const emailResult = await sendEmailViaSendGrid(
      sendgridApiKey,
      session.email,
      'Crie sua conta — Comando Central',
      emailHtml,
      fromEmail,
      fromName,
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

    // ============================================================
    // F2.3 — Motor de Créditos: registrar custo absorvido pela plataforma
    // SOMENTE após sucesso confirmado do SendGrid.
    // service_key=email-system-send | provider=sendgrid | cost_owner=platform
    // Idempotência: provider_message_id quando disponível; fallback determinístico.
    // Metadata sanitizada: sem token, sem link completo, sem email completo, sem HTML.
    // ============================================================
    try {
      const recipientHash = await hashRecipient(session.email);
      const idemBase = emailResult.messageId
        ? `resend-signup-email:${emailResult.messageId}`
        : `resend-signup-email:${session.id}:${recipientHash}:${Math.floor(Date.now() / 60000)}`;

      const costResult = await recordPlatformCost({
        serviceKey: 'email-system-send',
        units: { count: 1 },
        costUsd: 0.00060,
        origin: 'resend-signup-email',
        originId: session.id,
        idempotencyKey: idemBase,
        metadata: {
          provider: 'sendgrid',
          category: 'email',
          email_type: 'signup_resend',
          provider_message_id: emailResult.messageId ?? null,
          recipient_hash: recipientHash,
          origin_function: 'resend-signup-email',
        },
      });

      if (!costResult.success) {
        console.warn('[resend-signup-email] recordPlatformCost falhou (não bloqueia envio):', costResult.error_message);
      }
    } catch (e) {
      // Telemetria NUNCA pode quebrar o envio.
      console.warn('[resend-signup-email] Erro ao registrar custo (ignorado):', e);
    }

    console.log('Email resent to session:', session.id);

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
