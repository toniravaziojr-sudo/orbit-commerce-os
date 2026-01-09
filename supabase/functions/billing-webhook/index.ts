import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // CORS preflight
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
    // const mpWebhookSecret = Deno.env.get('MP_WEBHOOK_SECRET'); // For signature validation

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    const { type, data, action } = body;

    // Generate unique event ID for idempotency
    const eventId = body.id?.toString() || `${type}-${data?.id}-${Date.now()}`;

    // Check if already processed (idempotency)
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

    // Handle payment events
    if (type === 'payment' && data?.id) {
      // Fetch payment details from MP
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });

      if (paymentResponse.ok) {
        const payment = await paymentResponse.json();
        console.log('Payment details:', JSON.stringify(payment, null, 2));

        // Extract tenant info from external_reference or metadata
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

        // Process based on payment status
        if (tenantId && payment.status === 'approved') {
          const now = new Date();
          const periodEnd = new Date();
          if (cycle === 'annual') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
          }

          const { error: updateError } = await supabase
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

          if (updateError) {
            console.error('Error updating subscription:', updateError);
          } else {
            console.log('Subscription activated for tenant:', tenantId);
          }
        } else if (tenantId && ['rejected', 'cancelled', 'refunded'].includes(payment.status)) {
          await supabase
            .from('tenant_subscriptions')
            .update({
              status: payment.status === 'refunded' ? 'canceled' : 'inactive',
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', tenantId);

          console.log('Subscription deactivated for tenant:', tenantId);
        }

        // Record event
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

    // Handle subscription/preapproval events
    if (type === 'subscription_preapproval' && data?.id) {
      const preapprovalResponse = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      });

      if (preapprovalResponse.ok) {
        const preapproval = await preapprovalResponse.json();
        console.log('Preapproval details:', JSON.stringify(preapproval, null, 2));

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

        // Record event
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
    if (!tenantId) {
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
