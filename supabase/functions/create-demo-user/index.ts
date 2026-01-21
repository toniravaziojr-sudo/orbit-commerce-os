import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const email = "shopee-avaliacao@comandocentral.com.br";
    const password = "ShopeeDemo@2025";
    const fullName = "Avaliador Shopee";
    const tenantName = "Loja Demo Shopee";
    const tenantSlug = "loja-demo-shopee";

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
      // Create new tenant with unlimited plan
      const { data: newTenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: tenantName,
          slug: tenantSlug,
          plan: "unlimited", // Full access
          type: "customer",
          is_special: false, // NOT special = no status indicators
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

    // 5. Create sample data for the demo tenant
    // Create some categories
    const categories = [
      { tenant_id: tenantId, name: "Eletrônicos", slug: "eletronicos", is_active: true },
      { tenant_id: tenantId, name: "Moda", slug: "moda", is_active: true },
      { tenant_id: tenantId, name: "Casa e Decoração", slug: "casa-decoracao", is_active: true },
    ];

    await supabaseAdmin.from("categories").upsert(categories, { onConflict: "tenant_id,slug" });

    // Create some products
    const products = [
      { 
        tenant_id: tenantId, 
        name: "Smartphone Galaxy Pro", 
        slug: "smartphone-galaxy-pro",
        sku: "DEMO-001",
        price: 199900, 
        compare_at_price: 249900,
        status: "active",
        stock_quantity: 50
      },
      { 
        tenant_id: tenantId, 
        name: "Fone de Ouvido Bluetooth", 
        slug: "fone-bluetooth",
        sku: "DEMO-002",
        price: 15990, 
        compare_at_price: 19990,
        status: "active",
        stock_quantity: 100
      },
      { 
        tenant_id: tenantId, 
        name: "Camiseta Premium", 
        slug: "camiseta-premium",
        sku: "DEMO-003",
        price: 8990, 
        status: "active",
        stock_quantity: 200
      },
      { 
        tenant_id: tenantId, 
        name: "Relógio Smart Watch", 
        slug: "smart-watch",
        sku: "DEMO-004",
        price: 49900, 
        compare_at_price: 59900,
        status: "active",
        stock_quantity: 30
      },
      { 
        tenant_id: tenantId, 
        name: "Luminária LED Decorativa", 
        slug: "luminaria-led",
        sku: "DEMO-005",
        price: 12990, 
        status: "active",
        stock_quantity: 75
      },
    ];

    await supabaseAdmin.from("products").upsert(products, { onConflict: "tenant_id,slug" });

    // Create some customers
    const customers = [
      { tenant_id: tenantId, email: "cliente1@exemplo.com", full_name: "Maria Silva", status: "active" },
      { tenant_id: tenantId, email: "cliente2@exemplo.com", full_name: "João Santos", status: "active" },
      { tenant_id: tenantId, email: "cliente3@exemplo.com", full_name: "Ana Oliveira", status: "active" },
    ];

    await supabaseAdmin.from("customers").upsert(customers, { onConflict: "tenant_id,email" });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Demo environment created successfully",
        credentials: {
          url: "https://app.comandocentral.com.br",
          email,
          password,
          tenant: tenantName
        },
        info: {
          products: products.length,
          categories: categories.length,
          customers: customers.length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
