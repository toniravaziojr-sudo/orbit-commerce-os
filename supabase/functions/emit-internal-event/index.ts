import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmitEventRequest {
  tenant_id: string;
  event_type: string;
  occurred_at?: string;
  subject: {
    type: string;
    id: string;
  };
  payload_normalized: Record<string, unknown>;
  idempotency_key: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: EmitEventRequest = await req.json();
    
    console.log('[emit-internal-event] Received request:', {
      tenant_id: body.tenant_id,
      event_type: body.event_type,
      idempotency_key: body.idempotency_key,
      subject: body.subject,
    });

    // Validate required fields
    if (!body.tenant_id || !body.event_type || !body.idempotency_key || !body.subject) {
      console.error('[emit-internal-event] Missing required fields');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: tenant_id, event_type, idempotency_key, subject' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if event already exists (idempotency)
    const { data: existingEvent, error: checkError } = await supabase
      .from('events_inbox')
      .select('id, status')
      .eq('tenant_id', body.tenant_id)
      .eq('idempotency_key', body.idempotency_key)
      .maybeSingle();

    if (checkError) {
      console.error('[emit-internal-event] Error checking existing event:', checkError);
      throw checkError;
    }

    if (existingEvent) {
      console.log('[emit-internal-event] Duplicate event detected, returning existing:', existingEvent.id);
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          event_id: existingEvent.id,
          status: existingEvent.status,
          message: 'Event already exists (idempotency)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build payload_raw for internal events
    const payloadRaw = {
      source: 'internal',
      event_type: body.event_type,
      subject: body.subject,
      occurred_at: body.occurred_at || new Date().toISOString(),
      ...body.payload_normalized,
    };

    // Insert new event
    const { data: newEvent, error: insertError } = await supabase
      .from('events_inbox')
      .insert({
        tenant_id: body.tenant_id,
        provider: 'internal',
        event_type: body.event_type,
        occurred_at: body.occurred_at || new Date().toISOString(),
        payload_raw: payloadRaw,
        payload_normalized: {
          event_type: body.event_type,
          subject: body.subject,
          ...body.payload_normalized,
        },
        idempotency_key: body.idempotency_key,
        status: 'new',
      })
      .select('id, status')
      .single();

    if (insertError) {
      console.error('[emit-internal-event] Error inserting event:', insertError);
      throw insertError;
    }

    console.log('[emit-internal-event] Event created successfully:', newEvent.id);

    return new Response(
      JSON.stringify({
        success: true,
        duplicate: false,
        event_id: newEvent.id,
        status: newEvent.status,
        message: 'Event created successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[emit-internal-event] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
