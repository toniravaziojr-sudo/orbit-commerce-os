# Edge Functions — Regras e Especificações

> **REGRAS FIXAS** — Aplicáveis a TODAS as edge functions do projeto.

---

## ⚠️ VERSIONAMENTO OBRIGATÓRIO (Anti-Regressão)

**REGRA CRÍTICA**: Toda edge function DEVE ter uma constante de versão no topo do arquivo.

```typescript
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Descrição breve da última mudança
// ===========================================================
```

**No início do handler, logar a versão:**
```typescript
console.log(`[function-name][${VERSION}] Request received`);
```

### Checklist de Deploy
1. [ ] Incrementar VERSION
2. [ ] Verificar nomes de colunas no schema atual
3. [ ] Logar erros de insert (não silenciar)
4. [ ] Após deploy, confirmar versão nos logs

---

## Sincronização Schema ↔ Código

### `whatsapp_messages` — Colunas Corretas
```typescript
// ✅ USAR ESTES NOMES:
{
  tenant_id: string,           // UUID obrigatório
  recipient_phone: string,     // NÃO "phone"
  message_type: string,        // "text", "template", etc.
  message_content: string,     // NÃO "message"
  status: string,              // "sent", "failed", "delivered"
  sent_at?: string,
  provider_message_id?: string, // NÃO "external_message_id"
  error_message?: string,
  provider_response?: object,
  notification_id?: string,
  metadata?: object
}

// ❌ COLUNAS INEXISTENTES (causam erro silencioso):
// - phone → usar recipient_phone
// - message → usar message_content
// - direction → removido
// - provider → removido
// - external_message_id → usar provider_message_id
```

### Mapeamento Tabela → Edge Functions
| Tabela | Edge Functions |
|--------|----------------|
| `whatsapp_messages` | `meta-whatsapp-send`, `run-notifications`, `whatsapp-send` |
| `notifications` | `run-notifications`, `process-events` |
| `orders` | `pagarme-webhook`, `mercadopago-webhook` |

**REGRA**: Ao alterar schema de tabela, atualizar TODAS as edge functions listadas.

---

## Regras Gerais

| Regra | Descrição |
|-------|-----------|
| **Erro de negócio** | HTTP 200 + `{ success: false, error: "...", code? }` |
| **CORS** | Completo em TODAS as respostas (OPTIONS + success + error). **Falta de CORS = bug crítico** |
| **Email** | Sempre `normalizeEmail()` (trim + lowercase) |
| **RLS** | Validar SELECT/INSERT/UPDATE/DELETE por tabela antes de dar "done" |

---

## Padrão de Resposta

### Sucesso
```typescript
return new Response(
  JSON.stringify({ success: true, data: result }),
  { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  }
);
```

### Erro de Negócio (NÃO é HTTP 4xx/5xx)
```typescript
return new Response(
  JSON.stringify({ success: false, error: 'Mensagem do erro', code: 'ERROR_CODE' }),
  { 
    status: 200, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  }
);
```

---

## CORS Headers (Obrigatório)

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

---

## Multi-Tenant (Regra Fixa)

- Tudo sempre tenant-scoped
- **Proibido** vazamento de dados/tokens/credenciais entre tenants
- Validar `tenant_id` em TODA operação

---

## Normalização de Email

```typescript
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
```

---

## Checklist Antes de Deploy

- [ ] VERSION incrementada
- [ ] CORS completo
- [ ] Erros de negócio = HTTP 200 + `{ success: false }`
- [ ] Nomes de colunas validados contra schema
- [ ] Emails normalizados
- [ ] Tenant-scoped

---

## Sistema Centralizado de Roteamento IA (ai-router.ts)

### Versão Atual: v1.1.0

### Visão Geral

Todas as edge functions que usam IA utilizam o roteador centralizado `supabase/functions/_shared/ai-router.ts`.

**Prioridade de Provedores:**
1. **Gemini Nativa** (Google AI Studio) — mais barata e rápida
2. **OpenAI Nativa** — fallback secundário
3. **Lovable AI Gateway** — fallback final (sempre disponível)

### Resolução de Credenciais

O roteador busca chaves de API automaticamente:
1. Tabela `platform_credentials` (editável via painel admin `/platform-integrations` → IA)
2. Variáveis de ambiente (fallback)

| Credencial | Provider | Onde Configurar |
|------------|----------|-----------------|
| `GEMINI_API_KEY` | Gemini Nativa | Platform Integrations → IA → Google Gemini |
| `OPENAI_API_KEY` | OpenAI Nativa | Platform Integrations → IA → OpenAI |
| `LOVABLE_API_KEY` | Lovable Gateway | Auto-provisionada (nunca editar) |

### API do Router

```typescript
import { aiChatCompletion, aiChatCompletionJSON, getAIEndpoint, resetAIRouterCache } from "../_shared/ai-router.ts";

// Non-streaming (a maioria das funções)
const { data, provider, model } = await aiChatCompletionJSON(
  "google/gemini-2.5-flash", // modelo solicitado
  { messages, tools, tool_choice },
  { supabaseUrl, supabaseServiceKey, logPrefix: '[minha-funcao]' }
);

// Streaming (chat, assistente)
const endpoint = await getAIEndpoint("google/gemini-2.5-flash", {
  supabaseUrl, supabaseServiceKey
});
const response = await fetch(endpoint.url, {
  method: "POST",
  headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: endpoint.model, messages, stream: true }),
});

// Com fallback completo (tenta todos os provedores)
const response = await aiChatCompletion("google/gemini-2.5-flash", { messages }, {
  supabaseUrl, supabaseServiceKey, logPrefix: '[minha-funcao]'
});
```

### Mapeamento de Modelos

> **REGRA (v1.1.0):** O fallback OpenAI DEVE usar modelos de qualidade equivalente ao primário. Apenas modelos intencionalmente leves (`gpt-5-nano`, `gemini-2.5-flash-lite`) mapeiam para `gpt-4o-mini`. Todos os demais mapeiam para `gpt-4o`. O default (modelo não mapeado) também é `gpt-4o`.

| Modelo Solicitado | → Gemini Nativo | → OpenAI Nativo |
|-------------------|-----------------|-----------------|
| `google/gemini-2.5-flash` | `gemini-2.5-flash` | `gpt-4o` |
| `google/gemini-2.5-flash-lite` | `gemini-2.5-flash` | `gpt-4o-mini` |
| `google/gemini-2.5-pro` | `gemini-2.5-pro` | `gpt-4o` |
| `google/gemini-3-flash-preview` | `gemini-2.5-flash` | `gpt-4o` |
| `google/gemini-3-pro-preview` | `gemini-2.5-pro` | `gpt-4o` |
| `openai/gpt-5` | `gemini-2.5-pro` | `gpt-4o` |
| `openai/gpt-5-mini` | `gemini-2.5-flash` | `gpt-4o` |
| `openai/gpt-5-nano` | `gemini-2.5-flash` | `gpt-4o-mini` |
| `openai/gpt-5.2` | `gemini-2.5-pro` | `gpt-4o` |
| *(não mapeado)* | `gemini-2.5-flash` | `gpt-4o` |

### Opções de Preferência

```typescript
// Forçar provedor específico como primário
await aiChatCompletionJSON(model, body, { preferProvider: 'openai' }); // OpenAI → Gemini → Lovable
await aiChatCompletionJSON(model, body, { preferProvider: 'gemini' }); // Gemini → OpenAI → Lovable
await aiChatCompletionJSON(model, body, { preferProvider: 'lovable' }); // Apenas Lovable
```

### Funções Migradas (22+)

| Categoria | Funções |
|-----------|---------|
| SEO & Conteúdo | `generate-seo`, `ai-product-description`, `classify-content`, `import-institutional-pages` |
| Reviews | `generate-reviews` |
| Mídia & Criativos | `media-generate-copys`, `media-generate-suggestions`, `media-video-generate`, `creative-video-generate` |
| Ads Autopilot | `ads-autopilot-analyze`, `ads-autopilot-creative-generate`, `ads-autopilot-guardian`, `ads-autopilot-experiments-run`, `ads-autopilot-generate-prompt`, `ads-autopilot-weekly-insights`, `ads-autopilot-strategist` |
| Chat & Assistentes | `ads-chat`, `command-assistant-chat` |
| Landing Pages | `ai-landing-page-generate` |
| Análise | `ai-analyze-page`, `ai-memory-manager` |
| Shared | `_shared/ai-marketing-optimizer.ts`, `_shared/ai-content-creator.ts` |

### Comportamento de Fallback com Rate Limit Queue (v1.1.0)

```
Request → Gemini (GEMINI_API_KEY disponível?)
  ├─ ✅ OK → Retorna resposta
  ├─ ❌ 429 → Aguarda (Retry-After ou backoff exponencial 5s/10s/20s) → Retenta até 3x
  │    └─ Ainda 429 após 3 retries → Tenta próximo provedor
  ├─ ❌ 402/erro → Tenta próximo provedor (sem retry)
  ↓
Request → OpenAI (OPENAI_API_KEY disponível?)
  ├─ ✅ OK → Retorna resposta
  ├─ ❌ 429 → Aguarda + retenta até 3x → Tenta próximo
  ├─ ❌ 402/erro → Tenta próximo
  ↓
Request → Lovable Gateway (LOVABLE_API_KEY sempre disponível)
  ├─ ✅ OK → Retorna resposta
  └─ ❌ → HTTP 502 "Todos os provedores falharam"
```

**Parâmetros configuráveis:**
| Parâmetro | Default | Descrição |
|-----------|---------|-----------|
| `maxRetries` | 3 | Retries por provedor ao receber 429 |
| `baseDelayMs` | 5000 | Delay base (5s). Backoff: 5s → 10s → 20s |

**Importante:** O sistema respeita o header `Retry-After` do provedor quando disponível. Se não houver header, usa backoff exponencial (base × 2^attempt).

### Checklist para Novas Funções

- [ ] Importar `aiChatCompletion` ou `aiChatCompletionJSON` de `../_shared/ai-router.ts`
- [ ] Chamar `resetAIRouterCache()` no início do handler (se múltiplas chamadas IA)
- [ ] Usar `logPrefix` descritivo para debugging
- [ ] **NÃO** fazer `fetch` direto para provedores de IA
- [ ] **NÃO** importar `LOVABLE_API_KEY` diretamente (o router resolve)

---

## OpenAI API — Parâmetros por Modelo (Referência)

| Modelo | Parâmetro de Tokens | Temperature |
|--------|---------------------|-------------|
| `gpt-4o`, `gpt-4-turbo` | `max_tokens` | `0-2` |
| `gpt-5`, `gpt-5.2` | `max_completion_tokens` | `0-2` |
| `gpt-5-mini`, `gpt-5-nano` | `max_completion_tokens` | `1` (fixo!) |

> **Nota:** O `ai-router.ts` lida automaticamente com a conversão de parâmetros entre OpenAI e Gemini.

### Fallback entre Modelos (Legado)

> ⚠️ Este padrão é **legado**. Novas funções devem usar `aiChatCompletion()` que já faz fallback automático.

```typescript
// ✅ CORRETO: Armazenar erro antes de tentar próximo modelo
let lastErrorText = "";
for (const modelToTry of modelsToTry) {
  response = await fetch(...);
  if (response.ok) break;
  
  lastErrorText = await response.text(); // Ler apenas uma vez
  response = null; // Resetar para próximo modelo
}

// ❌ ERRADO: Causa "Body already consumed"
// await response.text() // Primeira vez
// await response.text() // ERRO!
```

---

## AI Landing Page Generator (`ai-landing-page-generate`)

### Versão Atual: v1.2.0

### Visão Geral
Edge function para geração de landing pages via IA usando Lovable AI Gateway (Gemini 2.5 Flash).

### Rotas no Frontend
| Tipo | Rota | Descrição |
|------|------|-----------|
| Admin | `/landing-pages` | Listagem e gerenciamento |
| Admin | `/landing-pages/:id` | Editor com chat IA |
| Público | `/ai-lp/:slug` | Renderização da LP publicada (standalone) |

**IMPORTANTE**: 
- A rota `/ai-lp/` é standalone, fora do `StorefrontLayout`, para renderizar HTML puro
- O componente `StorefrontAILandingPage` resolve o tenant automaticamente pelo hostname (domínio customizado ou subdomínio da plataforma)

### Fluxo de Resolução de Tenant (StorefrontAILandingPage)
1. Verifica se há `tenantSlug` na URL (rota `/store/:tenantSlug/ai-lp/:lpSlug`)
2. Se for subdomínio da plataforma (`tenant.shops.comandocentral.com.br`), extrai o slug
3. Se for domínio customizado, busca na tabela `tenant_domains`

### Campos do Produto Coletados
```typescript
// Dados buscados da tabela products:
{
  id, name, slug, sku,
  description, short_description,
  price, compare_at_price, cost_price,
  brand, vendor, product_type, tags,
  weight, width, height, depth,
  seo_title, seo_description
}

// Imagens da tabela product_images:
{
  product_id, url, is_primary, alt_text, position
}
```

### Regras do Prompt da IA (CRÍTICAS!)
1. **URL de Referência** = APENAS inspiração visual/estrutural
   - ❌ NÃO copiar conteúdo, textos ou produtos
   - ✅ Copiar layout, cores, tipografia, estrutura
2. **Produtos** = Usar EXCLUSIVAMENTE os selecionados
   - ⚠️ SEMPRE buscar `product_ids` salvos na landing page (mesmo em adjustments)
   - Todas as imagens DEVEM ser usadas no HTML (`<img src="URL-REAL">`)
   - ❌ NUNCA usar placeholder.com ou imagens genéricas
   - Preços, nomes e descrições devem ser exatos
3. **Output** = HTML completo com `<!DOCTYPE html>`
   - CSS inline ou em `<style>`
   - Responsivo e otimizado para conversão

### Comportamento Importante
- Em ajustes (`promptType: 'adjustment'`), a função SEMPRE busca `product_ids` e `reference_url` salvos na landing page
- Isso garante que edições subsequentes mantenham os produtos originais

