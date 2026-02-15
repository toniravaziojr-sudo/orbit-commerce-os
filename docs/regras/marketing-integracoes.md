# Marketing — Regras e Especificações

> **STATUS:** 🟧 Pending (parcialmente implementado)  
> **Última atualização:** 2026-01-28

---

## Visão Geral

Módulo de marketing dividido em **dois grupos** na navegação:

### Marketing Básico
Integrações com plataformas e configurações de atribuição/conversão.

| Submódulo | Rota | Status |
|-----------|------|--------|
| Integrações Marketing | `/marketing` | 🟧 Pending |
| Atribuição de venda | `/marketing/atribuicao` | 🟧 Pending |
| Descontos | `/discounts` | ✅ Ready (ver descontos.md) |
| Aumentar Ticket | `/offers` | ✅ Ready (ver ofertas.md) |

### Marketing Avançado
Ferramentas de engajamento, automação e geração de criativos com IA.

| Submódulo | Rota | Status |
|-----------|------|--------|
| Email Marketing | `/email-marketing` | 🟧 Pending (ver email-marketing.md) |
| Quizzes | `/quizzes` | 🟧 Pending (ver quizzes.md) |
| Gestor de Mídias IA | `/media` | ✅ Ready |
| Gestor de Tráfego IA | `/campaigns` | 🟧 Pending |
| Gestão de Criativos | `/creatives` | ✅ Ready (ver seção 6) |

---

## RBAC

A divisão reflete nas permissões:

| Módulo RBAC | Key | Descrição |
|-------------|-----|-----------|
| Marketing Básico | `marketing-basic` | Integrações, atribuição, descontos e ofertas |
| Marketing Avançado | `marketing-advanced` | Email marketing, quizzes, gestor de mídias, tráfego e criativos |

---

## 1. Integrações Marketing

### Plataformas
| Plataforma | Status | Funcionalidades |
|------------|--------|-----------------|
| Meta (FB/IG) | ✅ Ready | Pixel, Catálogo, CAPI, OAuth integrador |
| Google Ads | 🟧 Pending | Conversions, Merchant |
| TikTok | ✅ Ready | Pixel, Events API, OAuth integrador → **Migrado para Hub TikTok em `/integrations`** |
| Pinterest | 🟧 Pending | Tag, Catálogo |

### TikTok OAuth (MIGRADO E LIMPO — Fase 2 Concluída)

> **STATUS:** ✅ MIGRAÇÃO COMPLETA — Sem dual-write, sem fallback  
> **Fase 1 concluída em:** 2026-02-15  
> **Fase 2 concluída em:** 2026-02-15  
> **Documentação completa:** `docs/regras/integracoes.md` → seção "TikTok — Hub Multi-Conexão"

A integração TikTok foi completamente migrada de `marketing_integrations` para o Hub TikTok.

#### O que mudou na Fase 2

| Item | Antes (Fase 1) | Depois (Fase 2) |
|------|-----------------|------------------|
| `tiktok-oauth-callback` | v2 dual-write | v3 só `tiktok_ads_connections` |
| `tiktok-token-refresh` | v1 dual-write | v2 só `tiktok_ads_connections` |
| `marketing-send-tiktok` | v2 fallback legado | v3 só `tiktok_ads_connections` |
| `useTikTokConnection.ts` | Deprecated | **Deletado** |
| `TikTokIntegrationCard.tsx` | Deprecated | **Deletado** |

#### Colunas legadas em `marketing_integrations`

As colunas `tiktok_*` em `marketing_integrations` **não são mais escritas** por nenhuma edge function.  
Podem ser removidas em uma futura migração de limpeza.

### Meta Pixel & CAPI
```typescript
// Eventos rastreados
{
  PageView: 'Visualização de página',
  ViewContent: 'Visualização de produto',
  AddToCart: 'Adição ao carrinho',
  InitiateCheckout: 'Início do checkout',
  Purchase: 'Compra concluída',
}

// Configuração por tenant
{
  tenant_id: uuid,
  pixel_id: string,
  access_token: string,       // Para CAPI
  test_event_code: string,    // Ambiente de teste
  is_enabled: boolean,
}
```

---

## 2. Atribuição de Vendas

