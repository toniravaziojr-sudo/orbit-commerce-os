import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Deauthorize Callback
 * 
 * Recebe webhook do Meta quando usuário remove permissões do app.
 * Valida assinatura HMAC e desativa conexões associadas.
 * 
 * URL para configurar no Meta: 
 * https://<project-id>.supabase.co/functions/v1/meta-deauthorize-callback
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-deauthorize-callback][${traceId}] Request: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Meta envia POST com signed_request
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse body - pode ser form-urlencoded ou JSON
    let signedRequest: string | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      signedRequest = formData.get("signed_request") as string;
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      signedRequest = body.signed_request;
    } else {
      // Tentar como texto
      const text = await req.text();
      const params = new URLSearchParams(text);
      signedRequest = params.get("signed_request");
    }

    if (!signedRequest) {
      console.error(`[meta-deauthorize-callback][${traceId}] Missing signed_request`);
      return new Response(JSON.stringify({ success: false, error: "Missing signed_request" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-deauthorize-callback][${traceId}] Received signed_request`);

    // Buscar META_APP_SECRET
    const { data: secretData } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_APP_SECRET")
      .eq("is_active", true)
      .single();

    if (!secretData?.credential_value) {
      console.error(`[meta-deauthorize-callback][${traceId}] META_APP_SECRET not configured`);
      return new Response(JSON.stringify({ success: false, error: "App not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appSecret = secretData.credential_value;

    // Parse e valida signed_request
    const payload = parseSignedRequest(signedRequest, appSecret);
    
    if (!payload) {
      console.error(`[meta-deauthorize-callback][${traceId}] Invalid signature`);
      return new Response(JSON.stringify({ success: false, error: "Invalid signature" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-deauthorize-callback][${traceId}] Payload validated:`, JSON.stringify(payload));

    const userId = payload.user_id;

    if (!userId) {
      console.error(`[meta-deauthorize-callback][${traceId}] Missing user_id in payload`);
      return new Response(JSON.stringify({ success: false, error: "Missing user_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Desativar todas as conexões Meta deste usuário externo
    const { data: connections, error: fetchError } = await supabase
      .from("marketplace_connections")
      .select("id, tenant_id")
      .eq("marketplace", "meta")
      .eq("external_user_id", userId)
      .eq("is_active", true);

    if (fetchError) {
      console.error(`[meta-deauthorize-callback][${traceId}] Error fetching connections:`, fetchError);
    }

    if (connections && connections.length > 0) {
      console.log(`[meta-deauthorize-callback][${traceId}] Deactivating ${connections.length} connection(s)`);

      const { error: updateError } = await supabase
        .from("marketplace_connections")
        .update({
          is_active: false,
          last_error: "Usuário revogou permissões no Meta",
          updated_at: new Date().toISOString(),
        })
        .eq("marketplace", "meta")
        .eq("external_user_id", userId);

      if (updateError) {
        console.error(`[meta-deauthorize-callback][${traceId}] Error updating connections:`, updateError);
      }

      // Também desativar WhatsApp configs associados
      for (const conn of connections) {
        await supabase
          .from("whatsapp_configs")
          .update({
            is_enabled: false,
            connection_status: "disconnected",
            last_error: "Usuário revogou permissões no Meta",
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", conn.tenant_id)
          .eq("provider", "meta");
      }

      console.log(`[meta-deauthorize-callback][${traceId}] Connections deactivated successfully`);
    } else {
      console.log(`[meta-deauthorize-callback][${traceId}] No active connections found for user ${userId}`);
    }

    // Meta espera resposta com confirmation_code para data deletion requests
    // Se for apenas deauthorize, pode retornar vazio
    const confirmationCode = crypto.randomUUID();
    const statusUrl = `https://app.comandocentral.com.br/integrations/meta/deletion-status?code=${confirmationCode}`;

    return new Response(JSON.stringify({
      url: statusUrl,
      confirmation_code: confirmationCode,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-deauthorize-callback][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Parse e valida signed_request do Meta
 * Formato: base64url(signature).base64url(payload)
 */
function parseSignedRequest(signedRequest: string, appSecret: string): Record<string, any> | null {
  try {
    const parts = signedRequest.split(".");
    if (parts.length !== 2) {
      console.error("[parseSignedRequest] Invalid format - expected 2 parts");
      return null;
    }

    const [encodedSig, encodedPayload] = parts;

    // Decode signature
    const sig = base64UrlDecode(encodedSig);
    
    // Decode payload
    const payloadStr = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadStr);

    // Validate algorithm
    if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256") {
      console.error("[parseSignedRequest] Unsupported algorithm:", payload.algorithm);
      return null;
    }

    // Calculate expected signature
    const expectedSig = createHmac("sha256", appSecret)
      .update(encodedPayload)
      .digest();

    // Compare signatures (timing-safe comparison)
    if (!timingSafeEqual(sig, expectedSig)) {
      console.error("[parseSignedRequest] Signature mismatch");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("[parseSignedRequest] Error:", error);
    return null;
  }
}

/**
 * Decode base64url to Uint8Array
 */
function base64UrlDecode(input: string): Uint8Array {
  // Convert base64url to base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }

  // Decode
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Timing-safe comparison of two Uint8Arrays
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
