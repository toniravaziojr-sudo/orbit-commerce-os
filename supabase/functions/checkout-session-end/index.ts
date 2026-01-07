// ============================================
// CHECKOUT SESSION END - Marks session as abandoned when client leaves
// IMMEDIATELY marks as abandoned if contact was captured and no order exists
// Accepts text/plain to avoid CORS preflight (important for sendBeacon)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body - accept both JSON and text/plain (for sendBeacon)
    let body: Record<string, unknown> = {};
    const rawBody = await req.text();
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[checkout-session-end] Failed to parse body:', rawBody.substring(0, 100));
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { session_id, store_host } = body as { session_id?: string; store_host?: string };
    
    if (!session_id) {
      console.log('[checkout-session-end] No session_id provided');
      return new Response(JSON.stringify({ error: 'session_id required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[checkout-session-end] Processing exit for session: ${session_id}, store_host: ${store_host}`);

    // Find session directly by ID (session_id is unique)
    const { data: session, error: fetchError } = await supabase
      .from('checkout_sessions')
      .select('id, status, order_id, contact_captured_at, tenant_id, customer_email, customer_phone')
      .eq('id', session_id)
      .single();

    if (fetchError || !session) {
      console.log(`[checkout-session-end] Session ${session_id} not found`);
      return new Response(JSON.stringify({ success: false, reason: 'not_found' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const now = new Date().toISOString();

    // Skip if already completed or has order
    if (session.status === 'completed' || session.order_id) {
      console.log(`[checkout-session-end] Session ${session_id} already completed, skipping`);
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'skipped', 
        reason: 'already_completed',
        status: session.status 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // REGRA PRINCIPAL: Fechar = Abandonar (se houver contato capturado)
    // Se contact_captured_at IS NOT NULL e order_id IS NULL e status != 'completed':
    // => marcar como abandoned imediatamente
    const hasContact = session.contact_captured_at !== null;
    const noOrder = session.order_id === null;
    const notCompleted = session.status !== 'completed';

    if (hasContact && noOrder && notCompleted) {
      // MARCA COMO ABANDONADO IMEDIATAMENTE
      const { error: updateError } = await supabase
        .from('checkout_sessions')
        .update({ 
          status: 'abandoned',
          abandoned_at: now,
          last_seen_at: now,
          metadata: {
            ended_at: now,
            ended_reason: 'page_exit',
            abandoned_by: 'checkout-session-end'
          }
        })
        .eq('id', session_id);

      if (updateError) {
        console.error('[checkout-session-end] Update error:', updateError);
        throw updateError;
      }

      console.log(`[checkout-session-end] Session ${session_id} MARKED AS ABANDONED (contact captured, no order)`);

      return new Response(JSON.stringify({ 
        success: true, 
        action: 'abandoned',
        status: 'abandoned',
        message: 'Session marked as abandoned immediately (contact captured, page exit)'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Se não tem contato capturado, apenas registra o exit (não marca como abandonado)
    // Essas sessões sem contato não contam como abandono
    const { error: updateError } = await supabase
      .from('checkout_sessions')
      .update({ 
        last_seen_at: now,
        metadata: {
          ended_at: now,
          ended_reason: 'page_exit_no_contact'
        }
      })
      .eq('id', session_id);

    if (updateError) {
      console.error('[checkout-session-end] Update error:', updateError);
      throw updateError;
    }

    console.log(`[checkout-session-end] Session ${session_id} exit recorded (no contact - not marked as abandoned)`);

    return new Response(JSON.stringify({ 
      success: true, 
      action: 'exit_recorded',
      status: session.status,
      message: 'Exit recorded but not abandoned (no contact captured)'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-end] Error:', error);
    return new Response(JSON.stringify({ error: msg }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
