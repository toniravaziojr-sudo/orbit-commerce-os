// ============================================
// AFFILIATE TRACK CLICK - Register affiliate link clicks
// Public endpoint - no auth required
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TrackClickRequest {
  affiliate_code: string;
  tenant_id: string;
  landing_url?: string;
  referrer?: string;
  user_agent?: string;
}

/**
 * Simple hash for IP (privacy-friendly)
 */
function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: TrackClickRequest = await req.json();
    
    if (!payload.affiliate_code || !payload.tenant_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: affiliate_code, tenant_id',
        code: 'MISSING_FIELDS'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find affiliate link by code
    const { data: link, error: linkError } = await supabase
      .from('affiliate_links')
      .select('id, affiliate_id')
      .eq('tenant_id', payload.tenant_id)
      .eq('code', payload.affiliate_code)
      .maybeSingle();

    if (linkError) {
      console.error('[affiliate-track-click] Error finding link:', linkError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Database error',
        code: 'DB_ERROR'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!link) {
      // Link not found - might be direct affiliate ID
      // Try to find affiliate directly
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('id')
        .eq('tenant_id', payload.tenant_id)
        .eq('id', payload.affiliate_code)
        .maybeSingle();

      if (!affiliate) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Affiliate not found',
          code: 'AFFILIATE_NOT_FOUND'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Record click without link_id
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                       req.headers.get('cf-connecting-ip') || 
                       'unknown';
      
      const { error: insertError } = await supabase
        .from('affiliate_clicks')
        .insert({
          tenant_id: payload.tenant_id,
          affiliate_id: affiliate.id,
          link_id: null,
          landing_url: payload.landing_url || null,
          referrer: payload.referrer || null,
          user_agent: payload.user_agent || null,
          ip_hash: hashIP(clientIP),
        });

      if (insertError) {
        console.error('[affiliate-track-click] Error inserting click:', insertError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to record click',
          code: 'INSERT_ERROR'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        affiliate_id: affiliate.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Record click with link
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';

    const { error: insertError } = await supabase
      .from('affiliate_clicks')
      .insert({
        tenant_id: payload.tenant_id,
        affiliate_id: link.affiliate_id,
        link_id: link.id,
        landing_url: payload.landing_url || null,
        referrer: payload.referrer || null,
        user_agent: payload.user_agent || null,
        ip_hash: hashIP(clientIP),
      });

    if (insertError) {
      console.error('[affiliate-track-click] Error inserting click:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to record click',
        code: 'INSERT_ERROR'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[affiliate-track-click] Click recorded for affiliate:', link.affiliate_id);

    return new Response(JSON.stringify({
      success: true,
      affiliate_id: link.affiliate_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[affiliate-track-click] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
      code: 'UNKNOWN_ERROR'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
