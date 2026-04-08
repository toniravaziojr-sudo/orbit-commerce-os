// =============================================
// EDGE FUNCTION: Google Gmail
// Actions: profile, inbox, sync, send
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

async function getAccessToken(supabaseAdmin: any, tenantId: string): Promise<string> {
  const { data: conn, error } = await supabaseAdmin
    .from("google_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (error || !conn) throw new Error("Conexão Google não encontrada");

  const now = new Date();
  const expiresAt = new Date(conn.token_expires_at);

  if (expiresAt > now) return conn.access_token;

  // Refresh token
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) throw new Error("Falha ao renovar token Google");

  const tokens = await resp.json();
  const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

  await supabaseAdmin
    .from("google_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiry,
    })
    .eq("tenant_id", tenantId);

  return tokens.access_token;
}

async function gmailFetch(accessToken: string, path: string, options?: RequestInit) {
  const resp = await fetch(`${GMAIL_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[google-gmail] API error ${resp.status}:`, err);
    throw new Error(`Gmail API error: ${resp.status}`);
  }
  return resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, tenantId, ...params } = await req.json();

    if (!action || !tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "action e tenantId obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const accessToken = await getAccessToken(supabaseAdmin, tenantId);

    let data: any;

    switch (action) {
      case "profile": {
        const profile = await gmailFetch(accessToken, "/users/me/profile");
        data = {
          emailAddress: profile.emailAddress,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal,
          historyId: profile.historyId,
        };
        break;
      }

      case "inbox": {
        const maxResults = params.maxResults || 20;
        const listResp = await gmailFetch(
          accessToken,
          `/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`
        );

        const messageIds = listResp.messages || [];
        const messages = [];

        for (const msg of messageIds.slice(0, maxResults)) {
          try {
            const detail = await gmailFetch(
              accessToken,
              `/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
            );

            const headers = detail.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

            messages.push({
              id: detail.id,
              threadId: detail.threadId,
              from: getHeader("From"),
              to: getHeader("To"),
              subject: getHeader("Subject"),
              snippet: detail.snippet || "",
              date: getHeader("Date"),
              isRead: !detail.labelIds?.includes("UNREAD"),
              labelIds: detail.labelIds || [],
            });
          } catch (e) {
            console.error(`[google-gmail] Error fetching message ${msg.id}:`, e);
          }
        }

        data = messages;
        break;
      }

      case "sync": {
        // For now, sync just refreshes inbox data — can be expanded for local storage
        const listResp = await gmailFetch(
          accessToken,
          `/users/me/messages?maxResults=50&labelIds=INBOX`
        );
        data = { synced: listResp.messages?.length || 0 };
        break;
      }

      case "send": {
        const { to, subject, body, replyToMessageId } = params;
        if (!to || !subject || !body) {
          return new Response(
            JSON.stringify({ success: false, error: "to, subject e body obrigatórios" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let rawEmail = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${body}`;

        if (replyToMessageId) {
          rawEmail = `In-Reply-To: ${replyToMessageId}\r\nReferences: ${replyToMessageId}\r\n${rawEmail}`;
        }

        // Base64url encode
        const encoded = btoa(unescape(encodeURIComponent(rawEmail)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const sendResp = await gmailFetch(accessToken, "/users/me/messages/send", {
          method: "POST",
          body: JSON.stringify({ raw: encoded }),
        });

        data = { messageId: sendResp.id, threadId: sendResp.threadId };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[google-gmail] Error:", error);
    return errorResponse(error, corsHeaders);
  }
});
