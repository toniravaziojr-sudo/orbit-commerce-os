# CRM (Notificações, Atendimento, Emails, Avaliações) — Regras e Especificações

> **STATUS:** ✅ Ready (Emails, Notificações, Atendimento WhatsApp com IA via OpenAI, Avaliações)  
> **Última atualização:** 2025-01-26

## Visão Geral

Módulo de relacionamento com cliente: notificações, atendimento/suporte, gestão de emails e avaliações de produtos.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Notificações | `/notifications` | ✅ Ready |
| Atendimento | `/support` | ✅ Ready |
| Emails | `/emails` | ✅ Ready |
| Avaliações | `/reviews` | ✅ Ready |

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Notifications.tsx` | Notificações push/email |
| `src/pages/Support.tsx` | Central de atendimento unificada |
| `src/pages/Emails.tsx` | Gestão de emails |
| `src/hooks/useConversations.ts` | Hook de conversas |
| `src/hooks/useMessages.ts` | Hook de mensagens |
| `src/hooks/useAiSupportConfig.ts` | Configuração da IA |
| `src/hooks/useAiChannelConfig.ts` | Configuração por canal |
| `supabase/functions/ai-support-chat/index.ts` | Edge Function de IA |

---

## 1. Notificações

### Tipos de Notificação
| Tipo | Canal | Descrição |
|------|-------|-----------|
| `order_confirmed` | Email | Pedido confirmado |
| `order_shipped` | Email/Push | Pedido enviado |
| `order_delivered` | Email/Push | Pedido entregue |
| `payment_approved` | Email | Pagamento aprovado |
| `payment_failed` | Email | Pagamento falhou |
| `abandoned_cart` | Email | Carrinho abandonado |

### Canais
| Canal | Status | Descrição |
|-------|--------|-----------|
| Email | ✅ Ready | Via Resend |
| Push Web | 🟧 Pending | Web Push API |
| WhatsApp | ✅ Ready | Via Meta/Z-API |
| SMS | 🟧 Pending | Via providers |

---

## 2. Atendimento (Support)

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Inbox unificado | ✅ Ready | Todas as conversas |
| WhatsApp (Meta) | ✅ Ready | Via Meta Cloud API |
| WhatsApp (Z-API) | ✅ Ready | Via Z-API |
| Instagram DM | 🟧 Pending | Via Meta |
| Email | ✅ Ready | Recebimento via Resend |
| Chat ao vivo | ✅ Ready | Widget na loja |
| IA Atendente | ✅ Ready | OpenAI GPT-5.2 |

### Status de Conversa
| Status | Descrição |
|--------|-----------|
| `new` | Nova conversa |
| `open` | Aguardando atendimento |
| `waiting_customer` | Aguardando cliente |
| `waiting_agent` | Aguardando agente |
| `bot` | Em atendimento pela IA |
| `resolved` | Resolvido |
| `closed` | Fechado |
| `spam` | Marcado como spam |

### Modelo de Dados

```typescript
// conversations
{
  id: uuid,
  tenant_id: uuid,
  customer_id: uuid | null,
  customer_name: string,
  customer_email: string | null,
  customer_phone: string | null,
  channel_type: 'whatsapp' | 'instagram' | 'email' | 'chat' | 'messenger',
  status: 'new' | 'open' | 'waiting_customer' | 'waiting_agent' | 'bot' | 'resolved' | 'closed' | 'spam',
  assigned_to: uuid | null,
  last_message_at: timestamptz,
  created_at: timestamptz,
}