### Mapeamento Tabela → Edge Function
| Tabela | Edge Function |
|--------|---------------|
| `ai_landing_pages` | `ai-landing-page-generate` |
| `ai_landing_page_versions` | `ai-landing-page-generate` |
| `products` | `ai-landing-page-generate` |
| `product_images` | `ai-landing-page-generate` |
| `store_settings` | `ai-landing-page-generate` |

---

## AI Ads Autopilot (`ads-autopilot-analyze`)

### Versão Atual: v5.12.7

### v5.12.7:Fix Audiences + Copy Obrigatório + Asset Persistence
- **Audience Fetching Fix**: Busca de Custom Audiences agora usa `ads_autopilot_account_configs` como fonte primária de `ad_account_id`, em vez de depender de campanhas existentes (que podem estar vazias após cleanup). Fallback para campanhas ativas mantido como secundário.
- **Copy/Headline Required**: Parâmetros `headline` e `primary_text` agora são `required` nas tool definitions de `create_campaign` e `generate_creative`. A IA é forçada a gerar copy real em vez de deixar `null`.
- **Asset Copy Propagation**: `generate_creative` agora propaga `copy_text`, `headline` e `cta` para o pipeline `ads-autopilot-creative`, que persiste esses campos em `ads_creative_assets`. Antes, apenas a imagem era salva.
- **System Prompt**: Atualizado para priorizar `custom_audience_id` quando audiences salvas existem e proibir broad targeting quando há Custom Audiences disponíveis.

### v5.12.4: Guards Programáticos + Controle de Concorrência por Conta
- **Account Lock por conta**: Implementado `lock_session_id` + `lock_expires_at` em `ads_autopilot_account_configs`. Antes de iniciar sessão, adquire lock (validade 10 min). Sessões concorrentes para o mesmo `ad_account_id` são rejeitadas. Lock liberado ao final (sucesso ou falha).
- **Budget Guard**: Soma todos os orçamentos diários de campanhas IA ativas (`[AI]` no nome) e rejeita criação se ultrapassar `acctConfig.budget_cents`. Override possível via artefato `user_command` com `override=true` e status `confirmed`.
- **Targeting Guard**: Rejeita campanhas de remarketing (BOF/MOF) sem `custom_audiences`. Campanhas TOF sem interesses ou Lookalikes são marcadas como `pending_approval`.
- **Copy Guard**: Bloqueia anúncios com `copy_text` ausente ou que usem templates fallback genéricos (ex: `Conheça [Produto]!`). Status: `pending_creatives`.
- **Artifacts Gate**: Publicação na Meta bloqueada se artefatos `strategy`, `copy` e `campaign_plan` não estiverem com status `ready` na tabela `ads_autopilot_artifacts`.
- **First Activation Rule**: `trigger_type=first_activation` força `needsApproval=true` para TODAS as ações de criação, independente do `human_approval_mode`.
- **Novas colunas**: `ads_autopilot_account_configs` ganhou `lock_session_id` (text) e `lock_expires_at` (timestamptz).

### v5.12.3: Fallback `image_url` para Upload de Criativos (Standard Access)
- **Problema**: O endpoint `/adimages` da Meta exige Advanced Access na permissão `ads_management`. Com Standard Access, retorna erro `(#3) Application does not have the capability`.
- **Solução**: Implementado fallback automático em `ads-autopilot-analyze` (v5.12.3) e `ads-chat` (v5.11.4):
  1. Tenta upload via `POST /adimages` (método padrão → retorna `image_hash`)
  2. Se falhar, usa campo `picture` no `link_data` do `object_story_spec` (a Meta baixa a imagem da URL)
  3. Se **ambos** falharem, aí sim marca `media_blocked=true`
- **Campo usado**: `link_data.picture` (com `object_story_spec`) ou `image_url` (sem page_id)
- **Validação Graph API**: Quando usado fallback, `expected_image_hash` é salvo como `null` (não há hash para comparar)
- **⚠️ TEMPORÁRIO**: Este fallback será removido quando a permissão `ads_management` for aprovada com Advanced Access. Com Advanced Access, o upload via `/adimages` + `image_hash` é o método preferido (mais confiável, imagem permanente nos servidores da Meta).

### v5.11.2: Pipeline Orientado a Processo + Integridade Operacional
- **Nova tabela `ads_autopilot_artifacts`**: Persiste cada etapa do pipeline por campanha planejada (`campaign_key`). Tipos: `strategy`, `copy`, `creative_prompt`, `campaign_plan`, `user_command`. Status: `draft` → `ready` / `failed` / `awaiting_confirmation` / `confirmed`. UPSERT por `(tenant_id, campaign_key, artifact_type)`.
- **PAUSED-first (OBRIGATÓRIO)**: Campanhas e AdSets SEMPRE criados como `PAUSED`, independente de `isAutoMode`. Ativação (`ACTIVE` + `start_time`) só ocorre APÓS ad criado e validado via Graph API GET.
- **Rollback defensivo**: Se `campaign_id` criado mas `ad_id` não: pausa campanha automaticamente, grava `rollback_data` com `reason=no_ad_created`.
- **Produto por funil (genérico)**: TOF = menor preço (entrada/experimentação). BOF/MOF/Remarketing = maior preço (kits/bundles). Regra determinística por preço, sem hardcode de marca/produto.
- **Artefatos persistidos**: `strategy`, `copy`, `creative_prompt`, `campaign_plan` salvos em `ads_autopilot_artifacts` por `campaign_key` antes de publicar na Meta. Publicação bloqueada se qualquer artefato estiver faltando/failed.
- **`config_snapshot`**: `budget_cents`, `funnel_splits`, `strategy_mode`, `human_approval_mode` gravados em `action_data` de cada `create_campaign`.
- **Insights legíveis**: Prompt atualizado (max 4 frases, sem IDs, R$) + sanitização server-side (regex `/\b120\d{12,}\b/g` → `[campanha]`, limite 500 chars).
- **Regra de produto por funil no system prompt**: Genérica, sem hardcode de loja.

### v5.11.0: Pipeline de Criativos Determinístico + Integridade Operacional
- **Seleção determinística de criativos**: Substituído fallback cego (`existingAds?.[0]?.creative_id`) por seleção em 2 níveis:
  - **Nível 1 (Ready)**: Assets IA com `status='ready'`, `asset_url IS NOT NULL`, filtrados por `funnel_stage` compatível e `id NOT IN used_asset_ids`. Bloqueado quando `media_blocked=true`
  - **Nível 2 (Published)**: Assets com `platform_adcreative_id IS NOT NULL`, filtrados por `funnel_stage` e `platform_adcreative_id NOT IN used_adcreative_ids`. Funciona mesmo com `media_blocked=true`
  - Se nenhum compatível: status `pending_creatives` (NÃO cria campanha sem criativo)
- **Classificação de funil**: Helper `classifyCampaignFunnel()` classifica campanhas Meta existentes por estágio (TOF/MOF/BOF/Test/Leads) baseado no nome e objetivo. Enriquece contexto antes do prompt
- **Estado persistente por sessão**: `used_asset_ids`, `used_adcreative_ids`, `media_blocked`, `strategy_run_id` carregados/persistidos na tabela `ads_autopilot_sessions` (não mais em memória)
- **Update atômico com dedup**: Append de IDs usados via RPC `append_jsonb_array_dedup` ou fallback SQL direto, evitando lost updates e duplicatas em retries
- **Pós-condições estritas**: `actionRecord.status = "executed"` APENAS quando `campaign_id + adset_id + ad_id` verificados via Graph API GET. Sem `ad_id` = `pending_creatives`, sem `adset_id` = `partial_failed`, sem nenhum = `failed`
- **Validação Graph API GET**: Após criar ad, confirma existência e verifica mídia (`image_hash`, `video_id` ou `child_attachments`). Compara com `expected_image_hash`/`expected_video_id`. Mismatch = `partial_failed`
- **Gravar `platform_adcreative_id`**: Separado de `platform_ad_id` — agora grava o ID real do AdCreative no campo correto
- **Idempotency v2**: `action_hash` inclui `strategy_run_id` + `batch_index` (contador sequencial por combinação action_type+product_id+funnel_stage+template). Conflito UNIQUE = noop
- **Detecção de erro de mídia**: Ao detectar falha de upload, persiste `media_blocked=true` + razão. Bloqueia Nível 1 (upload) mas NÃO Nível 2 (published)
- **Regra `creative_test`**: Campanhas de teste buscam APENAS assets com `session_id` igual ao da sessão atual
- **System prompt com regras de criativos**: Unicidade por sessão, `generate_creative` antes de `create_campaign`, TOF≠BOF, identificar funil antes de decidir
- **Novas colunas**: `ads_creative_assets` ganhou `funnel_stage`, `platform_adcreative_id`, `expected_image_hash`, `expected_video_id`. `ads_autopilot_sessions` ganhou `used_asset_ids`, `used_adcreative_ids`, `media_blocked`, `media_block_reason`, `strategy_run_id`
- **Logs enriquecidos**: `action_data` inclui `selected_asset_id`, `selected_platform_adcreative_id`, `funnel_stage`, `strategy_run_id`, `expected_*`, `graph_validation_result`

### v5.9.1: Fix rejeição de ações vindas do Chat + generate_creative
- **Bug crítico**: `trigger_type: "manual"` (disparado pelo Chat AI) NÃO tinha bypass de data sufficiency. Resultado: TODAS as ações planejadas pelo Chat eram rejeitadas com "Dados insuficientes (1 dias). Mínimo: 3 dias."
- **Fix**: `manual` agora recebe o mesmo tratamento que `first_activation` — bypass completo de data sufficiency, limites de budget por ciclo e restrições de fase
- **generate_creative isento**: `generate_creative` é ação de PREPARAÇÃO (sem risco financeiro), agora NUNCA é bloqueada por data sufficiency independente do trigger_type
- **Budget**: Triggers manuais agora permitem alterações de budget maiores (até +20% por campanha em vez de ±10%)

### Visão Geral
Edge Function autônoma de gestão de tráfego pago multi-canal (Meta, Google, TikTok). Opera como media buyer sênior com pipeline de 5 etapas, camada de segurança determinística, **conhecimento específico por plataforma**, **metas de ROAS por canal definidas pelo usuário**, **planejamento estratégico completo** e **janela de publicação 00:01-04:00 BRT**.

### Agendamento
- **Cron**: `0 */6 * * *` (a cada 6 horas — 4 ciclos/dia)
- **Gatilho**: `scheduled` (automático) ou `manual` (botão na UI)
- A IA **não altera campanhas em todos os ciclos** — só age quando KPIs indicam necessidade

### Pipeline de 5 Etapas
1. **Pre-check**: Validação de tokens/conexões por canal
2. **Context Collector**: Coleta de métricas 7d + 7d anterior, produtos top 20, pedidos 30d, alertas de estoque, Custom Audiences
3. **Allocator**: Split orçamentário cross-channel baseado em ROAS marginal e tendências
4. **Planner**: Planejamento estratégico + decisões por campanha via tool calling com **conhecimento específico da plataforma**
5. **Policy & Constraints**: Validação determinística com **limites de budget por plataforma**

### Planejamento Estratégico (v5.2.0 — OBRIGATÓRIO)
A IA segue um fluxo de planejamento antes de qualquer ação:
1. **Diagnóstico**: Analisa todas as campanhas ativas, identifica vencedoras e perdedoras
2. **Redistribuição**: Calcula orçamento desperdiçado e realoca para campanhas vencedoras
3. **Criação**: Se o orçamento definido não está investido:
   - Define campanhas a criar (objetivo, público, funil)
   - Distribui orçamento estrategicamente
   - Cria públicos (Lookalikes) quando necessário
   - Gera criativos via IA quando indisponíveis
4. **Execução**: Pausas → Redistribuições → Criações (ordem obrigatória)
5. **Garantia**: O orçamento TOTAL definido DEVE estar sempre investido — verba ociosa é proibida

### Janela de Publicação e Ajustes (00:01-04:00 BRT) — v5.2.0
| Tipo de Ação | Comportamento |
|-------------|--------------|
| **Pausa de campanha** | Execução IMEDIATA |
| **Ajuste de orçamento** | AGENDADO para 00:01-04:00 BRT |
| **Nova campanha** | Criada com status PAUSED, ativação AGENDADA para 00:01-04:00 BRT |
| **Novo ad set** | Criado com status PAUSED, ativado junto com a campanha |
| **Novo ad** | Criado com status PAUSED, ativado junto com a campanha |
| **Lookalike audience** | Criação IMEDIATA (precisa de ~1h para ficar pronto) |
| **Geração de criativo** | IMEDIATA (assíncrona) |

A janela existe para respeitar o início do dia fiscal das plataformas de anúncios. Ações são distribuídas aleatoriamente dentro da janela para evitar picos.

### Métricas Pré-calculadas (por canal)
| Métrica | Descrição |
|---------|-----------|
| `real_cpa_cents` | Custo real por aquisição (spend / conversions) |
| `real_roas` | ROAS real (revenue / spend) |
| `avg_cpc_cents` | Custo por clique médio |
| `avg_cpm_cents` | Custo por mil impressões |
| `avg_ctr_pct` | Taxa de cliques |
| `days_with_data` | Dias com dados na janela |

### Comparação de Tendências (7d vs 7d anterior)
Calcula deltas percentuais para: spend, impressions, clicks, conversions, CPA, ROAS, CTR.
Classifica tendência como `improving`, `declining` ou `stable`.

### Metas de ROI por Canal (v3.1.0)
**IMPORTANTE**: O objetivo é sempre **VENDAS** (e-commerce). As metas de ROI são definidas **pelo usuário por canal**, pois cada negócio tem margens diferentes por plataforma. Armazenadas em `ads_autopilot_configs.safety_rules` de cada canal (não global).

ROI = Retorno sobre Investimento. Ex: ROI 2 = R$2 de retorno para cada R$1 investido em anúncios.

