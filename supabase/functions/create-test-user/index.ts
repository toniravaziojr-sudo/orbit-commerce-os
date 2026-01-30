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

  console.log(`[create-test-user v${VERSION}] Starting...`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Credenciais específicas para testes automatizados (Lovable Browser)
    const email = "lovable-test@comandocentral.com.br";
    const password = "LovableTest@2025";
    const fullName = "Lovable Tester";
    const tenantName = "Loja Testes Automatizados";
    const tenantSlug = "lovable-testes-automatizados";

    // 1. Check if tenant already exists
    const { data: existingTenant } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .maybeSingle();

    let tenantId: string;

    if (existingTenant) {
      tenantId = existingTenant.id;
      console.log("Tenant already exists:", tenantId);
    } else {
      // Create new tenant with unlimited plan and is_special = true for full access
      const { data: newTenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: tenantName,
          slug: tenantSlug,
          plan: "unlimited",
          type: "customer",
          is_special: true, // Full access without restrictions
          next_order_number: 1001
        })
        .select()
        .single();

      if (tenantError) {
        throw new Error(`Failed to create tenant: ${tenantError.message}`);
      }

      tenantId = newTenant.id;
      console.log("Tenant created:", tenantId);
    }

    // 2. Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists:", userId);
    } else {
      // Create user via Admin API
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

    // 3. Update profile with current_tenant_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        full_name: fullName,
        current_tenant_id: tenantId
      }, { onConflict: "id" });

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // 4. Create owner role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        role: "owner"
      }, { onConflict: "user_id,tenant_id" });

    if (roleError) {
      console.error("Role creation error:", roleError);
    }

    // 5. Create minimal sample data for testing
    const categories = [
      { tenant_id: tenantId, name: "Categoria Teste", slug: "categoria-teste", is_active: true },
    ];

    await supabaseAdmin.from("categories").upsert(categories, { onConflict: "tenant_id,slug" });

    const products = [
      { 
        tenant_id: tenantId, 
        name: "Produto Teste", 
        slug: "produto-teste",
        sku: "TEST-001",
        price: 9900, 
        status: "active",
        stock_quantity: 100
      },
    ];

    await supabaseAdmin.from("products").upsert(products, { onConflict: "tenant_id,slug" });

    console.log(`[create-test-user v${VERSION}] Completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test user created successfully",
        credentials: {
          email,
          password,
          tenant: tenantName
        },
        tenant_id: tenantId,
        user_id: userId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[create-test-user v${VERSION}] Error:`, errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
