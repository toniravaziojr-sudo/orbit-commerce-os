import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Lead Ads webhook → customers + tag + notification
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Meta Lead Ads Webhook
 *
 * Handles leadgen events from Meta Lead Ads.
 * Flow: Lead received → upsert customer → auto-tag "Lead Ads" → notify tenant
 *
 * Routing: Uses Page ID → marketplace_connections → tenant_id
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-leads-webhook][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET: Webhook verification (Meta challenge)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      const { data: credential } = await supabase
        .from("platform_credentials")
        .select("credential_value")
        .eq("credential_key", "META_WEBHOOK_VERIFY_TOKEN")
        .eq("is_active", true)
        .single();

      if (mode === "subscribe" && token === credential?.credential_value) {
        console.log(`[meta-leads-webhook][${traceId}] Verification OK`);
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // POST: Receive lead events
    if (req.method === "POST") {
      const payload = await req.json();
      console.log(
        `[meta-leads-webhook][${traceId}] object=${payload.object}, entries=${payload.entry?.length}`
      );

      if (payload.object !== "page") {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      for (const entry of payload.entry || []) {
        const pageId = entry.id;

        // Process leadgen changes
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "leadgen") {
              const leadgenId = change.value?.leadgen_id;
              const formId = change.value?.form_id;
              const adId = change.value?.ad_id;
              const createdTime = change.value?.created_time;

              if (!leadgenId) {
                console.warn(`[meta-leads-webhook][${traceId}] No leadgen_id in change`);
                continue;
              }

              console.log(
                `[meta-leads-webhook][${traceId}] Lead received: leadgen_id=${leadgenId}, form=${formId}, page=${pageId}`
              );

              // Find tenant by page ID
              const tenantId = await findTenantByPageId(supabase, pageId);
              if (!tenantId) {
                console.warn(`[meta-leads-webhook][${traceId}] No tenant for page ${pageId}`);
                continue;
              }

              // Get page access token to fetch lead data
              const pageToken = await getPageAccessToken(supabase, tenantId, pageId);
              if (!pageToken) {
                console.error(
                  `[meta-leads-webhook][${traceId}] No page token for tenant ${tenantId}`
                );
                continue;
              }

              // Fetch lead data from Graph API
              const leadData = await fetchLeadData(traceId, leadgenId, pageToken);
              if (!leadData) {
                console.error(
                  `[meta-leads-webhook][${traceId}] Could not fetch lead data for ${leadgenId}`
                );
                continue;
              }

              // Parse lead fields into structured data
              const parsedLead = parseLeadFields(leadData);
              console.log(
                `[meta-leads-webhook][${traceId}] Parsed lead: email=${parsedLead.email}, name=${parsedLead.name}`
              );

              // Upsert customer + auto-tag "Lead Ads"
              await processLead(supabase, traceId, tenantId, parsedLead, {
                leadgenId,
                formId,
                adId,
                pageId,
                createdTime,
                formName: leadData.form_name,
              });
            }
          }
        }
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error(`[meta-leads-webhook][${traceId}] Error:`, error);
    return new Response("OK", { status: 200, headers: corsHeaders }); // Always 200 for Meta
  }
});

// ==================== HELPERS ====================

/**
 * Find tenant by Facebook Page ID
 */
async function findTenantByPageId(
  supabase: any,
  pageId: string
): Promise<string | null> {
  const { data: connections } = await supabase
    .from("marketplace_connections")
    .select("tenant_id, metadata")
    .eq("marketplace", "meta")
    .eq("is_active", true);

  if (!connections) return null;

  for (const conn of connections) {
    const pages = conn.metadata?.assets?.pages || [];
    if (pages.some((p: any) => p.id === pageId)) {
      return conn.tenant_id;
    }
  }
  return null;
}

/**
 * Get Page Access Token for a specific page
 */
async function getPageAccessToken(
  supabase: any,
  tenantId: string,
  pageId: string
): Promise<string | null> {
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .single();

  if (!conn?.metadata?.assets?.pages) return null;
  const page = conn.metadata.assets.pages.find((p: any) => p.id === pageId);
  return page?.access_token || null;
}

/**
 * Fetch lead data from Meta Graph API
 */