| Campo | Default | Descrição |
|-------|---------|-----------|
| `min_roi_cold` | 2 | ROI mínimo para público frio — abaixo disso, pausar campanha |
| `min_roi_warm` | 3 | ROI mínimo para público quente (remarketing) — abaixo disso, pausar campanha |

**UI**: Componente `AdsChannelRoasConfig` em cada aba de canal (Meta, Google, TikTok) exibe:
- Toggle de ativação da IA **por canal** (não global)
- Botão "Executar Análise" por canal
- Config de ROI mínimo para pausar (frio e quente)
- Salvas em `safety_rules` da config do canal correspondente.

**Config Global** (`AdsGlobalConfig`): Apenas orçamento total, margem bruta, CPA máximo e prompt de direcionamento. Sem seletor de objetivo (sempre vendas).

### Regras de Segurança (Safety Rules — Globais)
| Regra | Default | Descrição |
|-------|---------|-----------|
| `max_budget_change_pct_day` | 10% | Máximo genérico (sobreescrito por regra da plataforma) |
| `max_actions_per_session` | 10 | Limite de ações por ciclo de análise |
| `min_data_days_for_action` | 3 | Dias mínimos de dados para executar ações |
| `ramp_up_max_pct` | 10% | Aumento acima disso requer confidence ≥ 0.7 |
| `max_new_campaigns_per_day` | 2 | Limite de campanhas novas criadas por dia |
| `gross_margin_pct` | 50% | Margem bruta para cálculo do CPA máximo |
| `scheduling_window_start_hour` | 0 | Início da janela de publicação (00:01 BRT) |
| `scheduling_window_end_hour` | 4 | Fim da janela de publicação (04:00 BRT) |

### Limites de Budget por Plataforma
| Plataforma | Máx. por ciclo (6h) | Regra da plataforma | Learning Phase |
|------------|---------------------|---------------------|----------------|
| **Meta** | ±10% | ±20% a cada 48h | ~50 conversões em 7 dias |
| **Google** | ±15% | ±30% a cada 48-72h | ~30 conversões em 14 dias |
| **TikTok** | ±7% | ±15% a cada 48h | ~50 conversões em 7 dias |

### Conhecimento de Audiência e Gestão de Públicos (v5.1.0)

#### Tipos de Audiência / Splits de Funil
As chaves de split salvas pela UI são: `cold`, `remarketing`, `tests`, `leads`.

| Chave UI | Conceito | Descrição | CPA esperado | Budget recomendado |
|----------|----------|-----------|-------------|-------------------|
| `cold` | **Público Frio (TOF)** | Lookalike, interesses, broad | 1.5x-3x maior | 60-70% (Meta), 50-60% (Google), 70-80% (TikTok) |
| `remarketing` | **Público Quente (MOF+BOF)** | Visitantes, engajadores, carrinhos | Menor, ROAS alto | 20-30% |
| `tests` | **Testes de Criativos** | Budget reservado para testar novos criativos/ângulos | Variável | 5-15% |
| `leads` | **Captação de Leads** | Campanhas de captação/formulários | Depende do objetivo | 0-10% |

> ⚠️ **IMPORTANTE**: As edge functions DEVEM usar as chaves `cold`, `remarketing`, `tests`, `leads` (não `tof`, `mof`, `bof`).

#### Gestão de Públicos (v5.1.0)
A IA pode criar e gerenciar públicos automaticamente:
- **Custom Audiences**: Busca automaticamente públicos salvos (Lookalikes, Website Visitors, Engagers) via Meta API
- **Lookalike Audiences**: Cria novos Lookalikes via `create_lookalike_audience` (ratios 1%-20%) quando há Custom Audiences com dados suficientes
- **Interest Targeting**: Define interesses específicos (ex: Cosmetics, Fashion) via `flexible_spec` para segmentação detalhada
- **Broad Targeting**: Fallback (Brasil, 18-65) quando nenhum público específico está disponível
- **Prioridade de seleção**: Custom Audiences > Interesses > Broad

#### Orçamento × Tamanho de Público
| Plataforma | Audiência < 10k | Audiência 10k-100k | Audiência > 100k |
|------------|----------------|-------------------|-----------------|
| **Meta** | Máx R$15/dia | R$15-50/dia | Sem limite rígido |
| **Google** | CPC × estimativa cliques | — | — |
| **TikTok** | Prefere > 500k broad | R$30-50/dia mín | Sem limite rígido |

### Investimento Inicial Mínimo por Plataforma
| Plataforma | Conversão | Tráfego | Reconhecimento |
|------------|-----------|---------|----------------|
| **Meta** | R$30/dia (10x CPA) | R$20/dia | R$15/dia |
| **Google Search** | R$30/dia | — | — |
| **Google Shopping/PMax** | R$50/dia | — | — |
| **TikTok** | R$50/dia | R$30/dia | — |

### Critérios de Pausa por Plataforma

**IMPORTANTE**: Os critérios de ROI mínimo (`min_roi_cold`/`min_roi_warm`) aplicam-se **SOMENTE a campanhas com objetivo de CONVERSÃO/VENDAS**. Campanhas com outros objetivos (tráfego, engajamento, alcance, visualizações de vídeo, etc.) NÃO devem ser pausadas por ROI — usam métricas próprias do objetivo (CPC, CPM, CTR, CPV, etc.).

#### Campanhas de Conversão/Vendas
| Plataforma | Critério de pausa |
|------------|-------------------|
| **Meta** | CPA > 2x alvo por 3+ dias (pós-learning), ROI < `min_roi_cold`/`min_roi_warm` do canal por 5d, Freq > 3.0, CTR < 0.5% |
| **Google Search** | CPA > 2x alvo por 7+ dias com 30+ cliques |
| **Google Shopping** | ROI < `min_roi_cold` do canal por 7+ dias |
| **TikTok** | CPA > 2.5x alvo por 5+ dias (pós-learning), CTR < 0.3%, NÃO pausar com < 7 dias |

#### Campanhas de Tráfego/Engajamento/Outros Objetivos
| Plataforma | Critério de pausa |
|------------|-------------------|
| **Meta** | CPC > 3x média do setor por 5+ dias, CTR < 0.3%, Freq > 4.0 |
| **Google** | CPC > 3x média por 7+ dias, CTR < 1% com 50+ impressões/dia |
| **TikTok** | CPV > 2x média por 5+ dias, CTR < 0.2%, NÃO pausar com < 7 dias |

> A IA pode criar campanhas de tráfego, engajamento ou alcance como parte da estratégia de funil (TOF), mas a **métrica final de sucesso do sistema é sempre o ROI das campanhas de conversão**.

### Ferramentas Disponíveis (Tool Calling)
| Ferramenta | Descrição | Fase |
|-----------|-----------|------|
| `pause_campaign` | Pausa campanha (execução imediata) | 1 |
| `adjust_budget` | Ajusta orçamento (agendado 00:01-04:00) | 1 |
| `report_insight` | Gera insight/diagnóstico | 1 |
| `allocate_budget` | Redistribui budget cross-channel | 1 |
| `create_campaign` | Cria campanha completa (Campaign→AdSet→Ad) com agendamento | 2 |
| `create_adset` | Cria ad set com targeting inteligente | 2 |
| `create_lookalike_audience` | Cria Lookalike audience via Meta API | 2 |
| `generate_creative` | Gera criativos de imagem via IA | 3 |

### Execução de `create_campaign` (v5.2.0)
1. Campanha criada **sempre PAUSED** via `meta-ads-campaigns` (action: create)
2. Ad Set criado **PAUSED** com targeting inteligente (Custom Audiences > Interests > Broad)
3. Ad criado **PAUSED** com criativo existente OU geração automática via IA
4. **Ativação agendada** para janela 00:01-04:00 BRT (action_type: `activate_campaign`)
5. No modo `approve_high_impact`, criação requer aprovação manual na aba Ações
6. Mapeamento: `conversions`→`OUTCOME_SALES`, `traffic`→`OUTCOME_TRAFFIC`, `awareness`→`OUTCOME_AWARENESS`, `leads`→`OUTCOME_LEADS`

### Checklist do Planner (7 pontos obrigatórios)
1. **Learning Phase** — A campanha está em aprendizado? Se sim, apenas report_insight
2. **Tipo de Audiência** — Público frio vs quente (CPA relativo, não absoluto)
3. **Eficiência (CPA)** — CPA vs teto de margem (contextualizado por tipo de público)
4. **Retorno (ROI)** — Acima ou abaixo do `min_roi_cold`/`min_roi_warm` configurado **para o canal específico**
5. **Engajamento (CTR/Frequência)** — Fadiga criativa, saturação
6. **Escala** — Potencial de aumento respeitando limites da plataforma
7. **Inventário** — Produtos com estoque ≤ 5 unidades

### Mecanismos de Integridade
- **Session Locking**: Impede execuções concorrentes (`lock_session_id`)
- **Idempotência**: `action_hash` único por ação
- **Rollback**: `rollback_data` salvo para todas as ações executadas
- **CPA Ceiling**: Bloqueia aumento de budget se CPA > margem
- **Ramp-up Logic**: Aumentos acima do ramp_up_max_pct exigem confidence ≥ 0.7
- **Platform-specific limits**: Policy layer aplica limite de budget por plataforma (Meta ±10%/ciclo, Google ±15%, TikTok ±7%)
- **Scheduling Window**: Novas campanhas e ajustes de budget só ativam entre 00:01-04:00 BRT

### Mapeamento Tabela → Edge Function
| Tabela | Edge Function |
|--------|---------------|
| `ads_autopilot_configs` | `ads-autopilot-analyze` |
| `ads_autopilot_account_configs` | `ads-autopilot-analyze` |
| `ads_autopilot_sessions` | `ads-autopilot-analyze` |
| `ads_autopilot_actions` | `ads-autopilot-analyze` |
| `ads_autopilot_insights` | `ads-autopilot-analyze` |
| `meta_ad_campaigns` | `ads-autopilot-analyze` |
| `meta_ad_adsets` | `ads-autopilot-analyze` |
| `meta_ad_ads` | `ads-autopilot-analyze` |
| `meta_ad_audiences` | `ads-autopilot-analyze` |
| `meta_ad_insights` | `ads-autopilot-analyze` |
| `google_ad_campaigns` | `ads-autopilot-analyze` |
| `google_ad_insights` | `ads-autopilot-analyze` |
| `tiktok_ad_campaigns` | `ads-autopilot-analyze` |
| `tiktok_ad_insights` | `ads-autopilot-analyze` |
| `products` | `ads-autopilot-analyze` |
| `orders` | `ads-autopilot-analyze` |
| `ads_creative_assets` | `ads-autopilot-analyze`, `ads-chat` |

---

## AI Ads Chat (`ads-chat`)

### Versão Atual: v5.11.3

### v5.11.0: Pipeline de Criativos + Propagação de Funil + Strategy Run ID
- **Propagação de `funnel_stage`**: `generateCreativeImage` aceita e normaliza `funnel_stage` (valores válidos: `tof`, `mof`, `bof`, `test`, `leads`). Propaga para `ads-autopilot-creative` junto com `session_id`
- **Seleção determinística em `createMetaCampaign`**: Mesma lógica de 2 níveis do analyze:
  - Nível 1 (Ready): Assets com `status='ready'`, `funnel_stage` compatível, `id NOT IN used_asset_ids`
  - Nível 2 (Published): Assets com `platform_adcreative_id IS NOT NULL`, `funnel_stage` compatível, `platform_adcreative_id NOT IN used_adcreative_ids`
  - Sem criativo compatível = erro claro (não cria campanha)
- **`strategy_run_id` no chat**: Gerado no primeiro round de cada interação, reutilizado em "continuar", propagado para todas as tools de escrita via `executeTool`
- **Persistência atômica**: Após uso de criativo, append atômico com dedup em `used_asset_ids`/`used_adcreative_ids` da sessão
- **System prompt atualizado**: Regras de criativos injetadas — unicidade por sessão, proibido criar campanha sem criativo compatível, proibido gerar+criar no mesmo round
- **Tool `generate_creative_image` atualizada**: Novo parâmetro `funnel_stage` na definição da ferramenta

### v5.9.8: Fix matching de produto + autonomia + preview de imagens + nome exato
- **Matching de produto por nome exato**: Substituído `.includes()` por algoritmo de 3 níveis (exact → startsWith → shortest includes → fallback primeiro produto). Aplicado em `generateCreativeImage` e `createMetaCampaign`. Resolve ambiguidade entre variantes como "Kit Banho Calvície Zero" vs "Kit Banho Calvície Zero (2x) Noite"
- **Autonomia da IA (sem pedir "continuar")**: A IA agora usa rounds internos (1-5) automaticamente para completar todo o plano. A pausa para pedir "continuar" só existe se o próprio lojista solicitar acompanhamento passo-a-passo (ex: "me avise quando terminar cada etapa"). Fora isso, execução autônoma e contínua entre rounds
- **Instrução de nome exato no prompt**: Nova regra no system prompt: "Ao chamar generate_creative_image ou create_meta_campaign, use o nome EXATO do produto conforme listado no catálogo. NÃO abrevie, NÃO generalize"
- **Preview de imagens no ActionDetailDialog**: Quando `creative_job_id` presente mas sem `asset_url`, o componente agora busca `creative_jobs.output_urls` e exibe as imagens prontas. Auto-refresh a cada 5s enquanto o job está em processamento. Exibe estado de erro se o job falhou

### v5.3.6: Fix colunas erradas em createCustomAudience/createLookalikeAudience
- **Bug crítico**: Insert usava `audience_id` mas coluna real é `meta_audience_id`. Insert falhava silenciosamente → públicos criados no Meta nunca eram salvos no banco local
- **Coluna inexistente**: Removido `status: "creating"` (coluna não existe na tabela `meta_ad_audiences`)
- **Coluna inexistente**: Removido `approximate_count: 0` do insert (campo é populado apenas pelo sync)
- **Logging**: Erros de insert agora são logados explicitamente em vez de silenciados com `.catch()`

