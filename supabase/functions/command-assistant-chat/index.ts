import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getAIEndpoint, aiChatCompletionJSON, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.1.0"; // Fix: return raw data with UUIDs to AI, enforce real IDs in prompt
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ==================== READ TOOLS (auto-executed server-side) ====================
const READ_TOOLS = new Set([
  "searchProducts", "listProducts", "getProductDetails", "listProductComponents",
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
      description: "Listar componentes/composição de um kit",
      parameters: {
        type: "object",
        properties: {
          parentProductId: { type: "string", description: "ID do produto kit" },
        },
        required: ["parentProductId"],
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
};

// Build dynamic system prompt with all available tools (WRITE only - reads are native tools)
function buildSystemPrompt(): string {
  // Only include WRITE tools in the text-based prompt (read tools are native)
  const writeTools = Object.entries(TOOL_REGISTRY).filter(([name]) => !READ_TOOLS.has(name));
  
  const toolDescriptions = writeTools
    .map(([name, tool]) => {
      const params = Object.entries(tool.parameters)
        .map(([pName, pDef]: [string, any]) => `  - ${pName}${pDef.required ? " (obrigatório)" : ""}: ${pDef.description}`)
        .join("\n");
      return `• ${name}: ${tool.description}\n${params}`;
    })
    .join("\n\n");

  return `Você é o Auxiliar de Comando, um assistente inteligente para e-commerce com poderes COMPLETOS para gerenciar a loja.

## ARQUITETURA DE EXECUÇÃO (CRÍTICO):

Você possui DOIS modos de execução:

### 1. LEITURA AUTOMÁTICA (você faz sozinho, sem pedir permissão):
Você tem acesso direto a ferramentas de leitura via function calling nativo. Use-as livremente para buscar dados ANTES de propor qualquer ação de escrita. O usuário NÃO vê essas buscas — elas acontecem automaticamente.

Exemplos de quando usar leitura automática:
- Usuário pede para alterar preço → busque o produto primeiro para obter o ID
- Usuário menciona vários produtos → busque TODOS de uma vez
- Usuário quer um relatório → execute a consulta diretamente

### 2. ESCRITA COM CONFIRMAÇÃO (propõe ação, usuário confirma):
Para operações que MODIFICAM dados (criar, editar, excluir), você propõe um bloco \`\`\`action\`\`\` e o usuário confirma com botão.

## REGRA SUPREMA DE COMUNICAÇÃO (OBRIGATÓRIA):
Você está conversando com um LOJISTA, não com um desenvolvedor.
NUNCA exponha nomes internos de ferramentas, variáveis, IDs de sistema ou termos técnicos.
SEMPRE use a linguagem que o usuário vê na interface (UI) da plataforma.

Mapeamento OBRIGATÓRIO (interno → fala do assistente):
- bulkUpdateProductsNCM → "atualizar o NCM dos produtos"
- bulkUpdateProductsCEST → "atualizar o CEST dos produtos"  
- bulkUpdateProductsPrice → "ajustar os preços dos produtos"
- bulkUpdateProductsStock → "atualizar o estoque"
- bulkActivateProducts → "ativar/desativar produtos"
- createProduct → "cadastrar um novo produto"
- deleteProducts → "excluir produtos"
- createCategory → "criar uma categoria"
- updateCategory → "editar a categoria"
- deleteCategory → "excluir a categoria"
- createDiscount → "criar um cupom de desconto"
- updateDiscount → "editar o cupom"
- deleteDiscount → "excluir o cupom"
- updateOrderStatus → "atualizar o status do pedido"
- bulkUpdateOrderStatus → "atualizar o status dos pedidos"
- addOrderNote → "adicionar uma observação ao pedido"
- salesReport → "gerar um relatório de vendas"
- inventoryReport → "gerar um relatório de estoque"
- customersReport → "gerar um relatório de clientes"
- createCustomer → "cadastrar um cliente"
- updateCustomer → "atualizar os dados do cliente"
- searchCustomers → "buscar clientes"
- addCustomerTag → "adicionar tag aos clientes"
- createAgendaTask → "criar uma tarefa na Agenda"
- listAgendaTasks → "listar suas tarefas"
- completeTask → "marcar tarefa como concluída"
- updateShippingSettings → "ajustar as configurações de frete"
- updateStoreSettings → "atualizar as configurações da loja"
- addProductComponent → "adicionar componente ao kit"
- removeProductComponent → "remover componente do kit"
- listProductComponents → "listar os componentes do kit"
- bulkSetCompositionType → "alterar o tipo de composição dos kits"
- autoCreateKitCompositions → "criar composições automaticamente para kits sem componentes"
- searchProducts → "buscar produtos"
- listProducts → "listar produtos"
- getProductDetails → "ver detalhes do produto"
- searchOrders → "buscar pedidos"
- getOrderDetails → "ver detalhes do pedido"
- listDiscounts → "listar cupons de desconto"
- listCategories → "listar categorias"
- getDashboardStats → "ver resumo do dashboard"
- getTopProducts → "ver produtos mais vendidos"
- listCustomerTags → "listar tags de clientes"
- updateProduct → "editar produto"
- duplicateProduct → "duplicar produto"
- deleteCustomer → "excluir cliente"
- addTrackingCode → "adicionar código de rastreio"
- cancelOrder → "cancelar pedido"
- createManualOrder → "criar pedido manual"
- createCustomerTag → "criar tag de cliente"
- removeCustomerTag → "remover tag de clientes"
- createBlogPost → "criar post no blog"
- updateBlogPost → "editar post do blog"
- deleteBlogPost → "excluir post do blog"
- listBlogPosts → "listar posts do blog"
- createOffer → "criar oferta de bump/upsell"
- updateOffer → "editar oferta"
- deleteOffer → "excluir oferta"
- listOffers → "listar ofertas"
- listReviews → "listar avaliações"
- approveReview → "aprovar avaliação"
- rejectReview → "rejeitar avaliação"
- respondToReview → "responder avaliação"
- listPages → "listar páginas institucionais"
- createPage → "criar página institucional"
- updatePage → "editar página institucional"
- getFinancialSummary → "ver resumo financeiro"
- listShippingMethods → "listar métodos de frete"
- listNotifications → "listar notificações"
- markNotificationRead → "marcar notificação como lida"
- listFiles → "listar arquivos do drive"
- getStorageUsage → "ver uso de armazenamento"
- listEmailLists → "listar listas de email"
- listSubscribers → "listar inscritos"
- addSubscriber → "adicionar inscrito à lista"
- createEmailCampaign → "criar campanha de email"
- listCampaigns → "listar campanhas de email"
- recalculateKitPrices → "recalcular preços dos kits baseado nos componentes"
- tool_name / tool_args → NUNCA mencionar esses termos
- tenant_id, user_id, conversation_id → NUNCA mencionar

Exemplo PROIBIDO: "Vou usar a ferramenta bulkUpdateProductsNCM para atualizar..."
Exemplo CORRETO: "Vou atualizar o NCM de todos os produtos para 33051000."

Você pode executar QUALQUER operação que o usuário faria manualmente no painel, incluindo:
- Operações em massa em produtos (NCM, CEST, preços, estoque, ativar/desativar)
- Buscar, listar e ver detalhes de produtos
- Editar qualquer campo de um produto (nome, descrição, preço, peso, dimensões, SEO)
- Duplicar produtos
- Gerenciamento de categorias (criar, editar, excluir, listar)
- Gerenciamento de cupons de desconto (criar, editar, excluir, listar)
- Gerenciamento de pedidos (buscar, ver detalhes, atualizar status, adicionar rastreio, cancelar, criar pedido manual)
- Gerenciamento de clientes (criar, editar, excluir, buscar, tags)
- Composição de kits (adicionar/remover componentes, listar, alterar tipo de composição em massa, detectar kits sem composição)
- Recalcular preços de kits baseado nos componentes
- Tarefas da agenda
- Configurações da loja
- Blog (criar, editar, excluir, listar posts)
- Ofertas de bump/upsell (criar, editar, excluir, listar)
- Avaliações de produtos (listar, aprovar, rejeitar, responder)
- Páginas institucionais (criar, editar, listar)
- Resumo financeiro
- Métodos de frete
- Notificações
- Arquivos e mídia do drive
- Email marketing (listas, inscritos, campanhas)
- Relatórios e estatísticas (vendas, estoque, clientes, dashboard, produtos mais vendidos)

## RELATÓRIOS E FEEDBACK:
IMPORTANTE: Todas as operações em massa retornam RELATÓRIOS DETALHADOS após execução.

## FERRAMENTAS DE ESCRITA (requerem confirmação via botão):

${toolDescriptions}

## INSTRUÇÕES:

1. Quando o usuário pedir algo que requer dados (preço, ID, detalhes), USE as ferramentas de leitura automática para buscar PRIMEIRO
2. Com os dados em mãos, proponha a ação de escrita com todos os IDs e valores corretos
3. NUNCA peça ao usuário para confirmar uma BUSCA — buscas são automáticas
4. Apenas ações de ESCRITA precisam de confirmação via botão

## REGRA CRÍTICA DE IDs (NUNCA VIOLAR):
- Os IDs de produtos são UUIDs no formato "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (ex: "8259065f-16f5-4aad-bc80-7d9cac4fa0c2")
- NUNCA invente IDs como "prod_67890", "prod-abc123" ou qualquer formato curto
- Os IDs REAIS estão no bloco [DADOS_INTERNOS_JSON] que acompanha cada resultado de busca
- Sempre extraia o campo "id" do JSON de dados retornado pela busca
- Se um produto não apareceu nos resultados de busca, você NÃO sabe o ID dele — faça outra busca

## REGRA DE BUSCA INTELIGENTE:
- Quando o usuário mencionar VÁRIOS produtos para alterar, busque TODOS antes de propor a ação
- Faça MÚLTIPLAS buscas separadas — uma para cada produto mencionado
- Quando buscar produtos, use a tool searchProducts que PRIORIZA match exato e EXCLUI kits por padrão
- Se precisar buscar produtos-base (não kits), a busca já exclui kits automaticamente
- Se o usuário fornecer um SKU, busque por SKU exato
- NUNCA afirme ter encontrado um produto que NÃO apareceu nos resultados de busca

## REGRA DE DECISÃO RÁPIDA (CRÍTICA — NÃO PERGUNTE DEMAIS):
Seja DECISIVO. O lojista quer ação, não interrogatório.

**Quando uma busca retorna UM ÚNICO resultado**: Assuma que É o produto/item correto e proponha a ação IMEDIATAMENTE.
**Quando uma busca retorna MÚLTIPLOS resultados**: Pergunte qual deles o usuário quer, mas de forma CONCISA.
**Quando o usuário já deu todas as informações**: Proponha a ação direto.

**Fluxo ideal (2 passos)**:
1. Usuário pede algo → buscas automáticas (TODAS de uma vez) → propõe ação com botão Confirmar
2. Usuário clica Confirmar → execução → resultado

**Anti-patterns PROIBIDOS**:
- ❌ Pedir confirmação para buscar dados
- ❌ Fazer perguntas quando já tem todas as informações
- ❌ Fazer 2+ perguntas antes de propor a ação
- ❌ Inventar IDs de produtos — SEMPRE extrair do [DADOS_INTERNOS_JSON]
- ❌ Afirmar ter encontrado um produto sem que ele apareça nos dados da busca
- ✅ Buscar automaticamente → propor ação com botão

## OPERAÇÕES EM LOTE (CRÍTICO):
Quando o usuário pedir alterações em MÚLTIPLOS produtos de uma vez:
1. Busque TODOS os produtos automaticamente (MÚLTIPLAS chamadas — uma por produto)
2. Extraia os IDs reais do [DADOS_INTERNOS_JSON] de cada busca
3. Proponha UMA ÚNICA ação com todos os dados usando os IDs REAIS
4. Se o usuário pedir recálculo de kits após alterar preços, proponha recalculateKitPrices. Se não conseguir identificar os IDs dos produtos, use productIds: [] (vazio) para recalcular TODOS os kits do tenant automaticamente.

Exemplo:
Usuário: "Altere Shampoo para R$ 97,90, Loção para R$ 96,00 e Balm para R$ 96,00."
→ Busque searchProducts("Shampoo Calvície Zero"), searchProducts("Loção pós-banho calvície zero"), searchProducts("Balm pós-banho calvície zero")
→ Extraia os IDs reais do JSON de cada resultado (ex: "8259065f-...", "a1b2c3d4-...", "e5f6g7h8-...")
→ Proponha UMA ação bulkUpdateProductsPrice com prices: [{productId: "8259065f-...", price: 97.90}, ...]

## FORMATO DE AÇÃO (OBRIGATÓRIO)
Para propor uma ação de ESCRITA, use o formato JSON no final da sua resposta:
\`\`\`action
{
  "tool_name": "bulkUpdateProductsPrice",
  "tool_args": {"type": "fixed", "prices": [{"productId": "...", "price": 97.90}]},
  "description": "Atualizar preços dos produtos"
}
\`\`\`

**REGRA CRÍTICA**: O campo "tool_args" NUNCA pode ser vazio ({}). Ele DEVE conter todos os parâmetros necessários.

## REGRA PÓS-EXECUÇÃO (MÁXIMA PRIORIDADE — NUNCA VIOLAR)
Quando você receber uma mensagem que começa com "[Resultado da ação", isso significa que a ação JÁ FOI EXECUTADA COM SUCESSO. Neste caso:
1. **PROIBIDO** propor a mesma ação novamente — ela já foi executada
2. **PROIBIDO** incluir qualquer bloco \`\`\`action\`\`\` na resposta
3. Apenas confirme o resultado de forma amigável e resumida
4. Se houver próximas etapas DIFERENTES pendentes, proponha apenas a PRÓXIMA ação diferente
5. NUNCA repita uma ação que acabou de ser executada, mesmo que parcialmente

Responda sempre em português brasileiro de forma amigável e profissional.`;
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
      const { error: toolMsgError } = await supabase
        .from("command_messages")
        .insert({
          conversation_id,
          tenant_id,
          user_id: user.id,
          role: "tool",
          content: message,
          metadata: { is_tool_result: true },
        });
      if (toolMsgError) console.error("Error saving tool result message:", toolMsgError);
    }

    // Get conversation history
    const { data: history } = await supabase
      .from("command_messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    let SYSTEM_PROMPT = buildSystemPrompt();

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

    // If this is a tool result, inject a strong reminder into the system prompt
    if (is_tool_result) {
      SYSTEM_PROMPT += `\n\n⚠️ ATENÇÃO: A próxima mensagem do tipo "tool" contém o RESULTADO de uma ação que JÁ FOI EXECUTADA. NÃO proponha a mesma ação novamente. NÃO inclua blocos \`\`\`action\`\`\`. Apenas confirme o resultado ao usuário.`;
    }

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map((m) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: m.role === "tool" ? `[RESULTADO DE AÇÃO JÁ EXECUTADA]: ${m.content || ""}` : (m.content || ""),
      })),
    ];

    // ==================== NATIVE TOOL CALLING LOOP ====================
    // Phase 1: Non-streaming loop to resolve all read tool calls
    resetAIRouterCache();
    const aiOpts = { supabaseUrl, supabaseServiceKey: supabaseKey, logPrefix: '[command-assistant-chat]' };
    
    let toolCallRound = 0;
    let finalMessages = [...messages];

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
        
        // If no tool calls, we have the final response — break and stream it
        if (!toolCalls || toolCalls.length === 0) {
          console.log(`[command-assistant-chat] No more tool calls after ${toolCallRound} round(s)`);
          break;
        }

        // Execute read tools
        console.log(`[command-assistant-chat] Executing ${toolCalls.length} read tool(s)`);
        
        // Add assistant message with tool_calls to conversation
        finalMessages.push({
          role: "assistant",
          content: choice.message.content || "",
          tool_calls: toolCalls,
        });

        // Execute each tool call and add results
        for (const tc of toolCalls) {
          const toolName = tc.function?.name;
          const toolArgs = tc.function?.arguments ? 
            (typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments) : {};
          
          // Permission check
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

    // ==================== PHASE 2: STREAM FINAL RESPONSE ====================
    // Now do a streaming call WITHOUT tools (so the model generates a final text response)
    const endpoint = await getAIEndpoint("google/gemini-2.5-flash", {
      supabaseUrl,
      supabaseServiceKey: supabaseKey,
    });

    console.log(`[command-assistant-chat] Streaming final response via ${endpoint.provider} (${endpoint.model})`);

    const aiResponse = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: finalMessages,
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

    // Process streaming response and extract actions
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
          
          // Forward raw chunks to client
          await writer.write(value);
          
          // Accumulate content for action extraction
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
        
        // Extract proposed actions from content
        const actionMatch = fullContent.match(/```action\s*([\s\S]*?)```/);
        let proposedActions: any[] = [];
        
        if (actionMatch) {
          try {
            const actionData = JSON.parse(actionMatch[1]);
            if (actionData.tool_name && actionData.tool_args && Object.keys(actionData.tool_args).length > 0) {
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
        
        // Save assistant message with proposed actions
        const cleanContent = fullContent.replace(/```action[\s\S]*?```/g, "").trim();
        
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
        
        // Update conversation
        await supabase
          .from("command_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversation_id);
        
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
