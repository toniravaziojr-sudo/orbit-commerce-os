import { createClient } from "npm:@supabase/supabase-js@2";
import { redactPII } from "../_shared/redact-pii.ts";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getBrainContextForPrompt } from "../_shared/brain-context.ts";
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
import {
  isPureGreeting,
  isExplicitImageRequest,
  evaluateImagePolicy,
  nextSalesState,
  hashResponse,
  type SalesState,
  type Intent,
} from "../_shared/sales-state-machine.ts";
// [F2] Pipeline modular por estado comercial
import {
  buildPromptForState,
  decideNextState,
  isToolAllowedInState,
  normalizeLegacyState,
  toLegacyState,
  TOOLS_BY_STATE,
  type PipelineState,
  type TransitionReason,
  // [Sub-fase 1.3] regra determinística de variante + persistência no foco
  evaluateVariantGate,
  buildProductFocus,
  readProductFocus,
  type ProductFocus,
} from "../_shared/sales-pipeline/index.ts";
// [Pacotes B/C/D/E] Dinâmica de turno (lock, continuação, stall, anti-dup)
import {
  acquireProcessingLock,
  releaseProcessingLock,
  detectContinuation,
  detectStallPromise,
  isDuplicateRecentResponse,
  loadPendingAction,
  persistPendingAction,
  type ContinuationContext,
  type LastPendingAction,
  type StallDetection,
} from "../_shared/turn-dynamics.ts";
// [Fase 1 - Pacotes A+B+C+G] Contexto de negócio inferido do tenant
import {
  loadBusinessContextBlock,
  triggerContextRegeneration,
} from "../_shared/business-context-loader.ts";

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

// [PERF] Modelos rápidos preferidos em estados simples (greeting/discovery).
// Ordem: rápidos primeiro, alta-qualidade como fallback.
const FAST_MODELS_FOR_SIMPLE_STATES: readonly string[] = [
  "gpt-5-nano",
  "gpt-5-mini",
  "gpt-4o",
  "gpt-5.2",
  "gpt-5",
] as const;

// [PERF] Cache em memória (vive por cold start) de modelos que retornaram
// 404/400 — evita reenviar a mesma requisição que vai falhar de novo.
// Tolerante a falha: se o cache estourar (caso impossível), apenas reentra na
// rota normal de fallback.
const UNAVAILABLE_MODELS = new Set<string>();

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
🖼️ ENVIO DE IMAGEM DO PRODUTO
═══════════════════════════════════════════════════════

