
# IA de Atendimento Especializada — Plano Ajustado (Production-Grade)

## Resumo Executivo

Este plano incorpora os **4 ajustes obrigatórios** solicitados para garantir qualidade production-grade:

1. **RAG com pgvector** — Busca semântica em vez de concatenação de KB no prompt
2. **Vision/Transcrição assíncronos** — Fila com idempotência e retry
3. **no_evidence por threshold** — Decisão baseada em score de relevância do RAG
4. **LGPD/Redaction robusto** — Mascaramento completo para Brasil

---

## Diagnóstico do Estado Atual

### O que já existe e funciona bem:
- Edge Function `ai-support-chat` com OpenAI GPT-5.2
- Guardrails informativos (não executa ações)
- Configuração multi-tenant (`ai_support_config`, `ai_channel_config`)
- Billing e metering via `record_ai_usage`
- Tabela `message_attachments` com campos para transcrição e moderação
- Webhooks de entrada (WhatsApp/Email/Chat) já persistem anexos

### Problema crítico identificado:
O sistema atual **concatena toda a KB no system prompt** (linhas 263-443 do `ai-support-chat`), causando:
- Contexto gigante (alto custo de tokens)
- Baixa relevância (modelo recebe "tudo" e se confunde)
- Sem evidência de quais trechos sustentaram a resposta

---

## Fase 1: RAG com pgvector (Fundação)

### 1.1 Habilitar extensão vector

```sql
-- Migration: enable_pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
```

### 1.2 Criar tabelas de Knowledge Base governada

```sql
-- knowledge_base_docs (documentos completos)
CREATE TABLE public.knowledge_base_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Metadados
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('policy', 'faq', 'product', 'script', 'shipping', 'payment', 'other')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'archived')),
  priority INTEGER DEFAULT 50, -- 1-100, menor = maior prioridade
  
  -- Conteúdo original
  content TEXT NOT NULL,
  
  -- Governança
  version INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadados extras
  tags TEXT[] DEFAULT '{}',
  source TEXT, -- 'manual', 'auto_import_products', 'auto_import_policies', etc.
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_tenant_doc UNIQUE (tenant_id, title, doc_type)
);

-- knowledge_base_chunks (trechos com embeddings)
CREATE TABLE public.knowledge_base_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES knowledge_base_docs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Conteúdo do chunk
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_tokens INTEGER,
  
  -- Embedding (1536 dimensões para text-embedding-3-small)
  embedding vector(1536),
  
  -- Status herdado do doc
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_doc_chunk UNIQUE (doc_id, chunk_index)
);

-- Índice para busca vetorial
CREATE INDEX knowledge_base_chunks_embedding_idx 
ON knowledge_base_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Índice para filtro por tenant
CREATE INDEX knowledge_base_chunks_tenant_active_idx 
ON knowledge_base_chunks (tenant_id, is_active);
```

### 1.3 Função de busca semântica

```sql
CREATE OR REPLACE FUNCTION search_knowledge_base(
  p_tenant_id UUID,
  p_query_embedding vector(1536),
  p_top_k INTEGER DEFAULT 5,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id UUID,
  doc_id UUID,
  doc_title TEXT,
  doc_type TEXT,
  doc_priority INTEGER,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id AS chunk_id,
    c.doc_id,
    d.title AS doc_title,
    d.doc_type,
    d.priority AS doc_priority,
    c.chunk_text,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM knowledge_base_chunks c
  JOIN knowledge_base_docs d ON d.id = c.doc_id
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND d.status = 'active'
    AND (d.valid_until IS NULL OR d.valid_until > now())
    AND 1 - (c.embedding <=> p_query_embedding) >= p_threshold
  ORDER BY d.priority ASC, similarity DESC
  LIMIT p_top_k;
$$;
```

### 1.4 Nova Edge Function: `ai-generate-embedding`

```typescript
// supabase/functions/ai-generate-embedding/index.ts
// Gera embedding via OpenAI text-embedding-3-small
// Chamada por: ai-support-chat (query) e pipeline de ingestão de KB (docs)

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  const data = await response.json();
  return data.data[0].embedding;
}
```

### 1.5 Modificar `ai-support-chat` para usar RAG

**Antes (atual):**
```typescript
// Concatena tudo no prompt
systemPrompt += storeContext; // 10-50KB de texto
```

