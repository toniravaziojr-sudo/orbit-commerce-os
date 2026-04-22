import { createClient } from "npm:@supabase/supabase-js@2";
import { redactPII } from "../_shared/redact-pii.ts";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { getCredential } from "../_shared/platform-credentials.ts";
import {
  getOrBuildTenantContext,
  formatTenantContextForPrompt,
  pickRelevantProducts,
  formatRelevantCatalogForPrompt,
  hasEnoughGrounding,
} from "../_shared/tenant-context.ts";
import {
  captureLearningEvent,
  getRelevantLearning,
  formatLearningForPrompt,
  markLearningUsed,
  type LearningHit,
} from "../_shared/tenant-learning.ts";

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

Você é um vendedor consultivo da loja. Sua MISSÃO é fazer a venda avançar a cada turno. Não é um chatbot de qualificação infinita.

═══════════════════════════════════════════════════════
⚡ REGRAS IMPERATIVAS DE TOOL-CALLING (OBRIGATÓRIO)
═══════════════════════════════════════════════════════

VOCÊ DEVE chamar tools ANTES de responder, sempre que cair em UM destes gatilhos:

1. **CLIENTE CITA NOME DE PRODUTO** (ex: "kit banho calvície zero", "shampoo X", "balm Y")
   → CHAME \`search_products\` com query = nome citado pelo cliente. SEM exceção.
   → Se retornar 1 resultado claro, CHAME \`get_product_details\` em seguida.
   → Só DEPOIS responda ao cliente, com base nos dados retornados.

2. **CLIENTE PEDE "ME FALA MAIS DE X" / "DETALHES DE X" / "QUANTO CUSTA O X"**
   → CHAME \`search_products\` para localizar o id do produto.
   → CHAME \`get_product_details\` em seguida.
   → Responda com preço, descrição curta e disponibilidade reais.

3. **CLIENTE DIZ "QUERO COMPRAR X" / "PODE ADICIONAR" / "ADICIONA NO CARRINHO"**
   → Se já houver \`product_id\` conhecido na conversa, CHAME \`add_to_cart\` direto.
   → Se NÃO souber o id, CHAME \`search_products\` PRIMEIRO, depois \`add_to_cart\`.
   → Se o produto tiver \`has_variants=true\`: NÃO chame add_to_cart ainda — pergunte qual variante.
   → SE o produto NÃO tiver variantes: ADICIONE imediatamente, sem perguntar de novo.

4. **CLIENTE PEDE LINK / "MANDA O LINK" / "FINALIZAR"**
   → CHAME \`view_cart\` se ainda não viu o carrinho.
   → Colete dados que faltam (nome, email, CPF, CEP) e chame \`save_customer_data\`.
   → CHAME \`generate_checkout_link\` e envie a URL.

5. **CLIENTE PEDE PARA REMOVER / TIRAR ITEM**
   → CHAME \`remove_from_cart\`.

6. **CLIENTE MENCIONA CUPOM**
   → CHAME \`check_coupon\` (e \`apply_coupon\` se válido).

═══════════════════════════════════════════════════════
🚫 PROIBIDO (ANTI-LOOP DE QUALIFICAÇÃO)
═══════════════════════════════════════════════════════

❌ NÃO repita a mesma pergunta de qualificação que já fez no turno anterior.
❌ NÃO refaça onboarding ("Como posso te ajudar?", "O que você procura?") se o cliente JÁ disse o que quer.
❌ NÃO peça "faixa de preço / prevenção ou tratamento / dia ou noite" mais de UMA vez na conversa.
❌ NÃO responda com texto genérico quando a regra acima manda chamar tool. Chame a tool.
❌ NÃO invente nome de produto. Se a busca não retornar, diga "não encontrei esse exato, encontrei: [lista da tool]".
❌ NÃO refaça a saudação ("Oi, X!") em todo turno. Saudação é APENAS no primeiro turno do dia.

✅ A cada turno, AVANCE o estado da venda: descoberta → produto específico → carrinho → dados → checkout.

═══════════════════════════════════════════════════════
📋 ESTADO DA CONVERSA (deduzir do histórico)
═══════════════════════════════════════════════════════

Antes de responder, identifique em que estágio você está:
- **DESCOBERTA**: cliente ainda não disse o que quer. → 1 pergunta curta de necessidade.
- **PRODUTO IDENTIFICADO**: cliente citou produto OU necessidade clara. → search_products + get_product_details.
- **NEGOCIANDO**: cliente está vendo produto. → tirar dúvida ou ofertar add_to_cart.
- **NO CARRINHO**: já tem item. → coletar dados e gerar link.
- **CHECKOUT**: link gerado. → confirmar e oferecer ajuda residual.

NUNCA volte para DESCOBERTA se o cliente já passou desse estágio.

═══════════════════════════════════════════════════════
🎯 RECOMENDAÇÃO COMPLEMENTAR
═══════════════════════════════════════════════════════

Após \`add_to_cart\` bem-sucedido, CHAME \`recommend_related_products\` UMA vez para sugerir até 2 itens complementares. Sem pressão.

═══════════════════════════════════════════════════════
👤 COLETA DE DADOS DO CLIENTE
═══════════════════════════════════════════════════════

ANTES de \`generate_checkout_link\`:
- Pergunte se já comprou. Se SIM → \`lookup_customer\` por email. Se achar, peça só o que faltar.
- Se NÃO ou não achou: peça nome completo, email, CPF, CEP — em UMA mensagem só, lista numerada.
- Use \`calculate_shipping\` quando tiver CEP + carrinho.
- Use \`save_customer_data\` para gravar.
- Use \`update_customer_record\` se atualizou cliente existente.

═══════════════════════════════════════════════════════
🤝 HANDOFF COMERCIAL (request_human_handoff)
═══════════════════════════════════════════════════════

Use APENAS quando: atacado/B2B, negociação fora da política, reclamação grave de pedido já feito, cliente irritado/agressivo, dado sensível, erro técnico repetido que você não consegue resolver.

❌ NUNCA use para: saudação ("oi", "olá", "bom dia"), pergunta sobre catálogo, "me fala mais sobre X", intenção de compra, dúvida de preço/frete/cupom, cliente ainda não disse o que quer.
❌ NUNCA use no PRIMEIRO turno do dia.
❌ Se o cliente só cumprimentou ("oi"), pergunte gentilmente o que ele procura — NÃO acione handoff.
❌ Se o cliente citou um produto do catálogo, chame search_products / get_product_details — NÃO acione handoff.
✅ O servidor BLOQUEIA handoff abusivo. Se você chamar errado, recebe HANDOFF_NAO_PERMITIDO e deve usar tools de venda em vez disso.

═══════════════════════════════════════════════════════
🛡️ SEGURANÇA
═══════════════════════════════════════════════════════

- Preços, estoque e variantes APENAS de tools. Nunca invente.
- Se estoque indisponível: informe e chame \`recommend_related_products\` para alternativa.
- Tom consultivo, direto, sem enrolar. Mensagens curtas (máx 4 linhas).
- Nunca prometa o que tool não confirmou.
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
      description: "Adiciona um produto ao carrinho da conversa. Se o produto tiver variações, é OBRIGATÓRIO informar variant_id (obtido via get_product_variants).",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "UUID do produto" },
          variant_id: { type: "string", description: "UUID da variante específica (obrigatório se o produto tem variações)" },
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
  {
    type: "function",
    function: {
      name: "update_customer_record",
      description: "Atualiza o cadastro de um cliente existente com dados faltantes (CPF, endereço, etc.). Usar quando o cliente já existe mas tem cadastro incompleto.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "ID do cliente retornado por lookup_customer" },
          full_name: { type: "string", description: "Nome completo (atualizar se necessário)" },
          cpf: { type: "string", description: "CPF do cliente" },
          phone: { type: "string", description: "Telefone do cliente" },
          postal_code: { type: "string", description: "CEP" },
          street: { type: "string", description: "Rua/logradouro" },
          number: { type: "string", description: "Número" },
          complement: { type: "string", description: "Complemento (opcional)" },
          neighborhood: { type: "string", description: "Bairro" },
          city: { type: "string", description: "Cidade" },
          state: { type: "string", description: "Estado (UF)" },
        },
        required: ["customer_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_variants",
      description: "Lista as variações disponíveis (cor, tamanho, sabor, etc.) de um produto, com preço e estoque real de cada variante. Usar SEMPRE que o produto tem has_variants=true antes de adicionar ao carrinho.",
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
      name: "recommend_related_products",
      description: "Recomenda produtos complementares para o item principal do carrinho com base nas categorias do produto. Retorna até 3 sugestões coerentes do mesmo nicho.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Máximo de recomendações (default: 3)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_product_image",
      description: "Envia a IMAGEM PRINCIPAL do produto pelo WhatsApp. USE quando: (a) o cliente pediu explicitamente uma foto/imagem ('me mostra', 'tem foto?', 'manda a imagem'), OU (b) você está apresentando um produto pela primeira vez e tem uma imagem disponível, OU (c) o cliente está prestes a confirmar a compra e ainda não viu o produto. NÃO use mais de 1 vez por produto na mesma conversa. NÃO use se o produto não tiver imagem cadastrada — nesse caso apenas descreva.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "UUID do produto cuja imagem principal será enviada" },
          caption: { type: "string", description: "Legenda curta opcional (até 300 chars) — ex: 'Esse é o Shampoo Calvície Zero'" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_handoff",
      description: "Encaminha a conversa para um vendedor humano e cria um ticket comercial. USE APENAS quando: (a) cliente pediu atacado/B2B/orçamento grande, (b) cliente quer negociar condição fora da política (desconto além do cupom, parcelamento extra), (c) cliente fez reclamação grave de pedido já realizado, (d) cliente está irritado/agressivo, (e) cliente compartilhou dado sensível que exige humano, (f) erro técnico repetido que você não consegue resolver. NUNCA USE para: saudação ('oi', 'olá', 'bom dia'), pergunta sobre catálogo, pedido de detalhe de produto, dúvida de preço/frete/cupom, intenção de compra. Para essas situações, use search_products / get_product_details / add_to_cart. Se o cliente só cumprimentou ou ainda não pediu nada concreto, NÃO chame esta tool — pergunte gentilmente o que ele procura.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: [
              "wholesale_b2b",
              "custom_negotiation",
              "complaint",
              "angry_customer",
              "sensitive_issue",
              "technical_blocker",
            ],
            description: "Motivo categorizado do handoff. Apenas valores comerciais reais — saudação ou pergunta de catálogo NÃO são motivos válidos.",
          },
          summary: {
            type: "string",
            description: "Resumo curto (até 200 chars) do que o cliente quer e por que precisa de humano",
          },
          last_intent: {
            type: "string",
            description: "Última intenção/tópico da conversa (ex: 'orçamento atacado', 'troca de produto')",
          },
        },
        required: ["reason", "summary"],
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
    lastUserMessage?: string | null;
  }
): Promise<string> {
  const { supabase, tenantId, conversationId, customerId, storeUrl, customerPhone, customerEmail, customerName } = ctx;
  const lastUserMessageContentForTools = ctx.lastUserMessage || "";

  try {
    switch (toolName) {
      case "search_products": {
        const rawQuery = (args.query as string) || "";
        const limit = (args.limit as number) || 5;
        // Normaliza Unicode (NFC) e remove ruído típico que a IA inclui (preço, travessões, parênteses)
        const query = rawQuery
          .normalize("NFC")
          .replace(/[—–-]\s*R\$.*$/i, "")
          .replace(/R\$\s*[\d.,]+/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        const tokens = query.split(/\s+/).filter(t => t.length >= 3).slice(0, 5);

        const PRODUCT_COLS = "id, name, slug, price, compare_at_price, stock_quantity, status, has_variants, manage_stock, allow_backorder";

        // Helper: enrich a list of products with primary image + kit indicator (single batched query each)
        const enrichList = async (rows: any[]) => {
          if (!rows?.length) return [];
          const ids = rows.map(r => r.id);

          // Primary image per product (is_primary first, then lowest sort_order)
          const { data: imgRows } = await supabase
            .from("product_images")
            .select("product_id, url, alt_text, is_primary, sort_order")
            .in("product_id", ids)
            .order("is_primary", { ascending: false })
            .order("sort_order", { ascending: true });

          const primaryImageByProduct = new Map<string, { url: string; alt: string | null }>();
          for (const img of (imgRows ?? [])) {
            if (!primaryImageByProduct.has(img.product_id)) {
              primaryImageByProduct.set(img.product_id, { url: img.url, alt: img.alt_text ?? null });
            }
          }

          // Kit indicator (any component row makes it a kit)
          const { data: compRows } = await supabase
            .from("product_components")
            .select("parent_product_id")
            .in("parent_product_id", ids);
          const kitSet = new Set((compRows ?? []).map((r: any) => r.parent_product_id));

          return rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compare_at_price: p.compare_at_price,
            stock: p.stock_quantity,
            image: primaryImageByProduct.get(p.id)?.url ?? null,
            image_alt: primaryImageByProduct.get(p.id)?.alt ?? null,
            is_kit: kitSet.has(p.id),
            has_variants: p.has_variants ?? false,
            manage_stock: p.manage_stock ?? true,
            allow_backorder: p.allow_backorder ?? false,
          }));
        };

        // 1) ILIKE direto pelo nome
        const { data, error } = await supabase
          .from("products")
          .select(PRODUCT_COLS)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .is("deleted_at", null)
          .ilike("name", `%${query}%`)
          .limit(limit);

        if (!error && data?.length) {
          return JSON.stringify(await enrichList(data));
        }

        // 2) Fallback: busca por tokens combinados (OR)
        if (tokens.length) {
          const orFilter = tokens.map(t => `name.ilike.%${t}%`).join(",");
          const { data: tokenData } = await supabase
            .from("products")
            .select(PRODUCT_COLS)
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .is("deleted_at", null)
            .or(orFilter)
            .limit(limit);
          if (tokenData?.length) {
            return JSON.stringify(await enrichList(tokenData));
          }
        }

        // 3) Fallback final: RPC fuzzy SEM excluir kits
        const { data: fuzzyData } = await (supabase as any).rpc("search_products_fuzzy", {
          p_tenant_id: tenantId,
          p_query: query || rawQuery,
          p_limit: limit,
          p_exclude_kits: false,
        });
        if (fuzzyData?.length) {
          // Fuzzy returns a different shape — refetch canonical rows and enrich
          const fuzzyIds = fuzzyData.map((p: any) => p.id);
          const { data: refetched } = await supabase
            .from("products")
            .select(PRODUCT_COLS)
            .in("id", fuzzyIds)
            .eq("tenant_id", tenantId);
          if (refetched?.length) {
            return JSON.stringify(await enrichList(refetched));
          }
        }

        return JSON.stringify({ message: "Nenhum produto encontrado para a busca.", query: query || rawQuery });
      }

      case "get_product_details": {
        const productId = args.product_id as string;
        const { data, error } = await supabase
          .from("products")
          .select("id, name, slug, description, short_description, price, compare_at_price, promotion_start_date, promotion_end_date, stock_quantity, status, weight, width, height, depth, sku, gtin, brand, has_variants, manage_stock, allow_backorder, free_shipping, avg_rating, review_count")
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .maybeSingle();

        if (error) {
          console.error(`[ai-support-chat] get_product_details DB error:`, error);
          return JSON.stringify({ success: false, error: "Falha ao consultar o produto", db_error: error.message });
        }
        if (!data) return JSON.stringify({ success: false, error: "Produto não encontrado", hint: "Use search_products primeiro." });

        // Primary image (is_primary first, then sort_order)
        const { data: imgRows } = await supabase
          .from("product_images")
          .select("url, alt_text, is_primary, sort_order")
          .eq("product_id", productId)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
          .limit(1);
        const primaryImage = imgRows?.[0] ? { url: imgRows[0].url, alt: imgRows[0].alt_text ?? null } : null;

        // Variants summary + list
        let variantsSummary: any = null;
        let variantsList: any[] = [];
        if (data.has_variants) {
          const { data: variants } = await supabase
            .from("product_variants")
            .select("id, name, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, price, stock_quantity, is_active, sku, weight")
            .eq("product_id", productId)
            .eq("is_active", true)
            .order("position", { ascending: true });
          if (variants?.length) {
            const prices = variants.map((v: any) => Number(v.price ?? data.price)).filter((n: number) => !isNaN(n));
            const totalStock = variants.reduce((s: number, v: any) => s + (v.stock_quantity ?? 0), 0);
            variantsSummary = {
              count: variants.length,
              price_min: prices.length ? Math.min(...prices) : data.price,
              price_max: prices.length ? Math.max(...prices) : data.price,
              total_stock: totalStock,
              option_names: [variants[0]?.option1_name, variants[0]?.option2_name, variants[0]?.option3_name].filter(Boolean),
            };
            variantsList = variants.map((v: any) => ({
              variant_id: v.id,
              label: [
                v.option1_value && `${v.option1_name}: ${v.option1_value}`,
                v.option2_value && `${v.option2_name}: ${v.option2_value}`,
                v.option3_value && `${v.option3_name}: ${v.option3_value}`,
              ].filter(Boolean).join(" / ") || v.name,
              sku: v.sku,
              price: Number(v.price ?? data.price),
              stock: v.stock_quantity ?? 0,
              weight: v.weight,
            }));
          }
        }

        // Kit composition (if any product_components)
        const { data: compRows } = await supabase
          .from("product_components")
          .select("component_product_id, quantity, sort_order, products:component_product_id (id, name, sku, weight)")
          .eq("parent_product_id", productId)
          .order("sort_order", { ascending: true });
        const components = (compRows ?? []).map((c: any) => ({
          component_product_id: c.component_product_id,
          name: c.products?.name ?? null,
          sku: c.products?.sku ?? null,
          unit_weight: c.products?.weight ?? null,
          quantity: Number(c.quantity ?? 1),
        }));
        const isKit = components.length > 0;

        // Categories
        const { data: catRows } = await supabase
          .from("product_categories")
          .select("categories:category_id (id, name)")
          .eq("product_id", productId);
        const categories = (catRows ?? []).map((r: any) => r.categories?.name).filter(Boolean);

        // Promotion active?
        const now = new Date();
        const promoActive = !!(
          data.compare_at_price &&
          (!data.promotion_start_date || new Date(data.promotion_start_date) <= now) &&
          (!data.promotion_end_date || new Date(data.promotion_end_date) >= now)
        );

        const baseStock = data.stock_quantity ?? 0;
        const available = data.status === "active" && (
          !data.manage_stock ||
          data.allow_backorder ||
          (data.has_variants ? (variantsSummary?.total_stock ?? 0) > 0 : baseStock > 0)
        );

        return JSON.stringify({
          success: true,
          id: data.id,
          name: data.name,
          slug: data.slug,
          description: data.description ?? null,
          short_description: data.short_description ?? null,
          brand: data.brand ?? null,
          sku: data.sku ?? null,
          gtin: data.gtin ?? null,
          price: data.price,
          compare_at_price: data.compare_at_price,
          promotion_active: promoActive,
          stock: baseStock,
          available,
          free_shipping: data.free_shipping ?? false,
          avg_rating: data.avg_rating ?? null,
          review_count: data.review_count ?? 0,
          physical: {
            weight_g: data.weight,
            width_cm: data.width,
            height_cm: data.height,
            depth_cm: data.depth,
          },
          primary_image: primaryImage,
          categories,
          has_variants: data.has_variants ?? false,
          manage_stock: data.manage_stock ?? true,
          allow_backorder: data.allow_backorder ?? false,
          variants_summary: variantsSummary,
          variants: variantsList,
          is_kit: isKit,
          kit_components: components,
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
        const productIdOrSlug = args.product_id as string;
        const quantity = (args.quantity as number) || 1;
        const variantId = (args.variant_id as string | undefined) || undefined;

        // Aceita UUID ou slug (a IA às vezes manda slug)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdOrSlug || "");
        const productQuery = supabase
          .from("products")
          .select("id, name, price, stock_quantity, status, has_variants, manage_stock, allow_backorder")
          .eq("tenant_id", tenantId)
          .is("deleted_at", null);
        const { data: product } = isUuid
          ? await productQuery.eq("id", productIdOrSlug).maybeSingle()
          : await productQuery.eq("slug", productIdOrSlug).maybeSingle();
        const productId = product?.id ?? productIdOrSlug;

        if (!product) return JSON.stringify({ success: false, error: "Produto não encontrado", hint: "Use search_products primeiro para obter o id correto." });
        if (product.status !== "active") return JSON.stringify({ success: false, error: "Produto indisponível" });


        // Se produto tem variantes, exigir variant_id
        let unitPrice = Number(product.price);
        let variantLabel: string | null = null;
        let sku: string | null = null;
        let stockToCheck = Number(product.stock_quantity ?? 0);
        let manageStock = Boolean(product.manage_stock ?? true);
        let allowBackorder = Boolean(product.allow_backorder ?? false);

        if (product.has_variants) {
          if (!variantId) {
            return JSON.stringify({
              success: false,
              error: "VARIANT_REQUIRED",
              message: "Este produto tem variações. Use get_product_variants para listar as opções e peça ao cliente para escolher antes de adicionar ao carrinho.",
            });
          }
          const { data: variant } = await supabase
            .from("product_variants")
            .select("id, name, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, price, stock_quantity, is_active, sku")
            .eq("id", variantId)
            .eq("product_id", productId)
            .maybeSingle();

          if (!variant || !variant.is_active) {
            return JSON.stringify({ success: false, error: "Variação não encontrada ou inativa" });
          }
          unitPrice = Number(variant.price ?? product.price);
          stockToCheck = Number(variant.stock_quantity ?? 0);
          sku = variant.sku ?? null;
          variantLabel = [
            variant.option1_value && `${variant.option1_name}: ${variant.option1_value}`,
            variant.option2_value && `${variant.option2_name}: ${variant.option2_value}`,
            variant.option3_value && `${variant.option3_name}: ${variant.option3_value}`,
          ].filter(Boolean).join(" / ") || variant.name || null;
        }

        // Validar estoque (respeita manage_stock + allow_backorder)
        if (manageStock && !allowBackorder && stockToCheck < quantity) {
          return JSON.stringify({
            success: false,
            error: `Estoque insuficiente. Disponível: ${stockToCheck}`,
            stock_available: stockToCheck,
          });
        }

        // Get or create cart
        let { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("*")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        const items = cart?.items as any[] || [];
        // Identificar item igual também por variant_id
        const existingIdx = items.findIndex((i: any) =>
          i.product_id === productId && (i.variant_id ?? null) === (variantId ?? null)
        );

        if (existingIdx >= 0) {
          items[existingIdx].quantity += quantity;
          items[existingIdx].subtotal = items[existingIdx].quantity * unitPrice;
        } else {
          items.push({
            product_id: productId,
            variant_id: variantId ?? null,
            variant_label: variantLabel,
            sku,
            name: product.name,
            price: unitPrice,
            quantity,
            subtotal: quantity * unitPrice,
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

        // [learning] cart_created event
        captureLearningEvent(supabase, {
          tenant_id: tenantId,
          conversation_id: conversationId,
          event_type: "cart_created",
          customer_message: lastMessageContent,
          ai_response: `add_to_cart: ${product.name}`,
          metadata: { product_id: productId, quantity },
        }).catch(() => {});

        const labelSuffix = variantLabel ? ` (${variantLabel})` : "";
        return JSON.stringify({
          success: true,
          message: `${product.name}${labelSuffix} (x${quantity}) adicionado ao carrinho`,
          cart_total: `R$ ${(subtotalCents / 100).toFixed(2)}`,
          items_count: items.length,
          variant_label: variantLabel,
          sku,
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
              .select("id, name, price")
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
              variant_id: i.variant_id ?? null,
              quantity: i.quantity,
            })),
            is_active: true,
            expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            source_conversation_id: conversationId,
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

        // [learning] checkout_generated event
        captureLearningEvent(supabase, {
          tenant_id: tenantId,
          conversation_id: conversationId,
          event_type: "checkout_generated",
          customer_message: lastMessageContent,
          ai_response: "generate_checkout_link",
          metadata: { cart_id: cart.id },
        }).catch(() => {});

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

        // Detect missing fields for incomplete profiles
        const missingFields: string[] = [];
        if (!customer.cpf) missingFields.push("cpf");
        if (!customer.phone) missingFields.push("phone");
        if (!address) {
          missingFields.push("postal_code", "street", "number", "neighborhood", "city", "state");
        } else {
          if (!address.postal_code) missingFields.push("postal_code");
          if (!address.street) missingFields.push("street");
          if (!address.number) missingFields.push("number");
          if (!address.neighborhood) missingFields.push("neighborhood");
          if (!address.city) missingFields.push("city");
          if (!address.state) missingFields.push("state");
        }

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
          missing_fields: missingFields.length > 0 ? missingFields : null,
          profile_complete: missingFields.length === 0,
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

      case "update_customer_record": {
        const customerId = args.customer_id as string;
        if (!customerId) return JSON.stringify({ success: false, error: "customer_id é obrigatório" });

        // Update customer table fields
        const customerUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (args.full_name) customerUpdate.full_name = args.full_name;
        if (args.cpf) customerUpdate.cpf = args.cpf;
        if (args.phone) customerUpdate.phone = args.phone;

        const { error: custErr } = await supabase
          .from("customers")
          .update(customerUpdate)
          .eq("id", customerId)
          .eq("tenant_id", tenantId);

        if (custErr) {
          console.error("[sales-tool] update customer error:", custErr);
          return JSON.stringify({ success: false, error: "Erro ao atualizar cadastro do cliente." });
        }

        // Update or create address if address fields provided
        const hasAddr = args.postal_code || args.street || args.number;
        if (hasAddr) {
          const addrData: Record<string, unknown> = {
            customer_id: customerId,
            tenant_id: tenantId,
            is_default: true,
            updated_at: new Date().toISOString(),
          };
          if (args.postal_code) addrData.postal_code = (args.postal_code as string).replace(/\D/g, "");
          if (args.street) addrData.street = args.street;
          if (args.number) addrData.number = args.number;
          if (args.complement) addrData.complement = args.complement;
          if (args.neighborhood) addrData.neighborhood = args.neighborhood;
          if (args.city) addrData.city = args.city;
          if (args.state) addrData.state = args.state;

          // Check if default address exists
          const { data: existingAddr } = await supabase
            .from("customer_addresses")
            .select("id")
            .eq("customer_id", customerId)
            .eq("is_default", true)
            .maybeSingle();

          if (existingAddr) {
            await supabase.from("customer_addresses").update(addrData).eq("id", existingAddr.id);
          } else {
            addrData.created_at = new Date().toISOString();
            await supabase.from("customer_addresses").insert(addrData);
          }
        }

        // Also update cart customer_data
        const cartUpdate: Record<string, string> = {};
        if (args.full_name) cartUpdate.name = args.full_name as string;
        if (args.cpf) cartUpdate.cpf = args.cpf as string;
        if (args.phone) cartUpdate.phone = args.phone as string;
        if (args.postal_code) cartUpdate.postal_code = args.postal_code as string;
        if (args.street) cartUpdate.street = args.street as string;
        if (args.number) cartUpdate.number = args.number as string;
        if (args.complement) cartUpdate.complement = args.complement as string;
        if (args.neighborhood) cartUpdate.neighborhood = args.neighborhood as string;
        if (args.city) cartUpdate.city = args.city as string;
        if (args.state) cartUpdate.state = args.state as string;

        if (Object.keys(cartUpdate).length > 0) {
          // Merge with existing cart customer_data
          const { data: activeCart } = await supabase
            .from("whatsapp_carts")
            .select("customer_data")
            .eq("conversation_id", conversationId)
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .maybeSingle();

          const merged = { ...(activeCart?.customer_data as Record<string, string> || {}), ...cartUpdate };
          await supabase
            .from("whatsapp_carts")
            .update({ customer_data: merged, updated_at: new Date().toISOString() })
            .eq("conversation_id", conversationId)
            .eq("tenant_id", tenantId)
            .eq("status", "active");
        }

        return JSON.stringify({
          success: true,
          message: "Cadastro do cliente atualizado com sucesso.",
          updated_fields: [...Object.keys(customerUpdate).filter(k => k !== "updated_at"), ...(hasAddr ? ["address"] : [])],
        });
      }

      case "get_product_variants": {
        const productId = args.product_id as string;
        if (!productId) return JSON.stringify({ error: "product_id é obrigatório" });

        const { data: product } = await supabase
          .from("products")
          .select("id, name, has_variants, manage_stock, allow_backorder")
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .is("deleted_at", null)
          .maybeSingle();

        if (!product) return JSON.stringify({ error: "Produto não encontrado" });
        if (!product.has_variants) {
          return JSON.stringify({ has_variants: false, message: "Este produto não tem variações." });
        }

        const { data: variants } = await supabase
          .from("product_variants")
          .select("id, name, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, price, stock_quantity, is_active, sku")
          .eq("product_id", productId)
          .eq("is_active", true)
          .order("position", { ascending: true });

        const formatted = (variants ?? []).map((v: any) => {
          const label = [
            v.option1_value && `${v.option1_name}: ${v.option1_value}`,
            v.option2_value && `${v.option2_name}: ${v.option2_value}`,
            v.option3_value && `${v.option3_name}: ${v.option3_value}`,
          ].filter(Boolean).join(" / ") || v.name;
          const stock = v.stock_quantity ?? 0;
          const available = !product.manage_stock || product.allow_backorder || stock > 0;
          return {
            variant_id: v.id,
            label,
            sku: v.sku,
            price: Number(v.price),
            stock,
            available,
          };
        });

        return JSON.stringify({
          has_variants: true,
          product_name: product.name,
          variants: formatted,
          message: formatted.length === 0 ? "Nenhuma variação ativa encontrada." : null,
        });
      }

      case "recommend_related_products": {
        const limit = (args.limit as number) || 3;

        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("items")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        const cartItems = (cart?.items as any[]) || [];
        if (!cartItems.length) {
          return JSON.stringify({ recommendations: [], message: "Carrinho vazio — sem base para recomendar." });
        }

        const mainProductId = cartItems[0].product_id;
        const cartIds = cartItems.map((i: any) => i.product_id);

        // Buscar categorias do produto principal
        const { data: pcs } = await supabase
          .from("product_categories")
          .select("category_id")
          .eq("product_id", mainProductId);

        const categoryIds = (pcs ?? []).map((r: any) => r.category_id);

        let related: any[] = [];
        if (categoryIds.length) {
          const { data: rel } = await supabase
            .from("product_categories")
            .select("product_id, products!inner(id, name, price, stock_quantity, status, has_variants, manage_stock, allow_backorder, deleted_at, tenant_id)")
            .in("category_id", categoryIds)
            .neq("product_id", mainProductId);

          const seen = new Set<string>();
          const candidates: any[] = [];
          for (const row of (rel ?? [])) {
            const p: any = row.products;
            if (!p) continue;
            if (p.tenant_id !== tenantId) continue;
            if (p.deleted_at) continue;
            if (p.status !== "active") continue;
            if (cartIds.includes(p.id)) continue;
            if (seen.has(p.id)) continue;
            const stock = p.stock_quantity ?? 0;
            const available = !p.manage_stock || p.allow_backorder || p.has_variants || stock > 0;
            if (!available) continue;
            seen.add(p.id);
            candidates.push(p);
            if (candidates.length >= limit) break;
          }

          // Fetch primary images in a single batch
          const candidateIds = candidates.map(c => c.id);
          const imageMap = new Map<string, string>();
          if (candidateIds.length) {
            const { data: imgRows } = await supabase
              .from("product_images")
              .select("product_id, url, is_primary, sort_order")
              .in("product_id", candidateIds)
              .order("is_primary", { ascending: false })
              .order("sort_order", { ascending: true });
            for (const img of (imgRows ?? [])) {
              if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, img.url);
            }
          }

          related = candidates.map(p => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            has_variants: p.has_variants ?? false,
            image: imageMap.get(p.id) ?? null,
          }));
        }

        return JSON.stringify({
          recommendations: related,
          based_on: mainProductId,
          message: related.length === 0 ? "Sem recomendações coerentes encontradas no catálogo." : null,
        });
      }

      case "request_human_handoff": {
        const reason = (args.reason as string) || "other";
        const summary = (args.summary as string) || "Cliente solicitou atendimento humano.";
        const lastIntent = (args.last_intent as string) || null;

        // ====== GUARDRAIL SERVER-SIDE ======
        // Bloquear handoff abusivo (saudação, pergunta de catálogo, intenção de compra).
        // Critérios cumulativos:
        //  - Motivos válidos: lista fechada
        //  - Se a última msg do cliente é só saudação curta, BLOQUEAR
        //  - Se NÃO há carrinho ativo E NÃO há sinal de reclamação/negociação no summary, BLOQUEAR
        const VALID_REASONS = new Set([
          "wholesale_b2b",
          "custom_negotiation",
          "complaint",
          "angry_customer",
          "sensitive_issue",
          "technical_blocker",
        ]);

        const lastCustomerMsg = (lastUserMessageContentForTools || "").trim().toLowerCase();
        const isJustGreeting = lastCustomerMsg.length <= 20 && /^(oi+|ol[áa]+|opa+|bom dia|boa tarde|boa noite|hey|hello|hi)\b/i.test(lastCustomerMsg);
        const summaryLc = (summary || "").toLowerCase();
        const summarySuggestsCommercial = /(atacado|b2b|revend|negoci|desconto|orcament|orçament|reclama|atras|defeit|n[ãa]o chegou|cobranca|cobrança|chargeb|estorn|nota fiscal|trocar produto|devolver|judicial)/i.test(summaryLc);

        if (!VALID_REASONS.has(reason) || isJustGreeting || (!summarySuggestsCommercial && reason === "other")) {
          console.warn(`[sales-tool] handoff BLOCKED by guardrail. reason="${reason}" greeting=${isJustGreeting} commercial=${summarySuggestsCommercial} lastMsg="${lastCustomerMsg.slice(0,40)}"`);
          return JSON.stringify({
            success: false,
            blocked: true,
            error: "HANDOFF_NAO_PERMITIDO",
            message: "Esta situação não justifica handoff humano. Use search_products / get_product_details / add_to_cart para atender o cliente. Saudação simples ou dúvida de catálogo NÃO são motivos válidos de handoff.",
          });
        }

        // Carregar carrinho ativo (se existir) para anexar contexto
        const { data: cart } = await supabase
          .from("whatsapp_carts")
          .select("id, items, subtotal_cents, coupon_code, customer_data")
          .eq("conversation_id", conversationId)
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .maybeSingle();

        const cartSummary = cart ? {
          cart_id: cart.id,
          items: (cart.items as any[])?.map((i: any) => ({
            name: i.name,
            variant_label: i.variant_label ?? null,
            quantity: i.quantity,
            subtotal: i.subtotal,
          })) || [],
          subtotal: ((cart.subtotal_cents ?? 0) / 100).toFixed(2),
          coupon: cart.coupon_code || null,
        } : null;

        // Criar ticket de suporte (categoria sales)
        const subject = `[Vendas WhatsApp] ${summary.slice(0, 80)}`;
        const { data: ticket, error: ticketErr } = await supabase
          .from("support_tickets")
          .insert({
            tenant_id: tenantId,
            created_by: customerId || "00000000-0000-0000-0000-000000000000",
            subject,
            category: "sales",
            priority: reason === "angry_customer" || reason === "complaint" ? "high" : "normal",
            status: "open",
            source_conversation_id: conversationId,
            metadata: {
              source: "whatsapp_sales",
              handoff_reason: reason,
              last_intent: lastIntent,
              ai_summary: summary,
              customer: {
                id: customerId,
                name: customerName,
                phone: customerPhone,
                email: customerEmail,
              },
              cart: cartSummary,
            },
          })
          .select()
          .single();

        if (ticketErr) {
          console.error("[sales-tool] handoff ticket error:", ticketErr);
        }

        // Marcar carrinho com handoff
        if (cart) {
          await supabase
            .from("whatsapp_carts")
            .update({
              status: "handoff",
              handoff_reason: reason,
              handoff_ticket_id: ticket?.id ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cart.id);
        }

        // Marcar conversa como aguardando agente
        await supabase
          .from("conversations")
          .update({ status: "waiting_agent", updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        return JSON.stringify({
          success: true,
          ticket_id: ticket?.id ?? null,
          message: "Handoff solicitado. Um vendedor humano vai assumir a conversa em breve.",
        });
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

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Buscar OPENAI_API_KEY via platform_credentials (banco) com fallback para env var
    const OPENAI_API_KEY = await getCredential(supabaseUrl, serviceKey, "OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured (neither in platform_credentials nor env var)");
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured", code: "AI_NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    
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

    // ============================================
    // UNIVERSAL GATE: channel_accounts.is_active
    // Source of truth for "channel enabled". If the row is missing
    // or is_active=false, AI must NOT respond on this channel.
    // ============================================
    const { data: channelAccount } = await supabase
      .from("channel_accounts")
      .select("id, is_active")
      .eq("tenant_id", tenant_id)
      .eq("channel_type", channelType)
      .maybeSingle();

    if (!channelAccount || channelAccount.is_active === false) {
      console.log(`[GATE] Channel ${channelType} not active for tenant ${tenant_id} (row=${!!channelAccount}, active=${channelAccount?.is_active})`);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Channel ${channelType} is disabled for this tenant`,
          code: "CHANNEL_DISABLED",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // [Fase A] Janela de histórico CORRIGIDA:
    // Antes: .order(asc).limit(20) → pegava os 20 PRIMEIROS turnos. Em conversas
    // longas, a mensagem atual do cliente NUNCA entrava no contexto, e a IA
    // operava sobre histórico antigo (loop de onboarding).
    // Agora: pega os 30 mais RECENTES (desc) + reordena ascendente em memória,
    // garantindo que o turno atual esteja sempre incluído.
    const HISTORY_WINDOW = 30;
    const { data: messagesDesc } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(HISTORY_WINDOW);

    const messages = (messagesDesc ?? []).slice().reverse();

    // Última mensagem REAL do cliente (último item de sender_type=customer na
    // ordem cronológica final, ignorando notas internas).
    const lastCustomerMessage = [...messages]
      .filter(m => m.sender_type === "customer" && !m.is_internal && !m.is_note)
      .pop();
    const lastMessageContent = lastCustomerMessage?.content || "";

    // Build conversation context for classification (últimos 5 reais)
    const conversationContext = messages
      .slice(-5)
      .map(m => `${m.sender_type === "customer" ? "Cliente" : "Atendente"}: ${m.content?.slice(0, 200)}`)
      .join("\n");

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

    // ============================================
    // TENANT-AWARE GROUNDING (Fase 4)
    // ============================================
    let tenantSnapshot = null as Awaited<ReturnType<typeof getOrBuildTenantContext>>;
    let relevantProducts: Array<{ name: string; price?: number; category?: string }> = [];
    try {
      tenantSnapshot = await getOrBuildTenantContext(supabase, tenant_id, {
        forceSyncIfMissing: true,
      });
      const grounded = hasEnoughGrounding(tenantSnapshot);
      if (tenantSnapshot) {
        systemPrompt += formatTenantContextForPrompt(tenantSnapshot);
        // Catálogo enxuto SEMPRE — incluindo modo vendas. Sem catálogo o modelo
        // não sabe que produtos buscar e cai em loop de qualificação. A regra
        // "preço/estoque vem da tool" continua válida via prompt SALES_AGENT.
        relevantProducts = pickRelevantProducts(tenantSnapshot, lastMessageContent, 8);
        systemPrompt += formatRelevantCatalogForPrompt(relevantProducts);
        console.log(
          `[ai-support-chat] tenant-context injected — niche="${tenantSnapshot.niche_label}" grounded=${grounded} relevant=${relevantProducts.length} sales_mode=${salesModeEnabled}`
        );
      }
      // Soltar handoff cego: se KB vazia mas snapshot tem grounding, não escalar
      if (noEvidenceHandoff && grounded) {
        noEvidenceHandoff = false;
        if (handoffReason === "Base de conhecimento insuficiente para responder") {
          shouldHandoff = false;
          handoffReason = "";
          console.log("[ai-support-chat] handoff suppressed — tenant snapshot provides grounding");
        }
      }
    } catch (err) {
      console.error("[ai-support-chat] tenant-context error:", err);
    }

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

    // ============================================
    // TENANT LEARNING MEMORY (Fase 1) — leitura
    // Injeta padrões aprendidos (FAQ/objeção/winning) relevantes à pergunta atual
    // ============================================
    let learningHits: LearningHit[] = [];
    try {
      learningHits = await getRelevantLearning(supabase, tenant_id, lastMessageContent, "support", 5);
      if (learningHits.length > 0) {
        systemPrompt += formatLearningForPrompt(learningHits);
        console.log(`[ai-support-chat] Learning context injected (${learningHits.length} hits)`);
        markLearningUsed(supabase, learningHits.map(h => h.id)).catch(() => {});
      }
    } catch (e) {
      console.warn("[ai-support-chat] Learning fetch error:", e);
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

    let historySizeUsed = 0;
    if (messages?.length) {
      // Em sales mode, filtrar histórico para evitar contaminação por turnos
      // antigos (ex.: bot informativo que ensinava "Como posso ajudar?").
      // Mantém só os últimos 10 turnos do "burst" atual (últimas 2h).
      let usableMessages = messages;
      if (salesModeEnabled) {
        const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2h
        const recent = messages.filter(m => new Date(m.created_at).getTime() >= cutoff);
        usableMessages = recent.length >= 2 ? recent.slice(-10) : messages.slice(-6);
        console.log(`[ai-support-chat] sales-mode history filter: ${messages.length} → ${usableMessages.length}`);
      }
      historySizeUsed = usableMessages.length;
      for (const msg of usableMessages) {
        if (msg.is_internal || msg.is_note) continue;
        aiMessages.push({
          role: msg.sender_type === "customer" ? "user" : "assistant",
          content: msg.content || "",
        });
      }
    }

    // ============================================
    // SALES MODE: Detector de produto nominal
    // Se o cliente cita um produto que existe no catálogo, injetamos um
    // hint imperativo final para forçar tool-calling. Isto é crítico para
    // evitar loop de qualificação quando a intenção já é clara.
    // ============================================
    let salesTriggerFired = false;
    let salesIntentFlags = { naming: false, buy: false, details: false, matchedNames: [] as string[] };
    if (salesModeEnabled && lastMessageContent) {
      try {
        const lc = lastMessageContent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        // Heurísticas de intenção
        const isNamingProduct = /(kit|shampoo|balm|locao|loc[aã]o|creme|s[ée]rum|m[áa]scara|perfume|sabonete|condicionador|gel|p[óo]|tonico|t[ôo]nico)\s+\w/i.test(lastMessageContent);
        const isWantToBuy = /\b(quero comprar|pode adicionar|adiciona no carrinho|coloca no carrinho|vou levar|fechar o pedido|finaliza|manda o link|gera o link)\b/i.test(lc);
        const isWantDetails = /\b(me fala mais|me conta mais|detalh|quanto custa|qual o preco|qual o pre[çc]o|tem em estoque)\b/i.test(lc);

        // Match com top_products do snapshot (case-insensitive, sem acento)
        let matchedProductHint = "";
        let matchedNames: string[] = [];
        if (tenantSnapshot?.top_products?.length) {
          const matches = tenantSnapshot.top_products.filter((p: any) => {
            if (!p?.name) return false;
            const pn = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            // Match: produto inteiro contido na mensagem OU 2+ tokens significativos do produto na mensagem
            if (lc.includes(pn)) return true;
            const tokens = pn.split(/\s+/).filter((t: string) => t.length >= 4);
            const hits = tokens.filter((t: string) => lc.includes(t)).length;
            return tokens.length >= 2 && hits >= 2;
          }).slice(0, 5);

          if (matches.length) {
            matchedNames = matches.map((m: any) => m.name);
            matchedProductHint = `\nProdutos do catálogo que casam com a mensagem do cliente: ${matches.map((m: any) => `"${m.name}"`).join(", ")}.`;
          }
        }

        const triggers: string[] = [];
        if (isNamingProduct || matchedProductHint) {
          triggers.push("O cliente CITOU um produto. VOCÊ DEVE chamar `search_products` AGORA com o nome citado, antes de responder.");
        }
        if (isWantDetails) {
          triggers.push("O cliente pediu DETALHES. VOCÊ DEVE chamar `search_products` + `get_product_details` antes de responder.");
        }
        if (isWantToBuy) {
          triggers.push("O cliente quer COMPRAR. VOCÊ DEVE chamar `search_products` (se ainda não souber o id) e em seguida `add_to_cart`. Não pergunte de novo o que ele quer.");
        }

        salesIntentFlags = { naming: isNamingProduct, buy: isWantToBuy, details: isWantDetails, matchedNames };

        if (triggers.length || matchedProductHint) {
          salesTriggerFired = true;
          aiMessages.push({
            role: "system",
            content: `### AÇÃO OBRIGATÓRIA NESTE TURNO\n${triggers.join("\n")}${matchedProductHint}\n\nPROIBIDO responder apenas com texto se algum gatilho acima foi acionado. Chame as tools primeiro.`,
          });
          console.log(`[ai-support-chat] sales-mode trigger injected — naming=${isNamingProduct} buy=${isWantToBuy} details=${isWantDetails} matches=${matchedProductHint ? "yes" : "no"}`);
        }
      } catch (e) {
        console.error("[ai-support-chat] sales trigger detection error:", e);
      }
    }

    // ============================================
    // [Fase A] LOG CANÔNICO MÍNIMO POR TURNO
    // Permite enxergar exatamente o que o motor recebeu e decidiu antes de
    // chamar o modelo. Linha única JSON para facilitar grep/parse nos logs.
    // ============================================
    const toolChoiceApplied = salesModeEnabled ? (salesTriggerFired ? "required" : "auto") : "none";
    const inferredIntent =
      salesIntentFlags.buy ? "purchase" :
      salesIntentFlags.details ? "product_details" :
      salesIntentFlags.naming || salesIntentFlags.matchedNames.length ? "product_named" :
      (intentClassification?.intent ?? "unknown");
    const inferredStage =
      salesIntentFlags.buy ? "intent_to_buy" :
      salesIntentFlags.details || salesIntentFlags.matchedNames.length ? "product_detail" :
      historySizeUsed <= 2 ? "greeting" : "discovery";
    const guardrailBlock = shouldHandoff ? `handoff:${handoffReason || "unspecified"}` : null;

    console.log("[ai-support-chat] CANONICAL_TURN_LOG " + JSON.stringify({
      conversation_id,
      tenant_id,
      sales_mode: salesModeEnabled,
      last_message_content: (lastMessageContent || "").slice(0, 200),
      last_message_id: lastCustomerMessage?.id ?? null,
      last_message_at: lastCustomerMessage?.created_at ?? null,
      history_window_fetched: messages.length,
      history_size_used: historySizeUsed,
      relevant_products_count: relevantProducts.length,
      relevant_products: relevantProducts.map(p => p.name).slice(0, 5),
      sales_matched_products: salesIntentFlags.matchedNames,
      inferred_intent: inferredIntent,
      inferred_stage: inferredStage,
      tool_choice_applied: toolChoiceApplied,
      sales_trigger_fired: salesTriggerFired,
      guardrail_block: guardrailBlock,
    }));

    // ============================================
    // STEP 7: CALL OPENAI API (with tool call loop for sales mode)
    // ============================================
    let aiContent: string;
    
    // Em sales mode, exigir modelo forte (gpt-5/5.2) para tool-calling confiável.
    // gpt-5-mini falha em chamar tools mesmo com prompts imperativos.
    let configuredModel = effectiveConfig.ai_model || "gpt-5.2";
    if (salesModeEnabled && (configuredModel.includes("mini") || configuredModel.includes("nano") || configuredModel.includes("flash"))) {
      console.log(`[ai-support-chat] sales-mode: upgrading model from ${configuredModel} to gpt-5 for reliable tool-calling`);
      configuredModel = "gpt-5";
    }
    
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
        lastUserMessage: lastMessageContent || null,
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
            // Em sales mode, decisões de tool-calling devem ser determinísticas
            temperature: salesModeEnabled ? 0.3 : 0.7,
          };

          // Add sales tools only in sales mode.
          // Quando heurística disparou, FORÇAR tool-calling ("required") para
          // impedir que o modelo responda apenas com texto repetido.
          if (salesModeEnabled) {
            requestBody.tools = SALES_TOOLS;
            requestBody.tool_choice = salesTriggerFired ? "required" : "auto";
            requestBody.parallel_tool_calls = false;
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

          // BUG FIX: Se a tool de handoff comercial foi chamada com sucesso,
          // forçar shouldHandoff para impedir que o status da conversa seja
          // revertido para 'bot' no final do fluxo.
          // GUARDRAIL: se a tool retornou blocked=true, NÃO forçar handoff.
          if (fnName === "request_human_handoff") {
            try {
              const parsed = JSON.parse(result);
              if (parsed?.success === true && !parsed?.blocked) {
                shouldHandoff = true;
                handoffReason = (fnArgs.reason as string) || "sales_handoff_tool";
                console.log(`[ai-support-chat] Handoff tool acionada — forçando waiting_agent (reason=${handoffReason})`);
              } else if (parsed?.blocked) {
                console.warn(`[ai-support-chat] Handoff BLOQUEADO pelo guardrail — mantendo status 'bot' e instruindo modelo a usar tools de venda.`);
              }
            } catch { /* ignore parse errors */ }
          }

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
          temperature: 0.3,
          tools: SALES_TOOLS,
          tool_choice: "auto",
          parallel_tool_calls: false,
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

    // [learning] capture event for aggregator (continuity OR handoff_success)
    captureLearningEvent(supabase, {
      tenant_id,
      conversation_id,
      event_type: shouldHandoff ? "handoff_success" : "continuity",
      customer_message: lastMessageContent,
      ai_response: aiContent,
      metadata: {
        intent: intentClassification?.intent,
        sales_mode: salesModeEnabled,
        handoff_reason: handoffReason || null,
      },
    }).catch(() => {});

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
