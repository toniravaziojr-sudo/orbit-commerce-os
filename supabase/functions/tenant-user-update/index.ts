import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateRequest {
  user_role_id: string;
  user_type?: string;
  permissions?: Record<string, boolean | Record<string, boolean>>;
  full_name?: string;
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
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create client with user context to get user
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: UpdateRequest = await req.json();
    const { user_role_id, user_type, permissions, full_name } = body;

    if (!user_role_id) {
      return new Response(
        JSON.stringify({ success: false, error: "user_role_id é obrigatório" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[tenant-user-update] User ${user.id} updating member ${user_role_id}`);

    // Create admin client for operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the target user_role to find tenant_id and user_id
    const { data: targetRole, error: targetRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('id, user_id, tenant_id, role')
      .eq('id', user_role_id)
      .single();

    if (targetRoleError || !targetRole) {
      console.error("[tenant-user-update] Target role not found:", targetRoleError);
      return new Response(
        JSON.stringify({ success: false, error: "Membro não encontrado" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if requester is owner of the tenant
    const { data: requesterRole, error: requesterRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', targetRole.tenant_id)
      .single();

    if (requesterRoleError || !requesterRole || requesterRole.role !== 'owner') {
      console.log("[tenant-user-update] Requester is not owner:", requesterRoleError);
      return new Response(
        JSON.stringify({ success: false, error: "Apenas o proprietário pode editar membros" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Cannot edit the owner role
    if (targetRole.role === 'owner') {
      return new Response(
        JSON.stringify({ success: false, error: "Não é possível editar o proprietário" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update user_roles (user_type and permissions)
    if (user_type !== undefined || permissions !== undefined) {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (user_type !== undefined) updateData.user_type = user_type;
      if (permissions !== undefined) updateData.permissions = permissions;

      const { error: updateRoleError } = await supabaseAdmin
        .from('user_roles')
        .update(updateData)
        .eq('id', user_role_id);

      if (updateRoleError) {
        console.error("[tenant-user-update] Error updating role:", updateRoleError);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao atualizar permissões" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Update profile name (service role bypasses RLS)
    if (full_name !== undefined) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name: full_name || null })
        .eq('id', targetRole.user_id);

      if (profileError) {
        console.error("[tenant-user-update] Error updating profile:", profileError);
        // Don't fail entirely - role was updated
        return new Response(
          JSON.stringify({ success: true, warning: "Permissões atualizadas, mas erro ao atualizar nome" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`[tenant-user-update] Successfully updated member ${user_role_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Membro atualizado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[tenant-user-update] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
