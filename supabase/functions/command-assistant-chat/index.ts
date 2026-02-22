import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getAIEndpoint, resetAIRouterCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extended Tool registry - defines ALL available actions
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
    description: "Atualizar preços de produtos (aumento/desconto percentual ou valor fixo)",
    parameters: {
      type: { type: "string", required: true, description: "percent_increase, percent_decrease, fixed" },
      value: { type: "number", required: true, description: "Valor (percentual ou fixo em reais)" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional)" },
      categoryId: { type: "string", required: false, description: "Filtrar por categoria" },
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

  // === CATEGORIAS ===
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

  // === DESCONTOS/CUPONS ===
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

  // === PEDIDOS ===
  updateOrderStatus: {
    description: "Atualizar status de um pedido",
    parameters: {
      orderId: { type: "string", required: true, description: "ID do pedido" },
      status: { type: "string", required: true, description: "Novo status: pending, paid, shipped, delivered, cancelled" },
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
  salesReport: {
    description: "Gerar relatório de vendas",
    parameters: {
      period: { type: "string", required: true, description: "Período: today, week, month, custom" },
      startDate: { type: "string", required: false, description: "Data início (para custom)" },
      endDate: { type: "string", required: false, description: "Data fim (para custom)" },
    },
    requiredPermission: "orders",
  },

  // === CLIENTES ===
  createCustomer: {
    description: "Criar um novo cliente",
    parameters: {
      name: { type: "string", required: true, description: "Nome do cliente" },
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
  searchCustomers: {
    description: "Buscar clientes por nome, email ou telefone",
    parameters: {
      query: { type: "string", required: true, description: "Termo de busca" },
    },
    requiredPermission: "customers",
  },

  // === AGENDA ===
  createAgendaTask: {
    description: "Criar uma tarefa na Agenda",
    parameters: {
      title: { type: "string", required: true, description: "Título da tarefa" },
      dueAt: { type: "string", required: true, description: "Data/hora de vencimento" },
      description: { type: "string", required: false, description: "Descrição" },
      reminderOffsets: { type: "array", required: false, description: "Offsets de lembretes em minutos" },
    },
    requiredPermission: null,
  },
  listAgendaTasks: {
    description: "Listar tarefas da agenda",
    parameters: {
      status: { type: "string", required: false, description: "Filtrar por status: pending, done, all" },
      limit: { type: "number", required: false, description: "Limite de resultados" },
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

  // === FRETE/LOGÍSTICA ===
  updateShippingSettings: {
    description: "Atualizar configurações de frete",
    parameters: {
      freeShippingThreshold: { type: "number", required: false, description: "Valor mínimo para frete grátis (em reais)" },
      defaultShippingPrice: { type: "number", required: false, description: "Preço padrão do frete (em reais)" },
    },
    requiredPermission: "shipping",
  },

  // === RELATÓRIOS ===
  inventoryReport: {
    description: "Relatório de estoque",
    parameters: {
      lowStockThreshold: { type: "number", required: false, description: "Limite para considerar estoque baixo" },
    },
    requiredPermission: "products",
  },
  customersReport: {
    description: "Relatório de clientes",
    parameters: {
      period: { type: "string", required: true, description: "Período: week, month, year" },
    },
    requiredPermission: "customers",
  },

  // === CONFIGURAÇÕES DA LOJA ===
  updateStoreSettings: {
    description: "Atualizar configurações gerais da loja",
    parameters: {
      storeName: { type: "string", required: false, description: "Nome da loja" },
      storeEmail: { type: "string", required: false, description: "Email da loja" },
      storePhone: { type: "string", required: false, description: "Telefone da loja" },
    },
    requiredPermission: "settings",
  },

  // === COMPOSIÇÃO DE KITS ===
  addProductComponent: {
    description: "Adicionar componente a um kit (produto com composição). Também converte o produto para formato kit se necessário.",
    parameters: {
      parentProductId: { type: "string", required: true, description: "ID do produto kit (pai)" },
      componentProductId: { type: "string", required: true, description: "ID do produto componente" },
      quantity: { type: "number", required: true, description: "Quantidade do componente no kit" },
    },
    requiredPermission: "products",
  },
  removeProductComponent: {
    description: "Remover componente de um kit",
    parameters: {
      parentProductId: { type: "string", required: true, description: "ID do produto kit" },
      componentProductId: { type: "string", required: true, description: "ID do componente a remover" },
    },
    requiredPermission: "products",
  },
  listProductComponents: {
    description: "Listar componentes de um kit e seus dados",
    parameters: {
      parentProductId: { type: "string", required: true, description: "ID do produto kit" },
    },
    requiredPermission: "products",
  },
  bulkSetCompositionType: {
    description: "Alterar o tipo de composição (estoque físico ou virtual) de kits em massa",
    parameters: {
      stockType: { type: "string", required: true, description: "Tipo: 'physical' ou 'virtual'" },
      productIds: { type: "array", required: false, description: "IDs específicos (opcional, se vazio aplica a todos os kits)" },
    },
    requiredPermission: "products",
  },
  autoCreateKitCompositions: {
    description: "Detectar produtos com nome de kit (ex: 'Kit X (2x)') que estão sem composição e criar automaticamente baseado no padrão do nome",
    parameters: {},
    requiredPermission: "products",
  },
};

// Build dynamic system prompt with all available tools
function buildSystemPrompt(): string {
  const toolDescriptions = Object.entries(TOOL_REGISTRY)
    .map(([name, tool]) => {
      const params = Object.entries(tool.parameters)
        .map(([pName, pDef]: [string, any]) => `  - ${pName}${pDef.required ? " (obrigatório)" : ""}: ${pDef.description}`)
        .join("\n");
      return `• ${name}: ${tool.description}\n${params}`;
    })
    .join("\n\n");

  return `Você é o Auxiliar de Comando, um assistente inteligente para e-commerce com poderes COMPLETOS para gerenciar a loja.

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
- tool_name / tool_args → NUNCA mencionar esses termos
- tenant_id, user_id, conversation_id → NUNCA mencionar

Exemplo PROIBIDO: "Vou usar a ferramenta bulkUpdateProductsNCM para atualizar..."
Exemplo CORRETO: "Vou atualizar o NCM de todos os produtos para 33051000."

Você pode executar QUALQUER operação que o usuário faria manualmente no painel, incluindo:
- Operações em massa em produtos (NCM, CEST, preços, estoque, ativar/desativar)
- Gerenciamento de categorias
- Gerenciamento de cupons de desconto
- Gerenciamento de pedidos e status
- Gerenciamento de clientes e tags
- Composição de kits (adicionar/remover componentes, listar, alterar tipo de composição em massa, detectar kits sem composição)
- Tarefas da agenda
- Configurações da loja
- Relatórios diversos

## RELATÓRIOS E FEEDBACK:
IMPORTANTE: Todas as operações em massa retornam RELATÓRIOS DETALHADOS após execução, incluindo:
- Total de itens processados
- Quantidade de itens atualizados com sucesso
- Exemplos de itens afetados (nome, SKU)
- Contagem de itens que já tinham o valor

Quando o usuário pedir relatório ou resumo da operação, INFORME que ele receberá o relatório completo após confirmar a ação.

## FERRAMENTAS DISPONÍVEIS (uso interno — NUNCA exponha esses nomes ao usuário):

${toolDescriptions}

## INSTRUÇÕES:

1. Quando o usuário pedir para executar uma ação, entenda claramente o que ele quer
2. Proponha a ação com linguagem natural e amigável (sem jargão técnico)
3. INFORME que após confirmar, ele receberá um relatório detalhado da operação
4. Aguarde a confirmação antes de executar

IMPORTANTE: Você NÃO executa ações diretamente. Você apenas propõe ações que o usuário pode confirmar.

Para propor uma ação, use o formato JSON no final da sua resposta (o bloco action é processado internamente e NÃO aparece para o usuário):
\`\`\`action
{
  "tool_name": "bulkUpdateProductsNCM",
  "tool_args": {"ncm": "33051000"},
  "description": "Atualizar NCM de todos os produtos para 33051000"
}
\`\`\`

## EXEMPLOS:

Usuário: "Coloque o NCM 33051000 em todos os produtos e me dê um relatório"
Resposta: Vou atualizar o NCM de todos os seus produtos para **33051000**. Após confirmar, você receberá um relatório completo com a quantidade de produtos atualizados e exemplos.
\`\`\`action
{"tool_name": "bulkUpdateProductsNCM", "tool_args": {"ncm": "33051000"}, "description": "Atualizar NCM de todos os produtos para 33051000"}
\`\`\`

Usuário: "Aumente o preço de todos os produtos em 10%"
Resposta: Vou aumentar o preço de todos os seus produtos em **10%**. O relatório mostrará quantos produtos foram afetados e exemplos dos novos valores.
\`\`\`action
{"tool_name": "bulkUpdateProductsPrice", "tool_args": {"type": "percent_increase", "value": 10}, "description": "Aumentar preços em 10%"}
\`\`\`

Responda sempre em português brasileiro de forma amigável e profissional. Seja proativo em sugerir o que você pode fazer, mas SEMPRE usando linguagem que o lojista entende.`;
}

serve(async (req) => {
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

    const { conversation_id, message, tenant_id } = await req.json();

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

    if (msgError) {
      console.error("Error saving message:", msgError);
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
        console.log(`[command-assistant] Memory context injected (${memoryContext.length} chars)`);
      }
    } catch (e) {
      console.error("[command-assistant] Memory fetch error:", e);
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map((m) => ({
        role: m.role === "tool" ? "assistant" : m.role,
        content: m.content || "",
      })),
    ];

    // Call AI via centralized router (Gemini/OpenAI native → Lovable fallback)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    resetAIRouterCache();

    const endpoint = await getAIEndpoint("google/gemini-2.5-flash", {
      supabaseUrl,
      supabaseServiceKey,
    });

    console.log(`[command-assistant-chat] Using provider: ${endpoint.provider}, model: ${endpoint.model}`);

    const aiResponse = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages,
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
    
    // Create a TransformStream to process and forward the stream
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
          
          // Also accumulate content for action extraction
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
            proposedActions = [{
              id: crypto.randomUUID(),
              tool_name: actionData.tool_name,
              tool_args: actionData.tool_args,
              description: actionData.description,
            }];
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
