import { createClient } from "npm:@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const type = url.searchParams.get("type"); // "open" or "click"
  const redirect = url.searchParams.get("url"); // destination for clicks

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch token record
    const { data: trackingToken, error } = await supabase
      .from("email_tracking_tokens")
      .select("id, campaign_id, subscriber_id, tenant_id, opened_at, clicked_at, open_count, click_count")
      .eq("token", token)
      .single();

    if (error || !trackingToken) {
      if (type === "click" && redirect) {
        return Response.redirect(redirect, 302);
      }
      return new Response(PIXEL_GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
    }

    const isFirstOpen = !trackingToken.opened_at;
    const isFirstClick = !trackingToken.clicked_at;

    if (type === "click") {
      // Update token click
      await supabase
        .from("email_tracking_tokens")
        .update({
          clicked_at: trackingToken.clicked_at || new Date().toISOString(),
          click_count: trackingToken.click_count + 1,
        })
        .eq("id", trackingToken.id);

      // Increment campaign click counters
      const updates: Record<string, any> = { click_count: (await getCampaignField(supabase, trackingToken.campaign_id, "click_count")) + 1 };
      if (isFirstClick) {
        updates.unique_click_count = (await getCampaignField(supabase, trackingToken.campaign_id, "unique_click_count")) + 1;
      }
      await supabase
        .from("email_marketing_campaigns")
        .update(updates)
        .eq("id", trackingToken.campaign_id);

      if (redirect) {
        // v8.36.0 — Pré-hidratação de identidade no clique de e-mail.
        // Anexa ?ah=<token> ao redirect quando o destino é do mesmo tenant
        // (domínios verificados) e há ao menos email/telefone do subscriber.
        // Falha silenciosamente — nunca bloqueia o redirect original.
        const finalUrl = await maybeAttachPrehydrationToken(
          supabase,
          redirect,
          trackingToken.tenant_id,
          trackingToken.subscriber_id,
        );
        return Response.redirect(finalUrl, 302);
      }
      return new Response("OK", { status: 200 });
    } else {

      // Open tracking (pixel)
      await supabase
        .from("email_tracking_tokens")
        .update({
          opened_at: trackingToken.opened_at || new Date().toISOString(),
          open_count: trackingToken.open_count + 1,
        })
        .eq("id", trackingToken.id);

      const openUpdates: Record<string, any> = { open_count: (await getCampaignField(supabase, trackingToken.campaign_id, "open_count")) + 1 };
      if (isFirstOpen) {
        openUpdates.unique_open_count = (await getCampaignField(supabase, trackingToken.campaign_id, "unique_open_count")) + 1;
      }
      await supabase
        .from("email_marketing_campaigns")
        .update(openUpdates)
        .eq("id", trackingToken.campaign_id);

      return new Response(PIXEL_GIF, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      });
    }
  } catch (err) {
    console.error("Tracking error:", err);
    if (type === "click" && redirect) {
      return Response.redirect(redirect, 302);
    }
    return new Response(PIXEL_GIF, { headers: { "Content-Type": "image/gif" } });
  }
});

async function getCampaignField(supabase: any, campaignId: string, field: string): Promise<number> {
  const { data } = await supabase
    .from("email_marketing_campaigns")
    .select(field)
    .eq("id", campaignId)
    .single();
  return data?.[field] ?? 0;
}

// ---------------------------------------------------------------------------
// v8.36.0 — Pré-hidratação do cofre _sf_identity via clique de e-mail
// ---------------------------------------------------------------------------
// SHA-256 hex, lowercase+trim — mesmo contrato de _shared/meta-capi-sender.ts
async function sha256Hex(value: string): Promise<string> {
  const normalized = value.toLowerCase().trim();
  const data = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhoneBR(phone: string): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits || digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  if (!full) return { first: null, last: null };
  const parts = full.trim().split(/\s+/);
  if (!parts.length) return { first: null, last: null };
  return { first: parts[0] || null, last: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

async function isSameTenantUrl(supabase: any, urlStr: string, tenantId: string): Promise<boolean> {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    const { data } = await supabase
      .from("tenant_domains")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .eq("domain", host)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

async function maybeAttachPrehydrationToken(
  supabase: any,
  redirect: string,
  tenantId: string | null,
  subscriberId: string | null,
): Promise<string> {
  try {
    if (!tenantId || !subscriberId) return redirect;
    if (!(await isSameTenantUrl(supabase, redirect, tenantId))) return redirect;

    const { data: sub } = await supabase
      .from("email_marketing_subscribers")
      .select("email, phone, name, birth_date, customer_id")
      .eq("id", subscriberId)
      .maybeSingle();
    if (!sub) return redirect;

    const bundle: Record<string, string | number> = {};
    if (sub.email) bundle.em_hash = await sha256Hex(sub.email);
    if (sub.phone) {
      const ph = normalizePhoneBR(sub.phone);
      if (ph) bundle.ph_hash = await sha256Hex(ph);
    }
    const { first, last } = splitName(sub.name);
    if (first) bundle.fn_hash = await sha256Hex(first);
    if (last) bundle.ln_hash = await sha256Hex(last);
    if (sub.birth_date) {
      // Meta espera YYYYMMDD
      const compact = String(sub.birth_date).replace(/-/g, "").slice(0, 8);
      if (/^\d{8}$/.test(compact)) bundle.db_hash = await sha256Hex(compact);
    }
    if (!bundle.em_hash && !bundle.ph_hash) return redirect;

    // expires_at em milissegundos (mesmo formato consumido por _sfGetIdentity)
    bundle.expires_at = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias no cofre

    const token = "ah_" + crypto.randomUUID().replace(/-/g, "");
    const expiresAtTs = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min de janela de clique

    const insertPayload: Record<string, unknown> = {
      token,
      tenant_id: tenantId,
      subscriber_id: subscriberId,
      identity_bundle: bundle,
      expires_at: expiresAtTs,
    };
    if (sub.customer_id) insertPayload.customer_id = sub.customer_id;

    const { error } = await supabase
      .from("identity_prehydration_tokens")
      .insert(insertPayload);
    if (error) {
      console.warn("[prehydration] insert failed:", error.message);
      return redirect;
    }

    const u = new URL(redirect);
    u.searchParams.set("ah", token);
    return u.toString();
  } catch (e) {
    console.warn("[prehydration] silent fail:", (e as Error).message);
    return redirect;
  }
}

