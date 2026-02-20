import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { redactPII } from "../_shared/redact-pii.ts";
import { getMemoryContext } from "../_shared/ai-memory.ts";

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
  intent: 'question' | 'complaint' | 'action_request' | 'greeting' | 'thanks' | 'general';
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

// Intent classification tool definition
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
          enum: ["question", "complaint", "action_request", "greeting", "thanks", "general"],
          description: "Tipo de intenção: question=pergunta, complaint=reclamação, action_request=pedido de ação, greeting=saudação, thanks=agradecimento, general=outro"
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative", "aggressive"],
          description: "Sentimento do cliente: positive=satisfeito, neutral=neutro, negative=insatisfeito, aggressive=agressivo/irritado"
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Urgência: low=pode esperar, medium=importante, high=urgente"
        },
        requires_action: {
          type: "boolean",
          description: "Se true, o cliente está solicitando uma AÇÃO (cancelamento, reembolso, alteração)"
        },
        topics: {
          type: "array",
          items: { type: "string" },
          description: "Lista de tópicos mencionados (ex: 'pedido', 'frete', 'pagamento', 'produto')"
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
    // Use raw query approach for pgvector compatibility - cast to any to bypass strict typing
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
        model: "gpt-4o", // Fast model for classification
        messages: [
          {
            role: "system",
            content: `Você é um classificador de intenções para atendimento ao cliente de e-commerce.
Analise a mensagem do cliente e classifique a intenção, sentimento e urgência.

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
      // RAG settings (with defaults)
      rag_similarity_threshold: 0.7,
      rag_top_k: 5,
      rag_min_evidence_chunks: 1,
      handoff_on_no_evidence: true,
      redact_pii_in_logs: true,
    };

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
      
      // Handoff triggers based on intent
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

    // ============================================
    // STEP 2: RAG - SEMANTIC SEARCH
    // ============================================
    let knowledgeContext = "";
    let noEvidenceHandoff = false;
    let similarityScores: number[] = [];

    // Only do RAG search for questions or general inquiries
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
        embeddingTokens = Math.ceil(lastMessageContent.length / 4); // Rough estimate

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
          
          // Build knowledge context from chunks
          knowledgeContext = "\n\n========================================\n";
          knowledgeContext += "📚 BASE DE CONHECIMENTO (relevância semântica)\n";
          knowledgeContext += "========================================\n";
          
          // Group chunks by doc type
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
          
          // Check if we should handoff due to no evidence
          const minChunks = effectiveConfig.rag_min_evidence_chunks || 1;
          if (effectiveConfig.handoff_on_no_evidence && chunks.length < minChunks) {
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

    // Build basic store context (only essential info not in KB)
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

    // Add guardrails (MANDATORY)
    systemPrompt += INFORMATIVE_GUARDRAILS;

    // Add knowledge base context (RAG results)
    if (knowledgeContext) {
      systemPrompt += knowledgeContext;
    }

    // Add store and customer context
    systemPrompt += storeContext;
    if (customerContext) {
      systemPrompt += customerContext;
    }

    // Inject AI memory context (tenant-level business facts for support)
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
    const aiMessages: { role: string; content: string }[] = [
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
    // STEP 7: CALL OPENAI API
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
      console.log(`[ai-support-chat] Calling OpenAI model: ${aiModel}, messages: ${aiMessages.length}, context: ${systemPrompt.length} chars`);

      let response: Response | null = null;
      let usedModel = aiModel;
      const modelsToTry = [aiModel, ...OPENAI_MODELS.filter(m => m !== aiModel)];

      let lastErrorText = "";
      for (const modelToTry of modelsToTry) {
        try {
          // GPT-5 models use max_completion_tokens instead of max_tokens
          const isGpt5Model = modelToTry.startsWith("gpt-5");
          const tokenParams = isGpt5Model 
            ? { max_completion_tokens: 1024 }
            : { max_tokens: 1024 };

          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: modelToTry,
              messages: aiMessages,
              ...tokenParams,
              temperature: 0.7,
            }),
          });

          if (response.ok) {
            usedModel = modelToTry;
            modelUsed = modelToTry;
            console.log(`[ai-support-chat] Using model: ${modelToTry}`);
            break;
          }

          lastErrorText = await response.text();
          console.warn(`[ai-support-chat] Model ${modelToTry} failed:`, response.status, lastErrorText);
          
          // Reset response so we try next model
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

      const aiData = await response.json();
      aiContent = aiData.choices?.[0]?.message?.content;
      
      if (aiData.usage) {
        inputTokens = aiData.usage.prompt_tokens || 0;
        outputTokens = aiData.usage.completion_tokens || 0;
      }

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

    // Increment AI metrics (messages, handoffs, no_evidence)
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
      event_type: shouldHandoff ? "ai_handoff" : "ai_response",
      actor_type: "bot",
      actor_name: personalityName,
      description: shouldHandoff 
        ? `IA escalou para humano: ${handoffReason}` 
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
        const { data: waConfig } = await supabase
          .from("whatsapp_configs")
          .select("provider")
          .eq("tenant_id", tenant_id)
          .eq("connection_status", "connected")
          .maybeSingle();

        const sendFunction = waConfig?.provider === "meta" ? "meta-whatsapp-send" : "whatsapp-send";

        const sendResponse = await fetch(
          `${supabaseUrl}/functions/v1/${sendFunction}`,
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

    console.log(`[ai-support-chat] Response ${sendResult.success ? "sent" : "failed"} via ${channelType}. Model: ${modelUsed}, RAG: ${similarityScores.length} chunks, Latency: ${latencyMs}ms`);

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
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
