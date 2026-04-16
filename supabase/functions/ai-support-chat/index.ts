import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { redactPII } from "../_shared/redact-pii.ts";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIRule {
  id: string;
  condition: string;
  action: 'respond' | 'transfer' | 'escalate' | 'suggest';
  response?: string;
  priority: number;
  is_active: boolean;
  category: string;
}

interface ChannelConfig {
  is_enabled: boolean;
  system_prompt_override: string | null;
  forbidden_topics: string[] | null;
  max_response_length: number | null;
  use_emojis: boolean | null;
  custom_instructions: string | null;
}

interface KnowledgeChunk {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  doc_type: string;
  doc_priority: number;
  chunk_text: string;
  similarity: number;
}

interface IntentClassification {
  intent: 'question' | 'complaint' | 'action_request' | 'greeting' | 'thanks' | 'general' | 'purchase_intent';
  sentiment: 'positive' | 'neutral' | 'negative' | 'aggressive';
  urgency: 'low' | 'medium' | 'high';
  requires_action: boolean;
  topics: string[];
  summary: string;
}

// OpenAI models ordered by priority (highest quality first)
const OPENAI_MODELS = [
  "gpt-5.2",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4o-2024-11-20",
  "gpt-4o",
] as const;

type OpenAIModel = typeof OPENAI_MODELS[number];

// AI cost tracking (per 1K tokens, in cents)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-5.2": { input: 3.0, output: 15.0 },
  "gpt-5": { input: 2.5, output: 10.0 },
  "gpt-5-mini": { input: 0.4, output: 1.6 },
  "gpt-5-nano": { input: 0.15, output: 0.6 },
  "gpt-4o-2024-11-20": { input: 0.25, output: 1.0 },
  "gpt-4o": { input: 0.25, output: 1.0 },
};

// Guardrails for informative-only support
const INFORMATIVE_GUARDRAILS = `
========================================
⚠️ REGRAS OBRIGATÓRIAS DE ATENDIMENTO (SOMENTE INFORMATIVO)
========================================

VOCÊ É UM ASSISTENTE PURAMENTE INFORMATIVO. SIGA RIGOROSAMENTE:

1. **NUNCA EXECUTE AÇÕES:**
   - NÃO cancele, altere ou reembolse pedidos
   - NÃO modifique dados do cliente ou cadastro
   - NÃO processe pagamentos ou estornos
   - NÃO aplique cupons ou descontos não informados
   - NÃO faça promessas de resolução ("vou resolver", "já está feito")

2. **SEMPRE INFORME E ESCALONE:**
   - Se o cliente pedir QUALQUER AÇÃO, diga: "Para isso, vou transferir você para um atendente humano que pode ajudar."
   - Se houver reclamação de pagamento, erro de cobrança, ou problema técnico: ESCALONE para humano
   - Se o cliente estiver irritado ou insatisfeito: ESCALONE para humano
   - Se a pergunta for sobre pedido que você não encontra nos dados: ESCALONE para humano

3. **NUNCA INVENTE INFORMAÇÕES:**
   - Se não encontrar o dado na base de conhecimento, diga: "Não encontrei essa informação. Deixe-me transferir para um atendente que pode verificar."
   - NUNCA crie prazos, políticas ou valores fictícios
   - NUNCA assuma status de pedidos que não estejam nos dados fornecidos

4. **COLETA MÍNIMA PARA ESCALONAMENTO:**
   - Quando escalonar, pergunte: nome, número do pedido (se aplicável), e um breve resumo do problema
   - Confirme que um atendente entrará em contato em breve

5. **LINGUAGEM ADEQUADA:**
   - Seja empático, educado e profissional
   - Use frases como: "Entendo sua situação", "Vou verificar isso para você", "Um momento"
   - Evite linguagem que pareça que você tem poderes de ação

LEMBRE-SE: Você INFORMA e ORIENTA. Você NÃO EXECUTA nem PROMETE execução.
`;

// Sales agent prompt (replaces INFORMATIVE_GUARDRAILS when sales mode is on)
const SALES_AGENT_PROMPT = `
========================================
🛒 MODO VENDAS — AGENTE DE VENDAS CONVERSACIONAL
========================================

Você é um agente de vendas consultivo. Seu objetivo é AJUDAR o cliente a encontrar o produto ideal e finalizar a compra de forma natural e agradável.

FLUXO DE VENDA (siga esta ordem):

1. **IDENTIFICAR INTENÇÃO DE COMPRA:**
   - Quando o cliente mencionar interesse em produto, categoria ou necessidade, use a ferramenta search_products para buscar opções
   - Pergunte sobre preferências (cor, tamanho, faixa de preço) para refinar sugestões

2. **APRESENTAR PRODUTOS:**
   - Use get_product_details para obter informações completas
   - Apresente preço, disponibilidade e principais características
   - Sugira até 3 opções relevantes por vez
   - NUNCA invente preços ou características — use APENAS dados das ferramentas

3. **CUPONS E DESCONTOS:**
   - Use check_coupon para validar cupons mencionados pelo cliente
   - Use check_customer_coupon_eligibility para verificar se o cliente pode usar o cupom
   - Ofereça cupons ativos quando for estratégico (ex: cliente hesitante)

4. **CARRINHO CONVERSACIONAL:**
   - Use add_to_cart quando o cliente confirmar interesse em um produto
   - Use view_cart para mostrar o resumo do carrinho
   - Use remove_from_cart se o cliente pedir para remover algo
   - Use apply_coupon para aplicar descontos ao carrinho

5. **UPSELL E OFERTAS:**
   - Use check_upsell_offers para verificar ofertas de aumento de ticket
   - Sugira ofertas de forma natural, sem pressão ("Aproveitando que você está levando X, temos uma oferta especial...")

6. **COLETA DE DADOS DO CLIENTE (OBRIGATÓRIO antes de gerar o link):**
   - Pergunte se o cliente já comprou antes na loja
   - Se SIM: peça o email e use lookup_customer para buscar o cadastro
     - Se encontrar: confirme o nome e use os dados (CPF, endereço) já cadastrados
     - Se não encontrar: informe que não encontrou e peça os dados necessários
   - Se NÃO ou se não encontrou o cadastro: solicite os dados obrigatórios:
     - Nome completo
     - Email
     - CPF (obrigatório para emissão de nota fiscal)
     - CEP (para calcular o frete)
   - Após receber o CEP, use calculate_shipping para informar o valor do frete
   - Use save_customer_data para salvar os dados coletados no carrinho

7. **FRETE:**
   - Use calculate_shipping com o CEP do cliente e os produtos do carrinho
   - Informe as opções de frete disponíveis (preço e prazo)
   - Se houver frete grátis, destaque isso como vantagem

8. **RESUMO E CONFIRMAÇÃO:**
   - Antes de gerar o link, apresente um resumo completo:
     - Produtos e quantidades
     - Subtotal
     - Desconto (se houver cupom)
     - Frete (valor e prazo)
     - Total final
   - Peça confirmação explícita do cliente

9. **FINALIZAR COMPRA:**
   - Após confirmação, use generate_checkout_link para criar o link
   - O link já virá com os dados do cliente preenchidos (nome, email, CPF, endereço)
   - O cliente só precisa escolher a forma de pagamento e confirmar
   - Envie o link com uma mensagem amigável

10. **REGRAS DE SEGURANÇA:**
    - NUNCA invente preços, descontos ou promoções
    - Respeite estoque: se indisponível, informe e sugira alternativas
    - Não force venda — se o cliente não quiser, respeite
    - Para problemas com pedidos anteriores, ESCALONE para humano
    - Mantenha tom consultivo e amigável, nunca agressivo ou insistente

11. **ESCALONAMENTO:**
    - Reclamações, problemas com pedidos, estornos → ESCALONE para humano
    - Cliente irritado ou agressivo → ESCALONE para humano
    - Dúvidas que não envolvem venda e não estão na base → ESCALONE para humano
`;

