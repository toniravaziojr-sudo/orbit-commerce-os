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

### Versão Atual: v2.1.0

### Visão Geral
Edge Function autônoma de gestão de tráfego pago multi-canal (Meta, Google, TikTok). Opera como media buyer sênior com pipeline de 5 etapas, camada de segurança determinística e **conhecimento específico por plataforma**.

### Agendamento
- **Cron**: `0 */6 * * *` (a cada 6 horas — 4 ciclos/dia)
- **Gatilho**: `scheduled` (automático) ou `manual` (botão na UI)
- A IA **não altera campanhas em todos os ciclos** — só age quando KPIs indicam necessidade

### Pipeline de 5 Etapas
1. **Pre-check**: Validação de tokens/conexões por canal
2. **Context Collector**: Coleta de métricas 7d + 7d anterior, produtos top 20, pedidos 30d, alertas de estoque
3. **Allocator**: Split orçamentário cross-channel baseado em ROAS marginal e tendências
4. **Planner**: Decisões por campanha via tool calling com **conhecimento específico da plataforma**
5. **Policy & Constraints**: Validação determinística com **limites de budget por plataforma**

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

### Regras de Segurança (Safety Rules)
| Regra | Default | Descrição |
|-------|---------|-----------|
| `max_budget_change_pct_day` | 10% | Máximo genérico (sobreescrito por regra da plataforma) |
| `max_actions_per_session` | 10 | Limite de ações por ciclo de análise |
| `min_data_days_for_action` | 3 | Dias mínimos de dados para executar ações (abaixo = recommendation-only) |
| `ramp_up_max_pct` | 10% | Aumento acima disso requer confidence ≥ 0.7 |
| `max_new_campaigns_per_day` | 2 | Limite de campanhas novas criadas por dia |
| `gross_margin_pct` | 50% | Margem bruta para cálculo do CPA máximo |
| `min_roas` | 2.0 | ROAS mínimo aceitável |

### Limites de Budget por Plataforma (v2.1.0)
| Plataforma | Máx. por ciclo (6h) | Regra da plataforma | Learning Phase |
|------------|---------------------|---------------------|----------------|
| **Meta** | ±10% | ±20% a cada 48h | ~50 conversões em 7 dias |
| **Google** | ±15% | ±30% a cada 48-72h | ~30 conversões em 14 dias |
| **TikTok** | ±7% | ±15% a cada 48h | ~50 conversões em 7 dias |

### Conhecimento de Audiência (v2.1.0)
A IA diferencia campanhas por tipo de público:
| Tipo | Descrição | CPA esperado | Budget recomendado |
|------|-----------|-------------|-------------------|
| **Frio (TOF)** | Lookalike, interesses, broad | 1.5x-3x maior | 60-70% (Meta), 50-60% (Google), 70-80% (TikTok) |
| **Quente (MOF)** | Visitantes, engajadores | Médio | 20-30% |
| **Hot (BOF)** | Carrinhos, compradores | Menor, ROAS alto | 10-20% |

### Investimento Inicial Mínimo por Plataforma (v2.1.0)
| Plataforma | Conversão | Tráfego | Reconhecimento |
|------------|-----------|---------|----------------|
| **Meta** | R$30/dia (10x CPA) | R$20/dia | R$15/dia |
| **Google Search** | R$30/dia | — | — |
| **Google Shopping/PMax** | R$50/dia | — | — |
| **TikTok** | R$50/dia | R$30/dia | — |

### Critérios de Pausa por Plataforma (v2.1.0)
| Plataforma | Critério de pausa |
|------------|-------------------|
| **Meta** | CPA > 2x alvo por 3+ dias (pós-learning), ROAS < 50% mín por 5d, Freq > 3.0, CTR < 0.5% |
| **Google Search** | CPA > 2x alvo por 7+ dias com 30+ cliques |
| **Google Shopping** | ROAS < 1.5x por 7+ dias |
| **TikTok** | CPA > 2.5x alvo por 5+ dias (pós-learning), CTR < 0.3%, NÃO pausar com < 7 dias |

### Rollout Progressivo (Phased)
| Fase | Ações Permitidas (`allowed_actions`) |
|------|--------------------------------------|
| Fase 1 (Semana 1) | `pause_campaign`, `adjust_budget`, `report_insight`, `allocate_budget` |
| Fase 2 (Semana 2) | + `create_campaign` |
| Fase 3 (Semana 3) | + `generate_creative` |

### Checklist do Planner (7 pontos obrigatórios — v2.1.0)
1. **Learning Phase** — A campanha está em aprendizado? Se sim, apenas report_insight
2. **Tipo de Audiência** — Público frio vs quente (CPA relativo, não absoluto)
3. **Eficiência (CPA)** — CPA vs teto de margem (contextualizado por tipo de público)
4. **Retorno (ROAS)** — Acima ou abaixo do mín. configurado
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

### Mapeamento Tabela → Edge Function
| Tabela | Edge Function |
|--------|---------------|
| `ads_autopilot_configs` | `ads-autopilot-analyze` |
| `ads_autopilot_sessions` | `ads-autopilot-analyze` |
| `ads_autopilot_actions` | `ads-autopilot-analyze` |
| `meta_ad_campaigns` | `ads-autopilot-analyze` |
| `meta_ad_insights` | `ads-autopilot-analyze` |
| `google_ad_campaigns` | `ads-autopilot-analyze` |
| `google_ad_insights` | `ads-autopilot-analyze` |
| `tiktok_ad_campaigns` | `ads-autopilot-analyze` |
| `tiktok_ad_insights` | `ads-autopilot-analyze` |
| `products` | `ads-autopilot-analyze` |
| `orders` | `ads-autopilot-analyze` |