### v5.3.5: Fix Audiences + Creatives invisíveis
- **getAudiences auto-sync**: Se `meta_ad_audiences` estiver vazia, faz sync inline (aguarda resultado) antes de retornar. Resolve o "Bloqueio de Públicos" — dezenas de públicos existiam no Meta mas nunca foram sincronizados para o banco local
- **getCreativeAssets inclui meta_ad_creatives**: Agora consulta AMBAS as tabelas (`ads_creative_assets` para criativos internos + `meta_ad_creatives` para 197 criativos reais sincronizados do Meta). Resolve o "Galeria Vazia" falso
- **meta-ads-audiences fix**: Removido campo `approximate_count` (inexistente na Graph API v21.0), removidos `rule`/`lookalike_spec` (causavam erro "reduce data"), adicionada paginação automática. Resultado: **71 públicos sincronizados com sucesso**

### v5.3.4: Fix Coluna `position` → `sort_order` em product_images
- **Bug fix crítico**: Queries em `getProducts` e `collectBaseContext` usavam `.order("position")` mas a coluna real é `sort_order`. Erro silencioso retornava `[]` para todas as imagens (251 imagens existem no banco mas nenhuma era retornada)
- **Impacto**: Resolverá de vez o "Bloqueio de Mídia" — IA agora verá as 251 imagens do catálogo

### v5.3.3: Fix Loop de Permissão (Auto-Execute)
- **Regra anti-loop**: IA proibida de pedir permissão para usar suas próprias ferramentas. Deve executar automaticamente ações de leitura e preparação (buscar imagens, criar públicos, gerar artes)
- **Distinção bloqueio real vs passo**: Se a IA TEM a ferramenta para resolver, não é bloqueio — é um passo a executar
- **Confirmação apenas para alto impacto**: Permissão só exigida para ações irreversíveis ou financeiras (ativar campanha com budget alto, overrides)
- **Fluxo de criação atualizado**: Passos 2-4 (imagens, artes, públicos) são executados automaticamente sem intervenção

### v5.3.2: Fix Busca de Imagens de Produtos
- **Bug fix crítico**: `getProductImages` filtrava por `tenant_id` em `product_images`, mas 100% dos registros tinham `tenant_id = NULL` (resultado: 0 imagens retornadas). Removido filtro — busca agora é por `product_id` apenas (isolamento garantido via ownership do produto)
- **Backfill de dados**: Migration para preencher `tenant_id` em todas as 252 imagens existentes a partir do `products.tenant_id`

### v5.3.1: Criatividade de Marketing + Sync de Imagens ao Drive
- **Regra de honestidade refinada**: Distingue "dados reais da loja" (nunca inventar) vs "textos de marketing" (criatividade incentivada — slogans, CTAs, frases de efeito)
- **Sincronização automática de imagens ao Drive**: Ao carregar contexto, copia imagens existentes de `product_images` para a pasta "Imagens de Produtos" no Meu Drive (evita duplicatas via `storage_path` único)

### v5.3.0: Imagens de Produtos + Anti-Alucinação Reforçada
- **Nova ferramenta `get_product_images`**: Busca imagens do catálogo (`product_images`) + pasta "Imagens de Produtos" no Meu Drive
- **Pasta "Imagens de Produtos" auto-criada** no Meu Drive na primeira interação do chat
- **Imagens incluídas no contexto base** (`collectBaseContext`) — cada produto agora mostra quantidade de imagens
- **Anti-alucinação reforçada**: IA proibida de inventar estatísticas, pedir ao lojista para "verificar dados", ou expressar dúvidas sobre seus próprios dados
- **UI Language enforcement**: Proibida exposição de UUIDs/IDs e nomes de ferramentas nas respostas

### Correção Crítica v5.2.1: Formatação de Preços
- Os preços de produtos no banco estão em **BRL (reais)**, NÃO em centavos
- Removida divisão `/100` em todas as formatações de preço de produtos (`getProducts`, `getStoreContext`, `buildSystemPrompt`)
- Corrigido nome da coluna `order_items.price` → `order_items.unit_price`
- Receita e ticket médio de pedidos (`orders.total`) também já em BRL — removida divisão
- **Exceção**: Campos `*_cents` (budget_cents, daily_budget_cents, etc.) continuam divididos por 100 corretamente

### Visão Geral
Edge Function de chat conversacional **multimodal** com **tool calling real** para o Gestor de Tráfego IA. Opera como assistente de tráfego pago com acesso completo de leitura e escrita ao módulo de tráfego. Suporta análise de imagens, arquivos e URLs. Implementa **auto-sync fire-and-forget**, **contexto de negócio enriquecido** e **passo de verificação obrigatório** para eliminar alucinações.

### Arquitetura: Tool Calling em 3 Etapas
1. **Chamada Inicial (não-streaming, timeout 90s)**: Envia mensagem do usuário + histórico (últimas 15 mensagens) + definições de ferramentas → IA decide se precisa chamar ferramentas
2. **Execução de Tools**: Se a IA requisitou ferramentas, executa cada uma contra o banco/APIs reais e coleta resultados
3. **Resposta Final (streaming)**: Injeta resultados reais como contexto `[DADOS REAIS DO SISTEMA]` e faz chamada final com streaming SSE

### Capacidades Multimodais (v3.0.0)
| Capacidade | Modelo | Descrição |
|-----------|--------|-----------|
| **Análise de Imagens** | `google/gemini-2.5-pro` | Screenshots de anúncios, criativos, métricas — análise visual via multimodal |
| **Análise de URLs** | Firecrawl API | Landing pages, concorrentes, artigos — extração de conteúdo via tool `analyze_url` |
| **Upload de Arquivos** | N/A | PDF, CSV, XLSX, TXT — referenciados na mensagem para contexto |
| **Seleção de Modelo** | Automática | Se imagem presente → `gemini-2.5-pro`; texto → `gemini-3-flash-preview` |

### Attachments (v3.0.0)
- Coluna `attachments JSONB` em `ads_chat_messages`
- Formato: `[{url, filename, mimeType}]`
- Upload via `useSystemUpload` → storage `store-assets/tenants/{id}/ads-chat/`
- Imagens são enviadas ao modelo como `image_url` multimodal
- Arquivos não-imagem são referenciados como texto

### Tratamento de Falhas (v2.3.0 — CRÍTICO)
| Cenário | Comportamento |
|---------|--------------|
| **Timeout (>90s)** | Retorna mensagem visível: "O processamento demorou mais que o esperado — crie uma nova conversa" |
| **Rate limit (429)** | Salva mensagem de erro no chat + retorna HTTP 429 |
| **Créditos (402)** | Salva mensagem de erro no chat + retorna HTTP 402 |
| **Erro genérico** | Retorna erro como SSE para que o cliente exiba no chat |
| **Sem resposta da IA** | NUNCA falha silenciosamente — sempre há uma mensagem para o usuário |

**REGRA**: Erros NUNCA devem ser silenciosos. Toda falha DEVE produzir uma mensagem visível no chat para que o usuário saiba o que aconteceu.

### Histórico de Conversa (v2.3.0)
- Carrega apenas as **últimas 15 mensagens** (com conteúdo não-nulo) em ordem cronológica
- Evita bloat de contexto que causava timeouts em conversas longas
- Se a conversa ficar muito longa, o sistema sugere criar uma nova conversa

### Contexto Injetado no System Prompt (v5.0.0)
O system prompt é construído dinamicamente com:
1. **user_instructions**: O prompt estratégico configurado pelo lojista na conta de anúncios
2. **Catálogo de Produtos**: Top 10 produtos ativos com nome, preço, custo (`cost_price`) e margem calculada
3. **Configurações de conta**: Budget, ROI alvo, splits de funil, modo de estratégia
4. **Vendas 30d**: Pedidos pagos, receita, ticket médio, top 5 produtos por receita
5. **Contexto de Negócio** (v5.0.0): Nicho, descrição, público-alvo, URLs da loja (via `store_settings` e `tenant_domains`)
6. **Descontos Ativos**: Cupons vigentes com tipo, valor e validade
7. **Categorias**: Mix de categorias ativas para entender o catálogo

### Auto-Sync Fire-and-Forget (v5.0.0 — CRÍTICO)
- No `collectBaseContext`, verifica a data do último insight em `meta_ad_insights`
- Se a última sync for > 1 hora, dispara sync fire-and-forget de campanhas, adsets e insights
- Garante que a IA sempre tenha dados frescos sem bloquear a resposta
- A sync roda em background — a resposta atual pode usar dados levemente antigos, mas a próxima terá dados frescos

### Limites de Busca (v5.0.0 — Anti-Alucinação)
| Recurso | Limite Anterior | Limite Atual | Ordenação |
|---------|----------------|-------------|-----------|
| Campanhas (`get_campaign_performance`) | 30 | 200 | `effective_status ASC` (ACTIVE primeiro) |
| AdSets (`get_meta_adsets`) | 30 | 100 | — |
| Ads (`get_meta_ads`) | 30 | 100 | — |

### Passo de Verificação Obrigatório (v5.0.0 — CRÍTICO)
**REGRA**: Antes de qualquer diagnóstico, estratégia ou sugestão, a IA DEVE obrigatoriamente chamar:
- `get_campaign_performance` — para ver o estado REAL das campanhas
- `get_meta_adsets` — para entender a segmentação atual
- `get_tracking_health` — para validar a saúde do rastreamento

Se o usuário pedir diagnóstico ou estratégia sem que a IA tenha chamado essas ferramentas, a IA DEVE chamar antes de responder. Nunca confiar apenas no contexto base.

### Regra Anti-Alucinação (CRÍTICA)
O system prompt inclui uma **"Regra Suprema: Honestidade Absoluta"** que proíbe a IA de:
- Inventar métricas, status ou resultados
- Fingir que está gerando imagens, renderizando ou processando
- Dizer "estou finalizando" sem ter executado uma ferramenta
- Afirmar capacidades que não possui
- Inventar nomes de produtos, preços ou descrições (deve usar APENAS o catálogo real)
- Contornar erros de ferramentas com texto inventado

### Ferramentas Disponíveis (Tool Calling) — v5.0.0
| Ferramenta | Descrição | Tipo |
|-----------|-----------|------|
| `get_campaign_performance` | Métricas reais 7d de até 200 campanhas Meta (ACTIVE primeiro) — spend, ROAS, CPA, cliques, conversões | Leitura |
| `get_campaign_details` | Drill-down: campanha específica com todos os seus conjuntos e anúncios | Leitura |
| `get_performance_trend` | Time-series diário de uma campanha (gasto/conversões por dia, últimos 14-30 dias) | Leitura |
| `get_adset_performance` | Métricas por conjunto de anúncios (essencial para otimizar segmentação) | Leitura |
| `get_ad_performance` | Métricas por anúncio individual (essencial para saber qual criativo performa melhor) | Leitura |
| `get_store_context` | Contexto completo do negócio: nicho, público-alvo, URLs, ofertas ativas, categorias | Leitura |
| `get_google_campaigns` | Performance de campanhas Google Ads (spend, clicks, conversions, ROAS) | Leitura |
| `get_tiktok_campaigns` | Performance de campanhas TikTok Ads (spend, impressions, clicks, conversions) | Leitura |
| `get_meta_adsets` | Lista até 100 ad sets Meta com targeting, budget e status | Leitura |
| `get_meta_ads` | Lista até 100 anúncios Meta com status, criativo e preview URL | Leitura |
| `get_audiences` | Lista públicos/audiências Meta (Custom Audiences, Lookalikes) | Leitura |
| `get_creative_assets` | Lista criativos existentes e status | Leitura |
| `get_autopilot_config` | Lê configurações do Autopilot para uma conta (ROI, budget, estratégia, splits) | Leitura |
| `get_autopilot_actions` | Lista ações executadas/agendadas pelo Autopilot | Leitura |
| `get_autopilot_insights` | Lista insights e diagnósticos reais | Leitura |
| `get_autopilot_sessions` | Histórico de sessões de análise do Autopilot | Leitura |
| `get_tracking_health` | Status de saúde do tracking (pixels, conversões) | Leitura |
| `get_experiments` | Lista experimentos/testes A/B ativos e finalizados | Leitura |
| `get_products` | Lista produtos ativos com nome, preço, custo, estoque e imagens | Leitura |
| `update_autopilot_config` | Atualiza config do Autopilot (ROI, budget, estratégia, instruções) | Escrita |
| `toggle_entity_status` | Pausa/reativa campanha, conjunto ou anúncio no Meta via API | Escrita |
| `update_budget` | Altera orçamento (em centavos) de campanha ou conjunto existente no Meta | Escrita |
| `duplicate_campaign` | Duplica campanha Meta existente com todos conjuntos e anúncios, agenda ativação | Escrita |
| `update_adset_targeting` | Atualiza segmentação de conjunto (idade, gênero, localização, interesses) | Escrita |
| `create_custom_audience` | Cria público personalizado Meta (customer_list, website/pixel, engagement) | Escrita |
| `create_lookalike_audience` | Cria público semelhante (Lookalike 1%-20%) a partir de público existente | Escrita |
| `trigger_creative_generation` | Dispara geração de briefs criativos (headlines + copy) | Execução |
| `generate_creative_image` | Gera IMAGENS reais via IA (Gemini) para criativos de anúncios | Execução |
| `create_meta_campaign` | Cria campanha COMPLETA no Meta (Campaign→AdSet→Ad com criativo do Drive). Agenda ativação para 00:01-04:00 BRT | Execução |
| `trigger_autopilot_analysis` | Dispara análise completa do Autopilot por canal | Execução |
| `analyze_url` | Analisa conteúdo de URL via Firecrawl (landing page, concorrente, artigo) | Leitura |

### Fluxo Completo de Criação de Campanha (v4.2.0)
1. IA gera criativos visuais via `generate_creative_image` (Gemini → pasta "Gestor de Tráfego IA")
2. IA chama `create_meta_campaign` que automaticamente:
   a. Busca criativos prontos em `ads_creative_assets` → fallback Drive → fallback imagem do produto
   b. Faz upload da imagem para Meta via `adimages` endpoint
   c. Cria Ad Creative com `object_story_spec` (page link ad)
   d. Cria Campanha PAUSED via `meta-ads-campaigns`
   e. Cria AdSet PAUSED com pixel/promoted_object via `meta-ads-adsets`
   f. Cria Ad PAUSED com creative via `meta-ads-ads`
   g. Agenda ativação (`activate_campaign`) para janela 00:01-04:00 BRT
