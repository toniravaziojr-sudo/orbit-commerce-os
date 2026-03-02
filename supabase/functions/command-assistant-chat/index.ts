import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getAIEndpoint, aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v3.7.0"; // Add listKitsSummary + applyKitDiscount tools for tiered kit pricing
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
      description: "Listar produtos com filtros (ativos, inativos, por categoria, faixa de preço)",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "active, inactive, all" },
          categoryId: { type: "string", description: "Filtrar por categoria" },
          minPrice: { type: "number", description: "Preço mínimo em reais" },
          maxPrice: { type: "number", description: "Preço máximo em reais" },
          limit: { type: "number", description: "Limite (padrão 20)" },
          orderBy: { type: "string", description: "name, price, created_at, stock_quantity" },
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
      description: "Lista TODOS os kits do tenant com resumo: nome, SKU, preço, quantidade total de unidades (soma das quantidades dos componentes). Use quando o usuário pedir para listar kits por quantidade de unidades ou aplicar descontos por faixa de unidades.",
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
    description: "Atualizar preços de produtos (aumento/desconto percentual ou valor fixo individual)",
    parameters: {
      type: { type: "string", required: true, description: "percent_increase, percent_decrease, fixed" },
      value: { type: "number", required: false, description: "Valor percentual (para percent_increase/percent_decrease)" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
      categoryId: { type: "string", required: false, description: "Filtrar por categoria" },
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
    description: "Criar um novo produto",
    parameters: {
      name: { type: "string", required: true, description: "Nome do produto" },
      price: { type: "number", required: true, description: "Preço em reais" },
      sku: { type: "string", required: false, description: "SKU do produto" },
      description: { type: "string", required: false, description: "Descrição" },
      categoryId: { type: "string", required: false, description: "ID da categoria" },
      stockQuantity: { type: "number", required: false, description: "Quantidade em estoque" },
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
    description: "Editar campos de um produto",
    parameters: {
      productId: { type: "string", required: true, description: "ID do produto" },
      name: { type: "string", required: false, description: "Novo nome" },
      description: { type: "string", required: false, description: "Nova descrição" },
      price: { type: "number", required: false, description: "Novo preço" },
      compareAtPrice: { type: "number", required: false, description: "Preço original" },
      sku: { type: "string", required: false, description: "Novo SKU" },
      weight: { type: "number", required: false, description: "Peso em gramas" },
      width: { type: "number", required: false, description: "Largura em cm" },
      height: { type: "number", required: false, description: "Altura em cm" },
      length: { type: "number", required: false, description: "Comprimento em cm" },
      seoTitle: { type: "string", required: false, description: "Título SEO" },
      seoDescription: { type: "string", required: false, description: "Descrição SEO" },
      isActive: { type: "boolean", required: false, description: "Ativar/desativar" },
      stockQuantity: { type: "number", required: false, description: "Quantidade em estoque" },
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
  let prompt = `Você é o Auxiliar de Comando, assistente IA para e-commerce.

## EXECUÇÃO (CRÍTICO — SEGUIR À RISCA):
1. LEITURA AUTOMÁTICA: Use function calling para buscar dados (searchProducts, listProducts, etc). O usuário NÃO vê essas buscas.
2. ESCRITA COM CONFIRMAÇÃO: Para criar/editar/excluir, proponha bloco \`\`\`action\`\`\` — usuário confirma via botão.

## ⚠️ REGRA ANTI-ALUCINAÇÃO (PRIORIDADE MÁXIMA):
- NUNCA diga "vou buscar" ou "estou buscando" sem REALMENTE chamar uma tool de busca na mesma resposta
- Se precisa de dados (nome, preço, ID de produto), CHAME searchProducts/listProducts IMEDIATAMENTE via function calling
- Se o usuário pede uma ação sobre produtos, PRIMEIRO busque os produtos via tool calling, DEPOIS proponha a ação
- PROIBIDO gerar texto dizendo que vai fazer algo SEM realmente fazer. Isso causa uma experiência onde o usuário fica esperando sem nada acontecer.
- Se não tem os IDs dos produtos → CHAME searchProducts. Não responda sem chamar.
- JAMAIS invente que "a busca está em andamento" — tools são síncronas, ou você chamou ou não chamou.

## COMUNICAÇÃO:
Fale como se conversa com LOJISTA. NUNCA exponha nomes de tools, IDs de sistema ou termos técnicos.
- bulkUpdateProductsPrice → "ajustar os preços"
- searchProducts → "buscar produtos"  
- recalculateKitPrices → "recalcular preços dos kits"
- tool_name / tool_args / tenant_id → NUNCA mencionar

## IDs (CRÍTICO):
- IDs são UUIDs (ex: "8259065f-16f5-4aad-bc80-7d9cac4fa0c2")
- NUNCA invente IDs — extraia do [DADOS_INTERNOS_JSON] retornado nas buscas
- Se não encontrou na busca, NÃO sabe o ID — busque novamente

## DECISÃO RÁPIDA:
- 1 resultado na busca → assuma correto, proponha ação
- Múltiplos resultados → pergunte qual, de forma CONCISA
- NUNCA peça confirmação para buscar dados
- NUNCA faça 2+ perguntas antes de propor ação

## ⚠️ UMA AÇÃO POR VEZ (OBRIGATÓRIO):
- Cada bloco \`\`\`action\`\`\` deve conter EXATAMENTE UM objeto JSON (NÃO um array)
- Para operações em múltiplas etapas (ex: duplicar produto + alterar nome), proponha APENAS A PRIMEIRA etapa
- Após o resultado da primeira etapa, proponha a próxima automaticamente
- NUNCA use placeholders como "<novoID>" — espere o resultado real da etapa anterior
- Exemplo: se o usuário pede "duplicar e alterar nome", primeiro proponha APENAS a duplicação

## KITS E COMPOSIÇÕES (IMPORTANTE):
- listProductComponents: dado um KIT (pai), lista seus componentes
- findKitsContainingProduct: dado um COMPONENTE (produto simples), encontra os KITS que o contêm ← USE SEMPRE que o usuário pedir para recalcular kits de um produto
- listKitsSummary: lista TODOS os kits com resumo (nome, SKU, preço, total de unidades). USE quando o usuário pedir para listar kits por quantidade ou aplicar descontos por faixa de unidades. Aceita filtros minUnits/maxUnits.
- recalculateKitPrices: aceita productIds de componentes (produtos simples) e encontra automaticamente os kits que os contêm
- applyKitDiscount: aplica desconto percentual sobre kits (compare_at_price = preço cheio, price = preço com desconto). USE após listKitsSummary quando o usuário pedir descontos por faixa de unidades.
- FLUXO DESCONTO POR FAIXA: 1) listKitsSummary para obter kits e unidades 2) Agrupar por faixa de unidades 3) applyKitDiscount com os IDs e percentuais
- Quando o usuário pede "atualizar kits de X", PRIMEIRO use findKitsContainingProduct para listar os kits afetados, DEPOIS proponha recalculateKitPrices

## OPERAÇÕES EM LOTE (AÇÃO ÚNICA):
Quando alterar MÚLTIPLOS produtos com A MESMA operação: busque TODOS automaticamente, extraia IDs do JSON, proponha UMA ação com todos os IDs.

## FORMATO DE AÇÃO:
\`\`\`action
{"tool_name":"bulkUpdateProductsPrice","tool_args":{"type":"fixed","prices":[{"productId":"UUID","price":97.90}]},"description":"Atualizar preços"}
\`\`\`
"tool_args" NUNCA pode ser vazio ({}).
O JSON deve ser um OBJETO, NUNCA um array.

## FERRAMENTAS DE ESCRITA:

${toolDescriptions}`;

  // Post-execution rule (only when relevant)
  if (isToolResult) {
    prompt += `

## ⚠️ PÓS-EXECUÇÃO (PRIORIDADE MÁXIMA):
Uma ação acaba de ser executada. O resultado está no histórico como mensagem com prefixo [AÇÃO_CONCLUÍDA] ou [AÇÃO_FALHOU].
- RECONHEÇA o resultado: diga "Pronto!" ou "Feito!" — NÃO diga "vou buscar" ou "estou aguardando"
- PROIBIDO propor a MESMA ação que aparece em [AÇÃO_CONCLUÍDA]
- Se o usuário pediu MÚLTIPLAS etapas (ex: atualizar preços E recalcular kits), PROSSIGA para a PRÓXIMA etapa
- Para a próxima etapa, use function calling para buscar dados necessários (ex: searchProducts para encontrar IDs)
- Se TODAS as etapas já foram concluídas, confirme de forma amigável e concisa
- NUNCA diga "houve um problema técnico" se a ação foi bem-sucedida`;
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

    const { conversation_id, message, tenant_id, is_tool_result } = await req.json();

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
          metadata: {},
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
    
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...filteredHistory.map((m: any) => ({
        role: m.role as string,
        content: m.content || "",
      })),
    ];

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
          if (actionData?.tool_name && actionData?.tool_args && Object.keys(actionData.tool_args).length > 0) {
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
      const endpoint = await getAIEndpoint("openai/gpt-5", {
        supabaseUrl,
        supabaseServiceKey: supabaseKey,
        preferProvider: 'openai',
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

    // ==================== NATIVE TOOL CALLING LOOP ====================
    // Phase 1: Non-streaming loop to resolve all read tool calls
    resetAIRouterCache();
    // Use OpenAI native for tool calling (reliable tool support, Gemini OpenAI-compat doesn't support tools well)
    const aiOpts = { supabaseUrl, supabaseServiceKey: supabaseKey, logPrefix: '[command-assistant-chat]', preferProvider: 'openai' as const };
    
    let toolCallRound = 0;
    let finalMessages = [...messages];
    let phase1FinalContent: string | null = null;

    while (toolCallRound < MAX_TOOL_ROUNDS) {
      toolCallRound++;
      console.log(`[command-assistant-chat] Tool calling round ${toolCallRound}/${MAX_TOOL_ROUNDS}`);

      try {
        const { data: aiData } = await aiChatCompletionJSON(
          "google/gemini-2.5-flash",
          {
            messages: finalMessages,
            tools: OPENAI_READ_TOOLS,
            tool_choice: "auto",
          },
          aiOpts
        );

        const choice = aiData?.choices?.[0];
        if (!choice) {
          console.error("[command-assistant-chat] No choice in AI response");
          break;
        }

        const toolCalls = choice.message?.tool_calls;
        
        // MUDANÇA 1: If no tool calls, CAPTURE the response instead of discarding it
        if (!toolCalls || toolCalls.length === 0) {
          phase1FinalContent = choice.message?.content || null;
          console.log(`[command-assistant-chat] Phase 1 complete after ${toolCallRound} round(s), captured response (${phase1FinalContent?.length || 0} chars)`);
          break;
        }

        // Execute read tools
        console.log(`[command-assistant-chat] Executing ${toolCalls.length} read tool(s)`);
        
        finalMessages.push({
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

          finalMessages.push({
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

    // ==================== MUDANÇA 1: Use Phase 1 response directly (synthetic stream) ====================
    if (phase1FinalContent) {
      console.log(`[command-assistant-chat] Using Phase 1 response directly (no Phase 2 needed)`);
      
      // Save the message and extract proposed actions
      await saveAssistantMessage(phase1FinalContent);
      
      // Extract proposed actions for synthetic stream emission
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
      
      // Clean content for streaming (remove action blocks)
      const cleanContent = phase1FinalContent.replace(/```action[\s\S]*?```/g, "").trim();
      
      // Stream it synthetically to the frontend
      const syntheticStream = createSyntheticStream(cleanContent, streamActions);
      
      return new Response(syntheticStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Fallback: Phase 1 didn't produce a final response (e.g., all rounds were tool calls)
    // In this case, do a streaming call to get the final response
    console.log(`[command-assistant-chat] Phase 1 exhausted without final response, falling back to streaming call`);
    return await streamFromAI(finalMessages);

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