CHAME \`send_product_image\` quando:
- O cliente pedir explicitamente foto/imagem ("me mostra", "tem foto?", "manda a imagem").
- Você apresentar um produto pela primeira vez na conversa E o resultado de \`get_product_details\` trouxer \`primary_image\` não-nulo.
- O cliente estiver prestes a confirmar a compra e ainda não viu o produto.

REGRAS:
- 1 imagem por produto por conversa. Se o servidor retornar \`already_sent: true\`, NÃO tente de novo.
- Se o produto não tiver imagem cadastrada (tool retorna erro), apenas descreva em texto. NÃO peça desculpas longas.
- A imagem é entregue pelo WhatsApp em separado. NO TEXTO da resposta, comente brevemente ("Te mandei a foto") e siga a venda.

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
      description: "Busca produtos do catálogo do tenant. Por padrão devolve APENAS produtos únicos (sem composição) — kits/combos só vêm se include_kits=true. Use pain_hint quando o cliente já declarou a dor/objetivo (ex.: 'calvície', 'queda', 'prevenção', 'caspa'); a tool faz join com as categorias do tenant pra filtrar pela dor antes do nome.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca (família ou nome do produto). Ex.: 'shampoo', 'balm', 'Calvície Zero'." },
          pain_hint: { type: "string", description: "Dor/objetivo do cliente em linguagem natural (ex.: 'calvície', 'queda de cabelo', 'prevenção', 'caspa', 'pós-banho'). Quando informado, a tool prioriza produtos das categorias compatíveis." },
          include_kits: { type: "boolean", description: "Default false. Só passe true quando o cliente JÁ tem produto base escolhido (upsell) ou pediu explicitamente kit/combo." },
          limit: { type: "number", description: "Máximo de resultados (default 5)." },
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
    salesState?: SalesState;
    imagesSentMap?: Record<string, number>;
    // [Sub-fase 1.3] foco de produto/variante persistido (leitura) + setter p/ o turno
    productFocus?: ProductFocus | null;
    setProductFocus?: (focus: ProductFocus | null) => void;
  }
): Promise<string> {
  const { supabase, tenantId, conversationId, customerId, storeUrl, customerPhone, customerEmail, customerName } = ctx;
  const lastUserMessageContentForTools = ctx.lastUserMessage || "";

  try {
    switch (toolName) {
      case "search_products": {
        const rawQuery = (args.query as string) || "";
        const requestedLimit = (args.limit as number) || 5;
        // Default seguro: na 1ª oferta a IA não vê kit. Só vê se pediu explicitamente.
        const includeKits = args.include_kits === true;
        const painHintRaw = (args.pain_hint as string) || "";

        // Normaliza Unicode (NFC) e remove ruído típico (preço, travessões)
        const query = rawQuery
          .normalize("NFC")
          .replace(/[—–-]\s*R\$.*$/i, "")
          .replace(/R\$\s*[\d.,]+/gi, "")
          .replace(/\s{2,}/g, " ")
          .trim();
        const tokens = query.split(/\s+/).filter(t => t.length >= 3).slice(0, 5);

        const PRODUCT_COLS = "id, name, slug, price, compare_at_price, stock_quantity, status, has_variants, manage_stock, allow_backorder";

        // ---------------------------------------------------------------
        // CAMADA 2 — Mapa léxico DOR/OBJETIVO → padrões de nome de categoria
        // do tenant. Mantido aqui (não em prompt) pra ser determinístico,
        // testável e à prova de divergência do modelo. Categorias do tenant
        // de teste: "Tratamento Para Calvicie", "Pos Tratamento Prevencao
        // Para Calvicie", "Shampoo Calvície Zero", "Shampoo Preventive Power",
        // "Balm Pós-Banho Calvície Zero", "Loção pós-banho Calvície Zero", etc.
        // O matching é por ILIKE em categories.name, então funciona com qualquer
        // tenant que tenha categorias nomeadas pela dor.
        // ---------------------------------------------------------------
        const painLexicon: Array<{ test: RegExp; categoryPatterns: string[] }> = [
          { test: /\bcalv[íi]cie|queda|caindo|falha(s)?\b|coroa|ralo|rala/i,
            categoryPatterns: ["%calv%", "%queda%", "%tratamento%"] },
          { test: /\bpreven(ir|[çc][ãa]o|tivo)|fortalec|crescimento|crescer/i,
            categoryPatterns: ["%preven%", "%fortalec%", "%crescimento%"] },
          { test: /\bcaspa|seborr[eé]ia/i,
            categoryPatterns: ["%caspa%", "%seborr%", "%anticaspa%"] },
          { test: /\boleosidade|cabelo\s+oleoso|couro\s+cabeludo/i,
            categoryPatterns: ["%oleos%", "%couro%"] },
          { test: /\bp[óo]s[\s-]banho/i,
            categoryPatterns: ["%pos%banho%", "%p[óo]s%banho%"] },
        ];

        const painSource = `${painHintRaw} ${query} ${lastUserMessageContentForTools}`;
        const matchedCategoryPatterns: string[] = [];
        for (const entry of painLexicon) {
          if (entry.test.test(painSource)) {
            for (const pat of entry.categoryPatterns) {
              if (!matchedCategoryPatterns.includes(pat)) matchedCategoryPatterns.push(pat);
            }
          }
        }

        // Resolve product_ids da árvore de categoria do tenant compatível com a dor.
        // Tolerante a falha: se as tabelas/joins falharem por qualquer motivo,
        // seguimos para o caminho normal (apenas perde-se o boost por dor).
        let painProductIds: Set<string> | null = null;
        if (matchedCategoryPatterns.length) {
          try {
            const orCatFilter = matchedCategoryPatterns.map(p => `name.ilike.${p}`).join(",");
            const { data: catRows } = await supabase
              .from("categories")
              .select("id")
              .eq("tenant_id", tenantId)
              .or(orCatFilter);
            const catIds = (catRows ?? []).map((c: any) => c.id);
            if (catIds.length) {
              const { data: pcRows } = await supabase
                .from("product_categories")
                .select("product_id")
                .in("category_id", catIds);
              const ids = new Set<string>((pcRows ?? []).map((r: any) => r.product_id));
              if (ids.size) painProductIds = ids;
            }
          } catch (e) {
            console.warn(`[ai-support-chat][search_products] pain→category resolve falhou (segue sem boost):`, (e as Error).message);
          }
        }

        // Helper: enriquece linhas com imagem e flag is_kit (fonte de verdade = product_components)
        const enrichList = async (rows: any[]) => {
          if (!rows?.length) return [];
          const ids = rows.map(r => r.id);

          const { data: imgRows } = await supabase
            .from("product_images")
            .select("product_id, url, alt_text, is_primary, sort_order")
            .in("product_id", ids)
            .order("is_primary", { ascending: false })
            .order("sort_order", { ascending: true });

          const primaryImageByProduct = new Map<string, { url: string; alt: string | null }>();
          for (const img of ((imgRows ?? []) as any[])) {
            if (!primaryImageByProduct.has(img.product_id)) {
              primaryImageByProduct.set(img.product_id, { url: img.url, alt: img.alt_text ?? null });
            }
          }

          const { data: compRows } = await supabase
            .from("product_components")
            .select("parent_product_id")
            .in("parent_product_id", ids);
          const kitSet = new Set((compRows ?? []).map((r: any) => r.parent_product_id));

          const KIT_EXPLICIT_PREFIX = /^\s*(kit|combo)\b/i;
          const looksLikeKitByExplicitName = (name?: string | null) =>
            !!name && KIT_EXPLICIT_PREFIX.test(name);

          return rows.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compare_at_price: p.compare_at_price,
            stock: p.stock_quantity,
            image: primaryImageByProduct.get(p.id)?.url ?? null,
            image_alt: primaryImageByProduct.get(p.id)?.alt ?? null,
            is_kit: kitSet.has(p.id) || looksLikeKitByExplicitName(p.name),
            has_variants: p.has_variants ?? false,
            manage_stock: p.manage_stock ?? true,
            allow_backorder: p.allow_backorder ?? false,
            // Sinaliza ao modelo qual foi a "razão de match" desse item.
            match_reason: painProductIds && painProductIds.has(p.id) ? "pain_match" : "name_match",
          }));
        };

        // ENFORCEMENT do servidor:
        // 1) Particiona em [únicos, kits] usando is_kit já resolvido.
        // 2) Aplica o limit em CIMA dos únicos primeiro; só completa com kits
        //    se include_kits=true e ainda houver folga.
        // 3) Quando há pain match, únicos com pain_match vêm antes dos demais.
        const partitionAndLimit = (enriched: any[]) => {
          const singles = enriched.filter(p => !p.is_kit);
          const kits = enriched.filter(p => p.is_kit);

          const sortByPain = (arr: any[]) =>
            [...arr].sort((a, b) => {
              const ap = a.match_reason === "pain_match" ? 0 : 1;
              const bp = b.match_reason === "pain_match" ? 0 : 1;
              return ap - bp;
            });

          const singlesSorted = sortByPain(singles);
          const kitsSorted = sortByPain(kits);

          const out = singlesSorted.slice(0, requestedLimit);
          if (includeKits && out.length < requestedLimit) {
            out.push(...kitsSorted.slice(0, requestedLimit - out.length));
          }
          return out;
        };

        // Pool de busca: pegamos um limite generoso (×6) pra ter material
        // pra particionar; o limit final do cliente é aplicado depois.
        const POOL_LIMIT = Math.max(requestedLimit * 6, 30);

        // 1) Pool por nome (ILIKE). Quando há query genérica como "shampoo",
        //    isso traz tanto únicos quanto kits — o particionamento decide o que sai.
        let pool: any[] = [];
        if (query) {
          const { data, error } = await supabase
            .from("products")
            .select(PRODUCT_COLS)
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .is("deleted_at", null)
            .ilike("name", `%${query}%`)
            .limit(POOL_LIMIT);
          if (!error && data?.length) pool = data;
        }

        // 2) Se houve pain match, garante que os produtos da categoria entrem no pool
        //    mesmo que o ILIKE no nome não os tenha pegado.
        if (painProductIds && painProductIds.size) {
          const missing = [...painProductIds].filter(id => !pool.some(r => r.id === id));
          if (missing.length) {
            const { data: byPain } = await supabase
              .from("products")
              .select(PRODUCT_COLS)
              .eq("tenant_id", tenantId)
              .eq("status", "active")
              .is("deleted_at", null)
              .in("id", missing)
              .limit(POOL_LIMIT);
            if (byPain?.length) pool.push(...byPain);
          }
        }

        // 3) Fallback por tokens, só se ainda estiver vazio.
        if (!pool.length && tokens.length) {
          const orFilter = tokens.map(t => `name.ilike.%${t}%`).join(",");
          const { data: tokenData } = await supabase
            .from("products")
            .select(PRODUCT_COLS)
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .is("deleted_at", null)
            .or(orFilter)
            .limit(POOL_LIMIT);
          if (tokenData?.length) pool = tokenData;
        }

        // 4) Último fallback: RPC fuzzy.
        if (!pool.length) {
          const { data: fuzzyData } = await (supabase as any).rpc("search_products_fuzzy", {
            p_tenant_id: tenantId,
            p_query: query || rawQuery,
            p_limit: POOL_LIMIT,
            p_exclude_kits: false,
          });
          if (fuzzyData?.length) {
            const fuzzyIds = fuzzyData.map((p: any) => p.id);
            const { data: refetched } = await supabase
              .from("products")
              .select(PRODUCT_COLS)
              .in("id", fuzzyIds)
              .eq("tenant_id", tenantId)
              .is("deleted_at", null);
            if (refetched?.length) pool = refetched;
          }
        }

        if (!pool.length) {
          return JSON.stringify({ message: "Nenhum produto encontrado para a busca.", query: query || rawQuery });
        }

        // Dedup por id (pool pode ter recebido o mesmo produto por 2 caminhos)
        const seen = new Set<string>();
        pool = pool.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });

        const enriched = await enrichList(pool);
        const finalList = partitionAndLimit(enriched);
        return JSON.stringify(finalList);
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
        const prod: any = data;

        // Primary image (is_primary first, then sort_order)
        const { data: imgRows } = await supabase
          .from("product_images")
          .select("url, alt_text, is_primary, sort_order")
          .eq("product_id", productId)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
          .limit(1);
        const firstImg: any = imgRows?.[0];
        const primaryImage = firstImg ? { url: firstImg.url, alt: firstImg.alt_text ?? null } : null;

        // Variants summary + list
        let variantsSummary: any = null;
        let variantsList: any[] = [];
        if (prod.has_variants) {
          const { data: variantsData } = await supabase
            .from("product_variants")
            .select("id, name, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, price, stock_quantity, is_active, sku, weight")
            .eq("product_id", productId)
            .eq("is_active", true)
            .order("position", { ascending: true });
          const variants: any[] = (variantsData ?? []) as any[];
          if (variants.length) {
            const prices = variants.map((v: any) => Number(v.price ?? prod.price)).filter((n: number) => !isNaN(n));
            const totalStock = variants.reduce((s: number, v: any) => s + (v.stock_quantity ?? 0), 0);
            variantsSummary = {
              count: variants.length,
              price_min: prices.length ? Math.min(...prices) : prod.price,
              price_max: prices.length ? Math.max(...prices) : prod.price,
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
              price: Number(v.price ?? prod.price),
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
          prod.compare_at_price &&
          (!prod.promotion_start_date || new Date(prod.promotion_start_date) <= now) &&
          (!prod.promotion_end_date || new Date(prod.promotion_end_date) >= now)
        );

        const baseStock = prod.stock_quantity ?? 0;
        const available = prod.status === "active" && (
          !prod.manage_stock ||
          prod.allow_backorder ||
          (prod.has_variants ? (variantsSummary?.total_stock ?? 0) > 0 : baseStock > 0)
        );

        return JSON.stringify({
          success: true,
          id: prod.id,
          name: prod.name,
          slug: prod.slug,
          description: prod.description ?? null,
          short_description: prod.short_description ?? null,
          brand: prod.brand ?? null,
          sku: prod.sku ?? null,
          gtin: prod.gtin ?? null,
          price: prod.price,
          compare_at_price: prod.compare_at_price,
          promotion_active: promoActive,
          stock: baseStock,
          available,
          free_shipping: prod.free_shipping ?? false,
          avg_rating: prod.avg_rating ?? null,
          review_count: prod.review_count ?? 0,
          physical: {
            weight_g: prod.weight,
            width_cm: prod.width,
            height_cm: prod.height,
            depth_cm: prod.depth,
          },
          primary_image: primaryImage,
          categories,
          has_variants: prod.has_variants ?? false,
          manage_stock: prod.manage_stock ?? true,
          allow_backorder: prod.allow_backorder ?? false,
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
        // [Sub-fase 1.3] variante efetivamente usada (pode vir do tool_call,
        //   do foco persistido, ou da auto-resolução por variante única).
        let effectiveVariantId: string | null = variantId ?? null;

        if (product.has_variants) {
          // --- GATE determinístico de variante ---
          // 1) Lê payload comercial (has_mandatory_variants) — pode ser null
          //    se o produto ainda não tem payload curado pelo cérebro.
          const { data: commercialPayload } = await supabase
            .from("ai_product_commercial_payload")
            .select("has_mandatory_variants")
            .eq("product_id", productId)
            .eq("tenant_id", tenantId)
            .maybeSingle();

          // 2) Lista enxuta de variantes ativas (pra resolver caso "1 única")
          const { data: activeVariantsRows } = await supabase
            .from("product_variants")
            .select("id, name, option1_value, option2_value, option3_value")
            .eq("product_id", productId)
            .eq("is_active", true);

          const activeVariants = (activeVariantsRows ?? []).map((v: any) => ({
            id: v.id as string,
            label:
              [v.option1_value, v.option2_value, v.option3_value]
                .filter(Boolean)
                .join(" / ") ||
              (v.name as string | null) ||
              null,
          }));

          const gate = evaluateVariantGate({
            product_id: productId,
            product_has_variants: true,
            commercial_has_mandatory_variants:
              (commercialPayload?.has_mandatory_variants as boolean | undefined) ?? null,
            current_focus: ctx.productFocus ?? null,
            explicit_variant_id: variantId ?? null,
            active_variants: activeVariants,
          });

          if (gate.status === "ask_variant") {
            return JSON.stringify({
              success: false,
              error: "VARIANT_REQUIRED",
              message:
                "Este produto tem variações. Use get_product_variants para listar as opções e peça ao cliente para escolher antes de adicionar ao carrinho.",
              gate_reason: gate.reason,
            });
          }

          // gate resolveu — usa o id decidido pelo gate (se houver) ou o que veio do call
          effectiveVariantId = gate.variant_id ?? variantId ?? null;

          if (effectiveVariantId) {
            const { data: variant } = await supabase
              .from("product_variants")
              .select("id, name, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, price, stock_quantity, is_active, sku")
              .eq("id", effectiveVariantId)
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

          // Persiste foco (determina quem resolveu: user ou auto)
          if (ctx.setProductFocus) {
            const source: ProductFocus["source"] =
              gate.status === "ok_single_variant"
                ? "single_variant"
                : gate.status === "ok_no_variant_needed"
                  ? "no_variants_needed"
                  : "user_selection";
            ctx.setProductFocus(
              buildProductFocus({
                product_id: productId,
                variant_id: effectiveVariantId,
                variant_label: variantLabel,
                source,
              })
            );
          }
        } else {
          // Produto sem variantes → grava foco simples também (útil p/ turnos futuros)
          if (ctx.setProductFocus) {
            ctx.setProductFocus(
              buildProductFocus({
                product_id: productId,
                variant_id: null,
                variant_label: null,
                source: "no_variants_needed",
              })
            );
          }
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
          i.product_id === productId && (i.variant_id ?? null) === (effectiveVariantId ?? null)
        );

        if (existingIdx >= 0) {
          items[existingIdx].quantity += quantity;
          items[existingIdx].subtotal = items[existingIdx].quantity * unitPrice;
        } else {
          items.push({
            product_id: productId,
            variant_id: effectiveVariantId ?? null,
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
          // [Sub-fase 1.3] produto sem variantes → foca no produto, não pergunta de novo
          if (ctx.setProductFocus) {
            ctx.setProductFocus(
              buildProductFocus({
                product_id: productId,
                variant_id: null,
                variant_label: null,
                source: "no_variants_needed",
              })
            );
          }
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

        // [Sub-fase 1.3] Se só existe 1 variante ativa → resolve foco automaticamente.
        //   A IA ainda vê a lista, mas não precisa repetir pergunta no próximo turno.
        if (formatted.length === 1 && ctx.setProductFocus) {
          ctx.setProductFocus(
            buildProductFocus({
              product_id: productId,
              variant_id: formatted[0].variant_id,
              variant_label: formatted[0].label,
              source: "single_variant",
            })
          );
        }

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

      case "send_product_image": {
        const productId = args.product_id as string;
        const caption = (args.caption as string | undefined)?.substring(0, 300) ?? "";

        if (!productId) {
          return JSON.stringify({ success: false, error: "product_id é obrigatório" });
        }
        if (!customerPhone) {
          return JSON.stringify({ success: false, error: "Sem telefone do cliente — não é possível enviar imagem." });
        }

        // [F1] POLÍTICA CONSERVADORA DE IMAGEM
        // Bloqueio server-side antes de qualquer custo (DB/WhatsApp).
        // Regras:
        //   1) Em greeting/discovery: SÓ se cliente pediu explicitamente
        //   2) Em consideration/decision: liberado
        //   3) Sempre proibido se já enviada para este produto
        const stateForImage: SalesState = ctx.salesState || "greeting";
        const customerAsked = isExplicitImageRequest(lastUserMessageContentForTools);
        const alreadySentForProduct = (ctx.imagesSentMap?.[productId] ?? 0) > 0;

        const policy = evaluateImagePolicy({
          salesState: stateForImage,
          intent: customerAsked ? "image_request" : "other",
          productAlreadySent: alreadySentForProduct,
          customerExplicitlyAsked: customerAsked,
        });

        if (!policy.allowed) {
          console.log(`[send_product_image] [F1] BLOCKED — state=${stateForImage} reason=${policy.reason} asked=${customerAsked}`);
          return JSON.stringify({
            success: false,
            blocked: true,
            error: "Envio de imagem bloqueado pela política da pipeline básica.",
            reason: policy.reason,
            instruction: stateForImage === "greeting" || stateForImage === "discovery"
              ? "Continue a conversa em texto. Só envie imagem quando o cliente pedir ou quando estiverem em fase avançada de decisão."
              : "Imagem deste produto já foi enviada nesta conversa.",
          });
        }

        // Look up product (must belong to tenant)
        const { data: product, error: prodErr } = await supabase
          .from("products")
          .select("id, name, status, deleted_at, tenant_id")
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (prodErr || !product || product.deleted_at) {
          return JSON.stringify({ success: false, error: "Produto não encontrado ou indisponível." });
        }

        // Primary image
        const { data: imgRows } = await supabase
          .from("product_images")
          .select("url, alt_text, is_primary, sort_order")
          .eq("product_id", productId)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
          .limit(1);
        const primary = imgRows?.[0];
        if (!primary?.url) {
          return JSON.stringify({
            success: false,
            error: "Este produto ainda não tem imagem cadastrada. Descreva-o em texto.",
          });
        }

        // Anti-spam: at most 1 image per product per conversation
        const { data: alreadySent } = await supabase
          .from("whatsapp_messages")
          .select("id, message_content")
          .eq("tenant_id", tenantId)
          .eq("recipient_phone", customerPhone)
          .eq("message_type", "image")
          .eq("status", "sent")
          .ilike("message_content", `%${product.name}%`)
          .limit(1);
        if (alreadySent && alreadySent.length > 0) {
          return JSON.stringify({
            success: false,
            error: "A imagem deste produto já foi enviada nesta conversa. Não envie de novo.",
            already_sent: true,
          });
        }

        // Send via meta-whatsapp-send
        try {
          const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-whatsapp-send`;
          const resp = await fetch(sendUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              tenant_id: tenantId,
              phone: customerPhone,
              message: product.name,
              image_url: primary.url,
              image_caption: caption || product.name,
            }),
          });
          const result = await resp.json();
          if (!result?.success) {
            return JSON.stringify({
              success: false,
              error: result?.error || "Falha ao enviar imagem",
              code: result?.code || null,
            });
          }
          // [F1] Marca cota usada (in-memory, persistido no fim do turno)
          if (ctx.imagesSentMap) {
            ctx.imagesSentMap[productId] = (ctx.imagesSentMap[productId] ?? 0) + 1;
          }
          return JSON.stringify({
            success: true,
            sent: true,
            product_name: product.name,
            image_url: primary.url,
            message: "Imagem enviada ao cliente. NÃO duplique no texto da resposta — apenas comente brevemente.",
          });
        } catch (e: any) {
          console.error("[send_product_image] error:", e);
          return JSON.stringify({ success: false, error: "Erro técnico ao enviar imagem", detail: e?.message });
        }
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

    // [F1] ANTI-VAZAMENTO ENTRE TENANTS: validar que a conversa pertence ao tenant
    // do payload. Sem isto, um conversation_id de outro tenant poderia processar
    // dados cruzados se o caller errasse o tenant_id.
    if (conversation.tenant_id !== tenant_id) {
      console.error(
        `[ai-support-chat] TENANT MISMATCH: payload tenant=${tenant_id} conversation tenant=${conversation.tenant_id} conv=${conversation_id}`
      );
      return new Response(
        JSON.stringify({ success: false, error: "Tenant mismatch", code: "TENANT_MISMATCH" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // [F1] Estado comercial atual (fonte de verdade: conversations.sales_state)
    const currentSalesState: SalesState = (conversation.sales_state as SalesState) || "greeting";
    const stateBefore: SalesState = currentSalesState;
    const imagesSentMap: Record<string, number> =
      (conversation.images_sent_per_product as Record<string, number>) || {};
    const lastBotResponseHash: string | null = conversation.last_bot_response_hash || null;

    // [Sub-fase 1.3] Foco de produto/variante persistido na conversa.
    // Fonte: conversations.metadata.product_focus. Evita repetir pergunta de variante.
    let currentProductFocus: ProductFocus | null = readProductFocus(conversation.metadata);
    // Atualizações feitas durante o turno (via tools) ficam aqui até gravar no fim.
    let nextProductFocus: ProductFocus | null | undefined = undefined;

    // [Pacote B] LOCK DE TURNO — evita processamento paralelo da mesma conversa
    // (cliente fragmenta msg + duas chamadas ao webhook chegam quase simultâneas).
    // Fail-OPEN: se o lock falhar, processa normalmente (não silencia o cliente).
    const lockResult = await acquireProcessingLock(
      supabase,
      conversation_id,
      "ai_turn",
    );
    if (!lockResult.acquired) {
      console.log(
        `[ai-support-chat] [LOCK] turn already in progress for conversation ${conversation_id} — skipping (lock alive)`,
      );
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "processing_lock_alive",
          existing_lock: lockResult.existing,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const myLockId = lockResult.lock_id!;

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
    // [PERF — Pacote 1] Saudação pura NÃO precisa de modelo classificador.
    // [Pacote C] Continuação de pendência NÃO pode ser tratada como greeting/reabertura.
    // ============================================
    const rawIsGreeting = isPureGreeting(lastMessageContent);

    // Última mensagem do bot (para janela "viva" de continuação)
    const lastBotMessage = [...messages]
      .filter(m => m.sender_type !== "customer" && !m.is_internal && !m.is_note)
      .pop();
    // [Pacote 3] Pendência REAL persistida (TTL 10 min). Sinal preferido sobre salesState.
    const existingPendingAction: LastPendingAction | null = loadPendingAction(
      (conversation.metadata as Record<string, unknown> | null) ?? null,
    );
    const continuationCtx: ContinuationContext = detectContinuation({
      message: lastMessageContent,
      salesState: currentSalesState,
      lastBotResponseAtIso: lastBotMessage?.created_at ?? null,
      liveWindowMinutes: 60,
      pendingAction: existingPendingAction,
    });
    if (continuationCtx.isContinuation) {
      console.log(
        `[ai-support-chat] [PACOTE C] continuation detected (state=${continuationCtx.salesState} pattern=${continuationCtx.matchedPattern} pending_kind=${continuationCtx.pendingActionKind} minutes_since_bot=${continuationCtx.minutesSinceLastBot}) — suppressing greeting fast-path`,
      );
    }

    // Suprime fast-path de greeting quando for cobrança/continuação de contexto vivo.
    const isPureGreetingFastPath = rawIsGreeting && !continuationCtx.isContinuation;

    let intentClassification: IntentClassification | null;
    if (isPureGreetingFastPath) {
      intentClassification = {
        intent: "greeting",
        sentiment: "neutral",
        urgency: "low",
        requires_action: false,
        topics: ["saudacao"],
        summary: "Saudação simples do cliente.",
      };
      console.log("[ai-support-chat] [PERF] skip classifyIntent (pure greeting fast-path)");
    } else if (continuationCtx.isContinuation) {
      // Continuação curta — também não precisa de classificador. Forçamos intent
      // adequada para o estado comercial corrente, sem cobrar OpenAI.
      intentClassification = {
        intent: "general",
        sentiment: "neutral",
        urgency: "medium",
        requires_action: true,
        topics: ["continuacao"],
        summary: "Cliente cobrando continuação do que foi prometido.",
      };
      console.log("[ai-support-chat] [PERF] skip classifyIntent (continuation fast-path)");
    } else {
      console.log("[ai-support-chat] Classifying intent...");
      intentClassification = await classifyIntent(
        OPENAI_API_KEY,
        lastMessageContent,
        conversationContext
      );
    }

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

    let systemPrompt = effectiveConfig.system_prompt || `Você é ${personalityName}, atende a loja ${storeName} pelo WhatsApp.

Você NÃO é um bot de FAQ nem um assistente virtual genérico. Você é uma pessoa real respondendo do celular, em português do Brasil, com tom de conversa natural, leve e profissional.

### COMO VOCÊ ESCREVE (estilo obrigatório)
- Português do Brasil natural, sem firula corporativa.
- Frases curtas, diretas, ritmo de WhatsApp (não de e-mail).
- Educado e moderno, sem gírias pesadas. Use "você", "te", "estou", "para", "está" — nunca "lhe", "Senhor(a)", "Vossa", "encontra-se", "auxiliá-lo", "estarei à disposição".
- Pode quebrar uma resposta longa em 2 linhas curtas. Não use markdown (sem **negrito**, sem listas com - ou *) a menos que seja realmente necessário.
- Pode usar o nome do cliente quando souber, com naturalidade ("Tudo certo, João?"), sem repetir a cada frase.
- Limite aproximado: ${maxLength} caracteres por mensagem.

### NUNCA ESCREVA ASSIM (bot-speak proibido)
Estas fórmulas de call-center estão BANIDAS, sem exceção:
- "Como posso te ajudar hoje?" / "Em que posso lhe servir?" / "Em que posso ser útil?"
- "Estou à disposição" / "Fico no aguardo" / "Qualquer dúvida estou aqui" / "Disponha"
- "Perfeito!" / "Ótimo!" / "Excelente escolha!" / "Maravilha!" como abertura automática
- "Entendi sua necessidade" / "Para melhor te atender" / "Com prazer"
- "Prezado(a)" / "Senhor(a)" / "Caro cliente"
- Vocativo formal de e-mail no início ("${storeName}, ...", "Cliente, ...")
- A palavra "hoje" como muleta no fim de pergunta ("...te ajudar hoje?", "...procurando hoje?")

### EXEMPLOS DE COMO RESPONDER (few-shot — siga este registro)
Cliente: "oi"
❌ Mecânico: "Olá! Como posso te ajudar hoje?"
✅ Natural: "Oi! Tudo bem? Me conta o que você precisa."

Cliente: "quanto custa o shampoo X?"
❌ Mecânico: "Perfeito! Ficarei feliz em lhe informar o valor do nosso produto."
✅ Natural: "Deixa eu ver o preço pra você, um segundo."

Cliente: "obrigado"
❌ Mecânico: "Por nada! Estou à disposição para qualquer outra dúvida."
✅ Natural: "Imagina! Qualquer coisa é só chamar."

Cliente: "vocês entregam em SP?"
❌ Mecânico: "Sim, prezado cliente, realizamos entregas para a localidade mencionada."
✅ Natural: "Entregamos sim! Me passa seu CEP que eu confirmo o prazo."

### REGRAS DE NEGÓCIO
- Use APENAS informações da BASE DE CONHECIMENTO e do contexto fornecido.
- Se não souber algo (preço, estoque, prazo, política), busque com as ferramentas. Nunca invente.
- Se não conseguir resolver, escale para um atendente humano de forma natural ("Vou te passar pra alguém da equipe que resolve isso, tá?").`;

    // Channel-specific override (mantém compatibilidade com prompt manual de canal)
    if (channelConfig?.system_prompt_override) {
      systemPrompt = channelConfig.system_prompt_override;
    }

    // ============================================
    // [F2] PIPELINE BÁSICA — PROMPT POR ESTADO COMERCIAL
    // Quando sales_mode_enabled = true, a pipeline estrutural F2 vira a BASE
    // do prompt. O texto vindo do tenant (effectiveConfig.system_prompt) e do
    // canal (custom_instructions) passa a COMPLEMENTAR — não substitui mais.
    // Guardrails estruturais (tools por estado, anti-loop, política de imagem,
    // máquina de estados) continuam acima de qualquer customização do tenant.
    // ============================================
    const pipelineStateBefore: PipelineState = normalizeLegacyState(
      conversation.sales_state as string | null
    );

    // [F2-FIX] Detecta saudação pura ANTES da pré-transição (decideNextState
    // precisa desse flag). Reusa o resultado já calculado no fast-path do Pacote 1.
    const isGreetingOnlyTurn = isPureGreetingFastPath;
    if (isGreetingOnlyTurn) {
      console.log(`[ai-support-chat] [F1] Pure greeting detected — tool triggers DISABLED for this turn.`);
    }

    // [F2-FIX] PRÉ-TRANSIÇÃO: decidir o estado do TURNO ATUAL antes de montar o
    // prompt e o filtro de tools. Sem isso, um cliente que diz "preciso de um
    // shampoo" ficava preso em greeting (0 tools) e não conseguia avançar.
    // Pós-tools, a transição é re-avaliada (linha ~3521) para refletir add_to_cart,
    // checkout link gerado, etc.
    let discoveryTurnsSoFarPre = 0;
    if (pipelineStateBefore === "discovery") {
      try {
        const { data: recentTurns } = await supabase
          .from("ai_support_turn_log")
          .select("sales_state_after")
          .eq("conversation_id", conversation_id)
          .order("created_at", { ascending: false })
          .limit(5);
        for (const t of recentTurns || []) {
          if (normalizeLegacyState(t.sales_state_after as string) === "discovery") {
            discoveryTurnsSoFarPre++;
          } else {
            break;
          }
        }
      } catch (e) {
        console.warn("[ai-support-chat] [F2-FIX] discovery pre-counter failed:", e);
      }
    }

    const preTransition = salesModeEnabled
      ? decideNextState({
          current: pipelineStateBefore,
          message: lastMessageContent || "",
          isPureGreeting: isGreetingOnlyTurn,
          hasActiveCart: false, // ainda não sabemos
          hasCheckoutLink: false,
          toolsCalled: [], // tools só rodam depois
          discoveryTurnsSoFar: discoveryTurnsSoFarPre,
          productNamesHint: [],
        })
      : { next: pipelineStateBefore, reason: "no_change_keep_state" as const, forced: false };

    const pipelineState: PipelineState = preTransition.next;
    console.log(
      `[ai-support-chat] [F2-FIX] pre-transition ${pipelineStateBefore} → ${pipelineState} (reason=${preTransition.reason})`
    );

    let pipelinePromptModule: string | null = null;
    let pipelineToolsExposed: string[] = [];
    let pipelineFilteredTools: typeof SALES_TOOLS = [];

    if (salesModeEnabled) {
      // [Fase 1] Carrega contexto de negócio do tenant (Pacotes A+B+C+G).
      // Tolerante a falha: se quebrar, IA segue como hoje.
      const businessCtx = await loadBusinessContextBlock(supabase, tenant_id);

      // Se contexto está stale ou não existe, dispara regeneração em background.
      // Não bloqueia o turno — usa o que tiver agora.
      try {
        const { data: ctxRow } = await supabase
          .from("tenant_business_context")
          .select("needs_regeneration, last_inferred_at")
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        if (!ctxRow || ctxRow.needs_regeneration || !ctxRow.last_inferred_at) {
          const _url = Deno.env.get("SUPABASE_URL") || "";
          const _key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          if (_url && _key) triggerContextRegeneration(_url, _key, tenant_id);
        }
      } catch (_) { /* tolerante */ }

      const contextualBlocks: string[] = [];
      if (businessCtx.promptBlock) contextualBlocks.push(businessCtx.promptBlock);

      const routed = buildPromptForState({
        state: pipelineState,
        allTools: SALES_TOOLS,
        tenant: {
          systemPromptComplement: effectiveConfig.system_prompt || null,
          channelCustomInstructions: channelConfig?.custom_instructions || null,
          personalityName,
          storeName,
        },
        contextualBlocks,
      });
      systemPrompt = routed.systemPrompt;
      pipelineFilteredTools = routed.tools;
      pipelineToolsExposed = routed.toolsExposed;
      pipelinePromptModule = routed.promptModule;
      console.log(
        `[ai-support-chat] [F2] state=${pipelineState} module=${routed.promptModule} tools_exposed=${routed.toolsExposed.length} biz_ctx=${businessCtx.meta.overall_confidence || "none"} segment=${businessCtx.meta.segment || "—"} incomplete=${businessCtx.meta.catalog_incomplete}`
      );
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

    // Inject AI Brain insights (aprendizados aprovados para o agente de vendas)
    try {
      const brainContext = await getBrainContextForPrompt(supabase, tenant_id, "vendas", { limit: 15 });
      if (brainContext) {
        systemPrompt += brainContext;
        console.log(`[ai-support-chat] Brain insights injected (${brainContext.length} chars)`);
      }
    } catch (e) {
      console.error("[ai-support-chat] Brain fetch error:", e);
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

    // [F1] CURTO-CIRCUITO DE SAUDAÇÃO PURA
    // (isGreetingOnlyTurn já foi declarado acima, antes da pré-transição F2-FIX)

    if (salesModeEnabled && lastMessageContent && !isGreetingOnlyTurn) {
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

    // [F1] Em saudação pura, injetar instrução explícita de resposta curta e NATURAL em PT-BR.
    // Objetivo: soar como atendente comercial real no WhatsApp BR (loja → cliente),
    // não como bot de FAQ nem como bate-papo entre amigos.
    if (isGreetingOnlyTurn && salesModeEnabled) {
      // Período do dia em horário de Brasília (BRT, UTC-3)
      const brtHour = (new Date().getUTCHours() - 3 + 24) % 24;
      const periodHint =
        brtHour >= 5 && brtHour < 12 ? "manhã (você pode dizer \"Bom dia\")" :
        brtHour >= 12 && brtHour < 18 ? "tarde (você pode dizer \"Boa tarde\")" :
        "noite (você pode dizer \"Boa noite\")";

      // Detectar se a IA já se apresentou antes nesta conversa (reabertura vs primeiro contato)
      const botAlreadyGreeted = (messages || []).some(m =>
        m.sender_type !== "customer" &&
        !m.is_internal &&
        !m.is_note &&
        typeof m.content === "string" &&
        /\b(aqui é (a |o )?(assistente|atendente|da )|tudo bem\?|bom dia|boa tarde|boa noite)\b/i.test(m.content)
      );

      // [ECO] Detectar o cumprimento exato usado pelo cliente para devolver na mesma forma
      const lcGreet = (lastMessageContent || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      let echoHint = "";
      let echoExample = "";
      if (/\bbom dia\b/.test(lcGreet)) {
        echoHint = `O cliente disse "Bom dia". COMECE OBRIGATORIAMENTE devolvendo "Bom dia!" como PRIMEIRA palavra, antes de qualquer outra coisa.`;
        echoExample = `"Bom dia! Aqui é da ${storeName}, me conta como posso ajudar, estou à disposição."`;
      } else if (/\bboa tarde\b/.test(lcGreet)) {
        echoHint = `O cliente disse "Boa tarde". COMECE OBRIGATORIAMENTE devolvendo "Boa tarde!" como PRIMEIRA palavra, antes de qualquer outra coisa.`;
        echoExample = `"Boa tarde! Aqui é da ${storeName}, me conta como posso ajudar, estou à disposição."`;
      } else if (/\bboa noite\b/.test(lcGreet)) {
        echoHint = `O cliente disse "Boa noite". COMECE OBRIGATORIAMENTE devolvendo "Boa noite!" como PRIMEIRA palavra, antes de qualquer outra coisa.`;
        echoExample = `"Boa noite! Aqui é da ${storeName}, me conta como posso ajudar, estou à disposição."`;
      } else if (/\bola\b/.test(lcGreet)) {
        echoHint = `O cliente disse "Olá". COMECE OBRIGATORIAMENTE devolvendo "Olá!" como PRIMEIRA palavra, antes de qualquer outra coisa.`;
        echoExample = `"Olá! Aqui é da ${storeName}, me conta como posso ajudar, estou à disposição."`;
      } else if (/\b(oi|opa|eai|e ai|hey|hi|hello|alo|alo\?|tudo bem)\b/.test(lcGreet)) {
        echoHint = `O cliente disse "Oi" (ou variação informal). COMECE OBRIGATORIAMENTE devolvendo "Oi!" como PRIMEIRA palavra, antes de qualquer outra coisa.`;
        echoExample = `"Oi! Aqui é da ${storeName}, me conta como posso ajudar, estou à disposição."`;
      } else {
        echoHint = `O cliente cumprimentou de forma curta. COMECE OBRIGATORIAMENTE com "Oi!" como PRIMEIRA palavra.`;
        echoExample = `"Oi! Aqui é da ${storeName}, me conta como posso ajudar, estou à disposição."`;
      }

      if (!botAlreadyGreeted) {
        // PRIMEIRO CONTATO — saudação comercial completa: ECO + identificação + oferta + FECHAMENTO CORDIAL
        aiMessages.push({
          role: "system",
          content: [
            "### ESTE É UM TURNO DE SAUDAÇÃO PURA — PRIMEIRO CONTATO",
            "",
            `O cliente apenas cumprimentou. É a primeira vez que você fala com ele nesta conversa. Período atual no Brasil: ${periodHint}.`,
            `Nome da loja: ${storeName}.`,
            "",
            "### REGRA 1 — ECO OBRIGATÓRIO DO CUMPRIMENTO (não negociável)",
            echoHint,
            "Devolver o cumprimento do cliente na MESMA forma é o que faz a conversa parecer humana. Pular essa etapa soa frio e robótico.",
            "",
            `### REGRA 2 — IDENTIFICAÇÃO OBRIGATÓRIA DA LOJA (não negociável)`,
            `Toda primeira resposta DEVE conter "Aqui é da ${storeName}" (ou variação equivalente como "Aqui é a assistente virtual da ${storeName}"). NÃO é opcional. Sem isso, a resposta está errada.`,
            "",
            "### REGRA 3 — FECHAMENTO CORDIAL E ABERTO (não negociável)",
            "A resposta NUNCA pode terminar de forma seca ou cortada. SEMPRE precisa terminar com um fechamento acolhedor que demonstre disponibilidade.",
            "",
            "Você PODE usar formulações como \"me diz\", \"me conta\", \"me fala\" — DESDE QUE venham acompanhadas de um fechamento cordial logo em seguida.",
            "",
            "Exemplos de fechamentos cordiais válidos (varie, não repita literal):",
            "- \"...estou aqui para ajudar.\"",
            "- \"...estou à disposição.\"",
            "- \"...fico à disposição.\"",
            "- \"...pode contar comigo.\"",
            "- \"...será um prazer atender você.\"",
            "- \"...vou te ajudar com prazer.\"",
            "",
            "❌ ERRADO (seco, cortado, soa rude em pt-BR):",
            "- \"Boa noite! Me diz o que você precisa.\"",
            "- \"Oi! O que você quer?\"",
            "- \"Olá! Manda aí.\"",
            "",
            "✅ CERTO (com fechamento cordial):",
            `- "Boa noite! Aqui é da ${storeName}, me diz o que você precisa, estou aqui para ajudar."`,
            `- "Oi! Aqui é da ${storeName}, me conta em poucas palavras como posso ajudar, estou à disposição."`,
            `- "Olá! Aqui é a assistente virtual da ${storeName}, em que posso te ajudar? Fico à disposição."`,
            "",
            "### ESTRUTURA OBRIGATÓRIA DA RESPOSTA",
            `[ECO do cumprimento] + [identificação "Aqui é da ${storeName}"] + [pergunta/oferta de ajuda] + [FECHAMENTO CORDIAL]`,
            "",
            "Tudo em UMA frase só ou no máximo duas frases curtas.",
            "",
            "EXEMPLO ALINHADO AO QUE O CLIENTE DISSE AGORA:",
            `- ${echoExample}`,
            "",
            "OUTROS EXEMPLOS de estrutura válida (varie a forma — NÃO copie literal):",
            `- "Oi, tudo bem? Aqui é a assistente virtual da ${storeName}, me conta como posso ajudar, estou à disposição."`,
            `- "Oi! Aqui é da ${storeName}, me diz em poucas palavras como posso ajudar, fico à disposição."`,
            `- "Olá! Tudo bem? Aqui é a assistente virtual da ${storeName}, em que posso te ajudar? Pode contar comigo."`,
            `- "Oi, boa tarde! Aqui é da ${storeName}, me conta o que você procura, estou aqui para ajudar."`,
            `- "Oi, boa noite! Aqui é a assistente virtual da ${storeName}, me diz como posso ajudar, será um prazer te atender."`,
            "",
            "PROIBIDO neste turno:",
            "- Começar direto por \"Bom dia/Boa tarde/Boa noite\" SEM antes ecoar o cumprimento que o cliente usou (a não ser que o cliente já tenha dito exatamente isso).",
            "- TERMINAR a resposta de forma seca, sem fechamento cordial. Frases como \"Me diz o que você precisa.\" no fim, sozinhas, são PROIBIDAS.",
            "- Chamar qualquer ferramenta, citar produto, enviar imagem, escalar para humano.",
            "- Listar categorias, benefícios, dores ou nicho. Você AINDA não sabe o que ele quer.",
            "- Assumir o tema do cliente (NÃO diga \"para seu cuidado com X\", \"sobre seu tratamento de Y\", \"para combater Z\").",
            "- Vocativo no início (\"Comando Central, ...\", \"Cliente, ...\") — comece pela saudação.",
            "- As fórmulas banidas da persona principal: \"como posso te ajudar hoje\", \"em que posso ser útil\", \"perfeito!\", \"ótimo!\", \"com prazer\" (sozinho como abertura).",
            "- Omitir o nome da loja. A identificação da loja é OBRIGATÓRIA no primeiro contato.",
            "- Markdown, emojis em excesso, múltiplos pontos de exclamação.",
          ].join("\n"),
        });
      } else {
        // REABERTURA — cliente voltou, já sabe com quem está falando: NÃO repete a identificação
        // Mas AINDA se aplicam: Regra 1 (eco do cumprimento) + Regra 3 (fechamento cordial).
        aiMessages.push({
          role: "system",
          content: [
            "### ESTE É UM TURNO DE SAUDAÇÃO PURA — CLIENTE RETOMANDO A CONVERSA",
            "",
            `O cliente apenas cumprimentou de novo, mas você JÁ se apresentou antes nesta conversa. Período atual no Brasil: ${periodHint}.`,
            "",
            "### REGRA 1 — ECO OBRIGATÓRIO DO CUMPRIMENTO (não negociável)",
            echoHint,
            "Devolver o cumprimento do cliente na MESMA forma é o que faz a conversa parecer humana. Pular essa etapa soa frio e robótico.",
            "",
            "### REGRA 3 — FECHAMENTO CORDIAL E ABERTO (não negociável)",
            "A resposta NUNCA pode terminar de forma seca ou cortada. SEMPRE precisa terminar com um fechamento acolhedor que demonstre disponibilidade.",
            "",
            "Você PODE usar formulações como \"me diz\", \"me conta\", \"me fala\" — DESDE QUE venham acompanhadas de um fechamento cordial logo em seguida.",
            "",
            "Exemplos de fechamentos cordiais válidos (varie, não repita literal):",
            "- \"...estou aqui para ajudar.\"",
            "- \"...estou à disposição.\"",
            "- \"...fico à disposição.\"",
            "- \"...pode contar comigo.\"",
            "- \"...tô por aqui.\"",
            "",
            "❌ ERRADO (seco, cortado, soa rude em pt-BR):",
            "- \"Boa noite! Me diz o que você precisa.\"",
            "- \"Oi! O que você quer?\"",
            "- \"Oi, voltou! Me conta o que você precisa.\"",
            "",
            "✅ CERTO (eco + retomada + fechamento cordial, SEM repetir identificação da loja):",
            "- \"Oi! Tô por aqui, me conta o que você precisa, estou aqui para ajudar.\"",
            "- \"Oi! Voltou? Me diz como posso ajudar agora, fico à disposição.\"",
            "- \"Boa noite! Me conta o que você procura, estou aqui para ajudar.\"",
            "- \"Oi! Em que posso ajudar agora? Pode contar comigo.\"",
            "",
            "### ESTRUTURA OBRIGATÓRIA DA RESPOSTA",
            "[ECO do cumprimento] + [pergunta/oferta de ajuda] + [FECHAMENTO CORDIAL]",
            "",
            "Tudo em UMA frase só ou no máximo duas frases curtas.",
            "",
            "EXEMPLO ALINHADO AO QUE O CLIENTE DISSE AGORA:",
            `- ${echoExample.replace(`Aqui é da ${storeName}, `, "")}`,
            "",
            "PROIBIDO neste turno:",
            "- Repetir \"Aqui é da [loja]\" / \"Aqui é a assistente virtual\" — você já se apresentou.",
            "- TERMINAR a resposta de forma seca, sem fechamento cordial. Frases como \"Me diz o que você precisa.\" no fim, sozinhas, são PROIBIDAS.",
            "- Chamar qualquer ferramenta, citar produto, enviar imagem, escalar para humano.",
            "- Assumir o tema do cliente.",
            "- Markdown, emojis em excesso, múltiplos pontos de exclamação.",
          ].join("\n"),
        });
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

    // [F1] Rastreio de tools chamadas no turno (escopo do handler, alimenta máquina de estado)
    const toolsCalledThisTurn: string[] = [];
    // [PACOTE B] Snapshots dos resultados reais de tools deste turno.
    // Usados pelo fallback conclusivo para que a IA NUNCA fale "consultei o catálogo"
    // ou "encontrei esses produtos reais" — em vez disso, montamos uma fala de
    // vendedora real a partir dos produtos retornados (ignorando kits na 1ª oferta).
    type ToolResultSnapshot = { tool: string; parsed: any };
    const toolResultsThisTurn: ToolResultSnapshot[] = [];
    // [F2] Tools que o modelo tentou chamar mas foram bloqueadas pelo filtro de estado
    const pipelineBlockedTools: string[] = [];
    // [F2-FIX] Sinaliza se o fallback de resposta vazia foi acionado (vai para o log)
    let emptyResponseFallbackApplied = false;
    // [PACOTE 1] Sinaliza se o round final forçado com tool_choice="none" foi acionado
    let forcedTextRoundApplied = false;
    let forcedTextRoundReason: string | null = null;
    // [PACOTE 1] iterations expostas no escopo do handler para entrar no log
    let toolCallIterations = 0;

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
        salesState: currentSalesState,
        imagesSentMap,
        // [Sub-fase 1.3] foco lido do metadata + setter que atualiza `nextProductFocus`
        productFocus: currentProductFocus,
        setProductFocus: (focus: ProductFocus | null) => {
          nextProductFocus = focus;
          // mantém disponível para tools subsequentes no mesmo turno
          salesToolCtx.productFocus = focus;
        },
      };

      let response: Response | null = null;
      let usedModel = aiModel;

      // [PERF — Pacote 2] Parâmetros de saída/raciocínio por estado.
      // Em greeting/discovery, limitamos esforço de raciocínio e tokens para
      // priorizar latência baixa. Em estados complexos (decisão, checkout,
      // detalhe, suporte), liberamos espaço para tools + texto final.
      const SIMPLE_STATES: PipelineState[] = ["greeting", "discovery"];
      const isSimpleState = salesModeEnabled && SIMPLE_STATES.includes(pipelineState);
      const stateMaxTokens = isSimpleState ? 600 : 4096;
      const stateReasoningEffort: "minimal" | "low" | "medium" = isSimpleState ? "minimal" : "low";

      // [PERF — Pacote 2] Reordenação de modelos por estado:
      // - estados simples: priorizar modelos rápidos (nano/mini)
      // - estados complexos: manter prioridade de qualidade (modelo configurado primeiro)
      // Em ambos, pular modelos cacheados como indisponíveis (404/400) no cold start.
      const baseOrder = isSimpleState
        ? [...FAST_MODELS_FOR_SIMPLE_STATES, ...OPENAI_MODELS.filter(m => !FAST_MODELS_FOR_SIMPLE_STATES.includes(m))]
        : [aiModel, ...OPENAI_MODELS.filter(m => m !== aiModel)];
      // Dedup mantendo ordem
      const seen = new Set<string>();
      const orderedCandidates = baseOrder.filter(m => {
        if (seen.has(m)) return false;
        seen.add(m);
        return true;
      });
      const skippedByCache: string[] = [];
      const modelsToTry = orderedCandidates.filter(m => {
        if (UNAVAILABLE_MODELS.has(m)) {
          skippedByCache.push(m);
          return false;
        }
        return true;
      });
      if (skippedByCache.length > 0) {
        console.log(`[ai-support-chat] [PERF] skipping cached unavailable models: ${skippedByCache.join(",")}`);
      }
      console.log(`[ai-support-chat] [PERF] state=${pipelineState} simple=${isSimpleState} model_order=${modelsToTry.slice(0, 3).join(",")}...`);

      let lastErrorText = "";
      let currentMessages = [...aiMessages];
      // toolCallIterations está em escopo do handler (acima)
      const MAX_TOOL_ITERATIONS = 5;

      // Outer loop for model fallback
      let modelFound = false;
      for (const modelToTry of modelsToTry) {
        try {
          const isGpt5Model = modelToTry.startsWith("gpt-5");
          const tokenParams = isGpt5Model 
            ? { max_completion_tokens: stateMaxTokens }
            : { max_tokens: stateMaxTokens };

          const requestBody: any = {
            model: modelToTry,
            messages: currentMessages,
            ...tokenParams,
          };

          // [PERF — Pacote 2] O parâmetro `reasoning` está sendo rejeitado pela
          // API para todos os modelos desta conta (Unknown parameter). Mantemos
          // desativado até confirmação de suporte. O controle de tokens
          // (stateMaxTokens) já limita o esforço em estados simples.
          // if (supportsReasoning) requestBody.reasoning = { effort: stateReasoningEffort };

          // [F1] Modelos gpt-5* rejeitam temperature customizado e fazem fallback
          // silencioso para o default. Só enviar temperature em modelos não-gpt5.
          // Em saudação pura, elevamos a temperatura para forçar variação lexical
          // real entre turnos e evitar que o modelo caia sempre na mesma frase.
          if (!isGpt5Model) {
            requestBody.temperature = isGreetingOnlyTurn
              ? 0.95
              : (salesModeEnabled ? 0.3 : 0.7);
          }

          // [F2] Tools filtradas pelo estado comercial atual.
          // Em greeting, pipelineFilteredTools fica vazio → não enviamos `tools`
          // para a API (modelo não tenta chamar nada). Em outros estados, só as
          // permitidas vão para o modelo.
          if (salesModeEnabled && pipelineFilteredTools.length > 0) {
            requestBody.tools = pipelineFilteredTools;
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

          // [PERF — Pacote 2] Cache de indisponibilidade no cold start.
          // 404 = modelo não existe / sem acesso.
          // 400 com referência a "model" / "unknown parameter" / "invalid parameter"
          // = incompatibilidade do modelo com o payload (não vale tentar de novo).
          const incompatible = response.status === 404 ||
            (response.status === 400 && /(model|unknown parameter|invalid parameter|unsupported)/i.test(lastErrorText));
          if (incompatible) {
            UNAVAILABLE_MODELS.add(modelToTry);
            console.log(`[ai-support-chat] [PERF] cached as unavailable: ${modelToTry} (status=${response.status})`);
            response = null;
            continue;
          }
          if (response.status === 400) {
            // 400 não relacionado a modelo (payload, tools etc.) — não cachear, mas tentar próximo.
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
      // [F1] toolsCalledThisTurn já declarado no escopo externo

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
        const pipelineBlockedThisLoop: string[] = [];
        for (const toolCall of assistantMsg.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: Record<string, unknown> = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch { /* empty args */ }

          // [F2] Defesa em profundidade: bloqueia tool chamada fora do estado.
          // Mesmo se o modelo "alucinar" uma tool, o servidor não executa.
          if (!isToolAllowedInState(fnName, pipelineState)) {
            console.warn(
              `[ai-support-chat] [F2] tool ${fnName} BLOQUEADA — não permitida no estado ${pipelineState}`
            );
            pipelineBlockedThisLoop.push(fnName);
            currentMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                blocked: true,
                reason: `tool_not_allowed_in_state_${pipelineState}`,
                allowed_tools: TOOLS_BY_STATE[pipelineState],
              }),
            } as any);
            continue;
          }

          console.log(`[ai-support-chat] Executing tool: ${fnName}`, JSON.stringify(fnArgs));
          const result = await executeSalesTool(fnName, fnArgs, salesToolCtx);
          toolsCalledThisTurn.push(fnName);
          // [PACOTE B] guarda snapshot estruturado pro fallback conclusivo
          try {
            toolResultsThisTurn.push({ tool: fnName, parsed: JSON.parse(result) });
          } catch {
            toolResultsThisTurn.push({ tool: fnName, parsed: result });
          }
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
        if (pipelineBlockedThisLoop.length > 0) {
          pipelineBlockedTools.push(...pipelineBlockedThisLoop);
        }

        const isGpt5ModelFollow = usedModel.startsWith("gpt-5");
        const tokenParamsFollow = isGpt5ModelFollow 
          ? { max_completion_tokens: stateMaxTokens }
          : { max_tokens: stateMaxTokens };

        const followUpBody: any = {
          model: usedModel,
          messages: currentMessages,
          ...tokenParamsFollow,
          // [F2] Mantém o filtro por estado também no follow-up
          tools: pipelineFilteredTools.length > 0 ? pipelineFilteredTools : undefined,
          tool_choice: pipelineFilteredTools.length > 0 ? "auto" : undefined,
          parallel_tool_calls: false,
        };
        // [F2-FIX] Mesmo controle de reasoning no follow-up
        if (isGpt5ModelFollow) {
          followUpBody.reasoning = { effort: stateReasoningEffort };
        }
        // [F1] Mesmo guard: gpt-5 não aceita temperature
        if (!isGpt5ModelFollow) {
          followUpBody.temperature = 0.3;
        }

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

      // ============================================
      // [PACOTE 1] ROUND FINAL FORÇADO COM TEXTO
      // ============================================
      // Se o loop terminou ainda pedindo tool_calls (esgotou MAX_TOOL_ITERATIONS)
      // OU se a última resposta veio sem texto E sem tool_calls,
      // forçamos UM ÚNICO round final com tool_choice="none" para obrigar texto.
      // Limitado a 1 (sem novo ciclo escondido).
      // (forcedTextRoundApplied/Reason declarados no escopo do handler para o log)
      const stillHasToolCalls = !!aiData.choices?.[0]?.message?.tool_calls?.length;
      const noTextAndNoTool = (!aiContent || !aiContent.trim()) && !stillHasToolCalls;
      if (salesModeEnabled && (stillHasToolCalls || noTextAndNoTool) && toolsCalledThisTurn.length > 0) {
        forcedTextRoundReason = stillHasToolCalls ? "loop_exhausted_with_pending_tools" : "empty_text_after_tools";
        console.log(
          `[ai-support-chat] [PACOTE 1] forcing final text round (reason=${forcedTextRoundReason} iters=${toolCallIterations})`,
        );
        // Se ainda há tool_calls no buffer, precisamos anexar o assistant_message
        // ao histórico para que o tool_choice="none" seja válido. Mas como não vamos
        // executar tool, anexamos como assistant SEM tool_calls (texto vazio explicativo)
        // não funciona — então anexamos com tool_calls e respondemos com role:"tool" stub
        // para cada chamada pendente, marcando-a como "skipped_loop_limit".
        if (stillHasToolCalls) {
          const pendingAssistant = aiData.choices[0].message;
          currentMessages.push({
            role: "assistant",
            content: pendingAssistant.content || "",
            tool_calls: pendingAssistant.tool_calls,
          });
          for (const tc of pendingAssistant.tool_calls) {
            currentMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({
                skipped: true,
                reason: "tool_loop_limit_reached_use_existing_results",
              }),
            } as any);
          }
        }

        const isGpt5ModelForced = usedModel.startsWith("gpt-5");
        const tokenParamsForced = isGpt5ModelForced
          ? { max_completion_tokens: stateMaxTokens }
          : { max_tokens: stateMaxTokens };
        const forcedBody: any = {
          model: usedModel,
          messages: currentMessages,
          ...tokenParamsForced,
          // Mantém tools no payload para o modelo "saber" que existiam,
          // mas tool_choice="none" PROÍBE nova chamada.
          tools: pipelineFilteredTools.length > 0 ? pipelineFilteredTools : undefined,
          tool_choice: "none",
          parallel_tool_calls: false,
        };
        if (isGpt5ModelForced) {
          forcedBody.reasoning = { effort: stateReasoningEffort };
        }
        if (!isGpt5ModelForced) {
          forcedBody.temperature = 0.3;
        }

        // [PACOTE A-FIX] Marca o round como APLICADO assim que disparamos a chamada,
        // independente de o modelo ter produzido texto. Antes só marcávamos quando
        // forcedText vinha não-vazio, o que escondia o round no log e dava a impressão
        // de que ele tinha sido pulado. Agora a observabilidade reflete a execução real.
        forcedTextRoundApplied = true;
        try {
          const forcedResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(forcedBody),
          });
          if (forcedResp.ok) {
            const forcedData = await forcedResp.json();
            if (forcedData.usage) {
              inputTokens += forcedData.usage.prompt_tokens || 0;
              outputTokens += forcedData.usage.completion_tokens || 0;
            }
            const forcedText = forcedData.choices?.[0]?.message?.content;
            if (forcedText && forcedText.trim()) {
              aiContent = forcedText;
              console.log(`[ai-support-chat] [PACOTE 1] forced text round produced text (${forcedText.length} chars)`);
            } else {
              console.warn(`[ai-support-chat] [PACOTE 1] forced text round applied but EMPTY — will use conclusive fallback`);
            }
          } else {
            console.error("[ai-support-chat] [PACOTE 1] forced text round HTTP error:", forcedResp.status);
          }
        } catch (forcedErr) {
          console.error("[ai-support-chat] [PACOTE 1] forced text round threw:", forcedErr);
        }
      }

      // [F2-FIX] Observabilidade: log de consumo excessivo de reasoning
      // (modelos gpt-5*). Se mais de 50% do completion budget foi para
      // reasoning interno, logamos para podermos ajustar effort por estado.
      try {
        const compTokens = aiData.usage?.completion_tokens || 0;
        const reasoningTokens =
          aiData.usage?.completion_tokens_details?.reasoning_tokens || 0;
        if (compTokens > 0 && reasoningTokens / compTokens >= 0.5) {
          console.warn(
            `[ai-support-chat] [F2-FIX] reasoning excessivo state=${pipelineState} ` +
            `model=${usedModel} reasoning=${reasoningTokens}/${compTokens} ` +
            `(${Math.round((reasoningTokens / compTokens) * 100)}%) ` +
            `effort=${stateReasoningEffort} max=${stateMaxTokens}`
          );
        }
      } catch { /* ignore */ }

      // [F2-FIX + PACOTE 1] Fallback de resposta vazia.
      // Diferenciação CRÍTICA:
      //   - Se nenhuma tool rodou neste turno → fallback "promessa" (pede tempo).
      //   - Se ALGUMA tool rodou (já existe resultado real no histórico) → fallback
      //     CONCLUSIVO, nunca repetir "Só um instante…" (proibido pelo usuário).
      if (!aiContent || !aiContent.trim()) {
        const finishReason = aiData.choices?.[0]?.finish_reason || "unknown";
        const compTokens = aiData.usage?.completion_tokens || 0;
        const reasoningTokens =
          aiData.usage?.completion_tokens_details?.reasoning_tokens || 0;
        console.error(
          `[ai-support-chat] [F2-FIX] RESPOSTA VAZIA state=${pipelineState} ` +
          `model=${usedModel} finish=${finishReason} ` +
          `completion=${compTokens} reasoning=${reasoningTokens} ` +
          `max_tokens=${stateMaxTokens} effort=${stateReasoningEffort} ` +
          `tools_called=${toolsCalledThisTurn.length} forced_round=${forcedTextRoundApplied}`
        );

        const toolsAlreadyRan = toolsCalledThisTurn.length > 0;
        const FALLBACK_PROMISE_BY_STATE: Record<PipelineState, string> = {
          greeting:        "Oi! Tudo bem? Me conta o que você está procurando.",
          discovery:       "Deixa eu entender melhor. Você procura algo específico ou quer ver opções?",
          recommendation:  "Só um instante, deixa eu ver as opções aqui pra você.",
          product_detail:  "Deixa eu confirmar essa informação aqui pra você, um segundo.",
          decision:        "Perfeito, vou organizar isso pra você. Me dá um minutinho.",
          checkout_assist: "Deixa eu verificar o seu carrinho e já te respondo.",
          support:         "Entendi. Deixa eu olhar isso pra você, um instante.",
          handoff:         "Vou te passar pra alguém da equipe que resolve isso, tá?",
        };
        // [PACOTE B v2] Fallback CONCLUSIVO HUMANIZADO.
        // Regras:
        //  1. Nunca dizer "consultei o catálogo", "encontrei esses produtos reais",
        //     "deixa eu ver", "vou buscar" etc. — isso é linguagem de sistema, proibida.
        //  2. Se search_products retornou produtos, montamos uma fala de vendedora
        //     com até 3 produtos ÚNICOS (sem kits). Kits só entram quando o cliente
        //     já escolheu um produto e estamos oferecendo upsell, nunca na vitrine inicial.
        //  3. Se get_product_details retornou produto, falamos do produto pelo nome.
        //  4. Se nada útil saiu das tools, caímos numa pergunta curta de vendedora.
        const buildHumanFallbackFromTools = (): string | null => {
          // Procura search_products mais recente com lista de produtos
          for (let i = toolResultsThisTurn.length - 1; i >= 0; i--) {
            const snap = toolResultsThisTurn[i];
            if (snap.tool === "search_products" && Array.isArray(snap.parsed)) {
              const all = snap.parsed as any[];
              // 1ª oferta: prioriza produtos únicos. Kits só se NÃO houver único.
              const singles = all.filter(p => !p?.is_kit);
              const pool = (singles.length > 0 ? singles : all).slice(0, 3);
              if (pool.length === 0) continue;
              const names = pool.map(p => p?.name).filter(Boolean);
              if (names.length === 0) continue;
              if (names.length === 1) {
                return `Temos sim, o ${names[0]}. Quer que eu te conte mais sobre ele?`;
              }
              if (names.length === 2) {
                return `Temos opções boas sim. Trabalhamos com o ${names[0]} e o ${names[1]}. Qual te chamou mais atenção, ou prefere que eu te conte a diferença entre eles?`;
              }
              return `Temos opções boas sim. Os mais procurados são o ${names[0]}, o ${names[1]} e o ${names[2]}. Quer que eu te conte a diferença entre eles, ou já tem um em mente?`;
            }
            if (snap.tool === "get_product_details" && snap.parsed?.name) {
              const p = snap.parsed;
              const priceTxt = typeof p.price === "number" ? ` Sai por R$ ${p.price.toFixed(2).replace(".", ",")}.` : "";
              return `O ${p.name} é um dos nossos.${priceTxt} Quer saber mais alguma coisa sobre ele ou já quer fechar?`;
            }
            if (snap.tool === "view_cart" && Array.isArray(snap.parsed?.items)) {
              const count = snap.parsed.items.length;
              if (count > 0) {
                return `Você tem ${count} ${count === 1 ? "item" : "itens"} no carrinho. Quer que eu finalize o pedido pra você?`;
              }
            }
          }
          return null;
        };

        const FALLBACK_CONCLUSIVE_BY_STATE: Record<PipelineState, string> = {
          greeting:        "Oi! O que você está procurando hoje?",
          discovery:       "Me conta um pouco mais do que você quer resolver, que eu já te indico o certo.",
          recommendation:  "Pra eu te indicar o melhor, me diz pra qual uso é?",
          product_detail:  "Quer saber preço, prazo de entrega ou tem outra dúvida sobre ele?",
          decision:        "Posso gerar o link de pagamento pra você?",
          checkout_assist: "Quer que eu finalize o pedido agora?",
          support:         "Me passa o número do pedido que eu já vejo aqui pra você.",
          handoff:         "Vou te passar pra alguém da equipe.",
        };

        if (toolsAlreadyRan) {
          const humanized = buildHumanFallbackFromTools();
          aiContent = humanized || FALLBACK_CONCLUSIVE_BY_STATE[pipelineState] || "Pode me dizer um pouco mais do que você procura?";
        } else {
          aiContent = FALLBACK_PROMISE_BY_STATE[pipelineState] || "Já te respondo.";
        }
        emptyResponseFallbackApplied = true;
        console.warn(
          `[ai-support-chat] [PACOTE B v2] fallback aplicado state=${pipelineState} conclusive=${toolsAlreadyRan} text="${aiContent.slice(0,120)}"`
        );
      }
    }

    // ============================================
    // [PACOTE C] REDE DE SEGURANÇA — LINGUAGEM DE SISTEMA
    // A regra principal está nos PROMPTS dos estados (causa raiz). Este
    // scrubber é só rede de segurança mínima para os 3 padrões mais
    // agressivos que comprometem a persona de vendedora real. Se ele
    // disparar com frequência, é sinal de prompt ruim — corrija lá, não
    // aqui. Mantemos enxuto pra não mascarar problemas estruturais.
    // ============================================
    if (aiContent && typeof aiContent === "string") {
      const SYSTEM_PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
        [/encontrei\s+esses\s+produtos\s+reais\s+(para|pra)\s+voc[êe]\s*[:.\-–]?\s*/gi, "Temos sim. "],
        [/j[áa]\s+consultei\s+o\s+cat[áa]logo[^.!?]*[.!?]?\s*/gi, ""],
        [/(deixa|deixe)\s+eu\s+(ver|consultar|buscar|verificar)[^.!?]*[.!?]?\s*/gi, ""],
      ];
      let scrubbed = aiContent;
      for (const [pattern, replacement] of SYSTEM_PHRASE_REPLACEMENTS) {
        scrubbed = scrubbed.replace(pattern, replacement);
      }
      scrubbed = scrubbed.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (scrubbed !== aiContent) {
        console.warn(
          `[ai-support-chat] [PACOTE C] system-language scrubbed — REVISAR PROMPT do estado, modelo emitiu fala de sistema (was ${aiContent.length}ch, now ${scrubbed.length}ch)`
        );
        aiContent = scrubbed;
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

    // [F1] Calcula próximo estado comercial (servidor, não modelo)
    const intentForState: Intent =
      shouldHandoff ? "complaint" :
      isGreetingOnlyTurn ? "greeting" :
      salesIntentFlags.buy ? "buy" :
      salesIntentFlags.details || salesIntentFlags.naming ? "question" :
      (intentClassification?.intent === "complaint" ? "complaint" : "other");

    const toolsCalledArr: string[] = toolsCalledThisTurn;
    const hasActiveCart = toolsCalledArr.includes("add_to_cart");
    const hasCheckout = toolsCalledArr.includes("generate_checkout_link");

    // [F2] Conta turnos consecutivos em discovery (anti-loop)
    let discoveryTurnsSoFar = 0;
    if (pipelineState === "discovery") {
      try {
        const { data: recentTurns } = await supabase
          .from("ai_support_turn_log")
          .select("sales_state_after")
          .eq("conversation_id", conversation_id)
          .order("created_at", { ascending: false })
          .limit(5);
        for (const t of recentTurns || []) {
          if (normalizeLegacyState(t.sales_state_after as string) === "discovery") {
            discoveryTurnsSoFar++;
          } else {
            break;
          }
        }
      } catch (e) {
        console.warn("[ai-support-chat] [F2] discovery turn counter failed:", e);
      }
    }

    // [F2] Decisão de transição pela pipeline modular
    const productNamesHint = (relevantProducts || []).map(p => p.name).filter(Boolean);
    const transition = decideNextState({
      current: pipelineState,
      message: lastMessageContent || "",
      isPureGreeting: isGreetingOnlyTurn,
      hasActiveCart,
      hasCheckoutLink: hasCheckout,
      toolsCalled: toolsCalledArr,
      discoveryTurnsSoFar,
      productNamesHint,
    });

    const nextPipelineState: PipelineState = shouldHandoff ? "handoff" : transition.next;
    const nextState: SalesState = toLegacyState(nextPipelineState) as SalesState;
    const transitionReason: TransitionReason = shouldHandoff ? "handoff_requested" : transition.reason;

    console.log(
      `[ai-support-chat] [F2] transition ${pipelineState} → ${nextPipelineState} (reason=${transitionReason})`
    );

    // Hash da resposta (anti-repetição na próxima rodada)
    const responseHash = await hashResponse(aiContent || "");

    // [Pacote D] Detector de stall: a IA prometeu "deixa eu ver…" e não chamou tool?
    const stallDetection: StallDetection = detectStallPromise({
      responseText: aiContent || "",
      toolsCalled: toolsCalledArr,
      salesState: pipelineState,
    });
    if (stallDetection.isStalled) {
      console.log(
        `[ai-support-chat] [PACOTE D] STALL DETECTED — promise without tool (state=${pipelineState} pattern=${stallDetection.matchedPromise})`,
      );
    }

    // [Pacote E] Anti-duplicidade: olha histórico recente de turnos para o mesmo hash.
    const dupCheck = await isDuplicateRecentResponse(supabase, conversation_id, responseHash);
    if (dupCheck.duplicate) {
      console.log(`[ai-support-chat] [PACOTE E] duplicate response blocked (${dupCheck.reason})`);
    }

    // [PACOTE 3] Decidir last_pending_action a persistir.
    //
    // Regras:
    //  - Se a IA chamou tool de busca/consulta MAS terminou em fallback de promessa
    //    (sem resultado conclusivo entregue) → persistir pendência.
    //  - Se a IA já entregou resposta conclusiva (texto não-vazio do modelo, sem
    //    fallback de promessa, sem stall) → LIMPAR pendência (resolveu).
    //  - Se já existia pendência viva e o turno não a resolveu nem agravou → manter.
    const PRODUCT_TOOLS = new Set([
      "search_products",
      "get_product_details",
      "get_product_variants",
      "recommend_related_products",
      "view_cart",
      "check_coupon",
    ]);
    const productToolsCalledNow = toolsCalledThisTurn.filter(t => PRODUCT_TOOLS.has(t));
    const aiDeliveredRealAnswer = !emptyResponseFallbackApplied && !stallDetection.isStalled && (aiContent || "").trim().length > 0;

    let pendingActionToPersist: LastPendingAction | null | undefined = undefined; // undefined = não mexer
    if (productToolsCalledNow.length > 0 && !aiDeliveredRealAnswer) {
      // Tool rodou, mas a IA não conseguiu fechar com texto útil → marca pendência.
      pendingActionToPersist = {
        kind: productToolsCalledNow[0] as LastPendingAction["kind"],
        tool_executed: true,
        promised_at: new Date().toISOString(),
      };
    } else if (stallDetection.isStalled) {
      // Promessa sem tool → marca pendência da promessa.
      pendingActionToPersist = {
        kind: "search_products",
        tool_executed: false,
        promised_at: new Date().toISOString(),
      };
    } else if (aiDeliveredRealAnswer && existingPendingAction) {
      // Conversa avançou de verdade — limpa pendência antiga.
      pendingActionToPersist = null;
    }

    // Update conversation status + estado comercial
    const newStatus = shouldHandoff ? "waiting_agent" : "bot";
    const conversationUpdate: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      customer_id: customerId || conversation.customer_id,
      sales_state: nextState,
      last_intent: intentForState,
      last_bot_response_hash: responseHash,
      images_sent_per_product: imagesSentMap,
    };
    if (nextState !== currentSalesState) {
      conversationUpdate.sales_state_updated_at = new Date().toISOString();
    }
    await supabase
      .from("conversations")
      .update(conversationUpdate)
      .eq("id", conversation_id);

    // [PACOTE 3] Persistir/limpar pendência (toca metadata, separado para não conflitar com o update acima)
    if (pendingActionToPersist !== undefined) {
      await persistPendingAction(supabase, conversation_id, pendingActionToPersist);
      console.log(
        `[ai-support-chat] [PACOTE 3] last_pending_action ${pendingActionToPersist === null ? "CLEARED" : `SET (${pendingActionToPersist.kind})`}`,
      );
    }

    // [Sub-fase 1.3] Persistir product_focus em conversations.metadata quando
    //   alguma tool deste turno resolveu/atualizou o foco (variante ou produto).
    //   Read-merge-write para não atropelar outros campos de metadata (lock, pendência).
    if (nextProductFocus !== undefined) {
      try {
        const { data: convRow } = await supabase
          .from("conversations")
          .select("metadata")
          .eq("id", conversation_id)
          .maybeSingle();
        const curMeta: Record<string, unknown> =
          (convRow?.metadata as Record<string, unknown>) || {};
        const newMeta =
          nextProductFocus === null
            ? (() => { const { product_focus: _drop, ...rest } = curMeta; return rest; })()
            : { ...curMeta, product_focus: nextProductFocus };
        await supabase
          .from("conversations")
          .update({ metadata: newMeta })
          .eq("id", conversation_id);
        console.log(
          `[ai-support-chat] [Sub-fase 1.3] product_focus ${nextProductFocus === null ? "CLEARED" : `SET (product=${nextProductFocus.product_id} variant=${nextProductFocus.variant_id ?? "—"} source=${nextProductFocus.source})`}`,
        );
      } catch (e) {
        console.warn("[ai-support-chat] [Sub-fase 1.3] falha ao persistir product_focus:", e);
      }
    }

    // [F1] LOG CANÔNICO POR TURNO — uma linha em ai_support_turn_log
    try {
      const { error: turnLogErr } = await supabase.from("ai_support_turn_log").insert({
        conversation_id,
        tenant_id,
        message_id: newMessage?.id ?? null,
        sales_state_before: stateBefore,
        sales_state_after: nextState,
        last_user_message: (lastMessageContent || "").slice(0, 500),
        last_user_message_at: conversation.last_customer_message_at ?? null,
        intent_classified: intentForState,
        sentiment: intentClassification?.sentiment ?? null,
        urgency: intentClassification?.urgency ?? null,
        context_blocks_included: ["mode", "state", "business", "catalog", "history", "current_turn"],
        history_messages_count: messages.length,
        history_scope_validated: true,
        tools_available: salesModeEnabled ? pipelineToolsExposed : [],
        tools_called: toolsCalledArr,
        model_used: modelUsed,
        temperature_sent: modelUsed?.startsWith("gpt-5") ? null : (isGreetingOnlyTurn ? 0.95 : (salesModeEnabled ? 0.3 : 0.7)),
        response_hash: responseHash,
        response_length: (aiContent || "").length,
        anti_greeting_blocked: isGreetingOnlyTurn,
        anti_repetition_blocked: dupCheck.duplicate,
        image_send_blocked: false,
        duration_ms: latencyMs,
        metadata: {
          sales_mode: salesModeEnabled,
          channel: channelType,
          handoff: shouldHandoff,
          handoff_reason: handoffReason || null,
          // [F2] Observabilidade da pipeline modular
          pipeline_state_before: pipelineStateBefore,
          pipeline_state_pre_routing: pipelineState,
          pipeline_state_after: nextPipelineState,
          pre_transition_reason: preTransition.reason,
          state_transition_reason: transitionReason,
          state_transition_forced: shouldHandoff ? true : transition.forced,
          prompt_module_used: pipelinePromptModule,
          tools_exposed_for_state: pipelineToolsExposed,
          pipeline_blocked_tools: pipelineBlockedTools,
          discovery_turns_so_far: discoveryTurnsSoFar,
          // [F2-FIX] Indicadores de saúde da resposta
          empty_response_fallback_applied: emptyResponseFallbackApplied,
          state_max_tokens: salesModeEnabled
            ? (["greeting", "discovery"].includes(pipelineState) ? 800 : 4096)
            : null,
          state_reasoning_effort: salesModeEnabled
            ? (["greeting", "discovery"].includes(pipelineState) ? "minimal" : "low")
            : null,
          // [Pacote F] Observabilidade da dinâmica de turno
          continuation_detected: continuationCtx.isContinuation,
          continuation_reason: continuationCtx.reason,
          continuation_pattern: continuationCtx.matchedPattern || null,
          continuation_minutes_since_bot: continuationCtx.minutesSinceLastBot ?? null,
          continuation_pending_kind: continuationCtx.pendingActionKind ?? null,
          // [PACOTE 1] Round final forçado
          forced_text_round_applied: forcedTextRoundApplied,
          forced_text_round_reason: forcedTextRoundReason,
          tool_loop_iterations: toolCallIterations,
          // [PACOTE 3] Pendência (estado pré e pós)
          pending_action_before: existingPendingAction?.kind ?? null,
          pending_action_after: pendingActionToPersist === undefined
            ? (existingPendingAction?.kind ?? null)
            : (pendingActionToPersist?.kind ?? null),
          stall_detected: stallDetection.isStalled,
          stall_pattern: stallDetection.matchedPromise || null,
          dup_block_reason: dupCheck.duplicate ? dupCheck.reason : null,
          processing_lock_id: myLockId,
          processing_lock_reason: lockResult.reason || null,
          raw_is_greeting: rawIsGreeting,
        },
      });
      if (turnLogErr) {
        console.error("[ai-support-chat] [F1] turn log insert error:", turnLogErr);
      }
    } catch (logErr) {
      console.error("[ai-support-chat] [F1] turn log insert failed:", logErr);
    }

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
    // [Pacote E] Se a resposta foi marcada como duplicada, NÃO envia (mas mantém
    // a mensagem persistida com delivery_status="suppressed_duplicate" para auditoria).
    // ============================================
    let sendResult: { success: boolean; error?: string; message_id?: string } = { success: false, error: "Canal não suportado" };

    if (dupCheck.duplicate) {
      console.log(`[ai-support-chat] [PACOTE E] suppress send (duplicate response within window)`);
      try {
        await supabase
          .from("messages")
          .update({ delivery_status: "suppressed_duplicate", failure_reason: dupCheck.reason })
          .eq("id", newMessage.id);
      } catch { /* tolerante a falha */ }
      sendResult = { success: false, error: "duplicate_suppressed" };
    } else if (conversation.channel_type === "whatsapp" && conversation.customer_phone) {
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

    // [Pacote B] Libera o lock antes de devolver. Tolerante a falha.
    await releaseProcessingLock(supabase, conversation_id, myLockId).catch(() => {});

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
        suppressed_duplicate: dupCheck.duplicate,
        stall_detected: stallDetection.isStalled,
        continuation_detected: continuationCtx.isContinuation,
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
    // [Pacote B] Tenta liberar o lock mesmo em erro. Tolerante a falha.
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.conversation_id) {
        // lock_id pode não estar disponível neste catch (escopo); usamos cleanup best-effort
        // o TTL do lock garante liberação automática em PROCESSING_LOCK_TTL_MS.
      }
    } catch { /* noop */ }
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte.", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