async function fetchLeadData(
  traceId: string,
  leadgenId: string,
  pageToken: string
): Promise<any | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${pageToken}`
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[meta-leads-webhook][${traceId}] Graph API error fetching lead: ${errText}`
      );
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[meta-leads-webhook][${traceId}] Fetch lead error:`, e);
    return null;
  }
}

interface ParsedLead {
  email: string | null;
  name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  rawFields: Record<string, string>;
}

/**
 * Parse lead fields from Meta's field_data array
 */
function parseLeadFields(leadData: any): ParsedLead {
  const fields: Record<string, string> = {};

  for (const field of leadData.field_data || []) {
    const key = (field.name || "").toLowerCase();
    const value = Array.isArray(field.values) ? field.values[0] : field.values;
    if (key && value) {
      fields[key] = value;
    }
  }

  return {
    email: fields.email || fields.e_mail || fields["e-mail"] || null,
    name:
      fields.full_name ||
      fields.nome ||
      fields.name ||
      [fields.first_name, fields.last_name].filter(Boolean).join(" ") ||
      null,
    phone:
      fields.phone_number || fields.phone || fields.telefone || fields.celular || null,
    city: fields.city || fields.cidade || null,
    state: fields.state || fields.estado || null,
    rawFields: fields,
  };
}

/**
 * Process lead: upsert customer, auto-tag, create notification
 */
async function processLead(
  supabase: any,
  traceId: string,
  tenantId: string,
  lead: ParsedLead,
  meta: {
    leadgenId: string;
    formId?: string;
    adId?: string;
    pageId: string;
    createdTime?: number;
    formName?: string;
  }
) {
  const normalizedEmail = lead.email?.trim().toLowerCase() || null;

  // 1) Upsert customer
  let customerId: string | null = null;
  let isNewCustomer = false;

  if (normalizedEmail) {
    // Check if customer exists
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", normalizedEmail)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
      // Update with new data if available
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (lead.name) updates.full_name = lead.name;
      if (lead.phone) updates.phone = lead.phone;
      updates.accepts_email_marketing = true;

      await supabase.from("customers").update(updates).eq("id", customerId);
      console.log(`[meta-leads-webhook][${traceId}] Updated customer ${customerId}`);
    } else {
      const { data: newCustomer, error: custError } = await supabase
        .from("customers")
        .insert({
          tenant_id: tenantId,
          email: normalizedEmail,
          full_name: lead.name || normalizedEmail,
          phone: lead.phone || null,
          status: "active",
          accepts_email_marketing: true,
          metadata: {
            source: "lead_ads",
            leadgen_id: meta.leadgenId,
            form_id: meta.formId,
            ad_id: meta.adId,
            form_name: meta.formName,
            raw_fields: lead.rawFields,
          },
        })
        .select("id")
        .single();

      if (custError) {
        console.error(
          `[meta-leads-webhook][${traceId}] Failed to create customer:`,
          custError
        );
      } else {
        customerId = newCustomer.id;
        isNewCustomer = true;
        console.log(`[meta-leads-webhook][${traceId}] Created customer ${customerId}`);
      }
    }
  } else {
    console.warn(`[meta-leads-webhook][${traceId}] Lead without email, skipping customer creation`);
  }

  // 2) Auto-tag "Lead Ads"
  if (customerId) {
    try {
      // Find or create "Lead Ads" tag
      let tagId: string | null = null;

      const { data: existingTag } = await supabase
        .from("customer_tags")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", "Lead Ads")
        .maybeSingle();

      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag, error: tagError } = await supabase
          .from("customer_tags")
          .insert({
            tenant_id: tenantId,
            name: "Lead Ads",
            color: "#3B82F6", // Blue
            description: "Leads capturados via Meta Lead Ads",
          })
          .select("id")
          .single();

        if (!tagError && newTag) {
          tagId = newTag.id;
        }
      }

      if (tagId) {
        await supabase
          .from("customer_tag_assignments")
          .upsert(
            { customer_id: customerId, tag_id: tagId },
            { onConflict: "customer_id,tag_id" }
          );
        console.log(`[meta-leads-webhook][${traceId}] Tagged customer with "Lead Ads"`);
      }
    } catch (tagErr) {
      console.warn(`[meta-leads-webhook][${traceId}] Tag assignment error:`, tagErr);
    }
  }

  // 3) Create notification for tenant
  try {
    const formLabel = meta.formName || meta.formId || "formulário";
    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      type: "lead_ads",
      title: "Novo lead capturado",
      message: `${lead.name || lead.email || "Lead"} preencheu o formulário "${formLabel}" via Meta Lead Ads.`,
      data: {
        customer_id: customerId,
        leadgen_id: meta.leadgenId,
        form_id: meta.formId,
        ad_id: meta.adId,
        email: normalizedEmail,
        phone: lead.phone,
        is_new_customer: isNewCustomer,
      },
      is_read: false,
    });
    console.log(`[meta-leads-webhook][${traceId}] Notification created`);
  } catch (notifErr) {
    console.warn(`[meta-leads-webhook][${traceId}] Notification error:`, notifErr);
  }

  // 4) Sync to email marketing (subscriber) if email exists
  if (normalizedEmail) {
    try {
      await supabase.rpc("sync_subscriber_to_customer_with_tag", {
        p_tenant_id: tenantId,
        p_email: normalizedEmail,
        p_name: lead.name || null,
        p_phone: lead.phone || null,
        p_source: "lead_ads",
      });
      console.log(`[meta-leads-webhook][${traceId}] Subscriber synced`);
    } catch (subErr) {
      console.warn(`[meta-leads-webhook][${traceId}] Subscriber sync error:`, subErr);
    }
  }
}