// ==============================
// SALES TOOL DEFINITIONS
// ==============================
const SALES_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Busca produtos no catálogo por nome, categoria ou termo de busca. Retorna lista resumida.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca (nome do produto, categoria, etc.)" },
          limit: { type: "number", description: "Máximo de resultados (default: 5)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Retorna informações detalhadas de um produto específico (preço, estoque, descrição, imagens).",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "UUID do produto" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_coupon",
      description: "Valida um cupom de desconto: verifica se está ativo, dentro da validade e limite de uso.",
      parameters: {
        type: "object",
        properties: {
          coupon_code: { type: "string", description: "Código do cupom" },
        },
        required: ["coupon_code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_customer_coupon_eligibility",
      description: "Verifica se o cliente específico pode usar um cupom (já usou antes? atingiu limite?).",
      parameters: {
        type: "object",
        properties: {
          coupon_code: { type: "string", description: "Código do cupom" },
          customer_id: { type: "string", description: "UUID do cliente" },
        },
        required: ["coupon_code", "customer_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Adiciona um produto ao carrinho da conversa.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "UUID do produto" },
          quantity: { type: "number", description: "Quantidade (default: 1)" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "view_cart",
      description: "Mostra o conteúdo atual do carrinho da conversa.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_from_cart",
      description: "Remove um produto do carrinho da conversa.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "UUID do produto a remover" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_coupon",
      description: "Aplica um cupom de desconto ao carrinho da conversa.",
      parameters: {
        type: "object",
        properties: {
          coupon_code: { type: "string", description: "Código do cupom" },
        },
        required: ["coupon_code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_upsell_offers",
      description: "Verifica ofertas de upsell/aumento de ticket disponíveis para o carrinho atual.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_checkout_link",
      description: "Gera um link de checkout pré-preenchido com os itens do carrinho, cupom e dados do cliente. Chamar APENAS após coletar dados do cliente e obter confirmação.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_customer",
      description: "Consulta o cadastro do cliente na loja para obter dados pessoais (nome, CPF, endereço), histórico de compras e informações de fidelidade.",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Telefone do cliente (opcional)" },
          email: { type: "string", description: "Email do cliente (opcional)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_shipping",
      description: "Calcula o frete para o CEP do cliente com base nos produtos do carrinho. Retorna opções de frete com preço e prazo.",
      parameters: {
        type: "object",
        properties: {
          postal_code: { type: "string", description: "CEP do cliente (somente números ou com hífen)" },
        },
        required: ["postal_code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_customer_data",
      description: "Salva os dados do cliente coletados durante a conversa no carrinho (nome, email, CPF, CEP, endereço). Usar após coletar os dados obrigatórios.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome completo do cliente" },
          email: { type: "string", description: "Email do cliente" },
          cpf: { type: "string", description: "CPF do cliente" },
          phone: { type: "string", description: "Telefone do cliente" },
          postal_code: { type: "string", description: "CEP do cliente" },
          street: { type: "string", description: "Rua/logradouro" },
          number: { type: "string", description: "Número" },
          complement: { type: "string", description: "Complemento (opcional)" },
          neighborhood: { type: "string", description: "Bairro" },
          city: { type: "string", description: "Cidade" },
          state: { type: "string", description: "Estado (UF)" },
        },
        required: ["name", "email", "cpf"],
        additionalProperties: false,
      },
    },
  },
];

// Intent classification tool definition (updated with purchase_intent)
const INTENT_CLASSIFICATION_TOOL = {
  type: "function",
  function: {
    name: "classify_intent",
    description: "Classifica a intenção, sentimento e urgência da mensagem do cliente",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["question", "complaint", "action_request", "greeting", "thanks", "general", "purchase_intent"],
          description: "Tipo de intenção: question=pergunta, complaint=reclamação, action_request=pedido de ação, greeting=saudação, thanks=agradecimento, general=outro, purchase_intent=interesse em comprar"
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative", "aggressive"],
          description: "Sentimento do cliente"
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgência"
        },
        requires_action: {
          type: "boolean",
          description: "Se true, o cliente está solicitando uma AÇÃO (cancelamento, reembolso, alteração)"
        },
        topics: {
          type: "array",
          items: { type: "string" },
          description: "Lista de tópicos mencionados"
        },
        summary: {
          type: "string",
          description: "Resumo breve da mensagem em até 50 palavras"
        }
      },
      required: ["intent", "sentiment", "urgency", "requires_action", "topics", "summary"],
      additionalProperties: false
    }
  }
};

// ==============================
// SALES TOOL EXECUTORS
// ==============================
async function executeSalesTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: {
    supabase: ReturnType<typeof createClient>;
    tenantId: string;
    conversationId: string;
    customerId: string | null;
    storeUrl: string;
    customerPhone: string | null;
    customerEmail: string | null;
    customerName: string | null;
  }
): Promise<string> {
  const { supabase, tenantId, conversationId, customerId, storeUrl, customerPhone, customerEmail, customerName } = ctx;

  try {
    switch (toolName) {
      case "search_products": {
        const query = (args.query as string) || "";
        const limit = (args.limit as number) || 5;
        
        const { data, error } = await supabase
          .from("products")
          .select("id, name, slug, price, compare_at_price, stock_quantity, status, images")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .is("deleted_at", null)
          .ilike("name", `%${query}%`)
          .limit(limit);

        if (error) {
          // Fallback: try fuzzy search via RPC if available
          const { data: fuzzyData } = await (supabase as any).rpc("search_products_fuzzy", {
            p_tenant_id: tenantId,
            p_query: query,
            p_limit: limit,
          });
          if (fuzzyData?.length) {
            return JSON.stringify(fuzzyData.map((p: any) => ({
              id: p.id, name: p.name, price: p.price, stock: p.stock_quantity,
              image: p.images?.[0] || null,
            })));
          }
          return JSON.stringify({ error: "Nenhum produto encontrado", query });
        }

        if (!data?.length) return JSON.stringify({ message: "Nenhum produto encontrado para a busca.", query });

        return JSON.stringify(data.map(p => ({
          id: p.id, name: p.name, slug: p.slug,
          price: p.price, compare_at_price: p.compare_at_price,
          stock: p.stock_quantity,
          image: (p.images as any)?.[0] || null,
        })));
      }

      case "get_product_details": {
        const productId = args.product_id as string;
        const { data, error } = await supabase
          .from("products")
          .select("id, name, slug, description, price, compare_at_price, stock_quantity, status, images, weight, sku")
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .single();

        if (error || !data) return JSON.stringify({ error: "Produto não encontrado" });

        return JSON.stringify({
          id: data.id, name: data.name, slug: data.slug,
          description: data.description?.slice(0, 500),
          price: data.price, compare_at_price: data.compare_at_price,
          stock: data.stock_quantity,
          available: data.status === "active" && (data.stock_quantity ?? 0) > 0,
          images: (data.images as any[])?.slice(0, 3) || [],
          sku: data.sku, weight: data.weight,
        });
      }

      case "check_coupon": {
        const code = (args.coupon_code as string).toUpperCase().trim();
        const { data, error } = await supabase
          .from("discounts")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("code", code)
          .maybeSingle();

        if (error || !data) return JSON.stringify({ valid: false, reason: "Cupom não encontrado" });

        const now = new Date();
        if (!data.is_active) return JSON.stringify({ valid: false, reason: "Cupom desativado" });
        if (data.starts_at && new Date(data.starts_at) > now) return JSON.stringify({ valid: false, reason: "Cupom ainda não válido" });
        if (data.ends_at && new Date(data.ends_at) < now) return JSON.stringify({ valid: false, reason: "Cupom expirado" });
        if (data.max_uses && data.total_uses >= data.max_uses) return JSON.stringify({ valid: false, reason: "Cupom esgotado" });

        return JSON.stringify({
          valid: true,
          code: data.code,
          type: data.discount_type,
          value: data.discount_value,
          min_order_value: data.min_order_value,
          max_discount_value: data.max_discount_value,
          remaining_uses: data.max_uses ? data.max_uses - (data.total_uses || 0) : "ilimitado",
        });
      }

      case "check_customer_coupon_eligibility": {
        const code = (args.coupon_code as string).toUpperCase().trim();
        const custId = args.customer_id as string;

        const { data: discount } = await supabase
          .from("discounts")
          .select("id, max_uses_per_customer")
          .eq("tenant_id", tenantId)
          .eq("code", code)
          .maybeSingle();

        if (!discount) return JSON.stringify({ eligible: false, reason: "Cupom não encontrado" });

        const { count } = await supabase
          .from("discount_redemptions")
          .select("id", { count: "exact", head: true })
          .eq("discount_id", discount.id)
          .eq("customer_id", custId);

        const used = count || 0;
        const maxPerCustomer = discount.max_uses_per_customer || 1;

        if (used >= maxPerCustomer) {
          return JSON.stringify({ eligible: false, reason: `Cliente já usou este cupom ${used} vez(es). Limite: ${maxPerCustomer}` });
        }

        return JSON.stringify({ eligible: true, uses_remaining: maxPerCustomer - used });
      }

      case "add_to_cart": {
        const productId = args.product_id as string;
        const quantity = (args.quantity as number) || 1;

        // Get product info
        const { data: product } = await supabase
          .from("products")
          .select("id, name, price, stock_quantity, status")
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .single();

        if (!product) return JSON.stringify({ success: false, error: "Produto não encontrado" });
        if (product.status !== "active") return JSON.stringify({ success: false, error: "Produto indisponível" });
        if ((product.stock_quantity ?? 0) < quantity) return JSON.stringify({ success: false, error: `Estoque insuficiente. Disponível: ${product.stock_quantity}` });

        // Get or create cart
        let { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        const items = cart?.items as any[] || [];
        const existingIdx = items.findIndex((i: any) => i.product_id === productId);

        if (existingIdx >= 0) {
          items[existingIdx].quantity += quantity;
          items[existingIdx].subtotal = items[existingIdx].quantity * product.price;
        } else {
          items.push({
            product_id: productId,
            name: product.name,
            price: product.price,
            quantity,
            subtotal: quantity * product.price,
          });
        }

        const subtotalCents = Math.round(items.reduce((s: number, i: any) => s + i.subtotal * 100, 0));

        if (cart) {
          await supabase
            .from("whatsapp_carts")
            .update({ items, subtotal_cents: subtotalCents, updated_at: new Date().toISOString() })
            .eq("id", cart.id);
        } else {
          await supabase
            .from("whatsapp_carts")
            .insert({
              conversation_id: conversationId,
              tenant_id: tenantId,
              customer_id: customerId,
              items,
              subtotal_cents: subtotalCents,
              status: "active",
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            });
        }

        return JSON.stringify({
          success: true,
          message: `${product.name} (x${quantity}) adicionado ao carrinho`,
          cart_total: `R$ ${(subtotalCents / 100).toFixed(2)}`,
          items_count: items.length,
        });
      }

      case "view_cart": {
        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        if (!cart || !(cart.items as any[])?.length) {
          return JSON.stringify({ empty: true, message: "Carrinho vazio" });
        }

        const items = cart.items as any[];
        return JSON.stringify({
          items: items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            price: `R$ ${i.price.toFixed(2)}`,
            subtotal: `R$ ${i.subtotal.toFixed(2)}`,
          })),
          coupon: cart.coupon_code || null,
          total: `R$ ${(cart.subtotal_cents / 100).toFixed(2)}`,
        });
      }

      case "remove_from_cart": {
        const productId = args.product_id as string;

        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        if (!cart) return JSON.stringify({ success: false, error: "Carrinho vazio" });

        const items = (cart.items as any[]).filter((i: any) => i.product_id !== productId);
        const subtotalCents = Math.round(items.reduce((s: number, i: any) => s + i.subtotal * 100, 0));

        await supabase
          .from("whatsapp_carts")
          .update({ items, subtotal_cents: subtotalCents, updated_at: new Date().toISOString() })
          .eq("id", cart.id);

        return JSON.stringify({ success: true, items_count: items.length, total: `R$ ${(subtotalCents / 100).toFixed(2)}` });
      }

      case "apply_coupon": {
        const code = (args.coupon_code as string).toUpperCase().trim();

        // Validate coupon first
        const { data: discount } = await supabase
          .from("discounts")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("code", code)
          .eq("is_active", true)
          .maybeSingle();

        if (!discount) return JSON.stringify({ success: false, error: "Cupom inválido ou expirado" });

        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        if (!cart) return JSON.stringify({ success: false, error: "Carrinho vazio" });

        // Check min order value
        if (discount.min_order_value && cart.subtotal_cents / 100 < discount.min_order_value) {
          return JSON.stringify({
            success: false,
            error: `Valor mínimo do pedido: R$ ${discount.min_order_value.toFixed(2)}. Carrinho: R$ ${(cart.subtotal_cents / 100).toFixed(2)}`,
          });
        }

        await supabase
          .from("whatsapp_carts")
          .update({ coupon_code: code, updated_at: new Date().toISOString() })
          .eq("id", cart.id);

        let discountText = "";
        if (discount.discount_type === "percentage") {
          discountText = `${discount.discount_value}% de desconto`;
        } else {
          discountText = `R$ ${discount.discount_value.toFixed(2)} de desconto`;
        }

        return JSON.stringify({ success: true, coupon: code, discount: discountText });
      }

      case "check_upsell_offers": {
        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        if (!cart || !(cart.items as any[])?.length) {
          return JSON.stringify({ offers: [], message: "Carrinho vazio" });
        }

        const cartTotal = cart.subtotal_cents / 100;
        const cartProductIds = (cart.items as any[]).map((i: any) => i.product_id);

        // Get active offer rules
        const { data: offers } = await supabase
          .from("offer_rules")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("is_active", true);

        if (!offers?.length) return JSON.stringify({ offers: [], message: "Sem ofertas disponíveis" });

        const matchedOffers: any[] = [];

        for (const offer of offers) {
          // Check min_cart_value
          if (offer.min_cart_value && cartTotal < offer.min_cart_value) continue;

          // Check trigger products
          if (offer.trigger_product_ids?.length) {
            const hasTrigger = offer.trigger_product_ids.some((id: string) => cartProductIds.includes(id));
            if (!hasTrigger) continue;
          }

          // Get offer product details
          if (offer.offer_product_id) {
            const { data: offerProduct } = await supabase
              .from("products")
              .select("id, name, price, images")
              .eq("id", offer.offer_product_id)
              .single();

            if (offerProduct) {
              matchedOffers.push({
                rule_name: offer.name,
                type: offer.offer_type,
                product: { id: offerProduct.id, name: offerProduct.name, price: offerProduct.price },
                discount_type: offer.discount_type,
                discount_value: offer.discount_value,
                message: offer.display_message,
              });
            }
          }
        }

        return JSON.stringify({ offers: matchedOffers });
      }

      case "generate_checkout_link": {
        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        if (!cart || !(cart.items as any[])?.length) {
          return JSON.stringify({ success: false, error: "Carrinho vazio. Adicione produtos antes de gerar o link." });
        }

        const items = cart.items as any[];
        const mainItem = items[0];
        const additionalItems = items.slice(1);

        // Create checkout_link record
        const slug = `wpp-${Date.now().toString(36)}`;
        const { data: checkoutLink, error: linkError } = await supabase
          .from("checkout_links")
          .insert({
            tenant_id: tenantId,
            name: `WhatsApp Cart - ${conversationId.slice(0, 8)}`,
            slug,
            product_id: mainItem.product_id,
            quantity: mainItem.quantity,
            coupon_code: cart.coupon_code || null,
            additional_products: additionalItems.map((i: any) => ({
              product_id: i.product_id,
              quantity: i.quantity,
            })),
            is_active: true,
            expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .single();

        if (linkError || !checkoutLink) {
          console.error("[sales-tool] checkout link creation error:", linkError);
          return JSON.stringify({ success: false, error: "Erro ao gerar link de checkout" });
        }

        // Build the checkout URL with customer data from cart or conversation
        const custData = (cart.customer_data as Record<string, string>) || {};
        const params = new URLSearchParams();
        params.set("link", slug);
        // Customer identification
        const cName = custData.name || customerName;
        const cEmail = custData.email || customerEmail;
        const cPhone = custData.phone || customerPhone;
        const cCpf = custData.cpf;
        if (cName) params.set("name", cName);
        if (cEmail) params.set("email", cEmail);
        if (cPhone) params.set("phone", cPhone);
        if (cCpf) params.set("cpf", cCpf);
        // Address data
        if (custData.postal_code) params.set("cep", custData.postal_code);
        if (custData.street) params.set("street", custData.street);
        if (custData.number) params.set("number", custData.number);
        if (custData.complement) params.set("complement", custData.complement);
        if (custData.neighborhood) params.set("neighborhood", custData.neighborhood);
        if (custData.city) params.set("city", custData.city);
        if (custData.state) params.set("state", custData.state);

        const checkoutUrl = `${storeUrl}/checkout?${params.toString()}`;

        // Mark cart as converted
        await supabase
          .from("whatsapp_carts")
          .update({ status: "converted", updated_at: new Date().toISOString() })
          .eq("id", cart.id);

        return JSON.stringify({
          success: true,
          checkout_url: checkoutUrl,
          items_count: items.length,
          total: `R$ ${(cart.subtotal_cents / 100).toFixed(2)}`,
          coupon: cart.coupon_code || null,
        });
      }

      case "lookup_customer": {
        const phone = args.phone as string | undefined;
        const email = args.email as string | undefined;

        let query = supabase
          .from("customers")
          .select("id, full_name, email, phone, cpf, person_type, total_orders, total_spent, first_order_at, last_order_at, loyalty_tier, tags")
          .eq("tenant_id", tenantId);

        if (phone) query = query.or(`phone.eq.${phone}`);
        if (email) query = query.or(`email.eq.${email}`);

        const { data: customer } = await query.maybeSingle();

        if (!customer) return JSON.stringify({ found: false, message: "Cliente não encontrado no cadastro" });

        // Fetch default address if available
        let address = null;
        const { data: addr } = await supabase
          .from("customer_addresses")
          .select("street, number, complement, neighborhood, city, state, postal_code")
          .eq("customer_id", customer.id)
          .eq("is_default", true)
          .maybeSingle();
        if (addr) address = addr;

        // Auto-save customer data to active cart
        const custDataForCart: Record<string, string> = {
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone || "",
        };
        if (customer.cpf) custDataForCart.cpf = customer.cpf;
        if (address) {
          custDataForCart.postal_code = address.postal_code;
          custDataForCart.street = address.street;
          custDataForCart.number = address.number;
          if (address.complement) custDataForCart.complement = address.complement;
          custDataForCart.neighborhood = address.neighborhood;
          custDataForCart.city = address.city;
          custDataForCart.state = address.state;
        }

        // Save to cart if active
        await supabase
          .from("whatsapp_carts")
          .update({ customer_data: custDataForCart, customer_id: customer.id, updated_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active");

        return JSON.stringify({
          found: true,
          id: customer.id,
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          cpf: customer.cpf,
          has_address: !!address,
          address: address ? {
            street: address.street,
            number: address.number,
            complement: address.complement,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
          } : null,
          total_orders: customer.total_orders,
          total_spent: customer.total_spent ? `R$ ${customer.total_spent.toFixed(2)}` : "R$ 0,00",
          tier: customer.loyalty_tier,
          tags: customer.tags,
        });
      }

      case "calculate_shipping": {
        const postalCode = (args.postal_code as string || "").replace(/\D/g, "");
        if (postalCode.length !== 8) {
          return JSON.stringify({ success: false, error: "CEP inválido. Informe um CEP com 8 dígitos." });
        }

        // Get cart items to calculate shipping
        const { data: shippingCart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        if (!shippingCart || !(shippingCart.items as any[])?.length) {
          return JSON.stringify({ success: false, error: "Carrinho vazio. Adicione produtos antes de calcular o frete." });
        }

        const cartItems = shippingCart.items as any[];
        
        // Get product details for weight/dimensions
        const productIds = cartItems.map((i: any) => i.product_id);
        const { data: shippingProducts } = await supabase
          .from("products")
          .select("id, name, weight, width, height, length")
          .in("id", productIds)
          .eq("tenant_id", tenantId);

        // Build items for shipping quote
        const shippingItems = cartItems.map((item: any) => {
          const prod = shippingProducts?.find((p: any) => p.id === item.product_id);
          return {
            product_id: item.product_id,
            quantity: item.quantity,
            weight: prod?.weight || 300,
            width: prod?.width || 11,
            height: prod?.height || 2,
            length: prod?.length || 16,
          };
        });

        // Call shipping-quote edge function
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

        try {
          const shippingResp = await fetch(`${supabaseUrl}/functions/v1/shipping-quote`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
              "apikey": serviceKey,
              "x-tenant-id": tenantId,
            },
            body: JSON.stringify({
              tenant_id: tenantId,
              postal_code: postalCode,
              items: shippingItems,
            }),
          });

          if (!shippingResp.ok) {
            const errText = await shippingResp.text();
            console.error("[sales-tool] shipping quote error:", errText);
            return JSON.stringify({ success: false, error: "Não foi possível calcular o frete. Tente novamente." });
          }

          const shippingData = await shippingResp.json();
          const options = (shippingData.options || shippingData || []).map((opt: any) => ({
            carrier: opt.carrier || opt.name || "Transportadora",
            service: opt.service || opt.name || "",
            price: opt.price != null ? `R$ ${Number(opt.price).toFixed(2)}` : "Grátis",
            price_cents: opt.price != null ? Math.round(Number(opt.price) * 100) : 0,
            delivery_days: opt.delivery_days || opt.days || opt.deadline || null,
            is_free: opt.price === 0 || opt.price === "0" || opt.is_free,
          }));

          return JSON.stringify({ success: true, options, postal_code: postalCode });
        } catch (shippingErr) {
          console.error("[sales-tool] shipping calc error:", shippingErr);
          return JSON.stringify({ success: false, error: "Erro ao calcular frete. Tente novamente." });
        }
      }

      case "save_customer_data": {
        const custSaveData: Record<string, string> = {};
        const fields = ["name", "email", "cpf", "phone", "postal_code", "street", "number", "complement", "neighborhood", "city", "state"];
        for (const f of fields) {
          if (args[f]) custSaveData[f] = args[f] as string;
        }

        const { error: saveErr } = await supabase
          .from("whatsapp_carts")
          .update({ customer_data: custSaveData, updated_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active");

        if (saveErr) {
          console.error("[sales-tool] save customer data error:", saveErr);
          return JSON.stringify({ success: false, error: "Erro ao salvar dados do cliente." });
        }

        return JSON.stringify({ success: true, message: "Dados do cliente salvos com sucesso.", saved_fields: Object.keys(custSaveData) });
      }

      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` });
    }
  } catch (err) {
    console.error(`[sales-tool] Error in ${toolName}:`, err);
    return JSON.stringify({ error: `Erro ao executar ${toolName}` });
  }
}

/**
 * Generates embedding for a query using ai-generate-embedding function
 */
async function generateQueryEmbedding(
  supabaseUrl: string,
  serviceKey: string,
  text: string,
  tenantId: string
): Promise<number[] | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-generate-embedding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ text, tenant_id: tenantId }),
    });

    const data = await response.json();
    if (data.success && data.embedding) {
      return data.embedding;
    }
    console.error("[ai-support-chat] Embedding generation failed:", data.error);
    return null;
  } catch (error) {
    console.error("[ai-support-chat] Error generating embedding:", error);
    return null;
  }
}

/**
 * Searches the knowledge base using semantic similarity
 */
async function searchKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  embedding: number[],
  topK: number,
  threshold: number
): Promise<KnowledgeChunk[]> {
  try {
    const { data, error } = await (supabase as any).rpc("search_knowledge_base", {
      p_tenant_id: tenantId,
      p_query_embedding: `[${embedding.join(",")}]`,
      p_top_k: topK,
      p_threshold: threshold,
    });

    if (error) {
      console.error("[ai-support-chat] Knowledge base search error:", error);
      return [];
    }

    return (data as KnowledgeChunk[]) || [];
  } catch (error) {
    console.error("[ai-support-chat] Error searching knowledge base:", error);
    return [];
  }
}

/**
 * Classifies the intent of a customer message using OpenAI tool calling
 */
async function classifyIntent(
  openaiKey: string,
  message: string,
  conversationContext: string
): Promise<IntentClassification | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Você é um classificador de intenções para atendimento ao cliente de e-commerce.
Analise a mensagem do cliente e classifique a intenção, sentimento e urgência.
Se o cliente demonstrar interesse em comprar algo, classificar como "purchase_intent".

Contexto da conversa:
${conversationContext}`,
          },
          {
            role: "user",
            content: message,
          },
        ],
        tools: [INTENT_CLASSIFICATION_TOOL],
        tool_choice: { type: "function", function: { name: "classify_intent" } },
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("[ai-support-chat] Intent classification failed:", response.status);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      return JSON.parse(toolCall.function.arguments) as IntentClassification;
    }

    return null;
  } catch (error) {
    console.error("[ai-support-chat] Error classifying intent:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let modelUsed = "";
  let embeddingTokens = 0;

  try {
    const { conversation_id, tenant_id } = await req.json();

    if (!conversation_id || !tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "conversation_id and tenant_id are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured", code: "AI_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceKey);

    // ============================================
    // LOAD AI SUPPORT CONFIG (with RAG settings)
    // ============================================
    const { data: aiConfig } = await supabase
      .from("ai_support_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const effectiveConfig = aiConfig || {
      is_enabled: true,
      personality_name: "Assistente",
      personality_tone: "friendly",
      use_emojis: true,
      auto_import_products: true,
      auto_import_categories: true,
      auto_import_policies: true,
      auto_import_faqs: true,
      max_response_length: 500,
      rules: [],
      custom_knowledge: null,
      forbidden_topics: [],
      handoff_keywords: [],
      ai_model: "gpt-5.2",
      sales_mode_enabled: false,
      rag_similarity_threshold: 0.7,
      rag_top_k: 5,
      rag_min_evidence_chunks: 1,
      handoff_on_no_evidence: true,
      redact_pii_in_logs: true,
    };

    const salesModeEnabled = effectiveConfig.sales_mode_enabled === true;

    if (effectiveConfig.is_enabled === false) {
      return new Response(
        JSON.stringify({ success: false, error: "AI support is disabled for this tenant", code: "AI_DISABLED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      console.error("Conversation not found:", convError);
      return new Response(
        JSON.stringify({ success: false, error: "Conversation not found", code: "CONVERSATION_NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Channel-specific config
    const channelType = conversation.channel_type || "chat";
    const { data: channelConfig } = await supabase
      .from("ai_channel_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("channel_type", channelType)
      .maybeSingle();

    if (channelConfig?.is_enabled === false) {
      console.log(`AI disabled for channel ${channelType}`);
      return new Response(
        JSON.stringify({ success: false, error: `AI support is disabled for ${channelType} channel`, code: "CHANNEL_AI_DISABLED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recent messages for context
    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(20);

    const lastCustomerMessage = messages?.filter(m => m.sender_type === "customer").pop();
    const lastMessageContent = lastCustomerMessage?.content || "";
    
    // Build conversation context for classification
    const conversationContext = messages
      ?.slice(-5)
      .map(m => `${m.sender_type === "customer" ? "Cliente" : "Atendente"}: ${m.content?.slice(0, 200)}`)
      .join("\n") || "";

    // ============================================
    // STEP 1: INTENT CLASSIFICATION (Tool Calling)
    // ============================================
    console.log("[ai-support-chat] Classifying intent...");
    const intentClassification = await classifyIntent(
      OPENAI_API_KEY,
      lastMessageContent,
      conversationContext
    );

    let shouldHandoff = false;
    let handoffReason = "";

    // Check intent-based handoff triggers
    if (intentClassification) {
      console.log("[ai-support-chat] Intent classification:", JSON.stringify(intentClassification));
      
      // In sales mode, purchase_intent and action_request for buying are OK
      if (salesModeEnabled) {
        if (intentClassification.sentiment === "aggressive") {
          shouldHandoff = true;
          handoffReason = "Cliente demonstra irritação/agressividade";
        }
        if (intentClassification.intent === "complaint" && intentClassification.urgency === "high") {
          shouldHandoff = true;
          handoffReason = "Reclamação urgente";
        }
        // In sales mode, action_request for purchases is handled by tools, not handoff
        if (intentClassification.requires_action && intentClassification.intent !== "purchase_intent") {
          // Check if it's a sales-related action (adding to cart, etc.) vs support action (cancel, refund)
          const supportActions = ["cancelar", "cancelamento", "reembolso", "estorno", "devolver", "troca"];
          const isSupportAction = intentClassification.topics.some(t => supportActions.some(sa => t.includes(sa)));
          if (isSupportAction) {
            shouldHandoff = true;
            handoffReason = "Cliente solicitou ação de suporte (requer atendente)";
          }
        }
      } else {
        // Original informative mode handoff logic
        if (intentClassification.requires_action) {
          shouldHandoff = true;
          handoffReason = "Cliente solicitou ação (requer atendente)";
        }
        if (intentClassification.sentiment === "aggressive") {
          shouldHandoff = true;
          handoffReason = "Cliente demonstra irritação/agressividade";
        }
        if (intentClassification.intent === "complaint" && intentClassification.urgency === "high") {
          shouldHandoff = true;
          handoffReason = "Reclamação urgente";
        }
      }
    }

    // ============================================
    // STEP 2: RAG - SEMANTIC SEARCH
    // ============================================
    let knowledgeContext = "";
    let noEvidenceHandoff = false;
    let similarityScores: number[] = [];

    const shouldSearchKnowledge = intentClassification?.intent === "question" || 
                                   intentClassification?.intent === "general" ||
                                   !intentClassification;

    if (shouldSearchKnowledge && lastMessageContent.trim()) {
      console.log("[ai-support-chat] Generating query embedding...");
      
      const queryEmbedding = await generateQueryEmbedding(
        supabaseUrl,
        serviceKey,
        lastMessageContent,
        tenant_id
      );

    if (queryEmbedding) {
        embeddingTokens = Math.ceil(lastMessageContent.length / 4);

        console.log("[ai-support-chat] Searching knowledge base...");
        const chunks = await searchKnowledgeBase(
          supabase as ReturnType<typeof createClient>,
          tenant_id,
          queryEmbedding,
          effectiveConfig.rag_top_k || 5,
          effectiveConfig.rag_similarity_threshold || 0.7
        );

        similarityScores = chunks.map(c => c.similarity);
        
        if (chunks.length > 0) {
          console.log(`[ai-support-chat] Found ${chunks.length} relevant chunks`);
          
          knowledgeContext = "\n\n========================================\n";
          knowledgeContext += "📚 BASE DE CONHECIMENTO (relevância semântica)\n";
          knowledgeContext += "========================================\n";
          
          const byType: Record<string, KnowledgeChunk[]> = {};
          for (const chunk of chunks) {
            if (!byType[chunk.doc_type]) byType[chunk.doc_type] = [];
            byType[chunk.doc_type].push(chunk);
          }

          for (const [docType, docChunks] of Object.entries(byType)) {
            knowledgeContext += `\n### ${docType.toUpperCase()}:\n`;
            for (const chunk of docChunks) {
              knowledgeContext += `[${chunk.doc_title}] ${chunk.chunk_text}\n`;
            }
          }
        } else {
          console.log("[ai-support-chat] No relevant chunks found in knowledge base");
          
          const minChunks = effectiveConfig.rag_min_evidence_chunks || 1;
          if (effectiveConfig.handoff_on_no_evidence && chunks.length < minChunks && !salesModeEnabled) {
            noEvidenceHandoff = true;
            if (!shouldHandoff) {
              shouldHandoff = true;
              handoffReason = "Base de conhecimento insuficiente para responder";
            }
          }
        }
      }
    }

    // ============================================
    // STEP 3: GET STORE & CUSTOMER CONTEXT
    // ============================================
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .single();

    const { data: customDomain } = await supabase
      .from("custom_domains")
      .select("domain, status, ssl_active")
      .eq("tenant_id", tenant_id)
      .eq("status", "verified")
      .eq("ssl_active", true)
      .maybeSingle();

    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    let storeUrl = "";
    if (customDomain?.domain) {
      storeUrl = `https://${customDomain.domain}`;
    } else if (tenant?.slug) {
      storeUrl = `https://${tenant.slug}.shops.comandocentral.com.br`;
    }

    const storeName = storeSettings?.store_name || tenant?.name || "Nossa Loja";

    let storeContext = `\n\n### Informações da loja:\n`;
    storeContext += `- Nome: ${storeName}\n`;
    if (storeUrl) storeContext += `- Site: ${storeUrl}\n`;
    if (storeSettings?.contact_email) storeContext += `- Email: ${storeSettings.contact_email}\n`;
    if (storeSettings?.contact_phone) storeContext += `- Telefone: ${storeSettings.contact_phone}\n`;
    if (storeSettings?.whatsapp_number) storeContext += `- WhatsApp: ${storeSettings.whatsapp_number}\n`;

    // Customer context
    let customerContext = "";
    let customerId: string | null = null;

    if (conversation.customer_phone || conversation.customer_email) {
      let query = supabase
        .from("customers")
        .select("id, full_name, email, phone, total_orders, total_spent, first_order_at, last_order_at, loyalty_tier, birth_date")
        .eq("tenant_id", tenant_id);

      if (conversation.customer_phone) {
        query = query.or(`phone.eq.${conversation.customer_phone}`);
      }
      if (conversation.customer_email) {
        query = query.or(`email.eq.${conversation.customer_email}`);
      }

      const { data: customer } = await query.maybeSingle();

      if (customer) {
        customerId = customer.id;
        customerContext += `\n\n### Dados do cliente:\n`;
        customerContext += `- Nome: ${customer.full_name}\n`;
        customerContext += `- ID: ${customer.id}\n`;
        if (customer.total_orders) customerContext += `- Total de pedidos: ${customer.total_orders}\n`;
        if (customer.total_spent) customerContext += `- Total gasto: R$ ${customer.total_spent.toFixed(2)}\n`;
        if (customer.loyalty_tier) customerContext += `- Nível de fidelidade: ${customer.loyalty_tier}\n`;

        // Get recent orders
        const { data: recentOrders } = await supabase
          .from("orders")
          .select("order_number, status, payment_status, shipping_status, total, created_at, tracking_code")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentOrders?.length) {
          customerContext += `\n### Últimos pedidos:\n`;
          customerContext += recentOrders.map(o => {
            let info = `- #${o.order_number} | Status: ${o.status} | Pagamento: ${o.payment_status}`;
            if (o.shipping_status) info += ` | Envio: ${o.shipping_status}`;
            info += ` | R$ ${o.total?.toFixed(2)}`;
            if (o.tracking_code) info += ` | Rastreio: ${o.tracking_code}`;
            return info;
          }).join("\n");
        }
      }
    }

    // ============================================
    // STEP 4: CHECK AI RULES (keyword-based)
    // ============================================
    const lastMessageLower = lastMessageContent.toLowerCase();
    let matchedRule: AIRule | null = null;
    let forceResponse: string | null = null;

    const rules: AIRule[] = Array.isArray(effectiveConfig.rules) ? effectiveConfig.rules : [];
    const activeRules = rules.filter(r => r.is_active).sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      const conditionKeywords = rule.condition.toLowerCase().split(/[,;]/).map(k => k.trim()).filter(Boolean);
      const matches = conditionKeywords.some(kw => lastMessageLower.includes(kw));
      
      if (matches) {
        matchedRule = rule;
        console.log(`[ai-support-chat] Rule matched: ${rule.id} - ${rule.condition} -> ${rule.action}`);
        
        if (rule.action === 'transfer' || rule.action === 'escalate') {
          shouldHandoff = true;
          handoffReason = `Regra ativada: ${rule.condition}`;
        }
        if ((rule.action === 'respond' || rule.action === 'suggest') && rule.response) {
          forceResponse = rule.response;
        }
        break;
      }
    }

    // Check handoff keywords
    if (!shouldHandoff && effectiveConfig.handoff_keywords?.length && lastMessageLower) {
      const matchedKeyword = effectiveConfig.handoff_keywords.find(
        (kw: string) => lastMessageLower.includes(kw.toLowerCase())
      );
      if (matchedKeyword) {
        shouldHandoff = true;
        handoffReason = `Palavra-chave de handoff: ${matchedKeyword}`;
      }
    }

    // ============================================
    // STEP 5: BUILD SYSTEM PROMPT
    // ============================================
    let personalityTone = effectiveConfig.personality_tone || "amigável e profissional";
    let personalityName = effectiveConfig.personality_name || "Assistente";
    let maxLength = effectiveConfig.max_response_length || 500;
    let useEmojis = effectiveConfig.use_emojis ?? true;
    let forbiddenTopics: string[] = effectiveConfig.forbidden_topics || [];

    // Channel overrides
    if (channelConfig) {
      if (channelConfig.max_response_length) maxLength = channelConfig.max_response_length;
      if (channelConfig.use_emojis !== null) useEmojis = channelConfig.use_emojis;
      if (channelConfig.forbidden_topics?.length) {
        forbiddenTopics = [...new Set([...forbiddenTopics, ...channelConfig.forbidden_topics])];
      }
    }

    let systemPrompt = effectiveConfig.system_prompt || `Você é ${personalityName}, assistente virtual de atendimento ao cliente da loja ${storeName}.

Seu tom de comunicação é: ${personalityTone}.

DIRETRIZES IMPORTANTES:
- Seja sempre educado, prestativo e objetivo
- Use APENAS as informações da BASE DE CONHECIMENTO fornecidas para responder
- Limite suas respostas a aproximadamente ${maxLength} caracteres
- Se não encontrar a resposta na base de conhecimento, ESCALONE para um atendente humano
- NUNCA invente informações sobre produtos, preços, prazos ou políticas
- Personalize o atendimento usando o nome do cliente quando disponível`;

    // Channel-specific override
    if (channelConfig?.system_prompt_override) {
      systemPrompt = channelConfig.system_prompt_override;
    }

    // Add guardrails — sales mode or informative mode
    if (salesModeEnabled) {
      systemPrompt += SALES_AGENT_PROMPT;
      console.log("[ai-support-chat] Sales mode ENABLED — injecting sales tools and prompt");
    } else {
      systemPrompt += INFORMATIVE_GUARDRAILS;
    }

    // Add knowledge base context (RAG results)
    if (knowledgeContext) {
      systemPrompt += knowledgeContext;
    }

    // Add store and customer context
    systemPrompt += storeContext;
    if (customerContext) {
      systemPrompt += customerContext;
    }

    // Inject AI memory context
    try {
      const memoryContext = await getMemoryContext(supabase, tenant_id, "system", "support", { memoryLimit: 10, summaryLimit: 0 });
      if (memoryContext) {
        systemPrompt += memoryContext;
        console.log(`[ai-support-chat] Memory context injected (${memoryContext.length} chars)`);
      }
    } catch (e) {
      console.error("[ai-support-chat] Memory fetch error:", e);
    }

    // Add custom knowledge from config
    if (effectiveConfig.custom_knowledge) {
      systemPrompt += `\n\n### Conhecimento adicional:\n${effectiveConfig.custom_knowledge}`;
    }

    // Add active rules
    if (activeRules.length > 0) {
      systemPrompt += `\n\n### Regras de atendimento:\n`;
      systemPrompt += activeRules.map(r => {
        let ruleText = `- Quando mencionar: "${r.condition}"`;
        if (r.action === 'transfer') ruleText += ' → Sugira falar com atendente humano';
        if (r.action === 'escalate') ruleText += ' → Trate com urgência e transfira';
        if (r.action === 'respond' && r.response) ruleText += ` → Responda: "${r.response}"`;
        return ruleText;
      }).join("\n");
    }

    // Channel-specific instructions
    if (channelConfig?.custom_instructions) {
      systemPrompt += `\n\n### Instruções para ${channelType.toUpperCase()}:\n${channelConfig.custom_instructions}`;
    }

    // Channel restrictions
    const channelRestrictions: Record<string, string> = {
      mercadolivre: `
RESTRIÇÕES DO MERCADO LIVRE (OBRIGATÓRIO):
- NUNCA mencione links externos, outros sites ou redes sociais
- NUNCA sugira contato fora do Mercado Livre
- NUNCA mencione WhatsApp, Instagram, email direto ou telefone`,
      shopee: `
RESTRIÇÕES DA SHOPEE:
- Não direcione para canais externos
- Mantenha toda comunicação dentro da plataforma`,
    };

    if (channelRestrictions[channelType]) {
      systemPrompt += channelRestrictions[channelType];
    }

    // Forbidden topics
    if (forbiddenTopics.length > 0) {
      systemPrompt += `\n\n### Tópicos proibidos:\n${forbiddenTopics.join(", ")}`;
    }

    // Emoji preference
    if (useEmojis) {
      systemPrompt += "\n\nUse emojis moderadamente para tornar a conversa amigável.";
    } else {
      systemPrompt += "\n\nNão use emojis nas respostas.";
    }

    // If no evidence and handoff is triggered, instruct AI to acknowledge
    if (noEvidenceHandoff) {
      systemPrompt += `\n\n⚠️ ATENÇÃO: Não foi encontrada informação relevante na base de conhecimento para esta pergunta.
Responda de forma empática dizendo que não possui essa informação e que vai transferir para um atendente humano que poderá ajudar.`;
    }

    // ============================================
    // STEP 6: BUILD CONVERSATION HISTORY
    // ============================================
    const aiMessages: { role: string; content: string; tool_calls?: any[]; tool_call_id?: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversation.customer_name) {
      aiMessages.push({
        role: "system",
        content: `O cliente nesta conversa se chama ${conversation.customer_name}. Canal: ${channelType}.`,
      });
    }

    if (messages?.length) {
      for (const msg of messages) {
        if (msg.is_internal || msg.is_note) continue;
        aiMessages.push({
          role: msg.sender_type === "customer" ? "user" : "assistant",
          content: msg.content || "",
        });
      }
    }

    // ============================================
    // STEP 7: CALL OPENAI API (with tool call loop for sales mode)
    // ============================================
    let aiContent: string;
    
    let configuredModel = effectiveConfig.ai_model || "gpt-5.2";
    
    const modelMapping: Record<string, string> = {
      "google/gemini-2.5-flash": "gpt-5-mini",
      "google/gemini-2.5-pro": "gpt-5",
      "google/gemini-2.5-flash-lite": "gpt-5-nano",
      "openai/gpt-5": "gpt-5",
      "openai/gpt-5-mini": "gpt-5-mini",
      "openai/gpt-5-nano": "gpt-5-nano",
      "openai/gpt-5.2": "gpt-5.2",
    };
    
    const aiModel = modelMapping[configuredModel] || configuredModel;
    modelUsed = aiModel;

    if (forceResponse && matchedRule?.action === 'respond') {
      aiContent = forceResponse;
      console.log(`[ai-support-chat] Using rule-based response for rule: ${matchedRule.id}`);
    } else {
      console.log(`[ai-support-chat] Calling OpenAI model: ${aiModel}, messages: ${aiMessages.length}, sales_mode: ${salesModeEnabled}`);

      // Tool call loop context
      const salesToolCtx = {
        supabase,
        tenantId: tenant_id,
        conversationId: conversation_id,
        customerId,
        storeUrl,
        customerPhone: conversation.customer_phone || null,
        customerEmail: conversation.customer_email || null,
        customerName: conversation.customer_name || null,
      };

      let response: Response | null = null;
      let usedModel = aiModel;
      const modelsToTry = [aiModel, ...OPENAI_MODELS.filter(m => m !== aiModel)];

      let lastErrorText = "";
      let currentMessages = [...aiMessages];
      let toolCallIterations = 0;
      const MAX_TOOL_ITERATIONS = 5;

      // Outer loop for model fallback
      let modelFound = false;
      for (const modelToTry of modelsToTry) {
        try {
          const isGpt5Model = modelToTry.startsWith("gpt-5");
          const tokenParams = isGpt5Model 
            ? { max_completion_tokens: 1024 }
            : { max_tokens: 1024 };

          const requestBody: any = {
            model: modelToTry,
            messages: currentMessages,
            ...tokenParams,
            temperature: 0.7,
          };

          // Add sales tools only in sales mode
          if (salesModeEnabled) {
            requestBody.tools = SALES_TOOLS;
          }

          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) {
            usedModel = modelToTry;
            modelUsed = modelToTry;
            modelFound = true;
            break;
          }

          lastErrorText = await response.text();
          console.warn(`[ai-support-chat] Model ${modelToTry} failed:`, response.status, lastErrorText);
          
          if (response.status === 404 || response.status === 400) {
            response = null;
            continue;
          }
          break;
        } catch (fetchError) {
          console.error(`[ai-support-chat] Fetch error for ${modelToTry}:`, fetchError);
          response = null;
        }
      }

      if (!response || !response.ok) {
        const errorText = lastErrorText || "No response";
        console.error("[ai-support-chat] OpenAI API error:", response?.status, errorText);
        
        if (response?.status === 429) {
          return new Response(
            JSON.stringify({ success: false, error: "Rate limit exceeded", code: "RATE_LIMIT" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ success: false, error: "Error generating AI response", code: "AI_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let aiData = await response.json();
      
      if (aiData.usage) {
        inputTokens += aiData.usage.prompt_tokens || 0;
        outputTokens += aiData.usage.completion_tokens || 0;
      }

      // ============================================
      // TOOL CALL LOOP (sales mode only)
      // ============================================
      while (
        salesModeEnabled &&
        aiData.choices?.[0]?.message?.tool_calls?.length &&
        toolCallIterations < MAX_TOOL_ITERATIONS
      ) {
        toolCallIterations++;
        const assistantMsg = aiData.choices[0].message;
        
        console.log(`[ai-support-chat] Tool call iteration ${toolCallIterations}: ${assistantMsg.tool_calls.length} calls`);

        // Add assistant message with tool calls
        currentMessages.push({
          role: "assistant",
          content: assistantMsg.content || "",
          tool_calls: assistantMsg.tool_calls,
        });

        // Execute each tool call and add results
        for (const toolCall of assistantMsg.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: Record<string, unknown> = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch { /* empty args */ }

          console.log(`[ai-support-chat] Executing tool: ${fnName}`, JSON.stringify(fnArgs));
          const result = await executeSalesTool(fnName, fnArgs, salesToolCtx);
          console.log(`[ai-support-chat] Tool result (${fnName}):`, result.slice(0, 200));

          currentMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          } as any);
        }

        // Call OpenAI again with tool results
        const isGpt5Model = usedModel.startsWith("gpt-5");
        const tokenParams = isGpt5Model 
          ? { max_completion_tokens: 1024 }
          : { max_tokens: 1024 };

        const followUpBody: any = {
          model: usedModel,
          messages: currentMessages,
          ...tokenParams,
          temperature: 0.7,
          tools: SALES_TOOLS,
        };

        const followUpResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(followUpBody),
        });

        if (!followUpResp.ok) {
          console.error("[ai-support-chat] Follow-up call failed:", followUpResp.status);
          break;
        }

        aiData = await followUpResp.json();
        
        if (aiData.usage) {
          inputTokens += aiData.usage.prompt_tokens || 0;
          outputTokens += aiData.usage.completion_tokens || 0;
        }
      }

      aiContent = aiData.choices?.[0]?.message?.content;

      if (!aiContent) {
        console.error("[ai-support-chat] No content in AI response:", aiData);
        return new Response(
          JSON.stringify({ success: false, error: "AI did not return a response", code: "EMPTY_RESPONSE" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const latencyMs = Date.now() - startTime;

    // ============================================
    // STEP 8: RECORD USAGE & METRICS
    // ============================================
    let costCents = 0;
    const modelCost = MODEL_COSTS[modelUsed] || MODEL_COSTS["gpt-5-mini"];
    if (inputTokens > 0 || outputTokens > 0) {
      costCents = Math.ceil(
        (inputTokens / 1000) * modelCost.input +
        (outputTokens / 1000) * modelCost.output
      );
      
      try {
        await supabase.rpc("record_ai_usage", {
          p_tenant_id: tenant_id,
          p_usage_cents: costCents,
        });
      } catch (usageError) {
        console.error("[ai-support-chat] Failed to record AI usage:", usageError);
      }
    }

    // Increment AI metrics
    try {
      await supabase.rpc("increment_ai_metrics", {
        p_tenant_id: tenant_id,
        p_messages: 1,
        p_handoffs: shouldHandoff ? 1 : 0,
        p_no_evidence: noEvidenceHandoff ? 1 : 0,
        p_embedding_tokens: embeddingTokens,
      });
    } catch (metricsError) {
      console.error("[ai-support-chat] Failed to record AI metrics:", metricsError);
    }

    // ============================================
    // STEP 9: SAVE MESSAGE
    // ============================================
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        tenant_id,
        direction: "outbound",
        sender_type: "bot",
        sender_name: personalityName,
        content: aiContent,
        content_type: "text",
        delivery_status: "queued",
        is_ai_generated: true,
        is_internal: false,
        is_note: false,
        ai_model_used: forceResponse ? "rule-based" : modelUsed,
        ai_confidence: forceResponse ? 1.0 : (similarityScores[0] || 0.9),
        ai_context_used: { 
          rag_enabled: true,
          chunks_found: similarityScores.length,
          avg_similarity: similarityScores.length > 0 
            ? similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length 
            : null,
          intent_classification: effectiveConfig.redact_pii_in_logs 
            ? { ...intentClassification, summary: intentClassification?.summary ? redactPII(intentClassification.summary) : "" }
            : intentClassification,
          no_evidence_handoff: noEvidenceHandoff,
          customer_id: customerId,
          matched_rule: matchedRule?.id,
          channel_type: channelType,
          handoff_reason: handoffReason || null,
          sales_mode: salesModeEnabled,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          embedding_tokens: embeddingTokens,
          cost_cents: costCents,
          latency_ms: latencyMs,
          provider: "openai",
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error("[ai-support-chat] Error saving AI message:", msgError);
      return new Response(
        JSON.stringify({ success: false, error: "Error saving response", code: "SAVE_ERROR" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update conversation status
    const newStatus = shouldHandoff ? "waiting_agent" : "bot";
    await supabase
      .from("conversations")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        customer_id: customerId || conversation.customer_id,
      })
      .eq("id", conversation_id);

    // Log event
    await supabase.from("conversation_events").insert({
      conversation_id,
      tenant_id,
      event_type: shouldHandoff ? "ai_handoff" : salesModeEnabled ? "ai_sales_response" : "ai_response",
      actor_type: "bot",
      actor_name: personalityName,
      description: shouldHandoff 
        ? `IA escalou para humano: ${handoffReason}` 
        : salesModeEnabled
          ? `IA respondeu em modo vendas via ${channelType}`
          : matchedRule 
            ? `IA respondeu via regra: ${matchedRule.condition}` 
            : `IA respondeu via ${channelType} (RAG: ${similarityScores.length} chunks)`,
      metadata: { 
        model: forceResponse ? "rule-based" : modelUsed,
        rag_chunks: similarityScores.length,
        handoff: shouldHandoff,
        handoff_reason: handoffReason,
        no_evidence_handoff: noEvidenceHandoff,
        intent: intentClassification?.intent,
        sentiment: intentClassification?.sentiment,
        matched_rule: matchedRule?.id,
        channel_type: channelType,
        sales_mode: salesModeEnabled,
        latency_ms: latencyMs,
        cost_cents: costCents,
      },
    });

    // ============================================
    // STEP 10: SEND VIA CHANNEL
    // ============================================
    let sendResult: { success: boolean; error?: string; message_id?: string } = { success: false, error: "Canal não suportado" };

    if (conversation.channel_type === "whatsapp" && conversation.customer_phone) {
      console.log(`[ai-support-chat] Sending WhatsApp response...`);
      
      try {
        const sendResponse = await fetch(
          `${supabaseUrl}/functions/v1/meta-whatsapp-send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              tenant_id,
              phone: conversation.customer_phone,
              message: aiContent,
            }),
          }
        );

        sendResult = await sendResponse.json();

        const deliveryStatus = sendResult.success ? "sent" : "failed";
        await supabase
          .from("messages")
          .update({ 
            delivery_status: deliveryStatus,
            external_message_id: sendResult.message_id || null,
            failure_reason: sendResult.success ? null : sendResult.error,
          })
          .eq("id", newMessage.id);

      } catch (sendError) {
        console.error("[ai-support-chat] WhatsApp send error:", sendError);
        sendResult = { success: false, error: sendError instanceof Error ? sendError.message : "Erro ao enviar" };
        
        await supabase
          .from("messages")
          .update({ 
            delivery_status: "failed",
            failure_reason: sendResult.error,
          })
          .eq("id", newMessage.id);
      }
    } else if (conversation.channel_type === "email" && conversation.customer_email) {
      console.log(`[ai-support-chat] Sending email response...`);
      
      try {
        const sendResponse = await fetch(
          `${supabaseUrl}/functions/v1/support-send-message`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              message_id: newMessage.id,
              channel_type: "email",
            }),
          }
        );

        const sendJson = await sendResponse.json();
        
        if (sendJson.success) {
          sendResult = { success: true, message_id: sendJson.external_message_id };
        } else {
          sendResult = { success: false, error: sendJson.error || "Falha ao enviar email" };
        }
      } catch (sendError) {
        console.error("[ai-support-chat] Email send error:", sendError);
        sendResult = { success: false, error: sendError instanceof Error ? sendError.message : "Erro ao enviar" };
        
        await supabase
          .from("messages")
          .update({ 
            delivery_status: "failed",
            failure_reason: sendResult.error,
          })
          .eq("id", newMessage.id);
      }
    } else if (conversation.channel_type === "chat") {
      sendResult = { success: true };
      await supabase
        .from("messages")
        .update({ delivery_status: "delivered" })
        .eq("id", newMessage.id);
    }

    console.log(`[ai-support-chat] Response ${sendResult.success ? "sent" : "failed"} via ${channelType}. Model: ${modelUsed}, Sales: ${salesModeEnabled}, RAG: ${similarityScores.length} chunks, Latency: ${latencyMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        message: newMessage,
        handoff: shouldHandoff,
        handoff_reason: handoffReason || null,
        matched_rule: matchedRule?.id,
        sent: sendResult.success,
        send_error: sendResult.error,
        channel_type: channelType,
        sales_mode: salesModeEnabled,
        rag: {
          chunks_found: similarityScores.length,
          avg_similarity: similarityScores.length > 0 
            ? similarityScores.reduce((a, b) => a + b, 0) / similarityScores.length 
            : null,
          no_evidence_handoff: noEvidenceHandoff,
        },
        intent: intentClassification,
        metrics: {
          model: modelUsed,
          provider: "openai",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          embedding_tokens: embeddingTokens,
          cost_cents: costCents,
          latency_ms: latencyMs,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ai-support-chat] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte.", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
