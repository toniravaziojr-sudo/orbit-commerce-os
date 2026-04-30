import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RemoveRequest {
  user_role_id: string;
}

/**
 * Remove a member (user_role) from a tenant.
 * Safeguards:
 *  - Only owners of the tenant can remove members
 *  - Cannot remove yourself
 *  - Cannot remove the last remaining owner of the tenant
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: RemoveRequest = await req.json();
    const { user_role_id } = body;

    if (!user_role_id) {
      return new Response(
        JSON.stringify({ success: false, error: "user_role_id é obrigatório" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[tenant-user-remove] User ${user.id} removing member ${user_role_id}`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the target role
    const { data: targetRole, error: targetRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, tenant_id, role")
      .eq("id", user_role_id)
      .single();

    if (targetRoleError || !targetRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Membro não encontrado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Requester must be owner of this tenant
    const { data: requesterRole, error: requesterRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", targetRole.tenant_id)
      .single();

    if (requesterRoleError || !requesterRole || requesterRole.role !== "owner") {
      return new Response(
        JSON.stringify({ success: false, error: "Apenas o proprietário pode remover membros" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cannot remove yourself
    if (targetRole.user_id === user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Você não pode remover a si mesmo" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If target is owner, ensure at least one owner remains
    if (targetRole.role === "owner") {
      const { count, error: countError } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", targetRole.tenant_id)
        .eq("role", "owner");

      if (countError) {
        console.error("[tenant-user-remove] Error counting owners:", countError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao validar proprietários" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if ((count ?? 0) <= 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Não é possível remover o último proprietário da conta",
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Delete the user_role
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("id", user_role_id);

    if (deleteError) {
      console.error("[tenant-user-remove] Error deleting role:", deleteError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao remover membro" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[tenant-user-remove] Successfully removed ${user_role_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Membro removido com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    return errorResponse(error, corsHeaders, { module: "tenant", action: "user-remove" });
  }
};

Deno.serve(handler);