3. `scheduler-tick` ativa a campanha no horário agendado

### O que o Chat NÃO Pode Fazer
- Criar campanhas Google/TikTok diretamente (somente Meta por enquanto)
- Acessar APIs de plataformas diretamente (usa edge functions intermediárias)
- Renderizar ou finalizar qualquer coisa fora das ferramentas acima

### Sistema de Override por Comando (v5.2.0 — CRÍTICO)
O lojista pode sobrepor QUALQUER configuração do sistema via chat com confirmação. Fluxo:
1. IA identifica que o pedido contradiz uma regra/configuração existente
2. Mostra aviso claro com valor atual vs novo valor solicitado
3. Após confirmação, executa `update_autopilot_config` com `chat_overrides` JSONB
4. O campo `chat_overrides` em `ads_autopilot_account_configs` tem **prioridade máxima** sobre configurações de tela
5. Todas as alterações via override ficam registradas com timestamp e contagem

**Campos passíveis de override**: `budget_cents`, `target_roi`, `strategy_mode`, `is_ai_enabled`, `human_approval_mode`, `user_instructions`.

### Fluxo de Conversação
1. Usuário envia mensagem (com ou sem anexos) via `useAdsChat` hook
2. Anexos são uploadados para `store-assets` via `useSystemUpload`
3. Edge function cria/recupera conversa em `ads_chat_conversations`
4. Salva mensagem do usuário em `ads_chat_messages` (com attachments JSONB)
5. Coleta contexto base (tenant, configs, **user_instructions**, **catálogo c/ margens**, pedidos 30d, **nicho/público/URLs/descontos**)
6. **Verifica freshness dos dados** — dispara sync fire-and-forget se > 1h
7. Monta mensagem multimodal (imagens como `image_url`, arquivos como texto)
8. Seleciona modelo (vision vs text) baseado nos anexos
9. Executa pipeline de 3 etapas (tool calling) com **timeout de 90s**
10. Salva resposta da IA em `ads_chat_messages` (inclusive erros)
11. Retorna streaming SSE para o frontend

### Escopos
| Escopo | Descrição |
|--------|-----------|
| `global` | Visão geral de todas as contas de anúncios |
| `account` | Focado em uma conta específica (`ad_account_id` + `channel`) |

### Mapeamento Tabela → Edge Function
| Tabela | Edge Function |
|--------|---------------|
| `ads_chat_conversations` | `ads-chat` |
| `ads_chat_messages` | `ads-chat` |
| `ads_autopilot_artifacts` | `ads-chat` (user_command), `ads-autopilot-analyze` (strategy/copy/creative_prompt/campaign_plan) |
| `ads_autopilot_account_configs` | `ads-chat` |
| `ads_autopilot_actions` | `ads-chat` |
| `ads_autopilot_insights` | `ads-chat` |
| `ads_autopilot_sessions` | `ads-chat` |
| `ads_autopilot_experiments` | `ads-chat` |
| `ads_tracking_health` | `ads-chat` |
| `meta_ad_campaigns` | `ads-chat` |
| `meta_ad_adsets` | `ads-chat` |
| `meta_ad_ads` | `ads-chat` |
| `meta_ad_audiences` | `ads-chat` |
| `meta_ad_insights` | `ads-chat` |
| `meta_ad_creatives` | `ads-chat` |
| `google_ad_campaigns` | `ads-chat` |
| `google_ad_insights` | `ads-chat` |
| `tiktok_ad_campaigns` | `ads-chat` |
| `tiktok_ad_insights` | `ads-chat` |
| `ads_creative_assets` | `ads-chat` |
| `orders` | `ads-chat` |
| `tenants` | `ads-chat` |
| `products` | `ads-chat` |
| `product_images` | `ads-chat` |
| `files` | `ads-chat` |
| `store_settings` | `ads-chat` |
| `tenant_domains` | `ads-chat` |
| `categories` | `ads-chat` |
| `discounts` | `ads-chat` |
| `marketplace_connections` | `ads-chat` |
| `marketing_integrations` | `ads-chat` |

### Sync de Insights (`meta-ads-insights`) — v1.7.0

| Parâmetro | Valor |
|-----------|-------|
| `time_increment` | `1` (dados diários) |
| `date_preset` | `maximum` com fallback para chunks trimestrais |
| Níveis | `campaign` + `adset` + `ad` |
| **Paginação** | Completa via `paging.next` (até 50 páginas / 25k rows por chunk) |
| **Chunked fallback** | Quando `maximum` falha, divide em chunks de 90 dias e busca cada um |
| **Upsert por chunk** | Salva no banco após cada chunk (evita perda por timeout) |
| **Campaign cache** | Cache em memória `meta_campaign_id → id` elimina lookups N+1 |
| **Batch upsert** | 100 rows por lote, chave: `(tenant_id, meta_campaign_id, date_start, date_stop)` |
| **Granularidade** | Apenas `date_start === date_stop` (diário); registros agregados multi-dia são excluídos |

A sync com paginação completa + chunking permite capturar **100% dos dados históricos** mesmo em contas com alto volume (ex: R$ 665k+ em 30 meses, 6000+ rows).

### Changelog — `ads-chat`

| Versão | Data | Mudança |
|--------|------|---------|
| v5.3.6 | 2026-02-17 | Fix: colunas `meta_audience_id` em `createCustomAudience`/`createLookalikeAudience`; erros de insert não mais silenciados |
| v5.3.7 | 2026-02-17 | Fix: loop multi-rodada de tool calls — IA agora executa leitura E escrita em até 5 rounds por interação |
| v5.4.0 | 2026-02-17 | **Strategy Mode Guardrails**: IA obrigada a validar ações contra `strategy_mode` configurado (conservative/balanced/aggressive). Regras de budget por modo injetadas no prompt. `get_autopilot_config` obrigatório antes de propor mudanças. Alerta obrigatório quando ação viola regra manual. |
| v5.5.0 | 2026-02-17 | **Action Logging + Anti-Hallucination**: Todas as tools de escrita (toggle_entity_status, update_budget, generate_creative_image, trigger_creative_generation) agora logam na tabela `ads_autopilot_actions`. Novas regras de prompt: proibido "Posso seguir?", obrigatório reportar resultados reais das ferramentas, respeitar mapeamento produto→funil das instruções estratégicas, distribuir budget conforme funnel_splits. |
| v5.6.0 | 2026-02-17 | **Playbook Estratégico Injetado no System Prompt**: Adicionado bloco completo de diretrizes de escala (vertical/horizontal), framework Core/Test/Explore (60-80%/15-30%/5-10%), árvore diagnóstica (Tracking→Unit Economics→Criativo→Público→Budget), cadência operacional (diária/semanal/mensal), regras de testes (1 variável, volume mínimo, promoção/corte), copy persuasiva (AIDA/PAS/4U, 8 tipos de hooks), checklist de criativos (gancho 0-2s, produto cedo, texto na tela, CTA claro), e métricas de ROI real vs ROAS + MER. |
| v5.7.0 | 2026-02-17 | **Timeout 90s + Logging Síncrono + Reconciliação de Campanhas**: Timeout da chamada de IA aumentado de 45s para 90s para suportar tarefas multi-campanha. Logging de ações em `ads_autopilot_actions` agora é `await` (síncrono) em vez de fire-and-forget, garantindo que todas as ações apareçam na aba "Ações da IA". Fallback de imagem melhorado em `createMetaCampaign` — loga ação de falha se nenhuma imagem encontrada. Sync de campanhas/adsets/ads agora reconcilia exclusões (deleta do banco local registros que não existem mais no Meta). |
| v5.8.0 | 2026-02-17 | **Fix Crítico: Imagens de Produto + Session ID FK**: Corrigido bug onde `createMetaCampaign` usava coluna inexistente `position` em vez de `sort_order` na tabela `product_images` — fazia com que a IA NUNCA encontrasse imagens do catálogo. Corrigido FK violation em `ads_autopilot_actions.session_id` — agora cria uma sessão real em `ads_autopilot_sessions` (trigger_type='chat') no início de cada request e propaga o ID para todas as tools de escrita. Todas as ações agora aparecem corretamente na aba "Ações da IA". |
| v5.9.0 | 2026-02-17 | **Execução Paralela de Tools + Fix files.url**: Tool calls agora executam em `Promise.allSettled` em paralelo (antes era `for...of await` sequencial). 5 campanhas que levavam ~90s+ agora completam em ~20s. Corrigido referência a `files.url` (coluna inexistente) no fallback de Drive — agora usa `storage_path` com signed URL. DB saves de tool_calls mudados para fire-and-forget para não bloquear execução. |
| v5.9.1 | 2026-02-17 | **Fix sort_order em generateCreativeImage + Limite de Campanhas**: Corrigido bug onde `generateCreativeImage` usava `position` (inexistente) em vez de `sort_order` na tabela `product_images` — mesmo bug do v5.8.0 mas em outra função. Corrigido `img.position` → `img.sort_order` na sync de imagens para o Drive. Adicionada regra no system prompt: **máximo 2 campanhas por rodada de ferramentas** para evitar timeouts (~5 chamadas HTTP por campanha × 5 campanhas = timeout garantido). IA agora pede "continuar" para criar as próximas. |
| v5.11.0 | 2026-02-18 | **Pipeline de Criativos Determinístico + Integridade Operacional**: Seleção determinística em 2 níveis (Ready/Published) com filtro por `funnel_stage` e unicidade por sessão. Estado persistente (`used_asset_ids`, `used_adcreative_ids`, `media_blocked`, `strategy_run_id`) em `ads_autopilot_sessions`. Pós-condições estritas (executed só com cadeia completa verificada via Graph API GET). Validação de mídia pós-criação. Idempotency v2 com `batch_index`. Detecção/bloqueio seletivo de erro de mídia (Nível 1 bloqueado, Nível 2 continua). Regra `creative_test` por `session_id`. System prompt com regras de criativos. Propagação de `funnel_stage`, `session_id` e `strategy_run_id` no ads-chat. |
| v5.11.3 | 2026-02-18 | **User Command Artifacts + Override com Confirmação**: Novas tools `persist_user_command` e `confirm_user_command` para fluxo de override seguro. Comandos do usuário persistidos como `artifact_type='user_command'` em `ads_autopilot_artifacts`. Conflitos com guardrails geram `status='awaiting_confirmation'` com alerta ao usuário. Após confirmação explícita, status evolui para `confirmed` e execução prossegue com `override=true`. Auditoria completa: `conflicts_acknowledged`, `confirmation_timestamp`, `confirmed_by`. |

### Regras de User Command Override — `ads-chat` v5.11.3

Comandos explícitos do usuário via chat têm **prioridade máxima** sobre configs/guardrails do Autopilot.

**Fluxo de Override:**
1. Usuário envia comando (ex: "cria campanha BOF com orçamento R$500")
2. IA chama `persist_user_command` com intent parseado e conflitos detectados
3. Se **sem conflitos**: `status='confirmed'`, execução imediata
4. Se **com conflitos**: `status='awaiting_confirmation'`, IA alerta o usuário com detalhes do conflito e pede confirmação
5. Usuário confirma → IA chama `confirm_user_command` → `status='confirmed'` → execução prossegue

**Artefato `user_command`:**
```json
{
  "artifact_type": "user_command",
  "campaign_key": "cmd_{timestamp}_{intent}",
  "data": {
    "original_text": "texto original do usuário",
    "parsed_intent": "create_campaign",
    "requested_changes": { "budget_cents": 50000, "funnel_stage": "bof" },
    "detected_conflicts": ["budget exceeds configured limit by 25%"],
    "requires_confirmation": true,
    "override_allowed": true,
    "confirmation_question": "O orçamento solicitado excede o limite configurado em 25%. Confirmar mesmo assim?"
  },
  "status": "awaiting_confirmation"
}
```

**Tools:**
| Tool | Descrição |
|------|-----------|
| `persist_user_command` | Salva intent + conflitos em `ads_autopilot_artifacts`. Params: `campaign_key`, `original_text`, `parsed_intent`, `requested_changes`, `detected_conflicts[]`, `confirmation_question` |
| `confirm_user_command` | Atualiza artifact para `confirmed` com timestamp e `confirmed_by`. Params: `campaign_key` |

**Regras:**
- HARD STOP continua válido: override NÃO permite pular etapas do pipeline (criativo obrigatório)
- Override apenas dita o **conteúdo** das etapas (produto, budget, funil, objetivo)
- `action_data` registra: `user_command_id`, `override=true`, `conflicts_acknowledged`, `confirmation_timestamp`

### Regras de Strategy Mode — `ads-chat` v5.4.0

| Modo | Budget ±max/ciclo | Intervalo mín | Criação de campanhas | Pausa por ROI |
|------|-------------------|---------------|----------------------|---------------|
| `conservative` | ±10% | 72h | 14+ dias histórico | ROI < 80% meta (3d) |
| `balanced` | ±20% | 48-72h | 7+ dias histórico | ROI < meta (7d) |
| `aggressive` | ±40% | 24-48h | Imediato | ROI < 50% meta (5d) |

**Regra de Conflito**: Se o lojista pede uma ação via chat que viola o modo configurado:
1. A IA avisa qual regra seria violada (valor atual vs proposto)
2. Pede confirmação explícita
3. Se confirmado, persiste em `chat_overrides` como Override

### Regras de Action Logging — `ads-chat` v5.9.2