### Fontes de Tráfego
| Parâmetro | Descrição |
|-----------|-----------|
| `utm_source` | Origem (google, facebook, etc) |
| `utm_medium` | Meio (cpc, email, social) |
| `utm_campaign` | Campanha |
| `utm_term` | Termo de busca |
| `utm_content` | Conteúdo/criativo |
| `aff` | Código de afiliado |
| `ref` | Referência genérica |

### Modelo de Atribuição
| Modelo | Descrição |
|--------|-----------|
| Last Click | Última fonte antes da compra |
| First Click | Primeira fonte conhecida |
| Linear | Divide entre todas as fontes |

### Campos no Pedido
```typescript
{
  attribution_data: {
    first_touch: {
      source: string,
      medium: string,
      campaign: string,
      timestamp: string,
    },
    last_touch: {
      source: string,
      medium: string,
      campaign: string,
      timestamp: string,
    },
    touchpoints: Array<TouchPoint>,
  }
}
```

---

## 3. Email Marketing

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Listas | 🟧 Pending | Segmentação |
| Templates | 🟧 Pending | Editor visual |
| Campanhas | 🟧 Pending | Envio em massa |
| Automações | 🟧 Pending | Fluxos automáticos |
| Métricas | 🟧 Pending | Open rate, CTR |

### Tipos de Automação
| Tipo | Trigger | Descrição |
|------|---------|-----------|
| Boas-vindas | Cadastro | Série de onboarding |
| Carrinho abandonado | Inatividade | Recuperação |
| Pós-compra | Compra | Upsell/review |
| Aniversário | Data | Cupom especial |
| Reativação | Inatividade | Win-back |

---

## 4. Gestor de Mídias IA

> **Antigo nome:** Mídias Sociais

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Media.tsx` | Dashboard de mídias |
| `src/pages/MediaCampaignDetail.tsx` | Detalhe de campanha |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Catálogo de criativos | 🟧 Pending | Imagens/vídeos |
| Campanhas de mídia | 🟧 Pending | Gestão |
| Performance | 🟧 Pending | Métricas |
| ROI | 🟧 Pending | Análise |

---

## 5. Gestor de Tráfego IA (Autopilot)

> **STATUS:** ✅ Ready (Fase 1-8 implementadas)  
> **Rota:** `/ads`

### Arquitetura

Pipeline autônomo de 5 etapas que gerencia tráfego pago cross-channel:

```text
Lojista (Orçamento Total + Instruções)
  → Etapa 0: Pre-check de Integrações (canal conectado? pixel ativo? dev token?)
  → Etapa 1: Lock (evitar sessões concorrentes)
  → Etapa 2: Context Collector (produtos top 20, pedidos 30d, campanhas, insights 7d)
  → Etapa 3: Allocator (GPT-5.2 decide split Meta/Google/TikTok por ROAS marginal)
  → Etapa 4: Planner (GPT-5.2 propõe ações por canal) + Policy Layer (validação determinística)
  → Etapa 5: Executor (executa ações validadas via edge functions de cada canal)
```

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ads_autopilot_configs` | Config global (`channel='global'`) + configs por canal |
| `ads_autopilot_sessions` | Histórico de sessões de análise |
| `ads_autopilot_actions` | Ações da IA com reasoning, rollback_data e action_hash |

### Config Global (`channel='global'`)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `budget_mode` | text | `daily` / `monthly` |
| `budget_cents` | integer | Orçamento total cross-channel |
| `allocation_mode` | text | `auto` (IA decide) / `manual` |
| `objective` | text | Fixo em `sales` (hardcoded no frontend) |
| `user_instructions` | text | Prompt livre do lojista (direcionamento estratégico) |
| `ai_model` | text | Default `openai/gpt-5.2` |
| `safety_rules` | jsonb | Ver tabela abaixo |
| `lock_session_id` | uuid | Sessão que detém o lock (nullable) |

### Safety Rules — Config Global (JSONB)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `target_roi` | number | null | **ROI Ideal** — Meta de retorno global que a IA busca alcançar somando todo investimento × todas as campanhas em todos os canais |
| `max_budget_change_pct_day` | number | 10 | Limite de alteração diária ±% |
| `max_actions_per_session` | number | 10 | Máximo de ações por sessão |
| `allowed_actions` | string[] | `["pause_campaign","adjust_budget","report_insight","allocate_budget"]` | Faseamento do rollout |

