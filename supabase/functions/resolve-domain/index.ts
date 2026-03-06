// ============================================
// RESOLVE DOMAIN - Edge Function
// v2.0.0: Refactored to use shared resolveTenant utility
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=60',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let hostname: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      hostname = url.searchParams.get('hostname');
    } else {
      const body = await req.json();
      hostname = body.hostname;
    }

    if (!hostname) {
      return new Response(
        JSON.stringify({ found: false, error: 'Missing hostname parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const result = await resolveTenantFromHostname(supabase, hostname);

    return new Response(
      JSON.stringify(result),
      {
        status: result.found ? 200 : (result.error === 'Database error' ? 500 : 200),
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[resolve-domain] Unexpected error:', error);
    return new Response(
      JSON.stringify({ found: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
