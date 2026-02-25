import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Importação de dados do banco a partir de JSON exportado
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Ordem de importação para respeitar foreign keys
const IMPORT_ORDER = [
  // Core primeiro
  'tenants', 'profiles', 'user_roles', 'tenant_domains', 'tenant_subscriptions', 'tenant_monthly_usage',
  // Planos e config
  'plans', 'plan_limits', 'plan_module_access', 'billing_plans',
  // Catálogo
  'categories', 'products', 'product_images', 'product_categories', 'product_components', 'related_products',
  // Clientes
  'customers', 'customer_addresses', 'customer_tags', 'customer_tag_assignments',
  // Pedidos
  'orders', 'order_items', 'order_history', 'payment_transactions', 'payment_events',
  'checkout_sessions', 'checkout_testimonials', 'shipments', 'shipment_events',
  // Loja
  'store_settings', 'store_pages', 'store_page_versions', 'storefront_template_sets',
  'storefront_page_templates', 'storefront_global_layout', 'menus', 'menu_items', 'page_templates',
  // Marketing
  'email_marketing_subscribers', 'email_marketing_lists', 'email_marketing_list_members',
  'email_marketing_campaigns', 'newsletter_popup_configs', 'product_reviews', 'discounts', 'discount_redemptions',
  // Fiscal
  'fiscal_invoices', 'fiscal_invoice_items', 'fiscal_invoice_events',
  // Files
  'files',
  // Notifications
  'notification_rules', 'notifications',
  // Config
  'whatsapp_configs', 'marketing_integrations', 'ai_support_config', 'email_provider_configs',
];

Deno.serve(async (req) => {
  console.log(`[database-import][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verificar auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se é owner
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1);

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Apenas owners podem importar" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    const body = await req.json();
    const { action } = body;

    // Ação 1: Importar uma tabela específica
    if (action === "import_table") {
      const { table, rows } = body;

      if (!table || !rows || !Array.isArray(rows)) {
        return new Response(JSON.stringify({ success: false, error: "Parâmetros 'table' e 'rows' são obrigatórios" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar que a tabela está na lista permitida
      if (!IMPORT_ORDER.includes(table)) {
        return new Response(JSON.stringify({ success: false, error: `Tabela '${table}' não é permitida para importação` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rows.length === 0) {
        return new Response(JSON.stringify({ success: true, action: "import_table", table, imported: 0, errors: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Importar em batches de 100 com upsert
      const BATCH_SIZE = 100;
      let imported = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        const { error: upsertError, data: upsertData } = await supabase
          .from(table)
          .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

        if (upsertError) {
          console.error(`[database-import][${VERSION}] Error upserting ${table} batch ${i}:`, upsertError);
          errors.push(`Batch ${i}-${i + batch.length}: ${upsertError.message}`);
        } else {
          imported += batch.length;
        }
      }

      console.log(`[database-import][${VERSION}] Table ${table}: ${imported} imported, ${errors.length} errors`);

      return new Response(JSON.stringify({
        success: true,
        action: "import_table",
        table,
        imported,
        total_sent: rows.length,
        errors,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação 2: Retornar a ordem de importação
    if (action === "get_import_order") {
      return new Response(JSON.stringify({
        success: true,
        action: "get_import_order",
        order: IMPORT_ORDER,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: "Ação inválida",
      actions: ["import_table", "get_import_order"],
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[database-import][${VERSION}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
