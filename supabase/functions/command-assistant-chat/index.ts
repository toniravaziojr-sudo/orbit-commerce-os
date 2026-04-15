import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getAIEndpoint, aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v4.0.0"; // Full system coverage: ~150 tools across all modules
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== READ TOOLS (auto-executed server-side) ====================
const READ_TOOLS = new Set([
  "searchProducts", "listProducts", "getProductDetails", "listProductComponents", "findKitsContainingProduct", "listKitsSummary",
  "searchOrders", "getOrderDetails", "listDiscounts", "listCategories",
  "getDashboardStats", "getTopProducts", "listCustomerTags", "searchCustomers",
  "listBlogPosts", "listOffers", "listReviews", "listPages",
  "getFinancialSummary", "listShippingMethods", "listNotifications",
  "listFiles", "getStorageUsage", "listEmailLists", "listSubscribers",
  "listCampaigns", "listAgendaTasks", "inventoryReport", "customersReport", "salesReport",
  // v4.0.0: New read tools
  "listFiscalDrafts", "getFiscalDraftDetails", "listFiscalInvoices", "getFiscalInvoiceDetails",
  "listShipments", "getShipmentDetails",
  "listPurchases", "getPurchaseDetails",
  "listTeamMembers", "getTeamMemberDetails",
  "listIntegrations",
  "listSupportTickets", "getSupportTicketDetails",
  "listAutomations", "getAutomationDetails",
  "getCampaignDetails", "listEmailTemplates", "getCampaignStats",
  "listCheckoutLinks", "getCheckoutLinkDetails",
  "listAffiliates", "getAffiliateDetails", "listAffiliatePayouts",
  "listSocialPosts", "getSocialPostDetails",
  "listDomains", "getStoreDetails",
  "listPotentialCustomers", "getPotentialCustomerDetails",
  "listProductVariants",
]);

// ==================== PERMISSION MAP for read tools ====================
const READ_PERMISSION_MAP: Record<string, string[]> = {
  searchProducts: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  listProducts: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  getProductDetails: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  listProductComponents: ["owner", "admin", "manager", "editor", "viewer"],
  findKitsContainingProduct: ["owner", "admin", "manager", "editor", "viewer"],
  listKitsSummary: ["owner", "admin", "manager", "editor", "viewer"],
  searchOrders: ["owner", "admin", "manager", "attendant", "viewer"],
  getOrderDetails: ["owner", "admin", "manager", "attendant", "viewer"],
  listDiscounts: ["owner", "admin", "manager", "viewer"],
  listCategories: ["owner", "admin", "manager", "editor", "attendant", "viewer"],
  getDashboardStats: ["owner", "admin", "manager", "viewer"],
  getTopProducts: ["owner", "admin", "manager", "viewer"],
  listCustomerTags: ["owner", "admin", "manager", "attendant", "viewer"],
  searchCustomers: ["owner", "admin", "manager", "attendant", "viewer"],
  listBlogPosts: ["owner", "admin", "manager", "editor", "viewer"],
  listOffers: ["owner", "admin", "manager", "viewer"],
  listReviews: ["owner", "admin", "manager", "attendant", "viewer"],
  listPages: ["owner", "admin", "manager", "editor", "viewer"],
  getFinancialSummary: ["owner", "admin", "manager", "viewer"],
  listShippingMethods: ["owner", "admin", "manager", "viewer"],
  listNotifications: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  listFiles: ["owner", "admin", "manager", "editor", "viewer"],
  getStorageUsage: ["owner", "admin", "manager", "viewer"],
  listEmailLists: ["owner", "admin", "manager"],
  listSubscribers: ["owner", "admin", "manager"],
  listCampaigns: ["owner", "admin", "manager", "viewer"],
  listAgendaTasks: ["owner", "admin", "manager", "editor", "attendant", "assistant", "viewer"],
  inventoryReport: ["owner", "admin", "manager", "editor", "viewer"],
  customersReport: ["owner", "admin", "manager", "viewer"],
  salesReport: ["owner", "admin", "manager", "editor", "viewer"],
};

