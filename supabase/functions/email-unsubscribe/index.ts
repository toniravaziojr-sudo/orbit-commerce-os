import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get token from query params or body
    let token: string | null = null;
    
    const url = new URL(req.url);
    token = url.searchParams.get("token");
    
    if (!token && req.method === "POST") {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "Token is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the unsubscribe token
    const { data: tokenRecord, error: tokenError } = await supabase
      .from("email_unsubscribe_tokens")
      .select("*, email_marketing_subscribers(*)")
      .eq("token", token)
      .is("used_at", null)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired unsubscribe link" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark subscriber as unsubscribed
    const { error: updateError } = await supabase
      .from("email_marketing_subscribers")
      .update({ status: "unsubscribed" })
      .eq("id", tokenRecord.subscriber_id);

    if (updateError) {
      console.error("Error unsubscribing:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to process unsubscribe" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await supabase
      .from("email_unsubscribe_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // Record event
    await supabase.from("email_events").insert({
      tenant_id: tokenRecord.tenant_id,
      subscriber_id: tokenRecord.subscriber_id,
      event_type: "unsubscribed",
      data: { method: "link", token_id: tokenRecord.id },
    });

    // Return HTML page for browser access
    if (req.method === "GET") {
      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Descadastrado com sucesso</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }
            h1 { color: #22c55e; margin-bottom: 1rem; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✓ Descadastrado</h1>
            <p>Você foi removido da nossa lista de emails com sucesso.</p>
            <p>Não receberá mais emails de marketing desta loja.</p>
          </div>
        </body>
        </html>
      `;
      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Successfully unsubscribed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