### Safety Rules — Config por Canal (JSONB)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `min_roi_cold` | number | null | ROI mínimo para pausar campanhas de público frio (prospecção) |
| `min_roi_warm` | number | null | ROI mínimo para pausar campanhas de público quente (remarketing) |

> **Nota:** Os campos `gross_margin_pct`, `max_cpa_cents` e `min_roas` foram removidos da config global (v3.1). O ROI é agora gerido em dois níveis: ROI Ideal (global, meta aspiracional) e ROI Mínimo para Pausar (por canal, frio vs quente).

### Tipos de Ação

| Ação | Semana | Descrição |
|------|--------|-----------|
| `allocate_budget` | 1 | Distribuição cross-channel |
| `pause_campaign` | 1 | Pausar campanha de baixo desempenho |
| `adjust_budget` | 1 | Ajustar orçamento de campanha |
| `report_insight` | 1 | Insight sem execução |
| `create_campaign` | 2 | Criar campanha com templates fixos |
| `generate_creative` | 3 | Gerar criativos via `ads-autopilot-creative` |

### Guardrails

- **Lock por tenant:** `lock_session_id` impede sessões concorrentes (expira em 10 min)
- **Idempotência:** `action_hash` UNIQUE (`session_id + action_type + target_id`)
- **Policy Layer:** Validação determinística antes de qualquer execução
- **Nunca deletar:** Só pausar campanhas
- **CPA baseado em margem:** Não em ticket médio

### Edge Functions

| Function | Descrição |
|----------|-----------|
| `ads-autopilot-analyze` | Orquestrador principal (pipeline 5 etapas) |
| `ads-autopilot-creative` | Geração de criativos para campanhas via autopilot |

### Arquivos Frontend

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/AdsManager.tsx` | Página principal com hooks de conexão por canal |
| `src/hooks/useAdsAutopilot.ts` | Hook para configs, actions, sessions |
| `src/components/ads/AdsGlobalConfig.tsx` | Card config global (orçamento + ROI ideal + prompt) |
| `src/components/ads/AdsChannelIntegrationAlert.tsx` | Alerta de integração por canal (não conectado → link para /integrations; conectado → chips de seleção de contas de anúncio com toggle) |
| `src/components/ads/AdsChannelRoasConfig.tsx` | Config de ROI por canal (frio/quente) + toggle IA |
| `src/components/ads/AdsCampaignsTab.tsx` | Campanhas por canal com: filtro por status (Todas/Ativas/Pausadas via ToggleGroup com contadores), filtro por contas selecionadas, agrupamento por conta, gestão manual (pausar/ativar via Meta API), botão de sync permanente |
| `src/components/ads/AdsActionsTab.tsx` | Timeline de ações da IA |
| `src/components/ads/AdsReportsTab.tsx` | Cards resumo + gráficos |

### Pre-check de Integrações

Antes de executar, o autopilot verifica automaticamente:

| Canal | Verificação |
|-------|-------------|
| Meta | Conexão ativa em `marketplace_connections` |
| Google | Conexão ativa em `google_connections` + Developer Token em `platform_credentials` |
| TikTok | Conexão ativa em `tiktok_ads_connections` |

Se falhar → status `BLOCKED`, gera `report_insight` com o que falta.

### Sincronização de Campanhas

| Comportamento | Descrição |
|---------------|-----------|
| **Auto-sync** | Na primeira visualização de um canal conectado, se a lista de campanhas estiver vazia, dispara `syncCampaigns.mutate()` automaticamente (controlado por `syncedChannelsRef` para evitar re-trigger) |
| **Sync manual** | Botão "Sincronizar" exibido **permanentemente** na toolbar da `AdsCampaignsTab` quando há campanhas e `isConnected=true`; também no `EmptyState` quando não há campanhas |
| **Filtro por status** | ToggleGroup com 3 opções: Todas (total), Ativas (ACTIVE/ENABLE), Pausadas (PAUSED/DISABLE/ARCHIVED) — cada uma com badge de contagem |
| **Gestão manual** | Botões de Pausar (⏸) e Ativar (▶) por campanha, chamam `onUpdateCampaign` que dispara update na API da plataforma (Meta/TikTok) em tempo real |

### Edge Function `meta-ads-campaigns` (v1.1.0)

| Item | Descrição |
|------|-----------|
| **Query de conexão** | Usa `marketplace_connections` com filtro `marketplace='meta'` e `is_active=true` |
| **Multi-account** | Itera por **todas** as contas de anúncio do tenant (não apenas a primeira) |
| **Ações** | `sync` (todas as contas), `create` / `update` / `delete` (requerem `ad_account_id` no body) |
| **Upsert** | Campanhas sincronizadas via `meta_campaign_id` como chave de conflito |

---

## 6. Gestão de Criativos

> **STATUS:** ✅ Ready  
> **Rota:** `/creatives`

Módulo para geração de criativos com IA (vídeos e imagens) via fal.ai e OpenAI.

### Arquivos Principais
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Creatives.tsx` | Página principal com 7 abas |
| `src/types/creatives.ts` | Tipos e configurações de modelos |
| `src/hooks/useCreatives.ts` | Hooks para jobs e pasta |
| `src/components/creatives/*` | Componentes de cada aba |
| `src/components/creatives/CreativeGallery.tsx` | Galeria visual dos criativos gerados |
| `src/components/creatives/AvatarMascotTab.tsx` | Aba de Avatar Mascote |