**Depois (RAG):**
```typescript
// 1. Gerar embedding da mensagem do cliente
const queryEmbedding = await generateEmbedding(lastCustomerMessage.content);

// 2. Buscar chunks relevantes (threshold 0.7)
const { data: relevantChunks } = await supabase.rpc("search_knowledge_base", {
  p_tenant_id: tenant_id,
  p_query_embedding: queryEmbedding,
  p_top_k: 5,
  p_threshold: 0.7,
});

// 3. Determinar no_evidence pelo resultado
const hasEvidence = relevantChunks && relevantChunks.length > 0;
const maxSimilarity = relevantChunks?.[0]?.similarity || 0;

if (!hasEvidence || maxSimilarity < 0.75) {
  // HANDOFF por falta de evidência
  shouldHandoff = true;
  noEvidenceDetected = true;
}

// 4. Injetar apenas chunks relevantes no prompt
if (hasEvidence) {
  systemPrompt += "\n\n### BASE DE CONHECIMENTO (trechos relevantes):\n";
  for (const chunk of relevantChunks) {
    systemPrompt += `[${chunk.doc_type.toUpperCase()}] ${chunk.doc_title}:\n${chunk.chunk_text}\n\n`;
  }
}

// 5. Registrar referências para auditoria
const kbReferences = relevantChunks?.map(c => c.chunk_id) || [];
```

### 1.6 Pipeline de ingestão de KB

Nova Edge Function: `ai-kb-ingest`

- **Trigger**: Quando doc é criado/atualizado com `status = 'active'`
- **Processo**:
  1. Chunking (máx 500 tokens por chunk)
  2. Gerar embedding para cada chunk
  3. Salvar em `knowledge_base_chunks`
  4. Invalidar chunks antigos se for update

- **Auto-import**: Criar cron que sincroniza produtos, categorias e políticas para `knowledge_base_docs`

---

## Fase 2: Vision e Transcrição Assíncronos com Fila

### 2.1 Tabela de fila de processamento

```sql
CREATE TABLE public.ai_media_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  attachment_id UUID NOT NULL REFERENCES message_attachments(id) ON DELETE CASCADE,
  
  -- Tipo de processamento
  process_type TEXT NOT NULL CHECK (process_type IN ('vision', 'transcription')),
  
  -- Status da fila
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed', 'skipped')),
  
  -- Retry control
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Resultado
  result JSONB,
  error_message TEXT,
  
  -- Idempotência
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  -- Evitar duplicação
  CONSTRAINT unique_attachment_process UNIQUE (attachment_id, process_type)
);

-- Índice para processador
CREATE INDEX ai_media_queue_pending_idx 
ON ai_media_queue (tenant_id, status, next_retry_at) 
WHERE status IN ('queued', 'failed');
```

### 2.2 Edge Function: `ai-support-vision`

```typescript
// supabase/functions/ai-support-vision/index.ts

// Recebe: attachment_id
// Verifica idempotência (já processado?)
// Chama GPT-5.2 Vision
// Salva descrição em message_attachments.metadata.vision_description
// Atualiza status da fila

const VISION_PROMPT = `Analise esta imagem no contexto de atendimento ao cliente de e-commerce.
Descreva:
1. O que você vê (produto, embalagem, documento, comprovante, erro)
2. Detalhes relevantes para atendimento (defeitos, códigos, valores)
3. Sugestão de ação para o atendente

Responda em JSON:
{
  "category": "product|damage|tracking|receipt|error|package|other",
  "description": "descrição objetiva",
  "extracted_text": "texto visível na imagem",
  "action_suggestion": "o que o atendente deve fazer"
}`;
```

### 2.3 Edge Function: `ai-support-transcribe`

```typescript
// supabase/functions/ai-support-transcribe/index.ts

// Recebe: attachment_id
// Verifica idempotência
// Baixa áudio do storage
// Chama OpenAI Whisper (transcription)
// Salva transcription em message_attachments.transcription
// Atualiza status da fila

async function transcribe(audioUrl: string): Promise<string> {
  const audioBuffer = await fetch(audioUrl).then(r => r.arrayBuffer());
  
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer]), "audio.ogg");
  formData.append("model", "whisper-1");
  formData.append("language", "pt");
  
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });
  
  const data = await response.json();
  return data.text;
}
```

### 2.4 Processador de fila (cron ou invocado por webhook)

Edge Function: `ai-media-queue-process`

```typescript
// Busca itens com status 'queued' ou 'failed' com next_retry_at <= now
// Para cada item:
//   1. Marca como 'processing'
//   2. Chama vision ou transcribe
//   3. Marca como 'done' ou 'failed' (incrementa attempts)
//   4. Se failed e attempts < max_attempts: define next_retry_at com backoff exponencial

const BACKOFF_BASE = 30; // segundos
const nextRetry = new Date(Date.now() + BACKOFF_BASE * Math.pow(2, attempts) * 1000);
```

