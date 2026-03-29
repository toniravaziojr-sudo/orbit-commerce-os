import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION =====
const VERSION = "v1.0.0";
// ====================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Polls Meta's API to check the approval status of pending WhatsApp templates.
 * Runs as a cron job every 1 hour.
 * 
 * Flow:
 * 1. Find all submissions with meta_status = 'pending'
 * 2. Group by tenant (to batch API calls per WABA)
 * 3. For each tenant, call Meta's GET message_templates API
 * 4. Update submission status + notification_rule accordingly
 */

interface PendingSubmission {
  id: string;
  tenant_id: string;
  rule_id: string;
  template_name: string;
  meta_template_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[whatsapp-check-templates][${VERSION}] Starting template status check...`);

    // 1. Find all pending submissions
    const { data: pendingSubmissions, error: fetchError } = await supabase
      .from("whatsapp_template_submissions")
      .select("id, tenant_id, rule_id, template_name, meta_template_id")
      .eq("meta_status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);

    if (fetchError) throw fetchError;

    if (!pendingSubmissions || pendingSubmissions.length === 0) {
      console.log(`[whatsapp-check-templates] No pending templates found`);
      return new Response(JSON.stringify({ success: true, checked: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[whatsapp-check-templates] Found ${pendingSubmissions.length} pending templates`);

    // 2. Group by tenant_id
    const byTenant = new Map<string, PendingSubmission[]>();
    for (const sub of pendingSubmissions as PendingSubmission[]) {
      const list = byTenant.get(sub.tenant_id) || [];
      list.push(sub);
      byTenant.set(sub.tenant_id, list);
    }

    // Get graph API version
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();
    const graphApiVersion = versionCred?.credential_value || "v21.0";

    let totalChecked = 0;
    let totalApproved = 0;
    let totalRejected = 0;

    // 3. For each tenant, check templates
    for (const [tenantId, submissions] of byTenant) {
      // Get WhatsApp config for this tenant
      const { data: waConfig } = await supabase
        .from("whatsapp_configs")
        .select("waba_id, access_token")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .eq("connection_status", "connected")
        .single();

      if (!waConfig?.waba_id || !waConfig?.access_token) {
        console.log(`[whatsapp-check-templates] No valid config for tenant ${tenantId}, skipping`);
        continue;
      }

      // Fetch all templates for this WABA
      const templatesUrl = `https://graph.facebook.com/${graphApiVersion}/${waConfig.waba_id}/message_templates?limit=250`;
      
      const response = await fetch(templatesUrl, {
        headers: {
          Authorization: `Bearer ${waConfig.access_token}`,
        },
      });

      if (!response.ok) {
        console.error(`[whatsapp-check-templates] Meta API error for tenant ${tenantId}:`, response.status);
        continue;
      }

      const result = await response.json();
      const metaTemplates = result.data || [];

      // Build a map of template_name -> status
      const templateStatusMap = new Map<string, { status: string; id: string; rejected_reason?: string }>();
      for (const t of metaTemplates) {
        templateStatusMap.set(t.name, {
          status: t.status,
          id: t.id,
          rejected_reason: t.quality_score?.reasons?.[0] || undefined,
        });
      }

      // 4. Check each pending submission
      for (const sub of submissions) {
        totalChecked++;
        const metaInfo = templateStatusMap.get(sub.template_name);
        const now = new Date().toISOString();

        if (!metaInfo) {
          console.log(`[whatsapp-check-templates] Template "${sub.template_name}" not found in Meta, marking as error`);
          await supabase
            .from("whatsapp_template_submissions")
            .update({ meta_status: "not_found", last_checked_at: now })
            .eq("id", sub.id);
          
          await supabase
            .from("notification_rules")
            .update({ meta_template_status: "not_found" })
            .eq("id", sub.rule_id);
          continue;
        }

        const metaStatus = metaInfo.status.toUpperCase();
        console.log(`[whatsapp-check-templates] Template "${sub.template_name}": ${metaStatus}`);

        if (metaStatus === "APPROVED") {
          totalApproved++;
          await supabase
            .from("whatsapp_template_submissions")
            .update({
              meta_status: "approved",
              meta_template_id: metaInfo.id,
              approved_at: now,
              last_checked_at: now,
            })
            .eq("id", sub.id);

          await supabase
            .from("notification_rules")
            .update({ meta_template_status: "approved" })
            .eq("id", sub.rule_id);

          console.log(`[whatsapp-check-templates] ✅ Template "${sub.template_name}" APPROVED!`);

        } else if (metaStatus === "REJECTED") {
          totalRejected++;
          await supabase
            .from("whatsapp_template_submissions")
            .update({
              meta_status: "rejected",
              meta_reject_reason: metaInfo.rejected_reason || "Rejeitado pela Meta",
              rejected_at: now,
              last_checked_at: now,
            })
            .eq("id", sub.id);

          await supabase
            .from("notification_rules")
            .update({ meta_template_status: "rejected" })
            .eq("id", sub.rule_id);

          console.log(`[whatsapp-check-templates] ❌ Template "${sub.template_name}" REJECTED`);

        } else {
          // Still pending
          await supabase
            .from("whatsapp_template_submissions")
            .update({ last_checked_at: now })
            .eq("id", sub.id);
        }
      }
    }

    console.log(`[whatsapp-check-templates] Done. Checked: ${totalChecked}, Approved: ${totalApproved}, Rejected: ${totalRejected}`);

    return new Response(JSON.stringify({
      success: true,
      checked: totalChecked,
      approved: totalApproved,
      rejected: totalRejected,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error(`[whatsapp-check-templates] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'whatsapp-templates', action: 'check' });
  }
});
