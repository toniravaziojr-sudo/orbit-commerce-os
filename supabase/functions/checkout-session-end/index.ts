// ============================================
// CHECKOUT SESSION END - Marks session as abandoned
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin, referer',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      try { body = JSON.parse(text); } catch { 
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { session_id } = body as { session_id?: string };
    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[checkout-session-end] Ending session: ${session_id}`);

    // Find session directly
    const { data: session } = await supabase
      .from('checkout_sessions')
      .select('id, status, order_id, tenant_id')
      .eq('id', session_id)
      .single();

    if (!session) {
      return new Response(JSON.stringify({ success: false, reason: 'not_found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (session.status !== 'active' || session.order_id) {
      return new Response(JSON.stringify({ success: true, action: 'skipped', status: session.status }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date().toISOString();
    await supabase.from('checkout_sessions').update({ status: 'abandoned', abandoned_at: now, last_seen_at: now }).eq('id', session_id);

    console.log(`[checkout-session-end] Session ${session_id} marked abandoned`);

    return new Response(JSON.stringify({ success: true, status: 'abandoned' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-end] Error:', error);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
