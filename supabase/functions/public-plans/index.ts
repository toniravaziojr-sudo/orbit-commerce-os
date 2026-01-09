import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface BillingPlan {
  plan_key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_annual_cents: number;
  included_orders_per_month: number | null;
  support_level: string | null;
  feature_bullets: string[];
  is_recommended: boolean;
  sort_order: number;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow GET
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch active public plans
    const { data: plans, error } = await supabase
      .from('billing_plans')
      .select('plan_key, name, description, price_monthly_cents, price_annual_cents, included_orders_per_month, support_level, feature_bullets, is_recommended, sort_order')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch plans', code: 'DB_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform to expected format
    const formattedPlans = (plans || []).map((plan: BillingPlan) => ({
      plan_key: plan.plan_key,
      name: plan.name,
      description: plan.description,
      price_monthly_cents: plan.price_monthly_cents,
      price_annual_cents: plan.price_annual_cents,
      limits: {
        orders_per_month: plan.included_orders_per_month,
      },
      flags: {
        recommended: plan.is_recommended,
      },
      feature_bullets: plan.feature_bullets || [],
      support_level: plan.support_level,
    }));

    return new Response(
      JSON.stringify({ success: true, plans: formattedPlans }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
