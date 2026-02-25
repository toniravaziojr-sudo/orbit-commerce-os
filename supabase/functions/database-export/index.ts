import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Exportação de tabelas do banco para migração
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Tabelas essenciais para migração, agrupadas por prioridade
const MIGRATION_TABLES = {
  core: [
    'tenants',
    'profiles',
    'user_roles',
    'tenant_domains',
    'tenant_subscriptions',
    'tenant_monthly_usage',
  ],
  catalog: [
    'categories',
    'products',
    'product_images',
    'product_categories',
    'product_components',
    'related_products',
  ],
  customers: [
    'customers',
    'customer_addresses',
    'customer_tags',
    'customer_tag_assignments',
  ],
  orders: [
    'orders',
    'order_items',
    'order_history',
    'payment_transactions',
    'payment_events',
    'checkout_sessions',
    'checkout_testimonials',
    'shipments',
    'shipment_events',
  ],
  store: [
    'store_settings',
    'store_pages',
    'store_page_versions',
    'storefront_template_sets',
    'storefront_page_templates',
    'storefront_global_layout',
    'menus',
    'menu_items',
    'page_templates',
  ],
  marketing: [
    'email_marketing_subscribers',
    'email_marketing_lists',
    'email_marketing_list_members',
    'email_marketing_campaigns',
    'newsletter_popup_configs',
    'product_reviews',
    'discounts',
    'discount_redemptions',
  ],
  fiscal: [
    'fiscal_invoices',
    'fiscal_invoice_items',
    'fiscal_invoice_events',
  ],
  files: [
    'files',
  ],
  notifications: [
    'notification_rules',
    'notifications',
  ],
  config: [
    'plans',
    'plan_limits',
    'plan_module_access',
    'billing_plans',
    'whatsapp_configs',
    'marketing_integrations',
    'ai_support_config',
    'email_provider_configs',
  ],
};

Deno.serve(async (req) => {
  console.log(`[database-export][${VERSION}] Request received`);

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
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Token inválido" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ success: false, error: "Apenas owners podem exportar" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list_groups";
    const group = url.searchParams.get("group");
    const table = url.searchParams.get("table");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const pageSize = Math.min(parseInt(url.searchParams.get("limit") || "1000"), 1000);

    // Ação 1: Listar grupos de tabelas disponíveis
    if (action === "list_groups") {
      const groups: Record<string, { tables: string[]; description: string }> = {
        core: { tables: MIGRATION_TABLES.core, description: "Tenants, perfis e roles" },
        catalog: { tables: MIGRATION_TABLES.catalog, description: "Produtos, categorias e imagens" },
        customers: { tables: MIGRATION_TABLES.customers, description: "Clientes, endereços e tags" },
        orders: { tables: MIGRATION_TABLES.orders, description: "Pedidos, pagamentos e envios" },
        store: { tables: MIGRATION_TABLES.store, description: "Configurações da loja e templates" },
        marketing: { tables: MIGRATION_TABLES.marketing, description: "Email marketing, reviews e descontos" },
        fiscal: { tables: MIGRATION_TABLES.fiscal, description: "Notas fiscais" },
        files: { tables: MIGRATION_TABLES.files, description: "Registros de arquivos (Drive)" },
        notifications: { tables: MIGRATION_TABLES.notifications, description: "Regras e histórico de notificações" },
        config: { tables: MIGRATION_TABLES.config, description: "Planos, billing e integrações" },
      };

      return new Response(JSON.stringify({ success: true, action: "list_groups", groups }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação 2: Exportar uma tabela específica (com paginação)
    if (action === "export_table") {
      if (!table) {
        return new Response(JSON.stringify({ success: false, error: "Parâmetro 'table' é obrigatório" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar que a tabela está na lista permitida
      const allTables = Object.values(MIGRATION_TABLES).flat();
      if (!allTables.includes(table)) {
        return new Response(JSON.stringify({ success: false, error: `Tabela '${table}' não está na lista de migração` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar dados com paginação
      const { data: rows, error: queryError } = await supabase
        .from(table)
        .select("*")
        .range(offset, offset + pageSize - 1);

      if (queryError) {
        console.error(`[database-export][${VERSION}] Error querying ${table}:`, queryError);
        return new Response(JSON.stringify({ success: false, error: queryError.message }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rowCount = rows?.length || 0;
      const hasMore = rowCount === pageSize;

      console.log(`[database-export][${VERSION}] Table ${table}: ${rowCount} rows (offset ${offset})`);

      return new Response(JSON.stringify({
        success: true,
        action: "export_table",
        table,
        offset,
        limit: pageSize,
        count: rowCount,
        has_more: hasMore,
        next_offset: hasMore ? offset + pageSize : null,
        rows: rows || [],
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ação 3: Exportar um grupo inteiro (metadados apenas — para saber quantos registros)
    if (action === "export_group") {
      if (!group || !MIGRATION_TABLES[group as keyof typeof MIGRATION_TABLES]) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Parâmetro 'group' inválido",
          valid_groups: Object.keys(MIGRATION_TABLES),
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tables = MIGRATION_TABLES[group as keyof typeof MIGRATION_TABLES];
      const tableCounts: Record<string, number> = {};

      for (const t of tables) {
        const { count, error: countError } = await supabase
          .from(t)
          .select("*", { count: "exact", head: true });

        tableCounts[t] = countError ? -1 : (count || 0);
      }

      return new Response(JSON.stringify({
        success: true,
        action: "export_group",
        group,
        tables: tableCounts,
        total_rows: Object.values(tableCounts).reduce((a, b) => a + Math.max(b, 0), 0),
      }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: "Ação inválida",
      actions: ["list_groups", "export_group", "export_table"],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[database-export][${VERSION}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
