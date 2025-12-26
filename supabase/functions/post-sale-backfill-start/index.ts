import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tenant_id, rate_limit_per_hour = 100 } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[post-sale-backfill-start] Starting for tenant ${tenant_id} by user ${user.id}`);

    // Check if user is admin/owner of tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: admin/owner role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing pending/processing jobs
    const { data: existingJob } = await supabase
      .from('post_sale_backfill_jobs')
      .select('id, status')
      .eq('tenant_id', tenant_id)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existingJob) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Já existe um job em andamento',
          existing_job_id: existingJob.id 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the earliest effective_from of post_sale rules
    const { data: earliestRule } = await supabase
      .from('notification_rules')
      .select('effective_from')
      .eq('tenant_id', tenant_id)
      .eq('rule_type', 'post_sale')
      .eq('is_enabled', true)
      .order('effective_from', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!earliestRule) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma regra de pós-venda ativa encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rulesEffectiveFrom = earliestRule.effective_from;

    // Get "old" customers: first_order_at before the earliest rule effective_from
    // AND not already processed by any previous backfill
    const { data: eligibleCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, first_order_at')
      .eq('tenant_id', tenant_id)
      .not('first_order_at', 'is', null)
      .lt('first_order_at', rulesEffectiveFrom)
      .order('first_order_at', { ascending: true });

    if (customersError) {
      console.error('[post-sale-backfill-start] Error fetching customers:', customersError);
      throw customersError;
    }

    if (!eligibleCustomers || eligibleCustomers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum cliente antigo elegível encontrado',
          total_customers: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which customers have already been processed (in ledger)
    const customerIds = eligibleCustomers.map(c => c.id);
    
    // Get post_sale rules to check ledger
    const { data: postSaleRules } = await supabase
      .from('notification_rules')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('rule_type', 'post_sale')
      .eq('is_enabled', true);

    const ruleIds = (postSaleRules || []).map(r => r.id);

    // Check ledger for customers already processed for any post_sale rule
    const { data: processedEntries } = await supabase
      .from('notification_dedup_ledger')
      .select('entity_id')
      .eq('tenant_id', tenant_id)
      .in('rule_id', ruleIds)
      .eq('entity_type', 'customer')
      .in('entity_id', customerIds);

    const processedCustomerIds = new Set((processedEntries || []).map(e => e.entity_id));
    const unprocessedCustomers = eligibleCustomers.filter(c => !processedCustomerIds.has(c.id));

    if (unprocessedCustomers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Todos os clientes antigos já foram processados',
          total_customers: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[post-sale-backfill-start] Found ${unprocessedCustomers.length} unprocessed customers`);

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('post_sale_backfill_jobs')
      .insert({
        tenant_id,
        created_by: user.id,
        total_customers: unprocessedCustomers.length,
        rate_limit_per_hour: rate_limit_per_hour,
        status: 'pending',
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('[post-sale-backfill-start] Error creating job:', jobError);
      throw jobError;
    }

    // Calculate scheduling: rate_limit_per_hour customers per hour
    // That's rate_limit_per_hour / 60 per minute, or 1 every (3600 / rate_limit_per_hour) seconds
    const intervalSeconds = Math.ceil(3600 / rate_limit_per_hour);
    const now = new Date();

    const items = unprocessedCustomers.map((customer, index) => {
      const scheduledFor = new Date(now.getTime() + (index * intervalSeconds * 1000));
      return {
        job_id: job.id,
        tenant_id,
        customer_id: customer.id,
        status: 'pending',
        scheduled_for: scheduledFor.toISOString(),
      };
    });

    // Insert items in batches
    const batchSize = 500;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('post_sale_backfill_items')
        .insert(batch);

      if (insertError) {
        console.error(`[post-sale-backfill-start] Error inserting batch ${i}:`, insertError);
        throw insertError;
      }
    }

    // Update job to processing
    await supabase
      .from('post_sale_backfill_jobs')
      .update({ status: 'processing', started_at: now.toISOString() })
      .eq('id', job.id);

    console.log(`[post-sale-backfill-start] Job ${job.id} created with ${items.length} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        job_id: job.id,
        total_customers: unprocessedCustomers.length,
        rate_limit_per_hour,
        estimated_duration_hours: Math.ceil(unprocessedCustomers.length / rate_limit_per_hour),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[post-sale-backfill-start] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