### As 7 Abas

#### Aba 1: UGC Cliente (Transformar vídeo)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Vídeo base + imagens referência |
| **Opções** | Trocar pessoa, fundo, voz |
| **Modelos** | PixVerse Swap, ChatterboxHD, Sync LipSync |

#### Aba 2: UGC 100% IA (Avatar IA)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Script + referência avatar |
| **Modos** | Avatar falando / Full video |
| **Modelos** | Kling AI Avatar v2 Pro, Veo 3.1, Sora 2 |

#### Aba 3: Vídeos Curtos (Talking Head)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Tópico + bullets + tom |
| **Opções** | Variações A/B/C |
| **Modelos** | Kling AI Avatar, Sync LipSync |

#### Aba 4: Vídeos Tech (Produto)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Produto + imagens + estilo |
| **Estilos** | Tech premium, Clean studio, Futurista |
| **Modelos** | Veo 3.1 First/Last Frame, Sora 2 Image-to-Video |

#### Aba 5: Imagens Produto (Pessoas segurando)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Produto + cenário + perfil |
| **Cenas** | Banheiro, quarto, academia, outdoor |
| **Modelo** | GPT Image 1.5 Edit (preserva rótulo) |

#### Aba 6: Avatar Mascote (Personagem Animado)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Imagem do mascote + script + voz |
| **Estilos** | Cartoon, 3D, Realista |
| **Fontes de Voz** | TTS (f5-tts), Upload de áudio, Clonagem (ChatterboxHD) |
| **Pós-processo** | Sync LipSync v2 Pro (opcional) |
| **Modelos** | Kling Avatar v2 Pro (primário), Kling Avatar v2 Standard (fallback) |
| **Componente** | `AvatarMascotTab.tsx` |

#### Aba 7: Galeria
| Campo | Descrição |
|-------|-----------|
| **Funcionalidade** | Visualização de todos os criativos gerados |
| **Views** | Grid (cards) e Lista (tabela) |
| **Filtros** | Tipo de criativo, status, busca por prompt/produto |
| **Ações** | Download, link externo, preview com detalhes |
| **Componente** | `CreativeGallery.tsx` |

#### fal.ai
```typescript
{
  // Swap pessoa/fundo
  'fal-ai/pixverse/swap': { modes: ['person', 'background'] },
  
  // Voice conversion
  'resemble-ai/chatterboxhd/speech-to-speech': {},
  
  // Lipsync
  'fal-ai/sync-lipsync/v2/pro': {},
  
  // Avatar IA
  'fal-ai/kling-video/ai-avatar/v2/pro': {},
  
  // Text/Image to Video
  'fal-ai/veo3.1': {},
  'fal-ai/veo3.1/first-last-frame-to-video': {},
  'fal-ai/veo3.1/image-to-video': {},
  'fal-ai/sora-2/text-to-video/pro': {},
  'fal-ai/sora-2/image-to-video/pro': {},
}
```