### 2.5 Integração nos webhooks

Nos webhooks (meta-whatsapp-webhook, support-email-inbound, etc.):

```typescript
// Após salvar attachment de imagem ou áudio
if (attachment.mime_type.startsWith("image/")) {
  await supabase.from("ai_media_queue").insert({
    tenant_id,
    message_id,
    attachment_id: attachment.id,
    process_type: "vision",
    status: "queued",
  }).onConflict("attachment_id,process_type").ignore();
}

if (attachment.mime_type.startsWith("audio/")) {
  await supabase.from("ai_media_queue").insert({
    tenant_id,
    message_id,
    attachment_id: attachment.id,
    process_type: "transcription",
    status: "queued",
  }).onConflict("attachment_id,process_type").ignore();
}
```

---

## Fase 3: no_evidence por Threshold de RAG

### 3.1 Configuração de thresholds

Adicionar à tabela `ai_support_config`:

```sql
ALTER TABLE ai_support_config ADD COLUMN IF NOT EXISTS
  rag_similarity_threshold FLOAT DEFAULT 0.7,
  rag_min_evidence_chunks INTEGER DEFAULT 1,
  rag_top_k INTEGER DEFAULT 5,
  handoff_on_no_evidence BOOLEAN DEFAULT true;
```

### 3.2 Lógica no ai-support-chat

```typescript
// Após busca RAG
const hasEvidence = relevantChunks && relevantChunks.length >= config.rag_min_evidence_chunks;
const maxSimilarity = relevantChunks?.[0]?.similarity || 0;
const noEvidenceDetected = !hasEvidence || maxSimilarity < config.rag_similarity_threshold;

if (noEvidenceDetected && config.handoff_on_no_evidence) {
  shouldHandoff = true;
  handoffReason = "no_evidence";
  
  // Injetar instrução especial no prompt
  systemPrompt += `\n\n⚠️ ATENÇÃO: Não foi encontrada informação suficiente na base de conhecimento para responder a esta pergunta.
  
VOCÊ DEVE:
1. Informar ao cliente que não encontrou a informação específica
2. Dizer que vai verificar com a equipe
3. Coletar dados básicos (nome, email, pedido se aplicável)
4. Confirmar que um atendente entrará em contato

NÃO INVENTE informações. NÃO tente responder sem evidência.`;
}
```

### 3.3 Métricas de no_evidence

```sql
ALTER TABLE tenant_monthly_usage ADD COLUMN IF NOT EXISTS
  ai_no_evidence_count INTEGER DEFAULT 0,
  ai_handoff_count INTEGER DEFAULT 0;
```

---

## Fase 4: LGPD/Redaction Robusto para Brasil

### 4.1 Função de redaction

```typescript
// supabase/functions/_shared/redact-pii.ts

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // CPF (com e sem formatação)
  { pattern: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, replacement: "[CPF]" },
  
  // CNPJ (com e sem formatação)
  { pattern: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, replacement: "[CNPJ]" },
  
  // Telefones BR (diversos formatos)
  { pattern: /\+?55?\s?\(?0?\d{2}\)?\s?9?\d{4}[- ]?\d{4}/g, replacement: "[TELEFONE]" },
  { pattern: /\(\d{2}\)\s?\d{4,5}[- ]?\d{4}/g, replacement: "[TELEFONE]" },
  
  // CEP
  { pattern: /\d{5}-?\d{3}/g, replacement: "[CEP]" },
  
  // Email
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL]" },
  
  // Chave Pix (UUID)
  { pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, replacement: "[CHAVE_PIX]" },
  
  // Chave Pix (aleatória 32 chars)
  { pattern: /[a-zA-Z0-9]{32}(?![a-zA-Z0-9])/g, replacement: "[CHAVE_PIX]" },
  
  // RG (padrões comuns)
  { pattern: /\d{2}\.?\d{3}\.?\d{3}[- ]?\d{1}/g, replacement: "[RG]" },
  
  // Cartão de crédito (4 grupos de 4)
  { pattern: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g, replacement: "[CARTAO]" },
  
  // Código de rastreio (Correios)
  { pattern: /[A-Z]{2}\d{9}[A-Z]{2}/g, replacement: "[RASTREIO]" },
];

export function redactPII(text: string): string {
  let redacted = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

export function redactForLog(obj: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['content', 'message', 'text', 'body', 'transcription', 'description'];
  const result = { ...obj };
  
  for (const key of sensitiveKeys) {
    if (typeof result[key] === 'string') {
      result[key] = redactPII(result[key]);
    }
  }
  
  return result;
}
```

