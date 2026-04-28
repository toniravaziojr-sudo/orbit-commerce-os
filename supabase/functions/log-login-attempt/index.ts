// Onda 5 F1: Edge function que registra toda tentativa de login (sucesso/falha)
// Chamada não-bloqueante a partir do front após signInWithPassword / OAuth
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LogPayload {
  email?: string | null;
  success: boolean;
  failure_reason?: string | null;
  user_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as LogPayload;

    if (typeof body?.success !== "boolean") {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_payload" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const email = body.email ? String(body.email).toLowerCase().trim().slice(0, 320) : null;
    const failureReason = body.failure_reason ? String(body.failure_reason).slice(0, 500) : null;

    const { error } = await supabase.from("auth_login_attempts").insert({
      email,
      ip_address: ip,
      user_agent: userAgent ? userAgent.slice(0, 500) : null,
      success: body.success,
      failure_reason: failureReason,
      user_id: body.user_id || null,
    });

    if (error) {
      console.error("[log-login-attempt] insert error", error);
      return new Response(
        JSON.stringify({ success: false, error: "db_error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[log-login-attempt] fatal", err);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