#### OpenAI (via Lovable AI Gateway)
```typescript
{
  'gpt-image-1.5/edit': { 
    description: 'Imagens realistas com produto preservado' 
  },
}
```

### Armazenamento
- **Pasta automática:** `Criativos com IA` dentro da Media Library do tenant
- **Criação automática:** Se não existir, criar na primeira geração

### Jobs Assíncronos
```typescript
interface CreativeJob {
  id: string;
  tenant_id: string;
  type: CreativeType; // 'ugc_client_video' | 'ugc_ai_video' | 'short_video' | 'tech_product_video' | 'product_image'
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  
  // Inputs
  prompt: string;
  product_id?: string;
  reference_images?: string[];
  reference_video_url?: string;
  settings: Record<string, unknown>;
  
  // Pipeline
  pipeline_steps?: PipelineStep[];
  current_step?: number;
  
  // Output
  output_urls?: string[];
  output_folder_id?: string;
  
  // Compliance
  has_authorization?: boolean;
  
  // Metadata
  error_message?: string;
  cost_cents?: number;
  created_at: string;
  completed_at?: string;
}
```

### Compliance (Obrigatório)
- Checkbox de autorização em abas que alteram rosto/voz
- Impedir geração sem aceite
- Guardar aceite no job (auditável)

### Edge Functions
| Function | Descrição | Status |
|----------|-----------|--------|
| `creative-generate` | Valida inputs, cria pasta, enfileira job | ✅ Ready |
| `creative-process` | Processa pipeline de modelos (fal.ai + Lovable AI) | ✅ Ready |
| `creative-webhook` | Recebe callbacks do fal.ai (futuro) | 🟧 Pending |

### Tabela `creative_jobs`
```sql
CREATE TABLE public.creative_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type creative_type NOT NULL,
  status creative_job_status DEFAULT 'queued',
  
  -- Inputs
  prompt TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT,
  product_image_url TEXT,
  reference_images TEXT[],
  reference_video_url TEXT,
  reference_audio_url TEXT,
  settings JSONB DEFAULT '{}',
  
  -- Compliance
  has_authorization BOOLEAN DEFAULT false,
  authorization_accepted_at TIMESTAMPTZ,
  
  -- Pipeline
  pipeline_steps JSONB DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  
  -- Output
  output_urls TEXT[],
  output_folder_id UUID,
  
  -- Metadata
  error_message TEXT,
  cost_cents INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL
);
```

### Enums
```sql
CREATE TYPE creative_type AS ENUM (
  'ugc_client_video',    -- Aba 1
  'ugc_ai_video',        -- Aba 2
  'short_video',         -- Aba 3
  'tech_product_video',  -- Aba 4
  'product_image'        -- Aba 5
);

CREATE TYPE creative_job_status AS ENUM (
  'queued', 'running', 'succeeded', 'failed'
);
```

### RLS Policies
- SELECT/INSERT/UPDATE/DELETE restritos por `tenant_id` via `user_roles`

### Função de Custo
```sql
-- increment_creative_usage(tenant_id, cost_cents)
-- Incrementa ai_usage_cents em tenant_monthly_usage
```

---

## Pendências

- [ ] Dashboard de atribuição
- [ ] Integração Google Ads (campanhas manuais)
- [ ] Módulo de email marketing completo
- [ ] Automações de marketing
- [x] Gestor de Tráfego IA — Fase 1: DB (3 tabelas + RLS)
- [x] Gestor de Tráfego IA — Fase 2: Edge Function `ads-autopilot-analyze`
- [x] Gestor de Tráfego IA — Fase 3: Edge Function `ads-autopilot-creative`
- [x] Gestor de Tráfego IA — Fase 4: Hook `useAdsAutopilot`
- [x] Gestor de Tráfego IA — Fase 5-8: UI completa
- [ ] Gestor de Tráfego IA — Fase 9: Scheduler (cron automático)
- [ ] Relatórios de ROI
- [x] Gestão de Criativos (UI básica)
- [x] Gestão de Criativos (Tabela creative_jobs)
- [x] Gestão de Criativos (Edge Functions generate/process)
- [x] Gestão de Criativos (Galeria visual)
- [ ] Gestão de Criativos (Webhook fal.ai)