### 4.2 Aplicação do redaction

**Em logs do console:**
```typescript
console.log(`AI response for ${conversation_id}:`, redactForLog({ content: aiContent }));
```

**Em summaries de handoff:**
```typescript
// Quando gerar resumo para humano, redactar PII
const safeResume = redactPII(aiGeneratedSummary);
```

**Em métricas/eventos:**
```typescript
// conversation_events.metadata não deve conter PII
await supabase.from("conversation_events").insert({
  // ...
  metadata: redactForLog({ ... }),
});
```

### 4.3 Retenção configurável

```sql
ALTER TABLE ai_support_config ADD COLUMN IF NOT EXISTS
  data_retention_days INTEGER DEFAULT 365,
  redact_pii_in_logs BOOLEAN DEFAULT true;
```

---

## Fase 5: Detecção de Intenção via Tool Calling

### 5.1 Tool de classificação (já proposto, agora com blindagem)

```typescript
const INTENT_TOOL = {
  type: "function",
  function: {
    name: "classify_customer_intent",
    description: "Classifica intenção, sentimento e urgência do cliente ANTES de responder",
    strict: true, // Força schema exato
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["delivery", "payment", "return_exchange", "product_info", "policy", "complaint", "praise", "greeting", "other"]
        },
        sub_intent: {
          type: "string",
          description: "Subcategoria (ex: delivery/delay, payment/failed)"
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative", "aggressive"]
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "critical"]
        },
        requires_action: {
          type: "boolean",
          description: "Cliente está pedindo uma AÇÃO (troca, cancelamento, reembolso)"
        },
        handoff_recommended: {
          type: "boolean",
          description: "Recomenda transferir para humano"
        }
      },
      required: ["intent", "sentiment", "urgency", "requires_action", "handoff_recommended"],
      additionalProperties: false
    }
  }
};
```

### 5.2 Validação no servidor

```typescript
// Validar resposta da tool (não confiar cegamente no modelo)
function validateIntentResult(result: any): IntentResult | null {
  const validIntents = ["delivery", "payment", "return_exchange", "product_info", "policy", "complaint", "praise", "greeting", "other"];
  const validSentiments = ["positive", "neutral", "negative", "aggressive"];
  const validUrgencies = ["low", "medium", "high", "critical"];
  
  if (!validIntents.includes(result.intent)) return null;
  if (!validSentiments.includes(result.sentiment)) return null;
  if (!validUrgencies.includes(result.urgency)) return null;
  if (typeof result.requires_action !== "boolean") return null;
  
  return result as IntentResult;
}

// Se validação falhar, usar heurística simples
if (!validatedResult) {
  validatedResult = {
    intent: "other",
    sentiment: detectSentimentByKeywords(message),
    urgency: "medium",
    requires_action: false,
    handoff_recommended: true, // Na dúvida, handoff
  };
}
```

---

## Fase 6: Metering Expandido

### 6.1 Campos adicionais em tenant_monthly_usage

```sql
ALTER TABLE tenant_monthly_usage ADD COLUMN IF NOT EXISTS
  ai_messages_count INTEGER DEFAULT 0,
  ai_image_analysis_count INTEGER DEFAULT 0,
  ai_audio_transcription_count INTEGER DEFAULT 0,
  ai_audio_duration_seconds INTEGER DEFAULT 0,
  ai_handoff_count INTEGER DEFAULT 0,
  ai_no_evidence_count INTEGER DEFAULT 0,
  ai_embedding_tokens INTEGER DEFAULT 0;
```

### 6.2 RPC para incrementar métricas

```sql
CREATE OR REPLACE FUNCTION increment_ai_metrics(
  p_tenant_id UUID,
  p_messages INTEGER DEFAULT 0,
  p_images INTEGER DEFAULT 0,
  p_audio_count INTEGER DEFAULT 0,
  p_audio_seconds INTEGER DEFAULT 0,
  p_handoffs INTEGER DEFAULT 0,
  p_no_evidence INTEGER DEFAULT 0,
  p_embedding_tokens INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_month TEXT;
BEGIN
  v_year_month := get_current_year_month();
  
  INSERT INTO tenant_monthly_usage (
    tenant_id, year_month,
    ai_messages_count, ai_image_analysis_count,
    ai_audio_transcription_count, ai_audio_duration_seconds,
    ai_handoff_count, ai_no_evidence_count, ai_embedding_tokens
  ) VALUES (
    p_tenant_id, v_year_month,
    p_messages, p_images, p_audio_count, p_audio_seconds,
    p_handoffs, p_no_evidence, p_embedding_tokens
  )
  ON CONFLICT (tenant_id, year_month) DO UPDATE SET
    ai_messages_count = tenant_monthly_usage.ai_messages_count + p_messages,
    ai_image_analysis_count = tenant_monthly_usage.ai_image_analysis_count + p_images,
    ai_audio_transcription_count = tenant_monthly_usage.ai_audio_transcription_count + p_audio_count,
    ai_audio_duration_seconds = tenant_monthly_usage.ai_audio_duration_seconds + p_audio_seconds,
    ai_handoff_count = tenant_monthly_usage.ai_handoff_count + p_handoffs,
    ai_no_evidence_count = tenant_monthly_usage.ai_no_evidence_count + p_no_evidence,
    ai_embedding_tokens = tenant_monthly_usage.ai_embedding_tokens + p_embedding_tokens,
    updated_at = now();
END;
$$;
```

