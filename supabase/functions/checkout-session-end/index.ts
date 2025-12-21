// ============================================
// CHECKOUT SESSION END - Marks session as abandoned
// Accepts text/plain to avoid CORS preflight (important for sendBeacon)
// Resolves session directly by ID (no tenant required from client)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log(`[checkout-session-end] Ending session: ${session_id}, store_host: ${store_host}`);

    // Find session directly by ID (no tenant needed - session_id is unique)
    const { data: session } = await supabase
      .from('checkout_sessions')
      .select('id, status, order_id, tenant_id')
      .eq('id', session_id)
      .single();

    if (!session) {
      console.log(`[checkout-session-end] Session ${session_id} not found`);
      return new Response(JSON.stringify({ success: false, reason: 'not_found' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Skip if already abandoned/converted or has order
    if (session.status !== 'active' || session.order_id) {
      console.log(`[checkout-session-end] Session ${session_id} skipped (status: ${session.status}, has_order: ${!!session.order_id})`);
      return new Response(JSON.stringify({ 
        success: true, 
        action: 'skipped', 
        status: session.status 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Mark as abandoned
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('checkout_sessions')
      .update({ 
        status: 'abandoned', 
        abandoned_at: now, 
        last_seen_at: now 
      })
      .eq('id', session_id);

    if (error) {
      console.error('[checkout-session-end] Update error:', error);
      throw error;
    }

    console.log(`[checkout-session-end] Session ${session_id} marked abandoned`);

    return new Response(JSON.stringify({ success: true, status: 'abandoned' }), { 
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