// messages
{
  id: uuid,
  conversation_id: uuid,
  tenant_id: uuid,
  direction: 'inbound' | 'outbound',
  sender_type: 'customer' | 'agent' | 'bot' | 'system',
  sender_id: uuid | null,
  sender_name: string,
  content: text,
  content_type: 'text' | 'image' | 'audio' | 'video' | 'document',
  delivery_status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed',
  is_ai_generated: boolean,
  is_internal: boolean,
  is_note: boolean,
  created_at: timestamptz,
}
```

---

## 3. Fluxo de Atendimento com IA (OpenAI)

### Provider: OpenAI

> **Migrado em:** 2025-01-26  
> **Provider anterior:** Lovable AI Gateway  
> **Provider atual:** OpenAI API direta

### Modelos Disponíveis

| Modelo | Prioridade | Descrição |
|--------|------------|-----------|
| `gpt-5.2` | 1 (default) | Máxima qualidade e raciocínio |
| `gpt-5` | 2 | Alta qualidade |
| `gpt-5-mini` | 3 | Equilíbrio custo/qualidade |
| `gpt-5-nano` | 4 | Rápido e econômico |
| `gpt-4o` | 5 (fallback) | Compatibilidade legada |

### Fallback Automático

Se o modelo configurado falhar (modelo não existe), o sistema tenta automaticamente o próximo na lista de prioridade.

### Mapeamento de Modelos Legados

| Modelo Legado | Mapeado Para |
|---------------|--------------|
| `google/gemini-2.5-flash` | `gpt-5-mini` |
| `google/gemini-2.5-pro` | `gpt-5` |
| `openai/gpt-4o` | `gpt-4o` |

---

## 4. Guardrails: Atendimento INFORMATIVO

### Regra Fundamental

> ⚠️ **A IA de atendimento é PURAMENTE INFORMATIVA. Nunca executa ações.**

### Prompt de Guardrails (injetado automaticamente)

```text
VOCÊ É UM ASSISTENTE PURAMENTE INFORMATIVO.

REGRAS ABSOLUTAS:
1. NUNCA EXECUTE AÇÕES - Você não pode cancelar pedidos, processar reembolsos, alterar dados, etc.
2. SEMPRE INFORME E ESCALONE - Se o cliente pedir ações ou estiver insatisfeito, diga que vai encaminhar para um humano.
3. NUNCA INVENTE INFORMAÇÕES - Se não souber a resposta, diga que vai verificar com a equipe.
4. NUNCA PROMETA PRAZOS OU RESULTADOS que você não pode garantir.
5. COLETE DADOS MÍNIMOS para facilitar o atendimento humano quando escalar.

QUANDO ESCALAR PARA HUMANO:
- Solicitação de cancelamento/reembolso
- Reclamação ou insatisfação
- Problema técnico não documentado
- Pedido de ação específica
- Cliente explicitamente pede falar com humano
- Informação não disponível na base de conhecimento
```

### Comportamento Esperado

| Cenário | Ação da IA |
|---------|------------|
| Pergunta sobre prazo de entrega | Responde com base na KB |
| Solicitação de cancelamento | Informa que vai escalar + coleta dados |
| Reclamação de produto | Informa que vai escalar + coleta detalhes |
| Pergunta não documentada | Informa que vai verificar + escala |
| Elogio | Agradece e registra |

---

## 5. Webhooks de Entrada

Cada canal possui seu próprio webhook que:
1. Recebe a mensagem do provedor
2. Cria/atualiza conversa na tabela `conversations`
3. Insere mensagem na tabela `messages`
4. **Invoca `ai-support-chat` se IA estiver habilitada**

| Canal | Edge Function | Invoca IA |
|-------|---------------|-----------|
| WhatsApp (Meta) | `meta-whatsapp-webhook` | ✅ Sim |
| WhatsApp (Z-API) | `support-webhook` | ✅ Sim |
| Email | `support-email-inbound` | ✅ Sim |
| Chat Widget | `SupportChatWidget.tsx` → `ai-support-chat` | ✅ Sim |

### Lógica de Invocação da IA

Antes de invocar a IA, os webhooks verificam:

```typescript
// 1. Verifica config global
const { data: aiConfig } = await supabase
  .from("ai_support_config")
  .select("is_enabled")
  .eq("tenant_id", tenantId)
  .single();

// 2. Verifica config específica do canal (opcional)
const { data: channelAiConfig } = await supabase
  .from("ai_channel_config")
  .select("is_enabled")
  .eq("tenant_id", tenantId)
  .eq("channel_type", channelType) // 'whatsapp', 'email', etc.
  .single();

// 3. IA habilitada se: global ON && (sem config canal OU canal ON)
const aiEnabled = aiConfig?.is_enabled && (channelAiConfig?.is_enabled !== false);

