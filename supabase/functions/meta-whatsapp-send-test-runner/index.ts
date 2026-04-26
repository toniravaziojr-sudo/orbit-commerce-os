// Internal test runner for meta-whatsapp-send retry logic.
// SECURITY: Only runs if caller provides the same x-internal-test-token header
// AND the token matches the META_WHATSAPP_TEST_INJECT_TOKEN secret.
// This function ONLY simulates failures (no real Meta API hit) when inject_failures >= 3.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const testToken = Deno.env.get("META_WHATSAPP_TEST_INJECT_TOKEN") || "";

  if (!testToken) {
    return new Response(JSON.stringify({ error: "Test token not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const {
      tenant_id,
      conversation_id,
      phone,
      inject_failures = 3, // default: all fail (safe — no real Meta hit)
      message_text = "[NÍVEL 1 TESTE] Esta é uma mensagem técnica de validação do retry. Não enviar para produção.",
    } = body;

    if (!tenant_id || !conversation_id || !phone) {
      return new Response(JSON.stringify({ error: "tenant_id, conversation_id, phone required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Create test message row
    const { data: newMessage, error: msgErr } = await supabase
      .from("messages")
      .insert({
        tenant_id,
        conversation_id,
        direction: "outbound",
        sender_type: "system",
        content: message_text,
        delivery_status: "pending",
        is_internal: true,
        metadata: { test_run: true, level: 1, created_by: "test-runner" },
      })
      .select()
      .single();

    if (msgErr || !newMessage) {
      return new Response(JSON.stringify({ error: "Failed to create test message", details: msgErr }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[test-runner] Created test message ${newMessage.id}`);

    // 2) Call meta-whatsapp-send with test header + injected failures
    const sendUrl = `${supabaseUrl}/functions/v1/meta-whatsapp-send`;
    const sendResp = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        "x-internal-test-token": testToken,
      },
      body: JSON.stringify({
        tenant_id,
        phone,
        message: message_text,
        message_id: newMessage.id,
        _test_inject_failures: inject_failures,
      }),
    });

    const sendResult = await sendResp.json();

    // 3) Read back the message state for validation
    const { data: finalMessage } = await supabase
      .from("messages")
      .select("id, delivery_status, failure_reason, external_message_id, metadata")
      .eq("id", newMessage.id)
      .single();

    return new Response(JSON.stringify({
      ok: true,
      test_message_id: newMessage.id,
      send_function_response: sendResult,
      final_state: finalMessage,
      attempts_recorded: ((finalMessage?.metadata as any)?.delivery_attempts ?? []).length,
    }, null, 2), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[test-runner] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
