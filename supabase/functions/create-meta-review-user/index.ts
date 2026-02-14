import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const VERSION = "1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[create-meta-review-user v${VERSION}] Starting...`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Credenciais para o Meta App Review
    const email = "meta-reviewer@comandocentral.com.br";
    const password = "MetaReview@2025!";
    const fullName = "Meta App Reviewer";
    const tenantId = "d1a4d0ed-8842-495e-b741-540a9a345b25"; // Respeite o Homem

    // 1. Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists:", userId);
      
      // Update password
      await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      console.log("Password updated");
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      userId = newUser.user.id;
      console.log("User created:", userId);
    }

    // 2. Upsert profile
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        full_name: fullName,
        current_tenant_id: tenantId
      }, { onConflict: "id" });

    // 3. Create viewer role (limited access, enough for content calendar)
    await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        role: "viewer",
        user_type: "editor",
        permissions: {
          marketing: true,
          media: true,
        }
      }, { onConflict: "user_id,tenant_id" });

    console.log(`[create-meta-review-user v${VERSION}] Completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Meta review user created successfully",
        credentials: {
          email,
          password,
          login_url: "https://orbit-commerce-os.lovable.app",
          navigate_to: "/media (Calendário de Conteúdo)"
        },
        tenant: "Respeite o Homem",
        user_id: userId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[create-meta-review-user v${VERSION}] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