---

## Resumo de Arquivos

### Novas Edge Functions:
| Função | Descrição |
|--------|-----------|
| `ai-generate-embedding` | Gera embeddings via OpenAI |
| `ai-kb-ingest` | Processa docs para chunks + embeddings |
| `ai-support-vision` | Análise de imagens via GPT-5.2 Vision |
| `ai-support-transcribe` | Transcrição via Whisper |
| `ai-media-queue-process` | Processador da fila de mídia |

### Arquivos Modificados:
| Arquivo | Alterações |
|---------|------------|
| `ai-support-chat/index.ts` | +RAG, +no_evidence, +tool calling, +redaction |
| `meta-whatsapp-webhook/index.ts` | +Enfileirar vision/transcription |
| `support-email-inbound/index.ts` | +Enfileirar vision/transcription |
| `_shared/redact-pii.ts` | Novo arquivo utilitário |

### Novas Tabelas:
| Tabela | Descrição |
|--------|-----------|
| `knowledge_base_docs` | Documentos de KB governada |
| `knowledge_base_chunks` | Chunks com embeddings |
| `ai_media_queue` | Fila de processamento multimodal |

### Campos Novos em Tabelas Existentes:
| Tabela | Campos |
|--------|--------|
| `ai_support_config` | `rag_similarity_threshold`, `rag_min_evidence_chunks`, `rag_top_k`, `handoff_on_no_evidence`, `data_retention_days`, `redact_pii_in_logs` |
| `tenant_monthly_usage` | `ai_messages_count`, `ai_image_analysis_count`, `ai_audio_transcription_count`, `ai_audio_duration_seconds`, `ai_handoff_count`, `ai_no_evidence_count`, `ai_embedding_tokens` |

---

## Ordem de Implementação

| Ordem | Fase | Risco | Descrição |
|-------|------|-------|-----------|
| 1 | RAG (pgvector) | Médio | Fundação para tudo |
| 2 | no_evidence + Tool Calling | Baixo | Melhora qualidade imediata |
| 3 | Redaction LGPD | Baixo | Segurança |
| 4 | Fila de Mídia | Médio | Infraestrutura assíncrona |
| 5 | Vision | Médio | Depende da fila |
| 6 | Transcrição | Médio | Depende da fila |
| 7 | Metering Expandido | Baixo | Observabilidade |
| 8 | UI Admin KB | Médio | Governança |

---

## Plano de Testes E2E

### Teste 1: RAG com Evidência
```
Setup: Criar doc de política ativo
Input: "Qual o prazo para troca?"
Expected: Resposta com trecho da política + kb_references populado
```

### Teste 2: RAG sem Evidência (Handoff)
```
Setup: Nenhum doc sobre tema
Input: "Vocês vendem peças de carro?"
Expected: shouldHandoff=true, noEvidence=true, mensagem de escalonamento
```

### Teste 3: Imagem na Fila
```
Input: Mensagem WhatsApp com foto
Expected: 
- message_attachments criado
- ai_media_queue com status='queued', process_type='vision'
- Após processamento: metadata.vision_description preenchido
```

### Teste 4: Áudio na Fila
```
Input: Mensagem de voz 15s
Expected:
- ai_media_queue enfileirado
- Após processamento: transcription preenchido
- Metering: +15 audio_duration_seconds
```

### Teste 5: Redaction
```
Input: "Meu CPF é 123.456.789-00 e email joao@teste.com"
Expected em logs: "[CPF]" e "[EMAIL]" no lugar dos dados
```

### Teste 6: Retry com Backoff
```
Setup: Simular falha na Vision API
Expected:
- Primeira tentativa: failed, attempts=1
- next_retry_at = now + 30s
- Segunda tentativa após retry: done
```
