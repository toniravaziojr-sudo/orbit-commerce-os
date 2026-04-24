import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: { tenant_id?: string } = {};
  try { body = await req.json(); } catch { /* no body */ }

  console.log('[email-marketing-list-sync] Starting sync...', body.tenant_id ? `tenant: ${body.tenant_id}` : 'all tenants');

  try {
    // Fetch all lists that have a tag_id (tag-based lists)
    let query = supabase
      .from('email_marketing_lists')
      .select('id, name, tenant_id, tag_id')
      .not('tag_id', 'is', null);

    if (body.tenant_id) {
      query = query.eq('tenant_id', body.tenant_id);
    }

    const { data: lists, error: listsError } = await query;

    if (listsError) {
      console.error('[email-marketing-list-sync] Error fetching lists:', listsError);
      return new Response(JSON.stringify({ error: listsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!lists || lists.length === 0) {
      console.log('[email-marketing-list-sync] No tag-based lists found');
      return new Response(JSON.stringify({ synced_lists: 0, total_synced: 0, results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[email-marketing-list-sync] Found ${lists.length} tag-based lists to sync`);

    const results: Array<{ list_id: string; list_name: string; tenant_id: string; synced: number; success: boolean; error?: string }> = [];
    let totalSynced = 0;

    for (const list of lists) {
      try {
        const { data, error } = await supabase.rpc('sync_list_subscribers_from_tag', {
          p_list_id: list.id,
        });

        if (error) {
          console.error(`[email-marketing-list-sync] Error syncing list ${list.name} (${list.id}):`, error);
          results.push({
            list_id: list.id,
            list_name: list.name,
            tenant_id: list.tenant_id,
            synced: 0,
            success: false,
            error: error.message,
          });
          continue;
        }

        const syncedCount = data?.synced ?? 0;
        totalSynced += syncedCount;

        console.log(`[email-marketing-list-sync] List "${list.name}" (${list.id}): ${syncedCount} subscribers synced`);
        results.push({
          list_id: list.id,
          list_name: list.name,
          tenant_id: list.tenant_id,
          synced: syncedCount,
          success: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[email-marketing-list-sync] Exception syncing list ${list.id}:`, msg);
        results.push({
          list_id: list.id,
          list_name: list.name,
          tenant_id: list.tenant_id,
          synced: 0,
          success: false,
          error: msg,
        });
      }
    }

    const response = {
      synced_lists: lists.length,
      total_synced: totalSynced,
      results,
    };

    console.log(`[email-marketing-list-sync] Completed: ${totalSynced} total subscribers synced across ${lists.length} lists`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[email-marketing-list-sync] Fatal error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
