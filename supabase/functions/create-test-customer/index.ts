import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const email = "cliente-teste@respeiteohomem.com.br";
    const password = "Cliente@2025!";
    const tenantId = "d1a4d0ed-8842-495e-b741-540a9a345b25";

    // Check if exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);

    let userId: string;
    if (existing) {
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: "Cliente Teste" }
      });
      if (createError) throw createError;
      userId = newUser.user.id;
    }

    // Upsert profile
    await supabaseAdmin.from("profiles").upsert({
      id: userId, email, full_name: "Cliente Teste", current_tenant_id: tenantId
    }, { onConflict: "id" });

    // Create a customer record if customers table exists
    const { error: custErr } = await supabaseAdmin.from("customers").upsert({
      tenant_id: tenantId,
      email,
      name: "Cliente Teste",
      user_id: userId,
    }, { onConflict: "tenant_id,email" });

    return new Response(JSON.stringify({
      success: true,
      credentials: { email, password },
      login_url: "https://respeiteohomem.com.br/conta/login",
      customer_error: custErr?.message || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
