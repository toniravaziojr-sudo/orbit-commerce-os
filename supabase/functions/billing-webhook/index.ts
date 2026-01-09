import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Send email via Resend REST API (no SDK dependency)
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'https://app.comandocentral.com.br';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Support both new format (type/data.id) and legacy format (topic/resource)
    let type = body.type;
    let dataId = body.data?.id;
    
    // Handle legacy MP webhook format (topic/resource)
    if (!type && body.topic) {
      type = body.topic; // "payment", "merchant_order", etc.
      // Extract ID from resource URL or use resource directly
      const resource = body.resource;
      if (resource) {
        // resource can be "140664541287" or "https://api.mercadolibre.com/merchant_orders/37151208468"
        const match = resource.match(/\/(\d+)$/) || resource.match(/^(\d+)$/);
        dataId = match ? match[1] : resource;
      }
      console.log('Converted legacy format:', { type, dataId, originalResource: resource });
    }

    const { action } = body;
    const eventId = body.id?.toString() || `${type}-${dataId}-${Date.now()}`;

    // Idempotency check
    const { data: existingEvent } = await supabase
      .from('billing_events')
      .select('id')
      .eq('provider', 'mercadopago')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log('Event already processed:', eventId);
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tenantId: string | null = null;
    let planKey: string | null = null;
    let cycle: string | null = null;
    let eventType = type || action || 'unknown';
    let checkoutSessionId: string | null = null;
    
    // Create data object for compatibility
    const data = { id: dataId };

    // Handle payment events
    if (type === 'payment' && data?.id) {
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });

      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        console.log('Payment details:', JSON.stringify(payment, null, 2));

        // Check if this is from billing_checkout_sessions (new flow)
        if (payment.external_reference?.startsWith('bcs_')) {
          const mpExternalRef = payment.external_reference;
          
          // Find the checkout session
          const { data: session } = await supabase
            .from('billing_checkout_sessions')
            .select('*')
            .eq('mp_external_reference', mpExternalRef)
            .maybeSingle();

          if (session && payment.status === 'approved') {
            checkoutSessionId = session.id;
            planKey = session.plan_key;
            cycle = session.billing_cycle;

            // IDEMPOTENCY: Only process if session is still pending_payment
            // Prevents duplicate emails if MP sends multiple events for same payment
            if (session.status !== 'pending_payment') {
              console.log('Session already processed:', session.id, 'status:', session.status);
              await supabase.from('billing_events').insert({
                tenant_id: null,
                provider: 'mercadopago',
                event_type: `payment.${payment.status}.duplicate`,
                event_id: eventId,
                payload: { ...payment, checkout_session_id: session.id, skipped: true },
                processed_at: new Date().toISOString(),
              });
              return new Response(
                JSON.stringify({ success: true, message: 'Session already processed' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            // Update session to paid
            await supabase
              .from('billing_checkout_sessions')
              .update({
                status: 'paid',
                mp_payment_id: data.id.toString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', session.id)
              .eq('status', 'pending_payment'); // Extra safety: only update if still pending

            // Generate token for complete-signup
            const { data: tokenData, error: tokenError } = await supabase.rpc(
              'generate_billing_checkout_token',
              { p_session_id: session.id }
            );

            if (tokenError) {
              console.error('Error generating token:', tokenError);
            } else {
              const token = tokenData;
              const completeUrl = `${appUrl}/complete-signup?token=${token}`;

              // Send email via REST (no SDK dependency)
              if (resendApiKey) {
                const emailHtml = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #1a1a1a;">Pagamento confirmado! 🎉</h1>
                    <p style="color: #4a4a4a; font-size: 16px;">
                      Olá <strong>${session.owner_name}</strong>,
                    </p>
                    <p style="color: #4a4a4a; font-size: 16px;">
                      Seu pagamento foi aprovado com sucesso. Agora é só criar sua conta para começar a usar o Comando Central.
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
                  'Pagamento confirmado — crie sua conta',
                  emailHtml
                );
                
                if (emailResult.success) {
                  console.log('Email sent to:', session.email);
                } else {
                  console.error('Email send failed:', emailResult.error);
                }
              } else {
                console.warn('RESEND_API_KEY not configured, skipping email');
              }
            }

            // Record event
            await supabase.from('billing_events').insert({
              tenant_id: null,
              provider: 'mercadopago',
              event_type: `payment.${payment.status}`,
              event_id: eventId,
              payload: { ...payment, checkout_session_id: session.id },
              processed_at: new Date().toISOString(),
            });
          }
        } else {
          // Legacy flow: tenant already exists
          if (payment.external_reference) {
            const parts = payment.external_reference.split('|');
            tenantId = parts[0] || null;
            planKey = parts[1] || null;
            cycle = parts[2] || null;
          } else if (payment.metadata) {
            tenantId = payment.metadata.tenant_id;
            planKey = payment.metadata.plan_key;
            cycle = payment.metadata.cycle;
          }

          if (tenantId && payment.status === 'approved') {
            const now = new Date();
            const periodEnd = new Date();
            if (cycle === 'annual') {
              periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            await supabase
              .from('tenant_subscriptions')
              .upsert({
                tenant_id: tenantId,
                plan_key: planKey || 'start',
                billing_cycle: cycle || 'monthly',
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                mp_customer_id: payment.payer?.id?.toString(),
                mp_payment_method: {
                  type: payment.payment_type_id,
                  last_four: payment.card?.last_four_digits,
                  brand: payment.payment_method_id,
                },
                updated_at: now.toISOString(),
              }, { onConflict: 'tenant_id' });

            console.log('Subscription activated for tenant:', tenantId);
          } else if (tenantId && ['rejected', 'cancelled', 'refunded'].includes(payment.status)) {
            await supabase
              .from('tenant_subscriptions')
              .update({
                status: payment.status === 'refunded' ? 'canceled' : 'inactive',
                updated_at: new Date().toISOString(),
              })
              .eq('tenant_id', tenantId);
          }

          await supabase.from('billing_events').insert({
            tenant_id: tenantId,
            provider: 'mercadopago',
            event_type: `payment.${payment.status}`,
            event_id: eventId,
            payload: payment,
            processed_at: new Date().toISOString(),
          });
        }
      }
    }

    // Handle subscription/preapproval events
    if (type === 'subscription_preapproval' && data?.id) {
      const preapprovalResponse = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });

      if (preapprovalResponse.ok) {
        const preapproval = await preapprovalResponse.json();
        console.log('Preapproval details:', JSON.stringify(preapproval, null, 2));

        // Check if new checkout flow
        if (preapproval.external_reference?.startsWith('bcs_')) {
          const { data: session } = await supabase
            .from('billing_checkout_sessions')
            .select('*')
            .eq('mp_external_reference', preapproval.external_reference)
            .maybeSingle();

          if (session && preapproval.status === 'authorized') {
            // IDEMPOTENCY: Only process if session is still pending_payment
            if (session.status !== 'pending_payment') {
              console.log('Preapproval session already processed:', session.id, 'status:', session.status);
              await supabase.from('billing_events').insert({
                tenant_id: null,
                provider: 'mercadopago',
                event_type: `preapproval.${preapproval.status}.duplicate`,
                event_id: eventId,
                payload: { ...preapproval, checkout_session_id: session.id, skipped: true },
                processed_at: new Date().toISOString(),
              });
              return new Response(
                JSON.stringify({ success: true, message: 'Session already processed' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            await supabase
              .from('billing_checkout_sessions')
              .update({
                status: 'paid',
                mp_preapproval_id: data.id.toString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', session.id)
              .eq('status', 'pending_payment'); // Extra safety

            // Generate token and send email (same as payment flow)
            const { data: tokenData } = await supabase.rpc(
              'generate_billing_checkout_token',
              { p_session_id: session.id }
            );

            if (tokenData && resendApiKey) {
              const completeUrl = `${appUrl}/complete-signup?token=${tokenData}`;
              const emailHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h1 style="color: #1a1a1a;">Assinatura ativada! 🎉</h1>
                  <p style="color: #4a4a4a; font-size: 16px;">
                    Olá <strong>${session.owner_name}</strong>,
                  </p>
                  <p style="color: #4a4a4a; font-size: 16px;">
                    Sua assinatura foi ativada com sucesso. Agora é só criar sua conta para começar.
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
                    Este link é válido por 24 horas.
                  </p>
                </div>
              `;
              
              const emailResult = await sendEmailViaResend(
                resendApiKey,
                session.email,
                'Assinatura confirmada — crie sua conta',
                emailHtml
              );
              
              if (!emailResult.success) {
                console.error('Email error:', emailResult.error);
              }
            }
          }
        } else {
          // Legacy preapproval
          if (preapproval.external_reference) {
            const parts = preapproval.external_reference.split('|');
            tenantId = parts[0] || null;
            planKey = parts[1] || null;
            cycle = parts[2] || null;
          }

          if (tenantId) {
            let status = 'pending';
            if (preapproval.status === 'authorized') status = 'active';
            else if (preapproval.status === 'paused') status = 'past_due';
            else if (preapproval.status === 'cancelled') status = 'canceled';

            await supabase
              .from('tenant_subscriptions')
              .upsert({
                tenant_id: tenantId,
                plan_key: planKey || 'start',
                billing_cycle: cycle || 'monthly',
                status: status,
                mp_preapproval_id: data.id,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'tenant_id' });
          }
        }

        await supabase.from('billing_events').insert({
          tenant_id: tenantId,
          provider: 'mercadopago',
          event_type: `preapproval.${preapproval.status}`,
          event_id: eventId,
          payload: preapproval,
          processed_at: new Date().toISOString(),
        });
      }
    }

    // Record generic event if not already recorded
    if (!tenantId && !checkoutSessionId) {
      await supabase.from('billing_events').insert({
        tenant_id: null,
        provider: 'mercadopago',
        event_type: eventType,
        event_id: eventId,
        payload: body,
        processed_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
