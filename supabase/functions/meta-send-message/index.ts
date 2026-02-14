import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Unified Messenger + Instagram DM send
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Meta Send Message (Unified)
 * 
 * Sends messages via:
 * - Facebook Messenger (Page → User)
 * - Instagram DM (IG Account → User)
 * 
 * Both use the Graph API Send API with Page Access Token.
 * 
 * Params:
 * - tenant_id: string
 * - channel: "facebook_messenger" | "instagram_dm"
 * - recipient_id: string (PSID for Messenger, IGSID for Instagram)
 * - message: string
 * - page_id?: string (optional, auto-resolved from conversation metadata)
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-send-message][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { tenant_id, channel, recipient_id, message, page_id } = await req.json();

    if (!tenant_id || !recipient_id || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id, recipient_id e message são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meta-send-message][${traceId}] tenant=${tenant_id} channel=${channel} recipient=${recipient_id}`);

    // Get Meta connection for tenant
    const { data: conn } = await supabase
      .from("marketplace_connections")
      .select("metadata, access_token")
      .eq("tenant_id", tenant_id)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .single();

    if (!conn) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectado para este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine which page to use
    let resolvedPageId = page_id;
    let pageAccessToken: string | null = null;

    if (channel === "instagram_dm") {
      // For Instagram, find the page linked to the IG account
      const igAccounts = conn.metadata?.assets?.instagram_accounts || [];
      // If page_id not provided, use the first IG account's page
      if (!resolvedPageId && igAccounts.length > 0) {
        resolvedPageId = igAccounts[0].page_id;
      }
    }

    // If still no page_id, use first available page
    const pages = conn.metadata?.assets?.pages || [];
    if (!resolvedPageId && pages.length > 0) {
      resolvedPageId = pages[0].id;
    }

    // Get page access token
    if (resolvedPageId) {
      const page = pages.find((p: any) => p.id === resolvedPageId);
      pageAccessToken = page?.access_token || null;
    }

    if (!pageAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Page Access Token não encontrado. Reconecte a integração Meta." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the message payload
    // Both Messenger and Instagram DM use the same Send API
    const sendUrl = channel === "instagram_dm"
      ? `https://graph.facebook.com/v21.0/me/messages`
      : `https://graph.facebook.com/v21.0/me/messages`;

    const payload = {
      recipient: { id: recipient_id },
      message: { text: message },
      messaging_type: "RESPONSE",
    };

    console.log(`[meta-send-message][${traceId}] Sending via ${channel} to ${recipient_id}`);

    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${pageAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await sendResponse.json();

    if (result.error) {
      console.error(`[meta-send-message][${traceId}] Send error:`, result.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error.message || "Erro ao enviar mensagem",
          code: result.error.code,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const externalMessageId = result.message_id || result.id;
    console.log(`[meta-send-message][${traceId}] Sent OK: ${externalMessageId}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message_id: externalMessageId,
          recipient_id,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-send-message][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