// ==================== OpenAI-format tool definitions for read tools ====================
const OPENAI_READ_TOOLS = [
  {
    type: "function",
    function: {
      name: "searchProducts",
      description: "Buscar produtos por nome ou SKU. Prioriza match exato no nome, exclui kits por padrão. Se o query parecer um SKU (numérico ou curto), busca por SKU exato primeiro.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca (nome ou SKU)" },
          categoryId: { type: "string", description: "Filtrar por categoria (opcional)" },
          limit: { type: "number", description: "Limite de resultados (padrão 20)" },
          excludeKits: { type: "boolean", description: "Excluir kits/composições (padrão true)" },
          exactMatch: { type: "boolean", description: "Priorizar match exato no nome (padrão true)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listProducts",
      description: "Listar produtos com filtros. Use productFormat para filtrar por tipo: 'simple' (produtos simples), 'with_composition' (kits), 'with_variants' (com variantes). Use excludeKits=true para excluir kits.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "active, inactive, all" },
          categoryId: { type: "string", description: "Filtrar por categoria" },
          minPrice: { type: "number", description: "Preço mínimo em reais" },
          maxPrice: { type: "number", description: "Preço máximo em reais" },
          limit: { type: "number", description: "Limite (padrão 20, máx 100)" },
          orderBy: { type: "string", description: "name, price, created_at, stock_quantity" },
          productFormat: { type: "string", description: "Filtrar por formato: simple, with_composition, with_variants" },
          excludeKits: { type: "boolean", description: "Se true, exclui produtos com composição (kits). Padrão false" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getProductDetails",
      description: "Ver detalhes completos de um produto (nome, preço, estoque, SKU, categorias, dimensões, SEO)",
      parameters: {
        type: "object",
        properties: {
          productId: { type: "string", description: "ID do produto" },
        },
        required: ["productId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listProductComponents",
      description: "Listar componentes/composição de um kit (dado o ID do kit pai)",
      parameters: {
        type: "object",
        properties: {
          parentProductId: { type: "string", description: "ID do produto kit (pai)" },
        },
        required: ["parentProductId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "findKitsContainingProduct",
      description: "Busca inversa: dado um produto simples (componente), encontra TODOS os kits que o contêm. Use ANTES de recalculateKitPrices para saber quais kits serão afetados.",
      parameters: {
        type: "object",
        properties: {
          componentProductId: { type: "string", description: "ID do produto simples (componente)" },
        },
        required: ["componentProductId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listKitsSummary",
      description: "Lista TODOS os kits do tenant com resumo: nome, SKU, preço, status de frete grátis, quantidade total de unidades (soma das quantidades dos componentes). Use quando o usuário pedir para listar kits, verificar frete grátis, ou aplicar descontos por faixa de unidades.",
      parameters: {
        type: "object",
        properties: {
          minUnits: { type: "number", description: "Filtrar kits com no mínimo X unidades totais (opcional)" },
          maxUnits: { type: "number", description: "Filtrar kits com no máximo X unidades totais (opcional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchOrders",
      description: "Buscar pedidos por número, nome do cliente, status ou período",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Número do pedido ou nome do cliente" },
          status: { type: "string", description: "pending, paid, shipped, delivered, cancelled" },
          startDate: { type: "string", description: "Data início (ISO)" },
          endDate: { type: "string", description: "Data fim (ISO)" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getOrderDetails",
      description: "Ver detalhes completos de um pedido",
      parameters: {
        type: "object",
        properties: {
          orderId: { type: "string", description: "ID do pedido" },
        },
        required: ["orderId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listDiscounts",
      description: "Listar cupons de desconto",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "active, inactive, all" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listCategories",
      description: "Listar categorias de produtos",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "active, inactive, all" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDashboardStats",
      description: "Obter estatísticas do dashboard: receita, pedidos, ticket médio",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "today, week, month, year" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getTopProducts",
      description: "Ver os produtos mais vendidos",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "week, month, year" },
          limit: { type: "number", description: "Quantidade (padrão 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listCustomerTags",
      description: "Listar tags de clientes disponíveis",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "searchCustomers",
      description: "Buscar clientes por nome, email ou telefone",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listBlogPosts",
      description: "Listar posts do blog",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "draft, published, all" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listOffers",
      description: "Listar ofertas de bump/upsell",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "bump, upsell, all" },
          status: { type: "string", description: "active, inactive, all" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listReviews",
      description: "Listar avaliações de produtos",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "pending, approved, rejected, all" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listPages",
      description: "Listar páginas institucionais",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "published, draft, all" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getFinancialSummary",
      description: "Ver resumo financeiro (receita, custos, lucro)",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "today, week, month, year" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listShippingMethods",
      description: "Listar métodos de frete configurados",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "listNotifications",
      description: "Listar notificações recentes",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Limite (padrão 20)" },
          unreadOnly: { type: "boolean", description: "Apenas não lidas" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listFiles",
      description: "Listar arquivos do drive/mídia",
      parameters: {
        type: "object",
        properties: {
          folder: { type: "string", description: "Pasta (ex: products, blog)" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getStorageUsage",
      description: "Ver uso de armazenamento do drive",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "listEmailLists",
      description: "Listar listas de email marketing",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "listSubscribers",
      description: "Listar inscritos de uma lista de email",
      parameters: {
        type: "object",
        properties: {
          listId: { type: "string", description: "ID da lista" },
          status: { type: "string", description: "active, unsubscribed, all" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: ["listId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listCampaigns",
      description: "Listar campanhas de email marketing",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "draft, active, completed, all" },
          limit: { type: "number", description: "Limite (padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listAgendaTasks",
      description: "Listar tarefas da agenda",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "pending, done, all" },
          limit: { type: "number", description: "Limite de resultados" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventoryReport",
      description: "Relatório de estoque (baixo, zerado)",
      parameters: {
        type: "object",
        properties: {
          lowStockThreshold: { type: "number", description: "Limite para considerar estoque baixo" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "customersReport",
      description: "Relatório de clientes (total, novos no período)",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "week, month, year" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salesReport",
      description: "Relatório de vendas por período",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "today, week, month, custom" },
          startDate: { type: "string", description: "Data início (para custom)" },
          endDate: { type: "string", description: "Data fim (para custom)" },
        },
        required: ["period"],
      },
    },
  },
];

// ==================== Execute read tool server-side ====================
async function executeReadTool(
  supabase: any,
  tenantId: string,
  userId: string,
  toolName: string,
  toolArgs: any,
  userAuthToken: string
): Promise<string> {
  // Call the execute function via HTTP using the user's original auth token
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/command-assistant-execute`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${userAuthToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversation_id: "internal-tool-call",
      tenant_id: tenantId,
      tool_name: toolName,
      tool_args: toolArgs,
      action_id: `auto-read-${crypto.randomUUID()}`,
    }),
  });

  const result = await response.json();
  
  if (result.success) {
    // CRITICAL: Return BOTH the human-readable message AND the raw data with IDs
    // The AI needs the real UUIDs to use in write operations
    const message = result.message || "";
    const data = result.data;
    if (data && (Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0)) {
      return `${message}\n\n[DADOS_INTERNOS_JSON]: ${JSON.stringify(data)}`;
    }
    return message || JSON.stringify(data || {});
  } else {
    return `Erro: ${result.error || "Falha ao executar consulta"}`;
  }
}

// Extended Tool registry - defines ALL available actions (for system prompt)
const TOOL_REGISTRY = {
  // === PRODUTOS ===
  bulkUpdateProductsNCM: {
    description: "Atualizar NCM de todos os produtos ou produtos filtrados",
    parameters: {
      ncm: { type: "string", required: true, description: "Código NCM (8 dígitos)" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional, se vazio aplica a todos)" },
    },
    requiredPermission: "products",
  },
  bulkUpdateProductsCEST: {
    description: "Atualizar CEST de todos os produtos",
    parameters: {
      cest: { type: "string", required: true, description: "Código CEST" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
    },
    requiredPermission: "products",
  },
  bulkUpdateProductsPrice: {
    description: "Atualizar preços de produtos (aumento/desconto percentual, valor fixo, ou aplicar desconto promocional criando preço de/por)",
    parameters: {
      type: { type: "string", required: true, description: "percent_increase, percent_decrease, fixed, apply_discount (cria preço de/por)" },
      value: { type: "number", required: false, description: "Valor percentual (para percent_increase/percent_decrease/apply_discount)" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
      categoryId: { type: "string", required: false, description: "Filtrar por categoria" },
      productFormat: { type: "string", required: false, description: "Filtrar por formato: simple, with_composition, with_variants" },
      excludeKits: { type: "boolean", required: false, description: "Se true, exclui kits (with_composition)" },
      prices: { type: "array", required: false, description: "Para definir preços individuais: [{productId, price}]. Usar com type='fixed'" },
      removeCompareAtPrice: { type: "boolean", required: false, description: "Se true, remove o preço de desconto (compare_at_price) dos produtos" },
    },
    requiredPermission: "products",
  },
  bulkUpdateProductsStock: {
    description: "Atualizar estoque de produtos",
    parameters: {
      operation: { type: "string", required: true, description: "set, add, subtract" },
      quantity: { type: "number", required: true, description: "Quantidade" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
    },
    requiredPermission: "products",
  },
  bulkUpdateProductsFreeShipping: {
    description: "Ativar ou desativar frete grátis em produtos em massa. Pode filtrar por formato (kits, simples), categoria, IDs específicos, ou por quantidade mínima de unidades totais na composição (soma das quantidades dos componentes).",
    parameters: {
      freeShipping: { type: "boolean", required: true, description: "true para ativar frete grátis, false para desativar" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
      categoryId: { type: "string", required: false, description: "Filtrar por categoria" },
      productFormat: { type: "string", required: false, description: "Filtrar por formato: simple, with_composition, with_variants" },
      minComponents: { type: "number", required: false, description: "Filtrar kits com no mínimo N unidades totais na composição (soma das quantidades). Ex: minComponents=3 inclui tanto kits com 3 componentes diferentes quanto kits com 1 produto em quantidade 3" },
    },
    requiredPermission: "products",
  },
  bulkActivateProducts: {
    description: "Ativar ou desativar produtos em massa",
    parameters: {
      isActive: { type: "boolean", required: true, description: "true para ativar, false para desativar" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
      categoryId: { type: "string", required: false, description: "Filtrar por categoria" },
    },
    requiredPermission: "products",
  },
  createProduct: {
    description: "Criar um novo produto com todos os campos disponíveis",
    parameters: {
      name: { type: "string", required: true, description: "Nome do produto" },
      price: { type: "number", required: true, description: "Preço em reais" },
      sku: { type: "string", required: false, description: "SKU do produto" },
      description: { type: "string", required: false, description: "Descrição completa" },
      shortDescription: { type: "string", required: false, description: "Descrição curta" },
      categoryId: { type: "string", required: false, description: "ID da categoria" },
      stockQuantity: { type: "number", required: false, description: "Quantidade em estoque" },
      brand: { type: "string", required: false, description: "Marca" },
      vendor: { type: "string", required: false, description: "Fornecedor" },
      barcode: { type: "string", required: false, description: "Código de barras" },
      gtin: { type: "string", required: false, description: "GTIN/EAN" },
      costPrice: { type: "number", required: false, description: "Preço de custo em reais" },
      weight: { type: "number", required: false, description: "Peso em gramas" },
      width: { type: "number", required: false, description: "Largura em cm" },
      height: { type: "number", required: false, description: "Altura em cm" },
      length: { type: "number", required: false, description: "Comprimento em cm" },
      depth: { type: "number", required: false, description: "Profundidade em cm" },
      freeShipping: { type: "boolean", required: false, description: "Frete grátis" },
      requiresShipping: { type: "boolean", required: false, description: "Requer envio físico" },
      isFeatured: { type: "boolean", required: false, description: "Produto destaque" },
      tags: { type: "array", required: false, description: "Tags do produto (array de strings)" },
      warrantyType: { type: "string", required: false, description: "Tipo de garantia: seller, manufacturer, none" },
      warrantyDuration: { type: "string", required: false, description: "Duração (ex: '30 dias', '1 ano')" },
      ncmCode: { type: "string", required: false, description: "Código NCM" },
      cestCode: { type: "string", required: false, description: "Código CEST" },
      originCode: { type: "string", required: false, description: "Código de origem fiscal" },
      taxable: { type: "boolean", required: false, description: "Tributável" },
      manageStock: { type: "boolean", required: false, description: "Controlar estoque" },
      allowBackorder: { type: "boolean", required: false, description: "Permitir venda sem estoque" },
      seoTitle: { type: "string", required: false, description: "Título SEO" },
      seoDescription: { type: "string", required: false, description: "Descrição SEO" },
      metaKeywords: { type: "string", required: false, description: "Keywords SEO" },
    },
    requiredPermission: "products",
  },
  deleteProducts: {
    description: "Excluir produtos",
    parameters: {
      productIds: { type: "array", required: true, description: "IDs dos produtos a excluir" },
    },
    requiredPermission: "products",
  },
  createCategory: {
    description: "Criar uma nova categoria de produtos",
    parameters: {
      name: { type: "string", required: true, description: "Nome da categoria" },
      slug: { type: "string", required: false, description: "Slug para URL" },
      description: { type: "string", required: false, description: "Descrição da categoria" },
      parentId: { type: "string", required: false, description: "ID da categoria pai" },
    },
    requiredPermission: "products",
  },
  updateCategory: {
    description: "Atualizar uma categoria existente",
    parameters: {
      categoryId: { type: "string", required: true, description: "ID da categoria" },
      name: { type: "string", required: false, description: "Novo nome" },
      description: { type: "string", required: false, description: "Nova descrição" },
      isActive: { type: "boolean", required: false, description: "Ativar/desativar" },
    },
    requiredPermission: "products",
  },
  deleteCategory: {
    description: "Excluir uma categoria",
    parameters: {
      categoryId: { type: "string", required: true, description: "ID da categoria" },
    },
    requiredPermission: "products",
  },
  createDiscount: {
    description: "Criar um novo cupom de desconto",
    parameters: {
      name: { type: "string", required: true, description: "Nome do cupom" },
      code: { type: "string", required: true, description: "Código do cupom" },
      type: { type: "string", required: true, description: "percent ou fixed" },
      value: { type: "number", required: true, description: "Valor do desconto" },
      minSubtotal: { type: "number", required: false, description: "Subtotal mínimo" },
      startsAt: { type: "string", required: false, description: "Data de início" },
      endsAt: { type: "string", required: false, description: "Data de fim" },
      usageLimit: { type: "number", required: false, description: "Limite de usos" },
    },
    requiredPermission: "discounts",
  },
  updateDiscount: {
    description: "Atualizar um cupom existente",
    parameters: {
      discountId: { type: "string", required: true, description: "ID do cupom" },
      isActive: { type: "boolean", required: false, description: "Ativar/desativar" },
      value: { type: "number", required: false, description: "Novo valor" },
      endsAt: { type: "string", required: false, description: "Nova data de fim" },
    },
    requiredPermission: "discounts",
  },
  deleteDiscount: {
    description: "Excluir um cupom",
    parameters: {
      discountId: { type: "string", required: true, description: "ID do cupom" },
    },
    requiredPermission: "discounts",
  },
  updateOrderStatus: {
    description: "Atualizar status de um pedido",
    parameters: {
      orderId: { type: "string", required: true, description: "ID do pedido" },
      status: { type: "string", required: true, description: "Novo status" },
    },
    requiredPermission: "orders",
  },
  bulkUpdateOrderStatus: {
    description: "Atualizar status de múltiplos pedidos",
    parameters: {
      orderIds: { type: "array", required: true, description: "IDs dos pedidos" },
      status: { type: "string", required: true, description: "Novo status" },
    },
    requiredPermission: "orders",
  },
  addOrderNote: {
    description: "Adicionar observação a um pedido",
    parameters: {
      orderId: { type: "string", required: true, description: "ID do pedido" },
      note: { type: "string", required: true, description: "Texto da observação" },
    },
    requiredPermission: "orders",
  },
  createCustomer: {
    description: "Criar um novo cliente",
    parameters: {
      name: { type: "string", required: true, description: "Nome" },
      email: { type: "string", required: true, description: "Email" },
      phone: { type: "string", required: false, description: "Telefone" },
      cpf: { type: "string", required: false, description: "CPF" },
    },
    requiredPermission: "customers",
  },
  updateCustomer: {
    description: "Atualizar dados de um cliente",
    parameters: {
      customerId: { type: "string", required: true, description: "ID do cliente" },
      name: { type: "string", required: false, description: "Novo nome" },
      email: { type: "string", required: false, description: "Novo email" },
      phone: { type: "string", required: false, description: "Novo telefone" },
    },
    requiredPermission: "customers",
  },
  addCustomerTag: {
    description: "Adicionar tag a clientes",
    parameters: {
      customerIds: { type: "array", required: true, description: "IDs dos clientes" },
      tagId: { type: "string", required: true, description: "ID da tag" },
    },
    requiredPermission: "customers",
  },
  createAgendaTask: {
    description: "Criar tarefa na Agenda",
    parameters: {
      title: { type: "string", required: true, description: "Título da tarefa" },
      dueAt: { type: "string", required: true, description: "Data/hora de vencimento" },
      description: { type: "string", required: false, description: "Descrição" },
      reminderOffsets: { type: "array", required: false, description: "Offsets de lembretes em minutos" },
    },
    requiredPermission: null,
  },
  completeTask: {
    description: "Marcar tarefa como concluída",
    parameters: {
      taskId: { type: "string", required: true, description: "ID da tarefa" },
    },
    requiredPermission: null,
  },
  updateShippingSettings: {
    description: "Atualizar configurações de frete",
    parameters: {
      freeShippingThreshold: { type: "number", required: false, description: "Valor mínimo para frete grátis" },
      defaultShippingPrice: { type: "number", required: false, description: "Preço padrão do frete" },
    },
    requiredPermission: "shipping",
  },
  updateStoreSettings: {
    description: "Atualizar configurações gerais da loja",
    parameters: {
      storeName: { type: "string", required: false, description: "Nome da loja" },
      storeEmail: { type: "string", required: false, description: "Email da loja" },
      storePhone: { type: "string", required: false, description: "Telefone da loja" },
    },
    requiredPermission: "settings",
  },
  addProductComponent: {
    description: "Adicionar componente a um kit",
    parameters: {
      parentProductId: { type: "string", required: true, description: "ID do kit (pai)" },
      componentProductId: { type: "string", required: true, description: "ID do componente" },
      quantity: { type: "number", required: true, description: "Quantidade" },
    },
    requiredPermission: "products",
  },
  removeProductComponent: {
    description: "Remover componente de um kit",
    parameters: {
      parentProductId: { type: "string", required: true, description: "ID do kit" },
      componentProductId: { type: "string", required: true, description: "ID do componente" },
    },
    requiredPermission: "products",
  },
  bulkSetCompositionType: {
    description: "Alterar tipo de composição de kits em massa",
    parameters: {
      stockType: { type: "string", required: true, description: "physical ou virtual" },
      productIds: { type: "array", required: false, description: "IDs específicos" },
    },
    requiredPermission: "products",
  },
  autoCreateKitCompositions: {
    description: "Detectar kits sem composição",
    parameters: {},
    requiredPermission: "products",
  },
  updateProduct: {
    description: "Editar qualquer campo de um produto (identificação, preços, estoque, logística, fiscal, garantia, SEO, tags)",
    parameters: {
      productId: { type: "string", required: true, description: "ID do produto" },
      name: { type: "string", required: false, description: "Novo nome" },
      description: { type: "string", required: false, description: "Nova descrição" },
      shortDescription: { type: "string", required: false, description: "Descrição curta" },
      price: { type: "number", required: false, description: "Novo preço em reais" },
      compareAtPrice: { type: "number", required: false, description: "Preço original (de)" },
      costPrice: { type: "number", required: false, description: "Preço de custo" },
      sku: { type: "string", required: false, description: "Novo SKU" },
      barcode: { type: "string", required: false, description: "Código de barras" },
      gtin: { type: "string", required: false, description: "GTIN/EAN" },
      brand: { type: "string", required: false, description: "Marca" },
      vendor: { type: "string", required: false, description: "Fornecedor" },
      weight: { type: "number", required: false, description: "Peso em gramas" },
      width: { type: "number", required: false, description: "Largura em cm" },
      height: { type: "number", required: false, description: "Altura em cm" },
      length: { type: "number", required: false, description: "Comprimento em cm" },
      depth: { type: "number", required: false, description: "Profundidade em cm" },
      seoTitle: { type: "string", required: false, description: "Título SEO" },
      seoDescription: { type: "string", required: false, description: "Descrição SEO" },
      metaKeywords: { type: "string", required: false, description: "Keywords SEO" },
      isActive: { type: "boolean", required: false, description: "Ativar/desativar" },
      isFeatured: { type: "boolean", required: false, description: "Produto destaque" },
      stockQuantity: { type: "number", required: false, description: "Quantidade em estoque" },
      manageStock: { type: "boolean", required: false, description: "Controlar estoque" },
      lowStockThreshold: { type: "number", required: false, description: "Limite para alerta de estoque baixo" },
      allowBackorder: { type: "boolean", required: false, description: "Permitir venda sem estoque" },
      freeShipping: { type: "boolean", required: false, description: "Frete grátis" },
      requiresShipping: { type: "boolean", required: false, description: "Requer envio físico" },
      tags: { type: "array", required: false, description: "Tags do produto (array de strings)" },
      warrantyType: { type: "string", required: false, description: "Tipo: seller, manufacturer, none" },
      warrantyDuration: { type: "string", required: false, description: "Duração (ex: '30 dias')" },
      ncmCode: { type: "string", required: false, description: "Código NCM" },
      cestCode: { type: "string", required: false, description: "Código CEST" },
      originCode: { type: "string", required: false, description: "Código de origem fiscal" },
      taxable: { type: "boolean", required: false, description: "Tributável" },
      taxCode: { type: "string", required: false, description: "Código fiscal" },
      promotionStartDate: { type: "string", required: false, description: "Data início promoção (ISO)" },
      promotionEndDate: { type: "string", required: false, description: "Data fim promoção (ISO)" },
      regulatoryInfo: { type: "object", required: false, description: "Info regulatória (ANVISA, AFE, etc.) como JSON" },
    },
    requiredPermission: "products",
  },
  duplicateProduct: {
    description: "Duplicar um produto existente",
    parameters: {
      productId: { type: "string", required: true, description: "ID do produto a duplicar" },
    },
    requiredPermission: "products",
  },
  deleteCustomer: {
    description: "Excluir um cliente (soft delete)",
    parameters: {
      customerId: { type: "string", required: true, description: "ID do cliente" },
    },
    requiredPermission: "customers",
  },
  addTrackingCode: {
    description: "Adicionar código de rastreio a um pedido",
    parameters: {
      orderId: { type: "string", required: true, description: "ID do pedido" },
      trackingCode: { type: "string", required: true, description: "Código de rastreio" },
      shippingCarrier: { type: "string", required: false, description: "Transportadora" },
    },
    requiredPermission: "orders",
  },
  cancelOrder: {
    description: "Cancelar um pedido",
    parameters: {
      orderId: { type: "string", required: true, description: "ID do pedido" },
      reason: { type: "string", required: false, description: "Motivo do cancelamento" },
    },
    requiredPermission: "orders",
  },
  createManualOrder: {
    description: "Criar um pedido manual",
    parameters: {
      customerEmail: { type: "string", required: true, description: "Email do cliente" },
      customerName: { type: "string", required: true, description: "Nome do cliente" },
      items: { type: "array", required: true, description: "Array de {productId, quantity}" },
      notes: { type: "string", required: false, description: "Observações" },
    },
    requiredPermission: "orders",
  },
  createCustomerTag: {
    description: "Criar nova tag de cliente",
    parameters: {
      name: { type: "string", required: true, description: "Nome da tag" },
      color: { type: "string", required: false, description: "Cor hex" },
      description: { type: "string", required: false, description: "Descrição" },
    },
    requiredPermission: "customers",
  },
  removeCustomerTag: {
    description: "Remover tag de clientes",
    parameters: {
      customerIds: { type: "array", required: true, description: "IDs dos clientes" },
      tagId: { type: "string", required: true, description: "ID da tag" },
    },
    requiredPermission: "customers",
  },
  createBlogPost: {
    description: "Criar post no blog",
    parameters: {
      title: { type: "string", required: true, description: "Título" },
      content: { type: "string", required: true, description: "Conteúdo" },
      excerpt: { type: "string", required: false, description: "Resumo" },
      status: { type: "string", required: false, description: "draft ou published" },
    },
    requiredPermission: "blog",
  },
  updateBlogPost: {
    description: "Editar post do blog",
    parameters: {
      postId: { type: "string", required: true, description: "ID do post" },
      title: { type: "string", required: false, description: "Novo título" },
      content: { type: "string", required: false, description: "Novo conteúdo" },
      status: { type: "string", required: false, description: "draft ou published" },
    },
    requiredPermission: "blog",
  },
  deleteBlogPost: {
    description: "Excluir post do blog",
    parameters: {
      postId: { type: "string", required: true, description: "ID do post" },
    },
    requiredPermission: "blog",
  },
  createOffer: {
    description: "Criar oferta de bump/upsell",
    parameters: {
      name: { type: "string", required: true, description: "Nome" },
      type: { type: "string", required: true, description: "bump ou upsell" },
      offerProductId: { type: "string", required: true, description: "ID do produto oferecido" },
      triggerProductId: { type: "string", required: false, description: "ID do gatilho" },
      discountPercent: { type: "number", required: false, description: "Desconto %" },
      isActive: { type: "boolean", required: false, description: "Ativo" },
    },
    requiredPermission: "offers",
  },
  updateOffer: {
    description: "Editar oferta",
    parameters: {
      offerId: { type: "string", required: true, description: "ID da oferta" },
      name: { type: "string", required: false, description: "Novo nome" },
      discountPercent: { type: "number", required: false, description: "Novo desconto" },
      isActive: { type: "boolean", required: false, description: "Ativar/desativar" },
    },
    requiredPermission: "offers",
  },
  deleteOffer: {
    description: "Excluir oferta",
    parameters: {
      offerId: { type: "string", required: true, description: "ID da oferta" },
    },
    requiredPermission: "offers",
  },
  approveReview: {
    description: "Aprovar avaliação",
    parameters: {
      reviewId: { type: "string", required: true, description: "ID da avaliação" },
    },
    requiredPermission: "reviews",
  },
  rejectReview: {
    description: "Rejeitar avaliação",
    parameters: {
      reviewId: { type: "string", required: true, description: "ID da avaliação" },
    },
    requiredPermission: "reviews",
  },
  respondToReview: {
    description: "Responder avaliação",
    parameters: {
      reviewId: { type: "string", required: true, description: "ID" },
      response: { type: "string", required: true, description: "Texto da resposta" },
    },
    requiredPermission: "reviews",
  },
  createPage: {
    description: "Criar página institucional",
    parameters: {
      title: { type: "string", required: true, description: "Título" },
      slug: { type: "string", required: false, description: "Slug" },
      content: { type: "string", required: false, description: "Conteúdo" },
      status: { type: "string", required: false, description: "draft ou published" },
    },
    requiredPermission: "pages",
  },
  updatePage: {
    description: "Editar página institucional",
    parameters: {
      pageId: { type: "string", required: true, description: "ID da página" },
      title: { type: "string", required: false, description: "Novo título" },
      content: { type: "string", required: false, description: "Novo conteúdo" },
      status: { type: "string", required: false, description: "draft ou published" },
    },
    requiredPermission: "pages",
  },
  markNotificationRead: {
    description: "Marcar notificação como lida",
    parameters: {
      notificationId: { type: "string", required: true, description: "ID da notificação" },
    },
    requiredPermission: null,
  },
  addSubscriber: {
    description: "Adicionar inscrito à lista de email",
    parameters: {
      listId: { type: "string", required: true, description: "ID da lista" },
      email: { type: "string", required: true, description: "Email" },
      name: { type: "string", required: false, description: "Nome" },
    },
    requiredPermission: "email_marketing",
  },
  createEmailCampaign: {
    description: "Criar campanha de email marketing",
    parameters: {
      name: { type: "string", required: true, description: "Nome" },
      subject: { type: "string", required: true, description: "Assunto" },
      listId: { type: "string", required: true, description: "ID da lista" },
    },
    requiredPermission: "email_marketing",
  },
  recalculateKitPrices: {
    description: "Recalcular preços de kits baseado nos componentes. Se productIds for vazio ou omitido, recalcula TODOS os kits do tenant. Preço = Σ(preço_componente × quantidade)",
    parameters: {
      productIds: { type: "array", required: false, description: "IDs dos produtos-base que mudaram de preço. Se vazio ou omitido, recalcula TODOS os kits do tenant." },
      removeCompareAtPrice: { type: "boolean", required: false, description: "Se true, remove preço de desconto dos kits" },
    },
    requiredPermission: "products",
  },
  applyKitDiscount: {
    description: "Aplicar desconto percentual sobre kits. Define compare_at_price = preço cheio (soma componentes) e price = preço com desconto. Útil para criar descontos por faixa de unidades.",
    parameters: {
      discounts: { type: "array", required: true, description: "Array de {kitId: UUID, discountPercent: número de 1 a 99}. Cada item define o desconto para um kit específico." },
    },
    requiredPermission: "products",
  },
};

// Build dynamic system prompt with all available tools (WRITE only - reads are native tools)
function buildSystemPrompt(isToolResult: boolean = false): string {
  // Only include WRITE tools in the text-based prompt (read tools are native)
  const writeTools = Object.entries(TOOL_REGISTRY).filter(([name]) => !READ_TOOLS.has(name));
  
  const toolDescriptions = writeTools
    .map(([name, tool]) => {
      const params = Object.entries(tool.parameters)
        .map(([pName, pDef]: [string, any]) => `  - ${pName}${pDef.required ? "*" : ""}: ${pDef.description}`)
        .join("\n");
      return `• ${name}: ${tool.description}\n${params}`;
    })
    .join("\n\n");

  // Compressed system prompt (~4KB instead of ~12KB)
  let prompt = `Você é o Auxiliar de Comando, assistente IA para e-commerce. Seu usuário é um EMPREENDEDOR comum, NÃO um técnico.

## 🚨 REGRA FUNDAMENTAL — COMO INTERPRETAR O USUÁRIO:

1. **CADA MENSAGEM É UM PEDIDO INDEPENDENTE.** O histórico anterior é apenas referência — NUNCA continue executando uma tarefa anterior quando o usuário claramente pediu algo NOVO. Leia a última mensagem como se fosse a primeira da conversa.

2. **INTERPRETE A INTENÇÃO, NÃO AS PALAVRAS EXATAS.** O usuário é um empreendedor que escreve de forma natural. Exemplos:
   - "aplica descontos nos kits" → quer desconto percentual (listKitsSummary + applyKitDiscount)
   - "atualiza os preços" → pode ser recálculo OU desconto — analise o CONTEXTO da mensagem
   - "agora faz X" → "agora" indica NOVA tarefa, não continuação
   - "e também Y" → extensão da tarefa atual
   
3. **NÃO ESPERE PROMPTS PERFEITOS.** Se o usuário escreveu algo ambíguo, pergunte de forma rápida e simples. Nunca assuma que ele sabe nomes de ferramentas ou termos técnicos.

4. **NUNCA RECICLE O RACIOCÍNIO ANTERIOR.** Se a conversa anterior era sobre "recalcular preços" e agora o usuário pede "aplicar descontos", você NÃO está mais no fluxo de recálculo. Comece do zero.

## 🚨🚨🚨 REGRA ANTI-ALUCINAÇÃO (MÁXIMA PRIORIDADE):
- **PROIBIDO** dizer "vou buscar", "estou buscando", "preciso buscar" como texto puro. Se precisa de dados, CHAME A TOOL via function calling IMEDIATAMENTE na mesma resposta. O usuário NÃO VÊ as tools — ele só vê o texto final.
- **PROIBIDO** gerar texto dizendo que vai fazer algo SEM realmente chamar uma tool.
- **PROIBIDO** pedir ao usuário para "aguardar" sem ter chamado nenhuma tool.
- Se não tem dados → CHAME a tool SILENCIOSAMENTE. NÃO anuncie, APENAS faça.
- Se a tool retornou dados → USE-OS imediatamente para propor a ação.

## 🚨🚨🚨 FORMATO DE AÇÃO (OBRIGATÓRIO):
**TODA ação DEVE usar bloco \`\`\`action\`\`\`.** Texto com JSON fora de bloco action será IGNORADO pelo sistema.

Formato CORRETO (o ÚNICO aceito):
\`\`\`action
{"tool_name":"bulkUpdateProductsPrice","tool_args":{"type":"percent_decrease","value":5},"description":"Aplicar 5% de desconto em todos os produtos"}
\`\`\`

Formato ERRADO (NUNCA use):
- JSON solto no texto sem \`\`\`action\`\`\`
- Mostrar JSON como "código" ou "exemplo"
- Pedir ao usuário para "confirmar" um JSON que você colou no texto

## 📌 EXEMPLOS OBRIGATÓRIOS (siga EXATAMENTE):

**Usuário:** "Aplica 5% de desconto em todos os produtos"
**Resposta CORRETA:**
Vou aplicar 5% de desconto em todos os seus produtos (incluindo kits).
\`\`\`action
{"tool_name":"bulkUpdateProductsPrice","tool_args":{"type":"percent_decrease","value":5},"description":"Reduzir preço base em 5% em todos os produtos e kits"}
\`\`\`

**Usuário:** "Aplica 5% de desconto promocional nos produtos simples (não kits)"
**Resposta CORRETA:**
Vou criar a promoção de 5% nos produtos simples, definindo "preço de" (riscado) e "preço por" (atual).
\`\`\`action
{"tool_name":"bulkUpdateProductsPrice","tool_args":{"type":"apply_discount","value":5,"excludeKits":true},"description":"Aplicar 5% desconto promocional (preço de/por) nos produtos simples"}
\`\`\`

**Resposta ERRADA (PROIBIDA):**
"Vou buscar todos os produtos primeiro..." (sem chamar tool)
"Preciso separar kits e produtos..." (desnecessário)

**Usuário:** "Ativa todos os produtos"
**Resposta CORRETA:**
\`\`\`action
{"tool_name":"bulkActivateProducts","tool_args":{"isActive":true},"description":"Ativar todos os produtos"}
\`\`\`

## TIPOS DE ALTERAÇÃO DE PREÇO:
| type | O que faz | Quando usar |
|---|---|---|
| \`percent_decrease\` | Reduz preço BASE em X% | Redução permanente de preço |
| \`percent_increase\` | Aumenta preço BASE em X% | Aumento de preço |
| \`fixed\` | Define preço fixo | Definir valor específico |
| \`apply_discount\` | Cria promoção: compare_at_price=preço atual, price=preço com desconto | Desconto promocional (preço de/por, preço riscado) |

## FILTROS DE FORMATO:
| Parâmetro | O que faz |
|---|---|
| \`productFormat: "simple"\` | Apenas produtos simples |
| \`excludeKits: true\` | Exclui kits (with_composition) |
| \`productFormat: "with_composition"\` | Apenas kits |

## REGRA: OPERAÇÕES EM MASSA SEM IDs = TODOS
- \`bulkUpdateProductsPrice\` sem \`productIds\` → aplica em TODOS os produtos (incluindo kits)
- \`bulkActivateProducts\` sem \`productIds\` → aplica em TODOS
- **NÃO É NECESSÁRIO** listar produtos antes de uma operação em massa sem filtro
- **NÃO SEPARE** kits de produtos — a tool já lida com todos

## COMO ESCOLHER A FERRAMENTA CERTA (KITS/PREÇOS):

| O que o usuário quer | Como você identifica | O que usar |
|---|---|---|
| Desconto/promoção em kits ESPECÍFICOS | Menciona "desconto nos kits", faixa de unidades | listKitsSummary → applyKitDiscount |
| Desconto PROMOCIONAL (preço de/por) | Menciona "preço riscado", "promoção", "preço de/por", "não alterar base" | bulkUpdateProductsPrice type=apply_discount |
| Desconto em TODOS os produtos (reduz base) | Menciona "todos os produtos", "tudo", "reduzir preço" | bulkUpdateProductsPrice type=percent_decrease |
| Corrigir preço base (componente mudou) | Menciona "recalcular", "preço mudou" | findKitsContainingProduct → recalculateKitPrices |
| Ativar/desativar frete grátis em massa | Menciona "frete grátis", "ativar frete", "free shipping" | bulkUpdateProductsFreeShipping |
| Frete grátis em kits com N+ componentes | Menciona "frete grátis nos kits com 3+", "kits com X produtos" | bulkUpdateProductsFreeShipping com minComponents |

## 🚨 EXECUÇÃO (REGRA CRÍTICA):
1. **LEITURA = SEMPRE VIA FUNCTION CALLING (tools nativas).** Use searchProducts, listProducts, listKitsSummary, etc. O usuário NÃO vê essas buscas. NUNCA gere bloco \`\`\`action\`\`\` para operações de leitura/consulta/listagem/verificação.
2. **ESCRITA = SEMPRE VIA BLOCO \`\`\`action\`\`\`.** Para criar/editar/excluir/atualizar, proponha bloco \`\`\`action\`\`\` — usuário confirma via botão.

## 🚨🚨🚨 PROIBIDO GERAR \`\`\`action\`\`\` PARA LEITURAS:
- "Listar kits", "Verificar status", "Consultar produtos", "Buscar pedidos" → FUNCTION CALLING (tools nativas), NUNCA \`\`\`action\`\`\`
- O bloco \`\`\`action\`\`\` é EXCLUSIVAMENTE para operações que MODIFICAM dados (create, update, delete, bulk)
- Se o usuário pede para VERIFICAR/CONSULTAR algo → chame a tool de leitura via function calling SILENCIOSAMENTE e responda com os dados
- NUNCA apresente uma consulta como ação que precisa de confirmação

## 🚫 PROIBIDO LOOPS DE RE-CONFIRMAÇÃO:
- Quando o usuário já disse "sim", "confirma", "pode prosseguir", "aplica" → EXECUTE IMEDIATAMENTE
- NUNCA re-liste o plano inteiro após o usuário já ter confirmado
- NUNCA peça confirmação duas vezes para a mesma ação
- PROIBIDO responder com "Você gostaria de aplicar?" se o usuário JÁ DISSE SIM

## COMUNICAÇÃO:
Fale como LOJISTA. NUNCA exponha nomes de tools, IDs de sistema ou termos técnicos. Seja direto e amigável.

## IDs:
- UUIDs — NUNCA invente. Extraia do [DADOS_INTERNOS_JSON].
- Se não encontrou, busque novamente.

## DECISÃO RÁPIDA:
- 1 resultado → assuma correto, proponha ação
- Múltiplos → pergunte CONCISAMENTE
- NUNCA peça confirmação para buscar dados

## UMA AÇÃO POR VEZ:
- Cada bloco \`\`\`action\`\`\` = EXATAMENTE UM objeto JSON
- Multi-step → proponha APENAS a primeira etapa, depois a próxima após resultado
- **EXCEÇÃO CRÍTICA para applyKitDiscount**: Esta tool aceita TODOS os kits de TODAS as faixas em UMA ÚNICA chamada. NUNCA fragmente por grupo/faixa.

## KITS E COMPOSIÇÕES:
- listProductComponents: KIT pai → seus componentes
- findKitsContainingProduct: componente → kits que o contêm
- listKitsSummary: TODOS os kits com nome, SKU, preço, frete grátis (✅/❌), total unidades. Filtros: minUnits/maxUnits.
- recalculateKitPrices: SOMENTE quando preço base dos componentes mudou
- applyKitDiscount: SEMPRE para descontos/promoções percentuais EM KITS ESPECÍFICOS.

## 🚨 REGRA ANTI-FRAGMENTAÇÃO (applyKitDiscount):
Quando o usuário pede descontos por faixa de unidades:
1. Chame listKitsSummary UMA VEZ (sem filtro) para pegar TODOS os kits
2. Agrupe por unidades, atribua % conforme pedido
3. Monte UM ÚNICO bloco action com TODOS os kits no array "discounts"
4. NUNCA faça uma ação por faixa — TUDO junto

## FORMATO DE AÇÃO:
\`\`\`action
{"tool_name":"applyKitDiscount","tool_args":{"discounts":[{"kitId":"UUID","discountPercent":15}]},"description":"Aplicar 15% de desconto nos kits de 2 unidades"}
\`\`\`
"tool_args" NUNCA pode ser vazio. JSON deve ser OBJETO, nunca array.

## FERRAMENTAS DE ESCRITA:

${toolDescriptions}`;

  if (isToolResult) {
    prompt += `

## ⚠️ PÓS-EXECUÇÃO (OBRIGATÓRIO):
Uma ação acaba de ser executada. O resultado está no histórico como [AÇÃO_CONCLUÍDA] ou [AÇÃO_FALHOU].
- Confirme o resultado em 1-2 frases ("Pronto!", "Feito!")
- PROIBIDO repetir a mesma ação
- Se há próxima etapa do pedido original → EXECUTE IMEDIATAMENTE (chame tools, proponha action) SEM pedir nova confirmação
- O usuário já autorizou o fluxo completo — NÃO peça "quer continuar?" ou "confirme para prosseguir"
- Se tudo concluído, confirme de forma breve
- NUNCA esqueça faixas/etapas pendentes — revise o pedido original e verifique se TUDO foi feito`;
  }

  prompt += `\n\nResponda sempre em português brasileiro de forma amigável e profissional.`;
  return prompt;
}

const MAX_TOOL_ROUNDS = 5;

serve(async (req) => {
  console.log(`[command-assistant-chat][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { conversation_id, message, tenant_id, is_tool_result, attachments } = await req.json();

    if (!tenant_id || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros inválidos" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado ao tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse attachments
    const parsedAttachments: Array<{ url: string; filename: string; mimeType: string }> = Array.isArray(attachments) ? attachments : [];
    const imageAttachments = parsedAttachments.filter((a: any) => a.mimeType?.startsWith("image/"));
    
    // Save user message
    if (!is_tool_result) {
      const { error: msgError } = await supabase
        .from("command_messages")
        .insert({
          conversation_id,
          tenant_id,
          user_id: user.id,
          role: "user",
          content: message,
          metadata: parsedAttachments.length > 0 ? { attachments: parsedAttachments } : {},
        });
      if (msgError) console.error("Error saving message:", msgError);
    } else {
      // v3.4.0: DON'T save here — the execute function already saved the result as role:"user"
      // with is_tool_result metadata. Saving again would create duplicate messages in the UI
      // and confuse the AI with redundant history entries.
      console.log(`[command-assistant-chat] Post-execution: skipping save (already saved by execute function)`);
    }

    // Get conversation history — includes metadata to distinguish action results
    const { data: history } = await supabase
      .from("command_messages")
      .select("role, content, metadata")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(50);

    // Build system prompt with post-execution context
    let SYSTEM_PROMPT = buildSystemPrompt(!!is_tool_result);

    // Inject AI memory context
    try {
      const memoryContext = await getMemoryContext(supabase, tenant_id, user.id, "command_assistant");
      if (memoryContext) {
        SYSTEM_PROMPT += memoryContext;
        console.log(`[command-assistant-chat] Memory context injected (${memoryContext.length} chars)`);
      }
    } catch (e) {
      console.error("[command-assistant-chat] Memory fetch error:", e);
    }

    // v3.4.0: Filter native tool call artifacts (role:"tool") but KEEP action results
    // Action results from execute function are now saved as role:"user" with is_tool_result metadata
    const filteredHistory = (history || []).filter((m: any) => m.role !== "tool");
    
    // Build messages array with multimodal support for images
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...filteredHistory.slice(0, -1).map((m: any) => {
        // Check if historical message has image attachments in metadata
        const msgAttachments = m.metadata?.attachments;
        if (m.role === "user" && Array.isArray(msgAttachments) && msgAttachments.some((a: any) => a.mimeType?.startsWith("image/"))) {
          const contentParts: any[] = [];
          if (m.content) contentParts.push({ type: "text", text: m.content });
          for (const att of msgAttachments) {
            if (att.mimeType?.startsWith("image/") && att.url) {
              contentParts.push({ type: "image_url", image_url: { url: att.url, detail: "high" } });
            }
          }
          return { role: "user", content: contentParts.length > 0 ? contentParts : m.content || "" };
        }
        return { role: m.role as string, content: m.content || "" };
      }),
    ];

    // Add the current user message (last in history) with multimodal content if images present
    const lastHistoryMsg = filteredHistory[filteredHistory.length - 1];
    if (imageAttachments.length > 0) {
      const contentParts: any[] = [];
      if (message) contentParts.push({ type: "text", text: message });
      for (const img of imageAttachments) {
        contentParts.push({ type: "image_url", image_url: { url: img.url, detail: "high" } });
      }
      messages.push({ role: "user", content: contentParts });
      console.log(`[command-assistant-chat] Multimodal message with ${imageAttachments.length} image(s)`);
    } else if (lastHistoryMsg) {
      messages.push({ role: "user", content: lastHistoryMsg.content || message || "" });
    } else {
      messages.push({ role: "user", content: message || "" });
    }

    // ==================== HELPER: Save assistant message and extract actions ====================
    async function saveAssistantMessage(content: string) {
      const actionMatch = content.match(/```action\s*([\s\S]*?)```/);
      let proposedActions: any[] = [];
      
      if (actionMatch) {
        try {
          let actionData = JSON.parse(actionMatch[1]);
          // v3.5.0: Handle arrays (take first action only)
          if (Array.isArray(actionData)) {
            console.warn("Action was array, taking first element only");
            actionData = actionData[0];
          }
          // v3.15.0: Guard — if the AI proposed a READ tool as an action, strip it
          // Read tools should NEVER be proposed as actions requiring confirmation
          if (actionData?.tool_name && READ_TOOLS.has(actionData.tool_name)) {
            console.warn(`[command-assistant-chat] ⚠️ Read tool "${actionData.tool_name}" was proposed as action — stripping (reads don't need confirmation)`);
            // Don't add to proposedActions — it will be stripped from the message
          } else if (actionData?.tool_name && actionData?.tool_args && Object.keys(actionData.tool_args).length > 0) {
            proposedActions = [{
              id: crypto.randomUUID(),
              tool_name: actionData.tool_name,
              tool_args: actionData.tool_args,
              description: actionData.description,
            }];
          } else {
            console.error("Action rejected: empty tool_args", JSON.stringify(actionData));
          }
        } catch (e) {
          console.error("Error parsing action:", e);
        }
      }
      
      const cleanContent = content.replace(/```action[\s\S]*?```/g, "").trim();
      
      await supabase
        .from("command_messages")
        .insert({
          conversation_id,
          tenant_id,
          user_id: user.id,
          role: "assistant",
          content: cleanContent,
          metadata: proposedActions.length > 0 ? { proposed_actions: proposedActions } : {},
        });
      
      await supabase
        .from("command_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversation_id);
    }

    // ==================== HELPER: Create synthetic SSE stream from text ====================
    function createSyntheticStream(text: string, proposedActions?: any[]): ReadableStream {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          // Stream in chunks to simulate real streaming
          const chunkSize = 20; // characters per chunk
          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize);
            const sseData = JSON.stringify({
              choices: [{ delta: { content: chunk } }],
            });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          }
          // v3.3.0: Emit proposed_actions so frontend can render action buttons immediately
          if (proposedActions && proposedActions.length > 0) {
            const actionsData = JSON.stringify({ proposed_actions: proposedActions });
            controller.enqueue(encoder.encode(`data: ${actionsData}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
    }

    // ==================== HELPER: Stream from real AI response ====================
    async function streamFromAI(streamMessages: any[]): Promise<Response> {
      // v3.8.1: Use Gemini for fallback streaming to avoid OpenAI rate limits
      const endpoint = await getAIEndpoint("google/gemini-2.5-flash", {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        preferProvider: 'gemini',
      });

      console.log(`[command-assistant-chat] Streaming via ${endpoint.provider} (${endpoint.model})`);

      const aiResponse = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${endpoint.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: endpoint.model,
          messages: streamMessages,
          stream: true,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Limite de requisições excedido. Tente novamente em instantes." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ success: false, error: "Créditos de IA esgotados. Adicione mais créditos." }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await aiResponse.text();
        console.error("AI Gateway error:", aiResponse.status, errorText);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao processar resposta da IA" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Process streaming response
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      
      let fullContent = "";

      (async () => {
        try {
          let buffer = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            await writer.write(value);
            
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);
              
              if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
              
              try {
                const parsed = JSON.parse(line.slice(6));
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
              } catch {}
            }
          }
          
          await saveAssistantMessage(fullContent);
        } catch (e) {
          console.error("Stream processing error:", e);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ==================== POST-EXECUTION: Allow tool calling for multi-step operations ====================
    // v3.2.0: Previously skipped Phase 1 entirely for is_tool_result, which prevented the AI
    // from calling searchProducts to find IDs for the NEXT step (e.g., recalculating kits after updating prices).
    // Now we allow tool calling so the AI can fetch data needed for subsequent steps.
    if (is_tool_result) {
      console.log(`[command-assistant-chat] Post-execution: allowing tool calling for potential next steps`);
      // Falls through to the normal tool calling loop below
    }

    // ==================== NATIVE TOOL CALLING LOOP (with SSE keep-alive) ====================
    // v3.8.2: Return Response immediately with heartbeat SSE events during tool calling
    // to prevent browser/proxy timeout on long-running tool calling rounds
    resetAIRouterCache();
    const aiOpts = { supabaseUrl, supabaseServiceKey: supabaseKey, logPrefix: '[command-assistant-chat]', preferProvider: 'openai' as const, maxRetries: 1, baseDelayMs: 3000 };

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();

    // Background processing
    (async () => {
      // Heartbeat interval — send SSE comment every 8s to keep connection alive
      const heartbeat = setInterval(() => {
        try { writer.write(enc.encode(": heartbeat\n\n")); } catch {}
      }, 8000);

      try {
        let toolCallRound = 0;
        let finalMsgs = [...messages];
        let phase1FinalContent: string | null = null;

        while (toolCallRound < MAX_TOOL_ROUNDS) {
          toolCallRound++;
          const isLastRound = toolCallRound >= MAX_TOOL_ROUNDS;
          console.log(`[command-assistant-chat] Tool calling round ${toolCallRound}/${MAX_TOOL_ROUNDS}${isLastRound ? ' (FINAL - forcing text response)' : ''}`);

          // Send status event so frontend knows progress
          try {
            writer.write(enc.encode(`data: ${JSON.stringify({ status: "processing", round: toolCallRound })}\n\n`));
          } catch {}

          try {
            const roundTools = isLastRound ? undefined : OPENAI_READ_TOOLS;
            const roundToolChoice = isLastRound ? undefined : "auto";

            const { data: aiData } = await aiChatCompletionJSON(
              "google/gemini-2.5-flash",
              {
                messages: isLastRound
                  ? [...finalMsgs, { role: "system", content: "IMPORTANTE: Você já coletou dados suficientes. Responda ao usuário agora com base nos dados que já tem. NÃO tente buscar mais dados." }]
                  : finalMsgs,
                ...(roundTools ? { tools: roundTools, tool_choice: roundToolChoice } : {}),
              },
              aiOpts
            );

            const choice = aiData?.choices?.[0];
            if (!choice) {
              console.error("[command-assistant-chat] No choice in AI response");
              break;
            }

            const toolCalls = choice.message?.tool_calls;

            if (!toolCalls || toolCalls.length === 0) {
              const responseText = choice.message?.content || "";
              
              // v3.14.0: Anti-hallucination guard — detect "vou verificar/buscar" without tool calls
              // When Gemini fallback generates text announcing intent without actually calling tools,
              // inject a correction and retry instead of accepting the hollow response
              const HALLUCINATION_PATTERNS = [
                /vou\s+(verificar|buscar|checar|conferir|consultar|analisar|investigar|pesquisar)/i,
                /já\s+estou\s+(buscando|verificando|checando|consultando|analisando)/i,
                /estou\s+(buscando|verificando|checando|consultando|analisando)/i,
                /deixa\s+eu\s+(verificar|buscar|checar|conferir)/i,
                /vou\s+te\s+(informar|avisar|dizer)/i,
              ];
              
              const isHallucination = !isLastRound && 
                HALLUCINATION_PATTERNS.some(p => p.test(responseText)) &&
                !responseText.includes("```action");
              
              if (isHallucination) {
                console.warn(`[command-assistant-chat] ⚠️ Anti-hallucination guard triggered! Response was: "${responseText.substring(0, 100)}..."`);
                // Inject correction message and retry
                finalMsgs.push({
                  role: "assistant",
                  content: responseText,
                });
                finalMsgs.push({
                  role: "user", 
                  content: "SISTEMA: Você disse que vai verificar/buscar, mas NÃO chamou nenhuma ferramenta. Use as tools disponíveis AGORA para buscar os dados. Chame searchProducts, listProducts, listKitsSummary ou a tool apropriada IMEDIATAMENTE.",
                });
                continue; // Retry the round
              }
              
              phase1FinalContent = responseText;
              console.log(`[command-assistant-chat] Phase 1 complete after ${toolCallRound} round(s), captured response (${phase1FinalContent?.length || 0} chars)`);
              break;
            }

            console.log(`[command-assistant-chat] Executing ${toolCalls.length} read tool(s)`);

            finalMsgs.push({
              role: "assistant",
              content: choice.message.content || "",
              tool_calls: toolCalls,
            });

            for (const tc of toolCalls) {
              const toolName = tc.function?.name;
              const toolArgs = tc.function?.arguments ?
                (typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments) : {};

              const allowedTypes = READ_PERMISSION_MAP[toolName];
              let toolResult: string;

              if (allowedTypes && !allowedTypes.includes(userRole.user_type)) {
                toolResult = `Sem permissão para executar ${toolName}. Necessário: ${allowedTypes.join(", ")}`;
              } else if (READ_TOOLS.has(toolName)) {
                try {
                  toolResult = await executeReadTool(supabase, tenant_id, user.id, toolName, toolArgs, token);
                } catch (e) {
                  toolResult = `Erro ao executar ${toolName}: ${e instanceof Error ? e.message : "Erro desconhecido"}`;
                }
              } else {
                toolResult = `Tool ${toolName} não é uma tool de leitura automática.`;
              }

              finalMsgs.push({
                role: "tool",
                tool_call_id: tc.id,
                content: toolResult,
              });
            }
          } catch (e) {
            console.error(`[command-assistant-chat] Tool calling round ${toolCallRound} error:`, e);
            break;
          }
        }

        clearInterval(heartbeat);

        // ==================== Send final response ====================
        if (phase1FinalContent) {
          console.log(`[command-assistant-chat] Using Phase 1 response directly (no Phase 2 needed)`);
          await saveAssistantMessage(phase1FinalContent);

          const actionMatch = phase1FinalContent.match(/```action\s*([\s\S]*?)```/);
          let streamActions: any[] = [];
          if (actionMatch) {
            try {
              const actionData = JSON.parse(actionMatch[1]);
              if (actionData.tool_name && actionData.tool_args && Object.keys(actionData.tool_args).length > 0) {
                streamActions = [{
                  id: crypto.randomUUID(),
                  tool_name: actionData.tool_name,
                  tool_args: actionData.tool_args,
                  description: actionData.description,
                }];
              }
            } catch (e) {
              console.error("Error parsing action for stream:", e);
            }
          }

          const cleanContent = phase1FinalContent.replace(/```action[\s\S]*?```/g, "").trim();

          // Stream content in chunks
          const chunkSize = 20;
          for (let i = 0; i < cleanContent.length; i += chunkSize) {
            const chunk = cleanContent.slice(i, i + chunkSize);
            await writer.write(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`));
          }
          if (streamActions.length > 0) {
            await writer.write(enc.encode(`data: ${JSON.stringify({ proposed_actions: streamActions })}\n\n`));
          }
          await writer.write(enc.encode("data: [DONE]\n\n"));
        } else {
          // Fallback: stream from AI
          console.log(`[command-assistant-chat] Phase 1 exhausted without final response, falling back to streaming call`);
          const endpoint = await getAIEndpoint("google/gemini-2.5-flash", {
            supabaseUrl,
            supabaseServiceKey: supabaseKey,
            preferProvider: 'gemini',
          });
          console.log(`[command-assistant-chat] Streaming via ${endpoint.provider} (${endpoint.model})`);

          const aiResponse = await fetch(endpoint.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${endpoint.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: endpoint.model,
              messages: finalMsgs,
              stream: true,
            }),
          });

          if (!aiResponse.ok || !aiResponse.body) {
            await writer.write(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente." } }] })}\n\n`));
            await writer.write(enc.encode("data: [DONE]\n\n"));
          } else {
            const reader = aiResponse.body.getReader();
            let fullContent = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = new TextDecoder().decode(value);
              await writer.write(enc.encode(text));
              // Extract content for saving
              const lines = text.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
                try {
                  const parsed = JSON.parse(line.slice(6));
                  const c = parsed.choices?.[0]?.delta?.content;
                  if (c) fullContent += c;
                } catch {}
              }
            }
            if (fullContent) await saveAssistantMessage(fullContent);
            // Ensure DONE is sent
            await writer.write(enc.encode("data: [DONE]\n\n"));
          }
        }
      } catch (error) {
        console.error("Error in background processing:", error);
        try {
          await writer.write(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "Desculpe, ocorreu um erro interno. Tente novamente." } }] })}\n\n`));
          await writer.write(enc.encode("data: [DONE]\n\n"));
        } catch {}
      } finally {
        try { await writer.close(); } catch {}
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'system', action: 'command-assistant-chat' });
  }
});