**Toda ferramenta de escrita DEVE registrar uma entrada em `ads_autopilot_actions`** com:
- `status`: "executed" (sucesso), "failed" (falha) ou "scheduled" (agendada)
- `action_data`: detalhes da ação incluindo `created_by: "ads_chat"`
- `reasoning`: descrição humanizada da ação
- `executed_at`: timestamp de execução (quando sucesso)
- `error_message`: mensagem de erro real (quando falha)
- `rollback_data`: **OBRIGATÓRIO** — dados necessários para reverter a ação manualmente (ex: `revert_to_status`, `revert_to_budget_cents`, `campaign_id` para pausar)

### Regras de Transparência — `ads-chat` v5.9.2+

1. **Progresso em lotes**: Quando criando campanhas em batches (máx 2 por rodada), informar progresso "X de N criadas"
2. **Resumo de ações**: Ao final de cada resposta com ações, listar todas com ✅/❌
3. **Aba Ações**: Informar que todas ficam registradas na aba Ações com opção de reversão
4. **Sem jargões**: Explicar limitações técnicas de forma clara, sem termos internos

### Regras Anti-Alucinação Comportamental — `ads-chat` v5.5.0+

1. **Proibido "loop de permissão"**: IA NUNCA pode perguntar "Posso seguir?", "Quer que eu faça?" etc para ações de leitura/preparação
2. **Reportar resultados reais**: NUNCA dizer "estou executando" sem ter chamado a ferramenta. Reportar resultado ✅/❌ de cada ação
3. **Respeitar mapeamento produto→funil**: Seguir as instruções estratégicas do lojista sobre qual produto usar em cada estágio
4. **Distribuir budget por funnel_splits**: Respeitar os percentuais configurados (cold/remarketing/tests/leads)

### v1.3.0 — `ads-autopilot-creative` — INSERT antes de gerar + `image_job_id` correto

**Mudanças**:
1. **Aceita `funnel_stage` e `strategy_run_id`** no body (propagados pelo analyze/chat)
2. **INSERT em `ads_creative_assets` ANTES de invocar `creative-image-generate`**: Registro criado com `status='generating'` para eliminar race conditions e garantir que o asset existe antes da geração assíncrona
3. **Chave `meta.image_job_id`** (não `job_id`): A `creative-image-generate` faz match por `meta->>'image_job_id'`, então o campo DEVE ser `image_job_id` no JSONB `meta`
4. **Marca asset como `failed`** se invoke falhar ou `success=false` — elimina "sucessos fantasma"
5. **Retorna `asset_id`** no response para rastreabilidade completa

### Correção v5.9.4 — `ads-autopilot-creative-generate` v1.2.0

**Bug corrigido**: A chamada ao Lovable AI Gateway **não incluía o header `Authorization`**, fazendo a IA retornar vazio silenciosamente. A ação era registrada como "Executada" apesar de nada ter sido gerado.

**Mudanças**:
1. **Auth header obrigatório**: `Authorization: Bearer ${LOVABLE_API_KEY}` adicionado à chamada do gateway
2. **Modelo atualizado**: De `openai/gpt-5-mini` para `google/gemini-2.5-flash` (mais rápido e confiável)
3. **Log enriquecido**: `triggerCreativeGeneration` agora inclui `created_count` e detalhes dos assets gerados no `action_data`
4. **Feedback real**: A resposta da ferramenta inclui os briefs gerados (headline, copy, formato, ângulo) para a IA reportar ao lojista

### v2.0.0 — `ads-autopilot-creative-generate` Bridge para Geração de Imagens

**Problema**: A função `ads-autopilot-creative-generate` gerava apenas **briefs de texto** (headline + copy) em `ads_creative_assets`, mas **não gerava imagens reais**. Os criativos ficavam com `asset_url: null` e `storage_path: null`, impossibilitando o upload para Meta.

**Mudanças**:
1. **Bridge para `creative-image-generate`**: Após gerar os briefs de texto, a função agora agrupa por `product_id` e dispara `creative-image-generate` via `fetch()` com `service_role` key (chamada M2M)
2. **Auto-fetch de imagem do produto**: Se `product_image_url` não fornecido, busca automaticamente de `product_images` (ordenado por `sort_order`) ou fallback para `products.images` JSONB
3. **Pasta "Gestor de Tráfego IA" no Drive**: Cria automaticamente a pasta no Drive do tenant para armazenar os criativos gerados
4. **Atualização de `ads_creative_assets`**: Após geração, atualiza `asset_url` e `storage_path` dos assets com as URLs das imagens geradas

### M2M Auth em `creative-image-generate`

**Mudança**: A edge function `creative-image-generate` agora aceita chamadas Machine-to-Machine (M2M) autenticadas com `service_role` key. Quando detecta o token como service role:
- `isM2M = true`
- `userId = null` (não há usuário real)
- `creative_jobs.created_by` aceita `NULL` (migration: `ALTER TABLE public.creative_jobs ALTER COLUMN created_by DROP NOT NULL`)

**Config**: `verify_jwt = false` em `supabase/config.toml` para `creative-image-generate`

### Correções v2.0.1 — `creative-image-generate`

1. **Remoção de `file_type`**: A coluna `file_type` não existe na tabela `files`. O insert no Drive foi corrigido para omitir esse campo, eliminando o erro `PGRST204`
2. **Atualização automática de `ads_creative_assets`**: Após o pipeline de imagem concluir com sucesso, a função agora busca todos os `ads_creative_assets` que referenciam o `job_id` (via `meta.image_job_id`) e atualiza:
   - `asset_url` → URL da imagem vencedora (winner) ou primeira gerada
   - `storage_path` → Path no Storage
   - `status` → `'ready'`
   - `meta.image_status` → `'completed'`

### v5.9.5 — `ads-chat` — URL de destino + bucket corrigido

1. **Campo `link` obrigatório no `link_data`**: O `object_story_spec.link_data` agora inclui `link` (URL de destino do anúncio) e `call_to_action.value.link`. A URL é construída como `https://{storeHost}/produto/{productSlug}` buscando o domínio da tabela `tenant_domains` (ver regra de resolução abaixo)
2. **Busca de `slug` do produto**: O select de produtos inclui campo `slug` para construir a URL de destino
3. **Bucket corrigido**: Fallbacks de `createSignedUrl` agora usam `media-assets` em vez de `files` (imagens geradas pela IA ficam no bucket `media-assets`)

### v5.10.1 — `ads-autopilot-analyze` — Integração com `ads_creative_assets`

**Problema**: O Motor Estrategista ignorava completamente os criativos gerados pela pipeline de IA (`ads_creative_assets`). Usava apenas `creative_id` de anúncios existentes na conta Meta ou disparava a função legada `ads-autopilot-creative`.

**Mudanças — Nova hierarquia de criativos (Step 3)**:
1. **Prioridade 1 — AI Assets**: Busca `ads_creative_assets` com `status = 'ready'` e `asset_url` preenchido. Se encontrar:
   - Upload da imagem para Meta via `/adimages` → obtém `image_hash`
   - Construção de URL de destino (`https://{storeHost}/produto/{slug}`)
   - Criação de `adcreative` no Meta com `link_data` completo (incluindo `link`)
   - Atualização do asset para `status = 'published'` com `platform_ad_id`
2. **Prioridade 2 — Creative existente**: Fallback para `creative_id` de anúncios já existentes na conta
3. **Prioridade 3 — Auto-geração**: Dispara `ads-autopilot-creative` para gerar novos criativos

### ⚠️ Resolução de Domínio para URL de Destino (REGRA CRÍTICA)

**A tabela `tenants` NÃO possui coluna `custom_domain`.** O domínio customizado está na tabela `tenant_domains`.

```typescript
// ✅ CORRETO — Buscar domínio de tenant_domains
const { data: tenantInfo } = await supabase.from("tenants").select("slug").eq("id", tenantId).single();
const { data: tenantDomainInfo } = await supabase
  .from("tenant_domains").select("domain")
  .eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true)
  .maybeSingle();
const storeHost = tenantDomainInfo?.domain || (tenantInfo?.slug ? `${tenantInfo.slug}.shops.comandocentral.com.br` : null);

// ❌ ERRADO — custom_domain NÃO EXISTE em tenants (retorna sempre null/undefined)
const { data: t } = await supabase.from("tenants").select("slug, custom_domain")...
```

**Aplicado em**: `ads-chat` (3 locais), `ads-autopilot-analyze` (1 local)

### Mapeamento Tabela → Edge Function (atualizado)
| Tabela | Edge Function |
|--------|---------------|
| `ads_creative_assets` | `ads-autopilot-creative-generate`, `ads-chat`, `ads-autopilot-analyze`, `creative-image-generate` (update após pipeline) |
| `creative_jobs` | `creative-image-generate`, `ads-autopilot-creative-generate` (via bridge) |
| `product_images` | `ads-autopilot-creative-generate`, `creative-image-generate` |
| `files` | `ads-autopilot-creative-generate` (pasta Drive), `creative-image-generate` (registro no Drive) |
| `tenant_domains` | `ads-chat`, `ads-autopilot-analyze` (resolução de domínio para URL de destino) |

### v5.9.7 — `ads-chat` — Fix Race Condition + Signed URLs para Meta

1. **Prevenção de Race Condition (Bug 2)**: Adicionada instrução explícita no system prompt proibindo a IA de chamar `generate_creative_image` e `create_meta_campaign` no mesmo round de ferramentas. A geração de imagens é assíncrona (~60-90s via `EdgeRuntime.waitUntil()`), então a campanha deve ser criada apenas em um round subsequente, após confirmação de assets `ready`
2. **Signed URLs para Meta API (Bug 3)**: `createMetaCampaign` agora usa `createSignedUrl()` (expiração 30 dias) do bucket `media-assets` em vez de URLs públicas para o upload via `/adimages`. Resolve erro de permissão onde Meta não conseguia buscar imagens do storage
3. **Governança multi-rodada**: A IA deve sempre: gerar criativos → aguardar confirmação → criar campanha (nunca no mesmo round)

### v3.2.0 — `creative-image-generate` — Respeitar `output_folder_id`

**Bug corrigido (Bug 1)**: A função ignorava o parâmetro `output_folder_id` enviado pelo `ads-autopilot-creative` e sempre criava/usava uma pasta fixa "Criativos com IA". Resultado: imagens geradas pelo Gestor de Tráfego IA iam para a pasta errada no Drive.

**Mudanças**:
1. **Extração de `output_folder_id` do body**: O parâmetro agora é lido do request body
2. **Prioridade de pasta**: Se `output_folder_id` fornecido, usa essa pasta em vez da padrão "Criativos com IA"
3. **Impacto**: Imagens geradas pelo autopilot agora aparecem corretamente na pasta "Gestor de Tráfego IA" do Drive

### v5.11.3 — `ads-autopilot-analyze` — Fix Artifact Persistence

**Bug corrigido**: Os 3 upserts de artefatos (`strategy`, `copy`, `campaign_plan`) na tabela `ads_autopilot_artifacts` falhavam silenciosamente. O cliente Supabase JS retorna `{ data, error }` em vez de lançar exceções, então o bloco `try/catch` nunca capturava os erros — os artefatos simplesmente não eram salvos.

**Mudanças**:
1. **Verificação explícita de `{ error }`**: Cada upsert agora desestrutura o retorno e verifica `error`, logando `message`, `details` e `hint`
2. **Log de sucesso**: Quando os 3 artefatos são salvos sem erro, loga confirmação com `campaign_key`
3. **Regra universal**: O cliente Supabase JS **nunca** lança exceções em operações de banco — sempre verificar `{ error }` no retorno

**Padrão obrigatório para upserts/inserts Supabase**:
```typescript
// ✅ CORRETO — verificar { error }
const { error } = await supabase.from("tabela").upsert({ ... });
if (error) console.error("Erro:", error.message, error.details, error.hint);

// ❌ ERRADO — try/catch não captura erros do cliente Supabase
try {
  await supabase.from("tabela").upsert({ ... }); // nunca lança
} catch (e) { /* nunca entra aqui */ }
```

### v3.3.0 — `creative-image-generate` — Callback para Analyze

**Problema**: Após os assets serem gerados e marcados como `ready`, nenhum mecanismo disparava o `ads-autopilot-analyze` para completar a cadeia (campanha+adset+ad). O ciclo só era completado no próximo agendamento automático (horas depois).

**Mudança**: Após atualizar `ads_creative_assets` para `status: 'ready'`, a função agora invoca `ads-autopilot-analyze` com `trigger_type: "creative_ready"` (fire-and-forget via `supabase.functions.invoke`).

**Impacto no `ads-autopilot-analyze`**: O `trigger_type: "creative_ready"` foi adicionado ao bypass de suficiência de dados (`bypassDataCheck`), junto com `first_activation` e `manual`.

**Fluxo completo agora**:
1. `analyze` detecta falta de criativos → dispara `generate_creative` → Hard Stop (sem campanha)
2. `creative-image-generate` processa imagem → asset vira `ready`
3. **NOVO**: `creative-image-generate` invoca `analyze` com `trigger_type: "creative_ready"`
4. `analyze` encontra assets `ready` → completa a cadeia (campanha+adset+ad) → persiste artefatos

### v5.12.0 — `ads-autopilot-analyze` — Fix creative_ready loop + Product Focus

**Problema 1 — Loop de criativos**: Quando `trigger_type: "creative_ready"` disparava, a IA entrava em loop gerando MAIS criativos em vez de usar os assets ready para criar campanhas. Causa: o prompt não instruía a IA a priorizar criação de campanhas no callback.

**Problema 2 — Produtos errados**: A seleção por preço era não-determinística para produtos com mesmo preço (ex: "Kit Banho Calvície Zero Noite" vs "Kit Banho Calvície Zero"). A IA escolhia variantes (Dia/Noite/2x/3x/FLEX) em vez dos produtos base.

**Mudanças**:
1. **Hard validation**: `generate_creative` é REJEITADO com erro quando `trigger_type === "creative_ready"` (bloqueio no `validateAction`)
2. **Prompt de creative_ready**: Seção dedicada instrui a IA a usar assets ready para `create_campaign`, proibindo `generate_creative`
3. **Ready assets context**: Quando `creative_ready`, busca assets `status=ready` e injeta IDs/funnel no prompt
4. **`selectFocusProducts()`**: Nova função filtra variantes (regex: `\(2x\)`, `\(3x\)`, `\(FLEX\)`, `Dia$`, `Noite$`) e separa singles de kits
5. **Seção PRODUTOS FOCO**: Injeta produtos foco por funil (TOF=singles baratos, BOF=kits) com IDs no prompt
6. **Product selection unificada**: `create_campaign` e `generate_creative` handlers agora usam `selectFocusProducts()` em vez de sort por preço bruto