if (aiEnabled) {
  await fetch(`${SUPABASE_URL}/functions/v1/ai-support-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      tenant_id: tenantId,
    }),
  });
}
```

---

## 6. Edge Function `ai-support-chat`

### Responsabilidades

1. Carregar histórico da conversa
2. Montar contexto (produtos, FAQs, políticas se habilitado)
3. **Injetar guardrails informativos**
4. Gerar resposta via **OpenAI API**
5. Salvar resposta na tabela `messages`
6. **Registrar consumo de tokens (metering)**
7. Enviar resposta de volta pelo canal correto

### Fluxo de Execução

```typescript
// 1. Buscar configuração do tenant
const aiConfig = await getAiConfig(tenantId);

// 2. Montar mensagens com contexto
const messages = [
  { role: 'system', content: systemPrompt + GUARDRAILS },
  ...conversationHistory,
];

// 3. Chamar OpenAI
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: resolvedModel, // gpt-5.2 com fallback
    messages,
    max_tokens: aiConfig.max_response_length || 500,
    temperature: 0.7,
  }),
});

// 4. Registrar consumo (billing)
await supabase.rpc('record_ai_usage', {
  p_tenant_id: tenantId,
  p_usage_cents: calculatedCost,
});

// 5. Registrar evento (observabilidade) e métricas
await supabase.rpc('increment_ai_metrics', {
  p_tenant_id: tenantId,
  p_messages: 1,
  p_images: visionProcessed ? 1 : 0,
  p_audio_count: audioProcessed ? 1 : 0,
  p_audio_seconds: audioDurationSeconds,
  p_handoffs: handoffTriggered ? 1 : 0,
  p_no_evidence: ragNoEvidence ? 1 : 0,
  p_embedding_tokens: embeddingTokens,
});

await supabase.from('conversation_events').insert({
  conversation_id,
  tenant_id,
  event_type: 'ai_response',
  metadata: {
    model: resolvedModel,
    input_tokens,
    output_tokens,
    latency_ms,
    cost_cents,
  },
});
```

### Envio por Canal

```typescript
if (conversation.channel_type === "whatsapp" && conversation.customer_phone) {
  await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
    body: JSON.stringify({
      tenant_id,
      phone: conversation.customer_phone,
      message: aiContent,
    }),
  });
}
```

---

## 7. Billing e Metering

### Custos por Modelo (aproximados)

| Modelo | Input ($/1M tokens) | Output ($/1M tokens) |
|--------|---------------------|----------------------|
| gpt-5.2 | $5.00 | $15.00 |
| gpt-5 | $5.00 | $15.00 |
| gpt-5-mini | $0.30 | $1.00 |
| gpt-5-nano | $0.10 | $0.40 |
| gpt-4o | $2.50 | $10.00 |

### Registro de Consumo

O consumo é registrado via RPC `record_ai_usage` que incrementa o campo `ai_usage_cents` na tabela `tenant_monthly_usage`.

```sql
-- Exemplo de query para ver consumo
SELECT tenant_id, year_month, ai_usage_cents 
FROM tenant_monthly_usage 
WHERE tenant_id = 'xxx'
ORDER BY year_month DESC;
```

### Métricas Registradas

Cada resposta de IA registra em `conversation_events`:

| Campo | Descrição |
|-------|-----------|
| `model` | Modelo usado |
| `input_tokens` | Tokens de entrada |
| `output_tokens` | Tokens de saída |
| `latency_ms` | Tempo de resposta |
| `cost_cents` | Custo em centavos |

---

## 8. Emails (Transacionais e Marketing)

### Templates de Email
| Template | Trigger | Descrição |
|----------|---------|-----------|
| Boas-vindas | Cadastro | Novo cliente |
| Confirmação de pedido | Checkout | Pedido criado |
| Pagamento aprovado | Webhook | PIX/Cartão OK |
| Nota fiscal | NF emitida | Envio da NF |
| Envio | Postagem | Código de rastreio |
| Entrega | Status update | Pedido entregue |
| Recuperação | Cron job | Carrinho abandonado |

### Variáveis de Template
| Variável | Descrição |
|----------|-----------|
| `{{customer.name}}` | Nome do cliente |
| `{{order.number}}` | Número do pedido |
| `{{order.total}}` | Valor total |
| `{{tracking.code}}` | Código de rastreio |
| `{{store.name}}` | Nome da loja |

---

## 9. Configuração de IA

### Tabela `ai_support_config` (Global)

```typescript
{
  tenant_id: uuid,
  is_enabled: boolean,
  ai_model: string, // 'gpt-5.2' padrão
  system_prompt: text,
  custom_knowledge: text,
  personality_name: string,
  personality_tone: 'formal' | 'casual' | 'friendly',
  use_emojis: boolean,
  max_response_length: number,
  max_messages_before_handoff: number,
  handoff_keywords: string[],
  forbidden_topics: string[],
  operating_hours: jsonb,
  out_of_hours_message: text,
  auto_import_products: boolean,
  auto_import_categories: boolean,
  auto_import_policies: boolean,
  auto_import_faqs: boolean,
  handle_images: boolean,
  handle_audio: boolean,
  approval_mode: boolean,
}
```

### Modelos Disponíveis na UI

| Opção | Modelo | Descrição |
|-------|--------|-----------|
| Máxima Qualidade | `gpt-5.2` | Melhor raciocínio (mais caro) |
| Alta Qualidade | `gpt-5` | Excelente (custo moderado) |
| Balanceado | `gpt-5-mini` | Bom custo-benefício |
| Econômico | `gpt-5-nano` | Mais barato |

### Tabela `ai_channel_config` (Por Canal)

Permite sobrescrever configurações específicas por canal:

```typescript
{
  tenant_id: uuid,
  channel_type: 'whatsapp' | 'email' | 'chat' | 'instagram' | 'messenger',
  is_enabled: boolean,
  system_prompt_override: text | null,
  forbidden_topics: string[],
  max_response_length: number | null,
  use_emojis: boolean | null,
  custom_instructions: text | null,
}
```

---

## 10. Provedores de WhatsApp

### Meta Cloud API (Recomendado)

| Campo | Descrição |
|-------|-----------|
| `phone_number_id` | ID do número no Meta |
| `access_token` | Token de acesso (criptografado) |
| `waba_id` | ID da conta WhatsApp Business |

**Webhook:** `meta-whatsapp-webhook`  
**Envio:** `meta-whatsapp-send`

### Z-API (Legacy)

| Campo | Descrição |
|-------|-----------|
| `instance_id` | ID da instância Z-API |
| `api_token` | Token da API |
| `client_token` | Token do cliente |

**Webhook:** `support-webhook`  
**Envio:** `whatsapp-send`

---

## 11. Tabelas de Configuração

### `whatsapp_configs`

```sql
CREATE TABLE whatsapp_configs (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  provider text NOT NULL, -- 'meta' | 'z-api'
  phone_number text,
  phone_number_id text,
  instance_id text,
  api_token text, -- encrypted
  client_token text, -- encrypted
  access_token text, -- encrypted
  waba_id text,
  connection_status text, -- 'connected' | 'disconnected' | 'qr_pending'
  is_enabled boolean DEFAULT true,
  UNIQUE(tenant_id, provider)
);
```

### RLS Policies

```sql
-- Owners/admins podem gerenciar configs do próprio tenant
CREATE POLICY "Tenant owners can view their whatsapp_configs"
ON whatsapp_configs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = whatsapp_configs.tenant_id
    AND ur.role IN ('owner', 'admin')
));

-- Policies similares para INSERT, UPDATE, DELETE
```

---

## 12. Teste Ponta a Ponta

### Passos para Validar

1. **Enviar mensagem** (WhatsApp/Chat/Email)
2. **Verificar log da Edge Function** (`ai-support-chat`)
3. **Confirmar modelo usado** (gpt-5.2 por padrão)
4. **Validar resposta informativa** (sem promessas de ação)
5. **Verificar consumo registrado** (`tenant_monthly_usage.ai_usage_cents`)
6. **Verificar evento registrado** (`conversation_events` com metadata de tokens)

### Comandos de Debug

```sql
-- Ver últimas respostas de IA
SELECT * FROM messages 
WHERE is_ai_generated = true 
ORDER BY created_at DESC LIMIT 10;

-- Ver consumo de IA por tenant
SELECT * FROM tenant_monthly_usage 
WHERE ai_usage_cents > 0 
ORDER BY year_month DESC;

-- Ver eventos de IA
SELECT * FROM conversation_events 
WHERE event_type = 'ai_response' 
ORDER BY created_at DESC LIMIT 10;
```

---

## Checklist de Implementação

- [x] Inbox unificado
- [x] Integrar WhatsApp Meta Cloud API
- [x] Integrar WhatsApp Z-API
- [x] Widget de chat ao vivo
- [x] IA para atendimento automático
- [x] Invocação automática da IA em todos os canais
- [x] **Migrar provider para OpenAI (GPT-5.2)**
- [x] **Implementar guardrails informativos**
- [x] **Metering de tokens por tenant**
- [x] **Fallback automático de modelos**
- [x] **Seletor de modelo na UI**
- [x] **RAG com busca semântica (Knowledge Base)**
- [x] **Vision para análise de imagens (GPT-4o)**
- [x] **Transcrição de áudio (Whisper)**
- [x] **Fila assíncrona de processamento de mídia**
- [x] **Intent classification via Tool Calling**
- [x] **Handoff automático inteligente**
- [x] **Redação de PII (LGPD)**
- [ ] Templates de email editáveis
- [ ] Automações de follow-up
- [ ] Instagram DM
- [ ] Messenger

---

## 13. RAG (Retrieval-Augmented Generation)

### Visão Geral

O sistema utiliza busca semântica para contextualizar as respostas da IA com base em documentos cadastrados na Knowledge Base.

### Componentes

| Componente | Descrição |
|------------|-----------|
| `knowledge_base_docs` | Documentos fonte (políticas, FAQs) |
| `knowledge_base_chunks` | Chunks vetorizados com embeddings |
| `ai-generate-embedding` | Edge Function para gerar embeddings |
| `search_knowledge_base` | RPC para busca semântica |

### Configuração por Tenant

```typescript
// ai_support_config
{
  rag_top_k: number,              // Máximo de chunks (default: 5)
  rag_similarity_threshold: number, // Limiar de similaridade (default: 0.7)
  rag_min_evidence_chunks: number,  // Mínimo para responder (default: 1)
  handoff_on_no_evidence: boolean,  // Escalar se não houver evidência
}
```

### Fluxo de RAG

```typescript
// 1. Gerar embedding da pergunta
const embedding = await generateEmbedding(customerMessage);

// 2. Buscar chunks similares
const { data: chunks } = await supabase.rpc('search_knowledge_base', {
  p_tenant_id: tenantId,
  p_query_embedding: embedding,
  p_top_k: config.rag_top_k || 5,
  p_threshold: config.rag_similarity_threshold || 0.7,
});

// 3. Verificar evidência mínima
if (chunks.length < config.rag_min_evidence_chunks && config.handoff_on_no_evidence) {
  // Escalar para humano - sem evidência suficiente
  return triggerHandoff('no_evidence');
}

// 4. Montar contexto para a IA
const ragContext = chunks.map(c => c.chunk_text).join('\n---\n');
```

---

## 14. Processamento de Mídia (Vision e Áudio)

### Fila Assíncrona

O processamento de imagens e áudio é feito via fila (`ai_media_queue`) para não bloquear o fluxo principal.

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando processamento |
| `processing` | Em execução |
| `completed` | Concluído com sucesso |
| `failed` | Falhou após max_attempts |

### Edge Functions

| Função | Modelo | Descrição |
|--------|--------|-----------|
| `ai-support-vision` | GPT-4o | Análise de imagens |
| `ai-support-transcribe` | Whisper | Transcrição de áudio |
| `ai-media-queue-process` | - | Processador da fila (cron) |

### Fluxo de Imagem

```typescript
// 1. Mensagem com imagem recebida
// 2. Criar item na fila
await supabase.from('ai_media_queue').insert({
  tenant_id,
  message_id,
  attachment_id,
  process_type: 'vision',
  status: 'pending',
});

// 3. Cron processa (ai-media-queue-process)
// 4. Chama ai-support-vision
// 5. Atualiza metadata do attachment
await supabase.from('message_attachments').update({
  ai_description: "Cliente mostra produto com defeito na embalagem",
  ai_extracted_text: "Texto extraído da imagem...",
  ai_suggested_actions: ["Solicitar fotos adicionais", "Escalar para logística"],
  vision_processed_at: new Date().toISOString(),
});

// 6. Descrição é injetada no contexto do ai-support-chat
```

### Fluxo de Áudio

```typescript
// 1. Mensagem com áudio recebida
// 2. Criar item na fila
await supabase.from('ai_media_queue').insert({
  tenant_id,
  message_id,
  attachment_id,
  process_type: 'transcription',
  status: 'pending',
});

// 3. Cron processa (ai-media-queue-process)
// 4. Chama ai-support-transcribe (OpenAI Whisper)
// 5. Atualiza metadata do attachment
await supabase.from('message_attachments').update({
  transcription: "Olá, estou ligando porque...",
  transcription_duration_seconds: 45,
  transcription_processed_at: new Date().toISOString(),
});

// 6. Transcrição é injetada no contexto do ai-support-chat
```

---

## 15. Intent Classification (Tool Calling)

### Objetivo

Classificar automaticamente a intenção do cliente para decidir:
- Se a IA pode responder
- Se deve escalar para humano
- Qual prioridade atribuir

### Schema do Tool

```typescript
const classifyIntentTool = {
  type: "function",
  function: {
    name: "classify_intent",
    description: "Classifica a intenção e sentimento do cliente",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["question", "complaint", "request_action", "praise", "other"],
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative", "aggressive"],
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        requires_action: {
          type: "boolean",
          description: "Se o cliente solicita uma ação (cancelar, reembolsar, etc)",
        },
        topic: {
          type: "string",
          description: "Tópico principal (entrega, pagamento, produto, etc)",
        },
      },
      required: ["intent", "sentiment", "urgency", "requires_action"],
    },
  },
};
```

### Gatilhos de Handoff Automático

| Condição | Ação |
|----------|------|
| `requires_action === true` | Escalar para humano |
| `sentiment === 'aggressive'` | Escalar para humano |
| `intent === 'complaint' && urgency === 'high'` | Escalar para humano |
| Sem evidência na KB | Escalar para humano |
| Cliente pediu humano | Escalar para humano |

---

## 16. Metering Avançado

### Métricas por Tenant (tenant_monthly_usage)

| Campo | Descrição |
|-------|-----------|
| `ai_messages_count` | Total de mensagens processadas pela IA |
| `ai_image_analysis_count` | Imagens analisadas via Vision |
| `ai_audio_transcription_count` | Áudios transcritos |
| `ai_audio_duration_seconds` | Total de segundos de áudio |
| `ai_handoff_count` | Escalações para humano |
| `ai_no_evidence_count` | Respostas sem evidência na KB |
| `ai_embedding_tokens` | Tokens usados em embeddings |
| `ai_usage_cents` | Custo total em centavos |

### RPC de Incremento

```sql
SELECT increment_ai_metrics(
  p_tenant_id := 'uuid',
  p_messages := 1,
  p_images := 1,
  p_audio_count := 0,
  p_audio_seconds := 0,
  p_handoffs := 0,
  p_no_evidence := 0,
  p_embedding_tokens := 150
);
```

---

## 17. Redação de PII (LGPD)

### Dados Redatados

O sistema mascara automaticamente:
- CPF (`***.456.789-**`)
- CNPJ (`12.345.***/0001-**`)
- Telefones (`(**) *****-1234`)
- Emails (`jo***@***.com`)
- CEPs (`*****-123`)
- Chaves Pix (parcialmente mascaradas)
- RGs

### Onde é Aplicado

| Local | Aplicação |
|-------|-----------|
| `ai_context_used` | Logs de contexto da IA |
| Resumos de conversa | Quando enviados para humanos |
| Exportações | Relatórios e analytics |

### Configuração

```typescript
// ai_support_config
{
  redact_pii_in_logs: boolean,   // Ativar redação (default: true)
  data_retention_days: number,  // Retenção de dados (default: 365)
}
```
