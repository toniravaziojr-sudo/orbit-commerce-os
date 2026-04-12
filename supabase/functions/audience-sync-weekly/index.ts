import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";

// ===== VERSION =====
const VERSION = "v1.1.0"; // Fix: use ad account from tenant_meta_integrations (anuncios) instead of first discovered_asset
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

// SHA-256 hash helper
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Normalize phone to E.164 format
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  let cleaned = phone.replace(/[^0-9+]/g, "");
  if (!cleaned.startsWith("+")) {
    // Assume BR if no country code
    if (cleaned.startsWith("55")) cleaned = "+" + cleaned;
    else cleaned = "+55" + cleaned;
  }
  return cleaned.length >= 12 ? cleaned : null;
}

// Split name into first/last
function splitName(fullName: string | null): { first: string | null; last: string | null } {
  if (!fullName || !fullName.trim()) return { first: null, last: null };
  const parts = fullName.trim().split(/\s+/);
  return {
    first: parts[0] || null,
    last: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

// Format date as DD/MM/YYYY
function formatDateBR(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[audience-sync-weekly][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth: accept service role (cron) or specific tenant_id for manual trigger
    const body = req.method === "POST" ? await req.json() : {};
    const specificTenantId = body.tenant_id || null;
    const dryRun = body.dry_run === true;

    // Get tenants to process
    let tenantIds: string[] = [];

    if (specificTenantId) {
      tenantIds = [specificTenantId];
      console.log(`[${traceId}] Manual trigger for tenant: ${specificTenantId}`);
    } else {
      // Get all tenants that have email marketing lists with members
      const { data: tenants } = await supabase
        .from("email_marketing_lists")
        .select("tenant_id")
        .limit(500);

      if (tenants) {
        tenantIds = [...new Set(tenants.map((t: any) => t.tenant_id))];
      }
      console.log(`[${traceId}] Cron mode: ${tenantIds.length} tenants to process`);
    }

    const results: any[] = [];

    for (const tenantId of tenantIds) {
      try {
        const tenantResult = await processTenant(supabase, tenantId, traceId, dryRun);
        results.push({ tenant_id: tenantId, ...tenantResult });
      } catch (err) {
        console.error(`[${traceId}] Tenant ${tenantId} failed:`, (err as Error).message);
        results.push({ tenant_id: tenantId, error: (err as Error).message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, version: VERSION, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${traceId}] Fatal error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno no sync de audiências" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processTenant(
  supabase: any,
  tenantId: string,
  traceId: string,
  dryRun: boolean
): Promise<{ meta: any; google: any }> {
  const tag = `[${traceId}][${tenantId.substring(0, 8)}]`;

  // Get all email lists for this tenant
  const { data: lists } = await supabase
    .from("email_marketing_lists")
    .select("id, name")
    .eq("tenant_id", tenantId);

  if (!lists || lists.length === 0) {
    console.log(`${tag} No email lists found`);
    return { meta: { skipped: "no_lists" }, google: { skipped: "no_lists" } };
  }

  // Try Meta sync
  let metaResult: any = { skipped: "not_connected" };
  const metaConn = await getMetaConnectionForTenant(supabase, tenantId, traceId);
  if (metaConn) {
    // Priority: use ad account from "anuncios" integration (user-selected), fallback to discovered_assets
    let adAccountId: string | null = null;

    const { data: anunciosInteg } = await supabase
      .from("tenant_meta_integrations")
      .select("selected_assets")
      .eq("tenant_id", tenantId)
      .eq("integration_id", "anuncios")
      .eq("status", "active")
      .maybeSingle();

    const integAdAccounts = anunciosInteg?.selected_assets?.ad_accounts;
    if (integAdAccounts && integAdAccounts.length > 0) {
      adAccountId = integAdAccounts[0].id;
      console.log(`${tag} Using ad account from anuncios integration: ${adAccountId}`);
    } else {
      // Fallback to discovered_assets
      const allAdAccounts = metaConn.metadata?.assets?.ad_accounts || [];
      if (allAdAccounts.length > 0) {
        adAccountId = allAdAccounts[0].id;
        console.log(`${tag} Using first discovered ad account (fallback): ${adAccountId}`);
      }
    }

    if (adAccountId) {
      metaResult = await syncMetaAudiences(supabase, tenantId, lists, metaConn, adAccountId, traceId, dryRun);
    } else {
      metaResult = { skipped: "no_ad_accounts" };
    }
  }

  // Try Google sync
  let googleResult: any = { skipped: "not_connected" };
  const { data: googleConn } = await supabase
    .from("google_connections")
    .select("id, access_token, assets")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (googleConn?.access_token) {
    const customerIds = googleConn.assets?.ads?.customer_ids || [];
    if (customerIds.length > 0) {
      googleResult = await syncGoogleAudiences(supabase, tenantId, lists, googleConn, customerIds[0], traceId, dryRun);
    } else {
      googleResult = { skipped: "no_customer_ids" };
    }
  }

  return { meta: metaResult, google: googleResult };
}

// ========================
// META SYNC
// ========================
async function syncMetaAudiences(
  supabase: any,
  tenantId: string,
  lists: Array<{ id: string; name: string }>,
  metaConn: any,
  adAccountId: string,
  traceId: string,
  dryRun: boolean
): Promise<any> {
  const tag = `[${traceId}][meta]`;
  const dateSuffix = formatDateBR();
  const syncResults: any[] = [];
  const cleanAdAccountId = adAccountId.replace("act_", "");

  for (const list of lists) {
    const startTime = Date.now();
    const audienceName = `${list.name} - Atualizado ${dateSuffix}`;

    try {
      // Get members for this list with subscriber data (paginated to handle 1000-row limit)
      let allMembers: any[] = [];
      const PAGE_SIZE = 1000;
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch } = await supabase
          .from("email_marketing_list_members")
          .select("subscriber_id, email_marketing_subscribers!inner(email, name, phone)")
          .eq("tenant_id", tenantId)
          .eq("list_id", list.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (!batch || batch.length === 0) {
          hasMore = false;
        } else {
          allMembers = allMembers.concat(batch);
          page++;
          if (batch.length < PAGE_SIZE) hasMore = false;
        }
        // Safety: max 50k
        if (allMembers.length >= 50000) break;
      }
      const members = allMembers;

      if (!members || members.length === 0) {
        console.log(`${tag} List "${list.name}": no members, skipping`);
        continue;
      }

      // Check if mapping exists
      const { data: mapping } = await supabase
        .from("audience_sync_mappings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("list_id", list.id)
        .eq("platform", "meta")
        .maybeSingle();

      let audienceId = mapping?.platform_audience_id;

      // Create audience if needed
      if (!audienceId) {
        if (dryRun) {
          console.log(`${tag} [DRY RUN] Would create audience: ${audienceName}`);
          syncResults.push({ list: list.name, action: "dry_run_create", members: members.length });
          continue;
        }

        const createRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${cleanAdAccountId}/customaudiences`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: audienceName,
              subtype: "CUSTOM",
              description: `Sincronizado automaticamente da lista "${list.name}"`,
              customer_file_source: "USER_PROVIDED_ONLY",
              access_token: metaConn.access_token,
            }),
          }
        );
        const createData = await createRes.json();

        if (createData.error) {
          console.error(`${tag} Create audience failed:`, JSON.stringify(createData.error));
          const errMsg = `${createData.error.message} (code: ${createData.error.code}, subcode: ${createData.error.error_subcode}, type: ${createData.error.type})`;
          await logSync(supabase, tenantId, list.id, "meta", null, "error", 0, null, errMsg, Date.now() - startTime);
          syncResults.push({ list: list.name, error: errMsg });
          continue;
        }

        audienceId = createData.id;
        console.log(`${tag} Created audience ${audienceId} for list "${list.name}"`);

        // Save mapping
        await supabase.from("audience_sync_mappings").upsert({
          tenant_id: tenantId,
          list_id: list.id,
          platform: "meta",
          platform_audience_id: audienceId,
          ad_account_id: adAccountId,
          audience_name: audienceName,
          status: "active",
        }, { onConflict: "tenant_id,list_id,platform" });

        await logSync(supabase, tenantId, list.id, "meta", audienceId, "create", 0, null, null, Date.now() - startTime);
      }

      if (dryRun) {
        console.log(`${tag} [DRY RUN] Would sync ${members.length} members to audience ${audienceId}`);
        syncResults.push({ list: list.name, action: "dry_run_sync", members: members.length, audience_id: audienceId });
        continue;
      }

      // Prepare hashed data in batches
      const BATCH_SIZE = 10000;
      let totalSent = 0;

      for (let i = 0; i < members.length; i += BATCH_SIZE) {
        const batch = members.slice(i, i + BATCH_SIZE);
        const schema = ["EMAIL", "PHONE", "FN", "LN"];
        const dataRows: string[][] = [];

        for (const m of batch) {
          const sub = m.email_marketing_subscribers;
          if (!sub?.email) continue;

          const { first, last } = splitName(sub.name);
          const phone = normalizePhone(sub.phone);

          dataRows.push([
            await sha256(sub.email),
            phone ? await sha256(phone) : "",
            first ? await sha256(first) : "",
            last ? await sha256(last) : "",
          ]);
        }

        if (dataRows.length === 0) continue;

        // Upload users
        const uploadRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${audienceId}/users`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payload: {
                schema,
                is_raw: false,
                data: dataRows,
              },
              access_token: metaConn.access_token,
            }),
          }
        );
        const uploadData = await uploadRes.json();

        if (uploadData.error) {
          console.error(`${tag} Upload batch failed:`, uploadData.error.message);
        } else {
          totalSent += dataRows.length;
          console.log(`${tag} Uploaded batch: ${dataRows.length} users (${uploadData.num_received || 0} received)`);
        }
      }

      // Rename audience with updated date
      await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${audienceId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: audienceName,
            access_token: metaConn.access_token,
          }),
        }
      );

      // Update mapping
      await supabase
        .from("audience_sync_mappings")
        .update({
          last_synced_at: new Date().toISOString(),
          members_synced: totalSent,
          audience_name: audienceName,
          status: "active",
        })
        .eq("tenant_id", tenantId)
        .eq("list_id", list.id)
        .eq("platform", "meta");

      await logSync(supabase, tenantId, list.id, "meta", audienceId, "sync", totalSent, null, null, Date.now() - startTime);
      syncResults.push({ list: list.name, audience_id: audienceId, members_sent: totalSent });

    } catch (err) {
      console.error(`${tag} List "${list.name}" error:`, (err as Error).message);
      await logSync(supabase, tenantId, list.id, "meta", null, "error", 0, null, (err as Error).message, Date.now() - startTime);
      syncResults.push({ list: list.name, error: (err as Error).message });
    }
  }

  return { lists_processed: syncResults.length, details: syncResults };
}

