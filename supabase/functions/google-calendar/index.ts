// =============================================
// EDGE FUNCTION: Google Calendar
// Actions: calendars, events, sync, create
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

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

async function calendarFetch(accessToken: string, path: string, options?: RequestInit) {
  const resp = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error(`[google-calendar] API error ${resp.status}:`, err);
    throw new Error(`Calendar API error: ${resp.status}`);
  }
  return resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

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
      case "calendars": {
        const listResp = await calendarFetch(accessToken, "/users/me/calendarList");
        data = (listResp.items || []).map((cal: any) => ({
          id: cal.id,
          summary: cal.summary,
          timeZone: cal.timeZone,
          primary: cal.primary || false,
        }));
        break;
      }

      case "events": {
        const now = new Date();
        const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const maxResults = params.maxResults || 50;

        const eventsResp = await calendarFetch(
          accessToken,
          `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`
        );

        data = (eventsResp.items || []).map((evt: any) => ({
          id: evt.id,
          summary: evt.summary || "(Sem título)",
          description: evt.description || "",
          start: evt.start?.dateTime || evt.start?.date || "",
          end: evt.end?.dateTime || evt.end?.date || "",
          location: evt.location || "",
          status: evt.status || "confirmed",
          htmlLink: evt.htmlLink,
          creator: evt.creator ? { email: evt.creator.email } : undefined,
          attendees: (evt.attendees || []).map((a: any) => ({
            email: a.email,
            responseStatus: a.responseStatus,
          })),
        }));
        break;
      }

      case "sync": {
        // Re-fetch events to refresh cache
        const now = new Date();
        const timeMin = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const eventsResp = await calendarFetch(
          accessToken,
          `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=100&singleEvents=true&orderBy=startTime`
        );
        data = { synced: eventsResp.items?.length || 0 };
        break;
      }

      case "create": {
        const { summary, description, start, end, location, attendees } = params;
        if (!summary || !start || !end) {
          return new Response(
            JSON.stringify({ success: false, error: "summary, start e end obrigatórios" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const eventBody: any = {
          summary,
          description: description || "",
          start: { dateTime: start },
          end: { dateTime: end },
        };

        if (location) eventBody.location = location;
        if (attendees?.length) {
          eventBody.attendees = attendees.map((email: string) => ({ email }));
        }

        const created = await calendarFetch(accessToken, "/calendars/primary/events", {
          method: "POST",
          body: JSON.stringify(eventBody),
        });

        data = { id: created.id, htmlLink: created.htmlLink };
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
    console.error("[google-calendar] Error:", error);
    return errorResponse(error, corsHeaders);
  }
});
