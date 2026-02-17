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

## OpenAI API — Parâmetros por Modelo

| Modelo | Parâmetro de Tokens | Temperature |
|--------|---------------------|-------------|
| `gpt-4o`, `gpt-4-turbo` | `max_tokens` | `0-2` |
| `gpt-5`, `gpt-5.2` | `max_completion_tokens` | `0-2` |
| `gpt-5-mini`, `gpt-5-nano` | `max_completion_tokens` | `1` (fixo!) |

```typescript
// ✅ CORRETO: Detectar modelo e usar parâmetro apropriado
const isGpt5Model = model.startsWith("gpt-5");
const tokenParams = isGpt5Model 
  ? { max_completion_tokens: 1024 }
  : { max_tokens: 1024 };
```

### Fallback entre Modelos

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

### Versão Atual: v5.9.0

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

### Versão Atual: v4.2.0

### Visão Geral
Edge Function de chat conversacional **multimodal** com **tool calling real** para o Gestor de Tráfego IA. Opera como assistente de tráfego pago com acesso completo de leitura e escrita ao módulo de tráfego, sem alucinações. Suporta análise de imagens, arquivos e URLs.

### Arquitetura: Tool Calling em 3 Etapas
1. **Chamada Inicial (não-streaming, timeout 45s)**: Envia mensagem do usuário + histórico (últimas 15 mensagens) + definições de ferramentas → IA decide se precisa chamar ferramentas
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
| **Timeout (>45s)** | Retorna mensagem visível: "O processamento demorou mais que o esperado — crie uma nova conversa" |
| **Rate limit (429)** | Salva mensagem de erro no chat + retorna HTTP 429 |
| **Créditos (402)** | Salva mensagem de erro no chat + retorna HTTP 402 |
| **Erro genérico** | Retorna erro como SSE para que o cliente exiba no chat |
| **Sem resposta da IA** | NUNCA falha silenciosamente — sempre há uma mensagem para o usuário |

**REGRA**: Erros NUNCA devem ser silenciosos. Toda falha DEVE produzir uma mensagem visível no chat para que o usuário saiba o que aconteceu.

### Histórico de Conversa (v2.3.0)
- Carrega apenas as **últimas 15 mensagens** (com conteúdo não-nulo) em ordem cronológica
- Evita bloat de contexto que causava timeouts em conversas longas
- Se a conversa ficar muito longa, o sistema sugere criar uma nova conversa

### Contexto Injetado no System Prompt (v2.2.0)
O system prompt é construído dinamicamente com:
1. **user_instructions**: O prompt estratégico configurado pelo lojista na conta de anúncios (ex: nicho, produtos prioritários, compliance, tom)
2. **Catálogo de Produtos**: Top 10 produtos ativos com nome, preço e descrição — obrigatório para evitar que a IA invente nomes de produtos
3. **Configurações de conta**: Budget, ROI alvo, splits de funil, modo de estratégia
4. **Vendas 30d**: Pedidos pagos, receita, ticket médio

### Regra Anti-Alucinação (CRÍTICA)
O system prompt inclui uma **"Regra Suprema: Honestidade Absoluta"** que proíbe a IA de:
- Inventar métricas, status ou resultados
- Fingir que está gerando imagens, renderizando ou processando
- Dizer "estou finalizando" sem ter executado uma ferramenta
- Afirmar capacidades que não possui
- Inventar nomes de produtos, preços ou descrições (deve usar APENAS o catálogo real)
- Contornar erros de ferramentas com texto inventado

### Ferramentas Disponíveis (Tool Calling) — v4.2.0
| Ferramenta | Descrição | Tipo |
|-----------|-----------|------|
| `get_campaign_performance` | Métricas reais 7d de campanhas Meta (spend, ROAS, CPA, cliques, conversões) | Leitura |
| `get_google_campaigns` | Performance de campanhas Google Ads (spend, clicks, conversions, ROAS) | Leitura |
| `get_tiktok_campaigns` | Performance de campanhas TikTok Ads (spend, impressions, clicks, conversions) | Leitura |
| `get_meta_adsets` | Lista ad sets Meta com targeting, budget e status | Leitura |
| `get_meta_ads` | Lista anúncios Meta com status, criativo e preview URL | Leitura |
| `get_audiences` | Lista públicos/audiências Meta (Custom Audiences, Lookalikes) | Leitura |
| `get_creative_assets` | Lista criativos existentes e status | Leitura |
| `get_autopilot_config` | Lê configurações do Autopilot para uma conta (ROI, budget, estratégia, splits) | Leitura |
| `get_autopilot_actions` | Lista ações executadas/agendadas pelo Autopilot | Leitura |
| `get_autopilot_insights` | Lista insights e diagnósticos reais | Leitura |
| `get_autopilot_sessions` | Histórico de sessões de análise do Autopilot | Leitura |
| `get_tracking_health` | Status de saúde do tracking (pixels, conversões) | Leitura |
| `get_experiments` | Lista experimentos/testes A/B ativos e finalizados | Leitura |
| `update_autopilot_config` | Atualiza config do Autopilot (ROI, budget, estratégia, instruções) | Escrita |
| `trigger_creative_generation` | Dispara geração de briefs criativos (headlines + copy) | Execução |
| `generate_creative_image` | Gera IMAGENS reais via IA (Gemini) para criativos de anúncios | Execução |
| `create_meta_campaign` | Cria campanha COMPLETA no Meta (Campaign→AdSet→Ad com criativo do Drive). Busca criativos automaticamente, faz upload de imagem, cria ad creative, e agenda ativação para 00:01-04:00 BRT | Execução |
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

### Fluxo de Conversação
1. Usuário envia mensagem (com ou sem anexos) via `useAdsChat` hook
2. Anexos são uploadados para `store-assets` via `useSystemUpload`
3. Edge function cria/recupera conversa em `ads_chat_conversations`
4. Salva mensagem do usuário em `ads_chat_messages` (com attachments JSONB)
5. Coleta contexto base (tenant, configs, **user_instructions**, **catálogo de produtos**, pedidos 30d)
6. Monta mensagem multimodal (imagens como `image_url`, arquivos como texto)
7. Seleciona modelo (vision vs text) baseado nos anexos
8. Executa pipeline de 3 etapas (tool calling) com **timeout de 45s**
9. Salva resposta da IA em `ads_chat_messages` (inclusive erros)
10. Retorna streaming SSE para o frontend

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
| `marketplace_connections` | `ads-chat` |
| `marketing_integrations` | `ads-chat` |
