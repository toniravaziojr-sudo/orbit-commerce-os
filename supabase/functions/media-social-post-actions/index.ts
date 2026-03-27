import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * media-social-post-actions v1.0.0
 * Phase 1B: Manual operational actions for social posts
 * 
 * Actions:
 * - retry_platform: Re-queue a failed post for retry
 * - dismiss_failure: Mark a failed post as canceled (acknowledged)
 * - supersede: Mark old posts as superseded when re-scheduling
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autorizado" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Sessão inválida" }, 401);
    }

    const body = await req.json();
    const { action, social_post_id, tenant_id } = body;

    if (!action || !social_post_id || !tenant_id) {
      return jsonResponse({ success: false, error: "Parâmetros inválidos: action, social_post_id, tenant_id obrigatórios" }, 400);
    }

    // Verify user access
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!userRole) {
      return jsonResponse({ success: false, error: "Sem acesso" }, 403);
    }

    // Get the social post
    const { data: post, error: postErr } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", social_post_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (postErr || !post) {
      return jsonResponse({ success: false, error: "Publicação não encontrada" }, 404);
    }

    const nowISO = new Date().toISOString();

    switch (action) {
      case "retry_platform": {
        if (post.status !== "failed") {
          return jsonResponse({ success: false, error: "Só é possível reenviar publicações com erro" }, 400);
        }

        const logEntry = {
          timestamp: nowISO,
          action: "manual_retry",
          triggered_by: user.id,
          previous_error: post.last_error_message,
          previous_attempts: post.attempt_count,
        };

        await supabase.from("social_posts").update({
          status: "scheduled",
          attempt_count: 0,
          last_error_code: null,
          last_error_message: null,
          error_message: null,
          next_retry_at: null,
          processing_started_at: null,
          lock_token: null,
          scheduled_at: nowISO,
          execution_log: [...(post.execution_log || []), logEntry],
        }).eq("id", social_post_id);

        return jsonResponse({ success: true, message: "Publicação reagendada para reenvio" });
      }

      case "dismiss_failure": {
        if (post.status !== "failed") {
          return jsonResponse({ success: false, error: "Só é possível encerrar publicações com erro" }, 400);
        }

        const logEntry = {
          timestamp: nowISO,
          action: "manual_dismiss",
          triggered_by: user.id,
          previous_error: post.last_error_message,
        };

        await supabase.from("social_posts").update({
          status: "canceled",
          next_retry_at: null,
          processing_started_at: null,
          lock_token: null,
          execution_log: [...(post.execution_log || []), logEntry],
        }).eq("id", social_post_id);

        return jsonResponse({ success: true, message: "Falha encerrada" });
      }

      case "supersede": {
        // Mark this post as superseded (called when re-scheduling)
        const logEntry = {
          timestamp: nowISO,
          action: "superseded",
          triggered_by: user.id,
          reason: body.reason || "Reagendamento manual",
        };

        await supabase.from("social_posts").update({
          status: "superseded",
          superseded_at: nowISO,
          superseded_by: body.new_post_id || null,
          processing_started_at: null,
          lock_token: null,
          next_retry_at: null,
          execution_log: [...(post.execution_log || []), logEntry],
        }).eq("id", social_post_id);

        return jsonResponse({ success: true, message: "Publicação marcada como substituída" });
      }

      default:
        return jsonResponse({ success: false, error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (error: any) {
    console.error("[media-social-post-actions] Error:", error);
    return jsonResponse({ success: false, error: error.message || "Erro interno" }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