### v5.12.1 — `ads-autopilot-analyze` — Variantes só para Remarketing + Fluxo de Aprovação

**Mudança 1 — Variantes restritas**: `selectFocusProducts()` agora retorna 3 listas: `tof` (base singles), `bof` (base kits) e `remarketing` (variantes: Dia, Noite, 2x, 3x, FLEX). Variantes são **terminantemente proibidas** em campanhas TOF/BOF — permitidas apenas em Remarketing e Ofertas.

**Mudança 2 — Fluxo de Aprovação (Aguardando Ação)**:
- Nova aba "Aguardando Ação" no Gerenciador (por conta) e na aba "Configurações Gerais" (global, todas as contas)
- Componente: `AdsPendingApprovalTab` com polling de 15s
- Cada card exibe: tipo, canal, justificativa, impacto, copy (se disponível), orçamento
- 3 controles: **Aprovar** (executa via `ads-autopilot-execute-approved`), **Ajustar** (rejeita + envia feedback para revisão) ou **Rejeitar** (com motivo)

**Mudança 3 — Edge Function `ads-autopilot-execute-approved`** (v1.1.0):
- Aceita ações com status `pending_approval` ou `approved`
- Re-dispara análise com `trigger_type: "approved_action"`
- Garante que ações aprovadas sejam executadas imediatamente

### v5.12.2 — `ads-autopilot-analyze` — Fix topProduct scope

**Bug**: `topProduct` estava declarado DENTRO de `if (newMetaAdsetId)` mas referenciado FORA do bloco para `actionRecord.action_data` e `campaignKey`, causando `ReferenceError: topProduct is not defined` em todos os callbacks `creative_ready`.

**Fix**: `topProduct` e `selectFocusProducts()` movidos para fora do bloco condicional, garantindo acessibilidade em todo o handler.

### Hierarquia IA Global vs. Per-Account

**Camada Global** (aba "Configurações Gerais"):
- Toggle "IA Global" ativa/desativa a IA para TODAS as contas que **não** possuem configurações exclusivas
- Insights globais aparecem SOMENTE quando a IA global está ativada
- Aba "Aguardando Aprovação" mostra ações de TODAS as contas

**Camada Per-Account** (Gerenciador > Conta > ⚙️):
- Configurações exclusivas por conta de anúncios prevalecem sobre as globais (Prioridade 1)
- Quando uma conta tem regras exclusivas, a IA global NÃO a afeta
- Aba "Aguardando Ação" filtra por canal

**Regra de produto por funil**:
```
TOF/Cold → focus.tof (singles base, ex: "Shampoo Calvície Zero")
BOF → focus.bof (kits base, ex: "Kit Banho Calvície Zero")  
Remarketing/Ofertas → focus.remarketing (variantes: "Kit Banho Calvície Zero Noite")
```

---

### Bug Fix: `imagesByProduct` Scope Leak (v1.5.1)

**Problema:** A variável `imagesByProduct` era definida dentro de `collectContext()` (escopo local) mas referenciada diretamente em `buildStrategistPrompt()` como variável livre, causando `ReferenceError: imagesByProduct is not defined`.

**Correção:**
1. Adicionado `imagesByProduct` ao objeto de retorno de `collectContext()`
2. Alterada referência em `buildStrategistPrompt()` para `context.imagesByProduct`

**Regra derivada:** Toda variável computada em `collectContext` que precise ser usada em `buildStrategistPrompt` DEVE ser incluída no objeto de retorno. Não usar variáveis de escopo externo entre funções.

---

### v1.8.0 → v1.9.0: `ads-autopilot-strategist` — Approval Obrigatório + Plano Injetado + Creative Link

**v1.8.0 — Approval Obrigatório**:
- `create_campaign` e `create_adset` agora SEMPRE retornam `pending_approval`, independentemente de `human_approval_mode`
- A Meta API NUNCA é chamada diretamente pelo strategist — execução real ocorre apenas via `execute-approved` após clique do usuário
- Ações internas como `activate_campaign` e status `scheduled` são filtradas da UI (não relevantes ao lojista)

**v1.9.0 — Injeção do Plano Aprovado**:
- Quando `trigger = "implement_approved_plan"`, o sistema busca o plano estratégico mais recente com `status = "approved"` da tabela `ads_autopilot_actions`
- O conteúdo completo (diagnóstico, ações planejadas, resultados esperados, alocação) é injetado no prompt do Motor Estrategista via placeholder `{{APPROVED_PLAN_CONTENT}}`
- Isso garante que a IA siga EXATAMENTE os produtos/estratégias planejados, em vez de ignorar o plano e repetir o mesmo produto
- **Regra derivada**: O prompt de `implement_approved_plan` instrui a IA a NÃO repetir o mesmo produto em campanhas diferentes, a menos que o plano especifique isso

**v1.9.0 — Vinculação de Creative URL**:
- `generate_creative` agora rastreia as URLs dos criativos gerados por produto na sessão (`creativeUrlsByProduct`)
- Ao registrar uma ação `create_campaign`, o sistema busca o criativo correspondente por nome do produto (no campaign_name ou targeting_description)
- Fallback: busca qualquer criativo da sessão atual se não houver match por nome
- A `creative_url` é persistida em `action_data.creative_url` para exibição no `ActionApprovalCard`

**v1.9.0 — Fix Ticket Médio**:
- `orders.total` já armazena valores em BRL (reais), não em centavos
- Removida a divisão por 100 em `avg_ticket_cents` e `revenue_cents_30d` no prompt do strategist

---

### v1.15.0: `ads-autopilot-strategist` — Plan-First + Multi-Copy

**Plan-First Enforcement**:
- Trigger `start` agora restringe ferramentas disponíveis APENAS para `strategic_plan` e `report_insight`
- Ferramentas de criação (`create_campaign`, `generate_creative`, `create_lookalike_audience`) são BLOQUEADAS na primeira ativação
- Isso garante que a IA gere primeiro um plano estratégico completo para aprovação antes de qualquer implementação

**Multi-Copy Obrigatório**:
- `create_campaign` agora aceita arrays: `primary_texts` (2-4 variações) e `headlines` (2-4 variações)
- Campos legados `primary_text` e `headline` (string única) continuam funcionando como fallback
- Mínimo 2 variações obrigatórias para testes A/B

**Campos atualizados em `create_campaign`**:
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `product_name` | string | ✅ | Nome exato do produto do catálogo |
| `primary_texts` | string[] | ✅ | 2-4 variações de texto principal |
| `headlines` | string[] | ✅ | 2-4 variações de headline |
| `descriptions` | string[] | ❌ | Descrições curtas |
| `cta` | string | ❌ | Call-to-action |

**Implementação do Plano Aprovado**:
- Trigger `implement_approved_plan` agora instrui a IA a criar TODAS as campanhas mencionadas no plano (teste, duplicação, remarketing)
- Cada campanha deve ter 2-4 copies diferentes
- Geração de criativos DEVE ocorrer ANTES de criar campanhas
- 100% do orçamento aprovado deve ser utilizado

---

### `creative-image-generate` v4.1.0 — Download Resiliente

**Melhorias**:
- Download da imagem do produto com **3 tentativas** (retry com backoff)
- Timeout de 15s por tentativa via `AbortController`
- Header `User-Agent` para evitar bloqueio por CDNs (Shopify, etc.)
- Validação de tamanho mínimo do arquivo (>100 bytes)
- Logging detalhado em cada etapa do pipeline

---

### `ads-autopilot-weekly-insights` v2.0.0 — Insights Acionáveis

**Mudança principal**: Reescrita completa do prompt para gerar RECOMENDAÇÕES DE NEGÓCIO em vez de dumps de contexto.

**10 tipos de insights suportados**:
| Tipo | Exemplo |
|------|---------|
| `increase_price` | "Aumente o preço do Shampoo X de R$Y para R$Z" |
| `decrease_price` | "Reduza preço para competitividade" |
| `increase_budget` | "Aumente orçamento diário para R$X" |
| `decrease_budget` | "Reduza investimento nesta campanha" |
| `pause` | "Pause anúncios do Produto X — margem negativa" |
| `scale` | "Escale Produto X — ROAS alto e margem boa" |
| `restock` | "Reponha estoque do Produto X (apenas N un)" |
| `create_offer` | "Crie oferta de tempo limitado" |
| `create_kit` | "Crie kit combo para aumentar ticket médio" |
| `adjust_target` | "Ajuste meta de ROAS baseado na margem real" |

**Regras do prompt**:
- Cada insight DEVE ter valores em R$ e nomes reais de produtos
- NÃO gera dumps de contexto ("analisei N campanhas...")
- NÃO usa IDs técnicos
- Mínimo 1 insight positivo quando há bons resultados
- Máximo 3 frases por body
- Modelo: `google/gemini-2.5-flash`

---

### v1.22.0: `ads-autopilot-strategist` — Full Meta Ads Params (Configuração Completa)

**Problema**: As tool definitions de `create_campaign` e `create_adset` tinham ~10 parâmetros, ignorando configurações obrigatórias do Meta Ads Manager (placements, optimization goal, billing event, conversion event, performance_goal, conversion_location, attribution_model, geo_locations, excluded audiences, ad format, destination URL, UTM params).

**Mudanças — `create_campaign` (35+ parâmetros)**:

| Nível | Campos Adicionados |
|---|---|
| **Campanha** | `special_ad_categories`, `lifetime_budget_cents`, `roas_avg_floor` |
| **Conjunto (inline)** | `adset_name`, `optimization_goal` (9 opções: OFFSITE_CONVERSIONS, LINK_CLICKS, etc.), `billing_event` (IMPRESSIONS/LINK_CLICKS/THRUPLAY), `conversion_event` (12 eventos Pixel: PURCHASE, ADD_TO_CART, etc.), `performance_goal` ("Maximizar Conversões"/"Maximizar Valor das Conversões"), `conversion_location` ("Site"/"Site e App"/"App"), `attribution_model` ("Padrão"/"Incremental") |
| **Targeting** | `age_min`, `age_max`, `genders`, `geo_locations` (countries/regions/cities), `interests`, `behaviors`, `custom_audience_ids`, `excluded_audience_ids`, `lookalike_spec` |
| **Posicionamentos** | `publisher_platforms` (facebook/instagram/audience_network/messenger), `position_types` (feed/story/reels/etc — 16 posições), `device_platforms` (mobile/desktop) |
| **Destino** | `destination_url` (OBRIGATÓRIO), `display_link`, `utm_params` |
| **Criativo** | `ad_name`, `ad_format` (SINGLE_IMAGE/SINGLE_VIDEO/CAROUSEL/COLLECTION), `cta` (13 CTAs) |
| **Agendamento** | `start_time`, `end_time` |

**Required fields**: `campaign_name`, `objective`, `daily_budget_cents`, `optimization_goal`, `conversion_event`, `targeting_description`, `funnel_stage`, `destination_url`, `product_name`, `primary_texts`, `headlines`, `reasoning`, `confidence`

**Mudanças — `create_adset` (25+ parâmetros)**:

Campos espelham os de `create_campaign` no nível de conjunto, incluindo: `optimization_goal`, `billing_event`, `conversion_event`, `bid_amount_cents`, `geo_locations`, `interests`, `behaviors`, `custom_audience_ids`, `excluded_audience_ids`, `publisher_platforms`, `position_types`, `device_platforms`, `destination_url`, `start_time`, `end_time`.

**Prompt atualizado**: Instrui a IA a preencher TODOS os campos como se estivesse configurando manualmente no Meta Ads Manager, usando dados reais da loja (URL, pixel, produtos).

---

### v3.0.0: `ads-autopilot-execute-approved` — Propagação Dinâmica de Parâmetros

**Problema**: O executor usava valores hardcoded (`billing_event: "IMPRESSIONS"`, `geo_locations: { countries: ["BR"] }`, `destination_type: "WEBSITE"`) independentemente do que a IA havia planejado.

**Mudanças — Propagação de `action_data` para Meta API**:

| Etapa | Antes (hardcoded) | Agora (dinâmico de `action_data`) |
|---|---|---|
| **Campanha** | `special_ad_categories` ausente | `special_ad_categories`, `lifetime_budget_cents`, `start_time`, `end_time` propagados |
| **AdSet — Targeting** | `geo_locations: {countries: ["BR"]}` fixo | `geo_locations`, `genders`, `age_min/max`, `interests`, `behaviors`, `excluded_audience_ids`, `lookalike_spec` — tudo da `action_data` |
| **AdSet — Posicionamentos** | Ausente (Automático sempre) | `publisher_platforms`, `position_types` (mapeados para `facebook_positions`/`instagram_positions`), `device_platforms` |
| **AdSet — Otimização** | `billing_event: "IMPRESSIONS"` fixo | `optimization_goal`, `billing_event`, `bid_amount_cents` da `action_data` |
| **AdSet — Conversão** | `promoted_object` com `PURCHASE` fixo | `conversion_event` dinâmico (PURCHASE, ADD_TO_CART, LEAD, etc.) |
| **Anúncio — Destino** | URL construída apenas por slug | `destination_url` da `action_data` com `utm_params` appended automaticamente |

**Lógica de Posicionamentos (Meta API mapping)**:
```typescript
// position_types são mapeados para as keys corretas da Meta API:
targeting.facebook_positions = positionTypes.filter(p => 
  ["feed", "right_hand_column", "marketplace", "video_feeds", "instant_article", "instream_video", "search", "facebook_stories", "facebook_reels"].includes(p)
);
targeting.instagram_positions = positionTypes.filter(p => 
  ["feed", "story", "reels", "explore", "profile_feed", "instagram_stories", "instagram_reels", "reels_overlay"].includes(p)
);
```