// ========================
// GOOGLE SYNC
// ========================
async function syncGoogleAudiences(
  supabase: any,
  tenantId: string,
  lists: Array<{ id: string; name: string }>,
  googleConn: any,
  customerId: string,
  traceId: string,
  dryRun: boolean
): Promise<any> {
  const tag = `[${traceId}][google]`;
  const dateSuffix = formatDateBR();
  const syncResults: any[] = [];
  const developerToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");

  if (!developerToken) {
    console.log(`${tag} No GOOGLE_ADS_DEVELOPER_TOKEN configured`);
    return { skipped: "no_developer_token" };
  }

  const cleanCustomerId = customerId.replace(/-/g, "");
  const headers = {
    "Authorization": `Bearer ${googleConn.access_token}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };

  for (const list of lists) {
    const startTime = Date.now();
    const audienceName = `${list.name} - Atualizado ${dateSuffix}`;

    try {
      // Get members (paginated to handle 1000-row limit)
      let allMembers: any[] = [];
      const PAGE_SIZE = 1000;
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data: batch } = await supabase
          .from("email_marketing_list_members")
          .select("subscriber_id, email_marketing_subscribers!inner(email, name, phone)")
          .eq("tenant_id", tenantId)
          .eq("list_id", list.id)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (!batch || batch.length === 0) { hasMore = false; }
        else { allMembers = allMembers.concat(batch); page++; if (batch.length < PAGE_SIZE) hasMore = false; }
        if (allMembers.length >= 100000) break;
      }
      const members = allMembers;

      if (!members || members.length === 0) continue;

      // Check mapping
      const { data: mapping } = await supabase
        .from("audience_sync_mappings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("list_id", list.id)
        .eq("platform", "google")
        .maybeSingle();

      let userListResourceName = mapping?.platform_audience_id;

      // Create user list if needed
      if (!userListResourceName) {
        if (dryRun) {
          syncResults.push({ list: list.name, action: "dry_run_create", members: members.length });
          continue;
        }

        const createBody = {
          operations: [{
            create: {
              name: audienceName,
              description: `Sincronizado da lista "${list.name}"`,
              membershipLifeSpan: 10000, // Maximum: unlimited
              crmBasedUserList: {
                uploadKeyType: "CONTACT_INFO",
                dataSourceType: "FIRST_PARTY",
              },
            },
          }],
        };

        const createRes = await fetch(
          `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/userLists:mutate`,
          { method: "POST", headers, body: JSON.stringify(createBody) }
        );
        const createData = await createRes.json();

        if (createData.error) {
          console.error(`${tag} Create user list failed:`, createData.error.message);
          await logSync(supabase, tenantId, list.id, "google", null, "error", 0, null, createData.error.message, Date.now() - startTime);
          syncResults.push({ list: list.name, error: createData.error.message });
          continue;
        }

        userListResourceName = createData.results?.[0]?.resourceName;
        console.log(`${tag} Created user list: ${userListResourceName}`);

        await supabase.from("audience_sync_mappings").upsert({
          tenant_id: tenantId,
          list_id: list.id,
          platform: "google",
          platform_audience_id: userListResourceName,
          ad_account_id: customerId,
          audience_name: audienceName,
          status: "active",
        }, { onConflict: "tenant_id,list_id,platform" });

        await logSync(supabase, tenantId, list.id, "google", userListResourceName, "create", 0, null, null, Date.now() - startTime);
      }

      if (dryRun) {
        syncResults.push({ list: list.name, action: "dry_run_sync", members: members.length, audience: userListResourceName });
        continue;
      }

      // Create offline user data job
      const jobBody = {
        job: {
          type: "CUSTOMER_MATCH_USER_LIST",
          customerMatchUserListMetadata: {
            userList: userListResourceName,
          },
        },
      };

      const jobRes = await fetch(
        `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/offlineUserDataJobs:create`,
        { method: "POST", headers, body: JSON.stringify(jobBody) }
      );
      const jobData = await jobRes.json();

      if (jobData.error) {
        console.error(`${tag} Create job failed:`, jobData.error.message);
        await logSync(supabase, tenantId, list.id, "google", userListResourceName, "error", 0, null, jobData.error.message, Date.now() - startTime);
        syncResults.push({ list: list.name, error: jobData.error.message });
        continue;
      }

      const jobResourceName = jobData.resourceName;

      // Add operations in batches
      const BATCH_SIZE = 10000;
      let totalSent = 0;

      for (let i = 0; i < members.length; i += BATCH_SIZE) {
        const batch = members.slice(i, i + BATCH_SIZE);
        const operations: any[] = [];

        for (const m of batch) {
          const sub = m.email_marketing_subscribers;
          if (!sub?.email) continue;

          const { first, last } = splitName(sub.name);
          const phone = normalizePhone(sub.phone);

          const userIdentifiers: any[] = [
            { hashedEmail: await sha256(sub.email) },
          ];

          if (phone) {
            userIdentifiers.push({ hashedPhoneNumber: await sha256(phone) });
          }

          if (first) {
            userIdentifiers[0].addressInfo = {
              hashedFirstName: await sha256(first),
              ...(last ? { hashedLastName: await sha256(last) } : {}),
              countryCode: "BR",
            };
          }

          operations.push({
            create: { userIdentifiers },
          });
        }

        if (operations.length === 0) continue;

        const addRes = await fetch(
          `https://googleads.googleapis.com/v18/${jobResourceName}:addOperations`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              operations,
              enablePartialFailure: true,
            }),
          }
        );
        const addData = await addRes.json();

        if (addData.error) {
          console.error(`${tag} Add operations failed:`, addData.error.message);
        } else {
          totalSent += operations.length;
        }
      }

      // Run the job
      await fetch(
        `https://googleads.googleapis.com/v18/${jobResourceName}:run`,
        { method: "POST", headers }
      );

      // Update mapping
      await supabase
        .from("audience_sync_mappings")
        .update({
          last_synced_at: new Date().toISOString(),
          members_synced: totalSent,
          audience_name: audienceName,
          status: "active",
        })
        .eq("tenant_id", tenantId)
        .eq("list_id", list.id)
        .eq("platform", "google");

      await logSync(supabase, tenantId, list.id, "google", userListResourceName, "sync", totalSent, null, null, Date.now() - startTime);
      syncResults.push({ list: list.name, audience: userListResourceName, members_sent: totalSent });

    } catch (err) {
      console.error(`${tag} List "${list.name}" error:`, (err as Error).message);
      await logSync(supabase, tenantId, list.id, "google", null, "error", 0, null, (err as Error).message, Date.now() - startTime);
      syncResults.push({ list: list.name, error: (err as Error).message });
    }
  }

  return { lists_processed: syncResults.length, details: syncResults };
}

// ========================
// LOG HELPER
// ========================
async function logSync(
  supabase: any,
  tenantId: string,
  listId: string,
  platform: string,
  audienceId: string | null,
  action: string,
  membersSent: number,
  membersMatched: number | null,
  errorMessage: string | null,
  durationMs: number
) {
  await supabase.from("audience_sync_logs").insert({
    tenant_id: tenantId,
    list_id: listId,
    platform,
    platform_audience_id: audienceId,
    action,
    members_sent: membersSent,
    members_matched: membersMatched,
    error_message: errorMessage,
    duration_ms: durationMs,
  });
}
