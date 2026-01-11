import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AcceptRequest {
  token: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user context
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { token }: AcceptRequest = await req.json();

    console.log(`[tenant-user-accept-invite] User ${user.id} accepting invite with token`);

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Call the database function to accept the invitation
    const { data: result, error: acceptError } = await supabaseAdmin
      .rpc('accept_invitation', {
        p_token: token,
        p_user_id: user.id,
      });

    if (acceptError) {
      console.error("[tenant-user-accept-invite] Accept error:", acceptError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao aceitar convite" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!result?.success) {
      console.log("[tenant-user-accept-invite] Invitation validation failed:", result?.error);
      return new Response(
        JSON.stringify({ success: false, error: result?.error || "Convite inválido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[tenant-user-accept-invite] Invitation accepted, tenant: ${result.tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: result.tenant_id,
        user_type: result.user_type,
        message: "Convite aceito com sucesso",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[tenant-user-accept-invite] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