**Fallbacks mantidos**: Se a IA não especificar um campo, o executor usa defaults sensatos (ex: `geo_locations` → `{countries: ["BR"]}`, `billing_event` → `"IMPRESSIONS"`).

---

## Pipeline Sequencial de Implementação (v1.16.0)

### Arquitetura: Execução em Fases com Callback Automático

O Motor Estrategista implementa um **pipeline sequencial obrigatório** para garantir que campanhas nunca sejam criadas sem criativos prontos.

#### Fluxo Completo

```
[Plano Aprovado]
    │
    ▼
[Fase 1: implement_approved_plan]
    │  Tools permitidos: generate_creative, create_lookalike_audience
    │  Objetivo: preparar todos os ativos (imagens, públicos)
    │
    ▼
[creative-image-generate] → gera imagem → status "ready"
    │
    ▼
[Callback automático: último criativo da sessão fica "ready"]
    │  Verifica: todas as ações generate_creative da sessão estão prontas?
    │  Se SIM → invoca ads-autopilot-strategist com trigger "implement_campaigns"
    │
    ▼
[Fase 2: implement_campaigns]
    │  Tools permitidos: create_campaign, create_adset, adjust_budget
    │  Prompt injetado: {{AVAILABLE_CREATIVES}} com URLs dos ativos prontos
    │  Objetivo: montar estrutura de campanhas para aprovação (pending_approval)
    │
    ▼
[Usuário aprova] → execute-approved → publicação na Meta API
```

#### Regras de Restrição de Tools por Trigger

| Trigger | Tools Permitidos | Objetivo |
|---|---|---|
| `implement_approved_plan` | `generate_creative`, `create_lookalike_audience` | Preparar ativos |
| `implement_campaigns` | `create_campaign`, `create_adset`, `adjust_budget` | Montar campanhas |
| `start` / `weekly` / `monthly` | Todos os tools | Análise completa |
| `revision` | Todos os tools | Re-análise após feedback |

#### Callback de Sessão Completa (`creative-image-generate` v4.2.0)

Quando um criativo atinge status `ready`:
1. Busca a sessão (`session_id`) do criativo
2. Conta quantas ações `generate_creative` existem na sessão
3. Conta quantas têm `creative_url` preenchido no `action_data`
4. Se `total === prontos` → dispara `implement_campaigns` automaticamente

```typescript
// Verificação de completude da sessão
const { count: totalCreatives } = await supabase
  .from("ads_autopilot_actions")
  .select("*", { count: "exact", head: true })
  .eq("session_id", sessionId)
  .eq("action_type", "generate_creative");

const { count: readyCreatives } = await supabase
  .from("ads_autopilot_actions")
  .select("*", { count: "exact", head: true })
  .eq("session_id", sessionId)
  .eq("action_type", "generate_creative")
  .not("action_data->creative_url", "is", null);

if (totalCreatives === readyCreatives) {
  // Trigger fase 2
  await supabase.functions.invoke("ads-autopilot-strategist", {
    body: { tenant_id, trigger: "implement_campaigns" }
  });
}
```

#### Injeção de Criativos Disponíveis (Fase 2)

Na fase `implement_campaigns`, o prompt recebe a lista de criativos prontos:

```
{{AVAILABLE_CREATIVES}}
- Shampoo Calvície Zero: https://storage.../creative-abc.png
- Kit Banho: https://storage.../creative-def.png
```

A IA usa essas URLs diretamente no `action_data.preview.creative_url` das campanhas propostas.

#### Fallback: Criativos com Erro

Se um criativo falha (status `failed`), ele **não bloqueia** o pipeline. O callback conta apenas criativos com `creative_url` preenchido. Se todos falharem, o callback ainda dispara `implement_campaigns` e a IA usa imagens do catálogo como fallback.

### Proibições

| Proibido | Motivo |
|---|---|
| `create_campaign` durante `implement_approved_plan` | Campanha ficaria sem criativos |
| `generate_creative` durante `implement_campaigns` | Fase de preparação já encerrada |
| Pular Fase 1 direto para Fase 2 | Violaria dependência sequencial |
| Callback manual (sem verificação de completude) | Risco de campanhas parciais |

---

### v1.25.0: `ads-autopilot-strategist` — Schema Estruturado da Tool `strategic_plan` (v6)

**Problema**: O schema anterior da tool `strategic_plan` usava `planned_actions` como `string[]`, permitindo que a IA gerasse textos vagos e genéricos (ex: "Criar campanha TOF focada em novos clientes...") sem detalhamento técnico de orçamento, público, funil ou métricas.

**Mudanças — Schema Estruturado**:

#### `planned_actions` (antes: `string[]` → agora: `array de objetos`)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `action_type` | string | ✅ | Tipo: `new_campaign`, `adjust_budget`, `pause`, `test`, `scale`, `restructure` |
| `campaign_type` | string | ✅ | TOF, BOF, MOF, Test, Remarketing |
| `product_name` | string | ✅ | Nome exato do produto do catálogo |
| `daily_budget_brl` | number | ✅ | Orçamento diário em R$ |
| `target_audience` | string | ✅ | Descrição do público-alvo |
| `funnel_stage` | string | ✅ | tof, mof, bof, test |
| `objective` | string | ✅ | Objetivo da campanha |
| `performance_goal` | string | ✅ | Meta de desempenho: "Maximizar Conversões" ou "Maximizar Valor das Conversões" |
| `conversion_location` | string | ✅ | Local da conversão: "Site", "Site e App", "App" |
| `attribution_model` | string | ❌ | Modelo de atribuição: "Padrão" ou "Incremental" |
| `creatives_count` | number | ❌ | Qtd de criativos planejados |
| `copy_variations` | number | ❌ | Qtd de variações de copy |
| `rationale` | string | ✅ | Justificativa detalhada da ação |
| `expected_roas` | number | ❌ | ROAS esperado |
| `placements` | string | ❌ | Feed, Stories, Reels, etc. |

#### `budget_allocation` (novo campo obrigatório)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `total_daily_brl` | number | ✅ | Orçamento diário total do plano |
| `tof_pct` | number | ✅ | % alocado para TOF (aquisição) |
| `tof_brl` | number | ✅ | Valor em R$ para TOF |
| `bof_pct` | number | ✅ | % alocado para BOF (remarketing) |
| `bof_brl` | number | ✅ | Valor em R$ para BOF |
| `test_pct` | number | ✅ | % alocado para Testes |
| `test_brl` | number | ✅ | Valor em R$ para Testes |

#### `diagnosis.description` — Mínimo 300 palavras

O campo `description` do diagnóstico agora exige **mínimo 300 palavras** no schema da tool para forçar análise profunda com dados reais (ROAS, CPA, receita, ticket médio, campanhas ativas, problemas identificados).

#### Frontend `StrategicPlanContent` (v6)

- Renderiza `planned_actions` como **cards estruturados** com badges dinâmicos (funnel_stage, campaign_type, action_type)
- Exibe métricas financeiras em destaque: `daily_budget_brl`, `expected_roas`
- Nova seção **Alocação de Orçamento** com barra visual de funil (TOF/BOF/Test)
- **Retrocompatível**: Se `planned_actions` for `string[]` (formato legado), renderiza como lista simples

#### Componentes Afetados

| Componente | Mudança |
|---|---|
| `StrategicPlanContent.tsx` | Renderização de ações estruturadas + alocação de orçamento visual |
| `ActionApprovalCard.tsx` | Passa `actionData` completo para `StrategicPlanContent` |
| `ActionDetailDialog.tsx` | Passa `actionData` para renderização no diálogo de detalhes |

---

### v1.29.0: `ads-autopilot-strategist` — Análise Histórica Profunda + Mandato Mensal

**Problema**: O contexto do estrategista era limitado a 7-30 dias de métricas agregadas por campanha. Não havia visibilidade sobre performance de AdSets individuais (públicos), Ads individuais (criativos/copys), nem breakdowns de posicionamento (Feed vs Reels vs Stories). Isso impedia a IA de identificar padrões históricos de sucesso.

**Mudanças — Deep Historical Analysis (trigger `start`)**:

#### Nova função: `fetchDeepHistoricalInsights`
- Chamada **exclusivamente** no trigger `start` (primeira ativação)
- Consulta a **Meta Graph API diretamente** com `date_preset=maximum` (todo o histórico disponível)
- Coleta insights em **3 níveis hierárquicos**:
  - **Campanhas**: spend, impressions, clicks, conversions, revenue, CPA, ROAS
  - **AdSets (Públicos)**: mesmas métricas + nome do público + tipo de targeting
  - **Ads (Criativos)**: mesmas métricas + headline, body, CTA, thumbnail_url
- **Breakdown de Posicionamentos**: `publisher_platform` + `platform_position` (Feed, Reels, Stories, Search, etc.)
- Extrai e injeta no prompt:
  - **Top 5 AdSets** por ROAS (públicos que mais converteram)
  - **Top 5 Ads** por ROAS (criativos/copys que mais performaram)
  - **Top 3 Posicionamentos** por CPA (onde as conversões são mais baratas)
  - Separação por funil: **TOF** (Público Frio) vs **BOF** (Remarketing)

#### Placeholder no prompt: `{{DEEP_HISTORICAL_DATA}}`
- Injetado no system prompt do trigger `start`
- Contém análise formatada com seções:
  1. `TOP AUDIENCES (by ROAS)` — Nome, tipo, spend, conversões, ROAS
  2. `TOP CREATIVES (by ROAS)` — Headline, body, CTA, spend, ROAS
  3. `TOP PLACEMENTS (by CPA)` — Plataforma, posição, CPA, CTR
  4. `COLD vs WARM PERFORMANCE` — Métricas agregadas por temperatura de público

#### Mandato Mensal (`trigger: monthly`)
- **Período fixo**: Últimos 30 dias de dados (não mais 7-30)
- **Obrigatoriedade**: `tool_choice: "required"` para `strategic_plan` — a IA DEVE gerar um plano todo mês
- **Mesmo que mantenha**: Se a recomendação for manter o plano atual, a IA deve documentar o porquê com diagnóstico completo
- **Prompt diferenciado**: Inclui instrução explícita para análise de 30 dias e proposta de plano para o próximo mês

#### Triggers e Períodos de Análise
| Trigger | Período de Dados | Profundidade | Obrigatório Gerar Plano |
|---------|-----------------|-------------|------------------------|
| `start` | `date_preset=maximum` (todo histórico) | Campanha + AdSet + Ad + Placement | ✅ Sim |
| `monthly` | Últimos 30 dias | Campanha (padrão) | ✅ Sim (mandato mensal) |
| `weekly` | Últimos 7 dias | Campanha (padrão) | ❌ Não (opcional) |
| `implement_approved_plan` | N/A (execução) | N/A | N/A |

#### Fluxo de Dados (trigger `start`)
```
Meta Graph API
  ├── GET /{ad_account_id}/insights?level=campaign&date_preset=maximum
  ├── GET /{ad_account_id}/insights?level=adset&date_preset=maximum
  ├── GET /{ad_account_id}/insights?level=ad&date_preset=maximum
  └── GET /{ad_account_id}/insights?level=ad&date_preset=maximum&breakdowns=publisher_platform,platform_position
      │
      ▼
  fetchDeepHistoricalInsights()
      │ Processa, rankeia por ROAS/CPA
      ▼
  context.deepHistoricalData = { topAdsets, topAds, topPlacements, coldVsWarm }
      │
      ▼
  buildStrategistPrompt() → {{DEEP_HISTORICAL_DATA}} substituído
      │
      ▼
  IA gera strategic_plan com base em TODO o histórico da conta
```

#### Componentes Afetados

| Componente | Mudança |
|---|---|
| `ads-autopilot-strategist/index.ts` | Nova função `fetchDeepHistoricalInsights`, atualização de `collectStrategistContext` com parâmetro `trigger`, prompt diferenciado por trigger |
| `useAdsAutopilot.ts` | Sem mudanças (triggers existentes já suportam `start` e `monthly`) |

---

### v1.33.0: `ads-autopilot-strategist` — Formato Tabular Compacto (Análise Completa sem Limites)

**Problema**: A v1.32.0 limitava o prompt a ~20 campanhas pausadas, 30 adsets e 30 ads para evitar rate limits. Isso impedia a IA de ver a conta completa, causando diagnósticos incompletos em contas com alto volume.

**Solução**: Substituição de `JSON.stringify(data, null, 2)` por formato tabular compacto (pipe-separated), reduzindo ~70-80% dos tokens por entidade e eliminando todos os limites de quantidade.

#### Formato de Dados no Prompt (v1.33.0)

| Entidade | Antes (v1.32.0) | Depois (v1.33.0) |
|----------|-----------------|-------------------|
| Campanhas | JSON completo, limitado a ativas + top 20 pausadas | Tabular (pipe-separated), **TODAS** |
| AdSets | JSON, limitado a 30 | Tabular, **TODOS** |
| Ads | JSON, limitado a 30 | Tabular, **TODOS** |
| Públicos | JSON, todos | Tabular, todos |
| Produtos | JSON, 15 | Compacto inline, 20 |

#### Exemplo de Formato Tabular
```
ID | Nome | Status | EffStatus | Objetivo | Budget/dia | ROAS30d | CPA30d | Spend30d | Conv30d | CTR30d | ROAS7d | CPA7d | Spend7d | Conv7d
123456 | [AI] TOF Shampoo Broad | ACTIVE | ACTIVE | OUTCOME_SALES | 50.00 | 3.2 | 2500 | 1500 | 6 | 1.20% | 4.1 | 2000 | 500 | 3
```

#### Regras Anti-Regressão
- [ ] Nenhum `.slice()` ou `.limit()` nos dados de campanhas, adsets ou ads no prompt
- [ ] Formato tabular com headers pipe-separated (não JSON)
- [ ] Valores monetários em centavos convertidos para reais (÷100) com `fmtCents()`
- [ ] Cadência de criativos e experimentos ativos permanecem em JSON (volume pequeno)
