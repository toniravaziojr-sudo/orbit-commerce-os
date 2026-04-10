# Marketing — Integrações, Atribuição e Criativos

> **Status:** 🟧 Parcial  
> **Versão:** 1.1.0  
> **Camada:** Layer 3 — Especificações / Marketing  
> **Migrado de:** `docs/regras/marketing-integracoes.md`  
> **Última atualização:** 2026-04-07
>
> **Nota:** A seção "Gestor de Tráfego IA" foi extraída para doc dedicado: `marketing/gestor-trafego.md`  
> **Nota:** O ecossistema Google completo (Analytics, Ads, Merchant, GMB, Search Console, GTM, Gmail, Calendar) tem doc dedicado: `marketing/google-integracoes.md`


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
| Email Marketing | `/email-marketing` | ✅ Ready (ver email-marketing.md) |
| Quizzes | `/quizzes` | 🟧 Pending (ver quizzes.md) |
| Gestor de Mídias IA | `/media` | ✅ Ready |
| Gestor de Tráfego IA | `/ads` | ✅ Ready (ver `marketing/gestor-trafego.md`) |
| Gestão de Criativos | `/creatives` | ✅ Ready (ver seção 6) |

---

## RBAC

A divisão reflete nas permissões:

| Módulo RBAC | Key | Descrição |
|-------------|-----|-----------|
| Marketing Básico | `marketing-basic` | Integrações, atribuição, descontos e ofertas |
| Marketing Avançado | `marketing-advanced` | Email marketing, quizzes, gestor de mídias, tráfego e criativos |

---

## 1. Integrações Marketing (DEPRECADO)

> **⚠️ MÓDULO REMOVIDO — 2026-02-16**
>
> O módulo "Integrações Marketing" (`/marketing`) foi **completamente removido** da navegação e rota.
> Todas as funcionalidades foram migradas para os Hubs centralizados em `/integrations`:
>
> | Funcionalidade | Novo Local |
> |----------------|------------|
> | Meta Pixel & CAPI | Hub Meta (`/integrations?tab=social`) |
> | Meta Catálogo | Hub Meta (`/integrations?tab=social`) |
> | TikTok Pixel/CAPI | Hub TikTok (`/integrations?tab=tiktok`) |
> | Google Ads | Hub Google (`/integrations?tab=google`) — futuro |
>
> **A rota `/marketing` redireciona automaticamente para `/integrations?tab=social`.**
>
> A tabela `marketing_integrations` continua existindo para o storefront tracker (`MarketingTrackerProvider`),
> mas é atualizada automaticamente pelo Hub Meta ao salvar Pixel ID/CAPI.
>
> ### Automação Completa de Pixel & CAPI (v5.4.0)
>
> #### Pixel (Client-side)
> O fluxo OAuth (`meta-oauth-callback`) descobre automaticamente os Pixels associados a cada conta de anúncios via `GET /{ad_account_id}/adspixels`. Os Pixels são exibidos como ativos selecionáveis (radio button — seleção única) no checklist de assets. Ao salvar, o `meta-save-selected-assets` sincroniza o Pixel primário selecionado para `marketing_integrations.meta_pixel_id` e ativa `meta_enabled=true`, eliminando a necessidade de configuração manual.
>
> **Catálogo:** Ao confirmar a seleção de ativos, o sistema cria automaticamente um catálogo NOVO na Meta Commerce e envia todos os produtos ativos em lote (50/batch). O catálogo fica disponível imediatamente no Commerce Manager para campanhas de catálogo (FB) e sacolinha (IG).
>
> **WhatsApp:** O número de telefone selecionado é automaticamente populado em `whatsapp_configs` com `phone_number_id`, `waba_id`, `access_token`, `connection_status=connected` e `is_enabled=true`. Todas as automações (notificações de pedidos, suporte IA, lembretes) ficam operacionais imediatamente.
>
> O campo na UI é **somente leitura** com badge "Automático". Para alterar o pixel principal, o usuário edita os ativos conectados.
>
> **Pixels adicionais:** Campo `meta_additional_pixel_ids` (TEXT[]) permite adicionar múltiplos Pixel IDs extras para disparar eventos em vários pixels simultaneamente.
>
> #### CAPI (Server-side)
> O `meta-save-selected-assets` também sincroniza automaticamente o `access_token` long-lived (~60 dias) do OAuth para `marketing_integrations.meta_access_token` e ativa `meta_capi_enabled=true`. Isso elimina a necessidade de configuração manual do token CAPI.
>
> A UI mostra badge "Automático" quando o token foi sincronizado via OAuth. Um fallback manual ("Usar token manual — avançado") permite inserir um System User Token permanente que não expira.
>
> #### Cobertura do Tracking
>
> O `MarketingTrackerProvider` envolve **todo o storefront** via `TenantStorefrontLayout` e `StorefrontLayout`:
>
> | Página | Coberta | Observação |
> |--------|---------|------------|
> | Home, Categorias, Produtos | ✅ | Dentro do layout storefront |
> | Carrinho, Checkout, Thank You | ✅ | Dentro do layout storefront |
> | Blog, Rastreio | ✅ | Dentro do layout storefront |
> | Landing Pages (Builder) `/lp/` | ✅ | Dentro do layout storefront |
> | Quizzes `/quiz/` | ✅ | Dentro do layout storefront |
> | Páginas Institucionais | ✅ | Dentro do layout storefront |
> | AI Landing Pages `/ai-lp/` | ✅ | Pixel injetado automaticamente no HTML do iframe via `buildPixelScripts()` em `StorefrontAILandingPage.tsx` |
>
> #### Renovação do Token OAuth
>
> ✅ **IMPLEMENTADO (v5.5.0):** A edge function `meta-token-refresh` renova automaticamente os tokens long-lived da Meta antes da expiração. Funciona via `fb_exchange_token` (a Meta não usa refresh tokens tradicionais).
>
> - **Cron diário:** `meta-token-refresh-daily` executa às 03:00 UTC com `{ refreshAll: true }`, renovando todos os tokens que expiram em <7 dias.
> - **Modo single:** `POST { tenantId }` renova token de um tenant específico.
> - **Sync CAPI:** Ao renovar, o novo token é automaticamente sincronizado com `marketing_integrations.meta_access_token`.
> - **Fallback:** Se o token já expirou/foi revogado, a conexão é marcada como inativa e o usuário precisa reconectar.

> #### Cobertura de Parâmetros CAPI (v8.18.0 — Auditoria Março 2026)
>
> **Problema:** Cobertura baixa de `fbp`, `fbc`, `external_id` e PII (email/phone) nos eventos CAPI.
>
> | Parâmetro | Causa | Fix |
> |-----------|-------|-----|
> | `external_id` | SSR `_sfCapi` não lia `_sf_vid` | Adicionado `_sfGetVid()` |
> | `fbp` | Primeira carga: Pixel não criou `_fbp` antes do CAPI | Re-tentativa CAPI 3.5s depois |
> | `fbc` | Só existe com `fbclid` na URL | 6-18% é NORMAL |
> | `email/phone` | `sessionStorage` perdia ao fechar aba | Migrado para `localStorage` + SSR beacon lê |
> | Facebook Login ID | Sistema não usa Facebook Login | Não aplicável |
>
> #### Correções v8.19.0 — Março 2026
>
> | Problema | Causa | Fix |
> |----------|-------|-----|
> | `fbc` expirado enviado ao CAPI | `localStorage` persistia `fbc` sem validade; ao cookie expirar (90d), valor velho era re-criado | Adicionada validação `isFbcExpired()` em `visitorIdentity.ts` — descarta valores >90 dias |
> | Purchase sem par CAPI | `fetch()` cancelado pelo redirect pós-checkout para /obrigado | `sendServerEvent` usa `navigator.sendBeacon()` para Purchase, Lead e InitiateCheckout — sobrevive a navegação |
> | sendBeacon sem headers | `sendBeacon` não permite headers customizados | `apikey` enviado via query string; edge function já opera com `verify_jwt=false` |
>
> #### Correções v8.21.1 — Março 2026
>
> | Problema | Causa | Fix |
> |----------|-------|-----|
> | `fbp` ausente em eventos mid-funnel | Apenas PageView/ViewContent/AddToCart aguardavam `_fbp` | `needsFbpWait = true` universal — todos os eventos CAPI aguardam até 1.5s pelo `_fbp` |
>
> #### Correções v8.22.0 — Março 2026
>
> | Problema | Causa | Fix |
> |----------|-------|-----|
> | Vendas duplicadas na Meta (5 vs 4) | Purchase disparava no Checkout E na página de Obrigado — dois disparos navegador+servidor para mesmo pedido | **Purchase removido do Checkout** — agora dispara APENAS na página de Obrigado |
> | Purchase sem cidade/estado/CEP | ThankYou enviava apenas email/phone/name no userData | Adicionados `city`, `state`, `zip` do endereço de entrega ao userData do Purchase |
> | IP "compartilhado" 74% PageView | Investigado: `cf-connecting-ip` captura IP real corretamente | **Não é bug** — é NAT do provedor de internet (vários clientes no mesmo IP público) |
>
> **Regra de disparo do Purchase (v8.22.0):**
> - O evento Purchase é disparado **exclusivamente** na página de Obrigado (`ThankYouContent.tsx`)
> - O Checkout (`CheckoutStepWizard.tsx`) **NÃO** dispara Purchase em nenhuma circunstância
> - Para modo `all_orders`: dispara ao carregar a página de Obrigado (qualquer status)
> - Para modo `paid_only`: dispara somente se `payment_status` é `approved` ou `paid`
 > - O robô do servidor (`process-events`) só dispara Purchase CAPI no modo `paid_only`
>
> #### Correções v8.23.0 — Março 2026
>
> | Problema | Causa | Fix |
> |----------|-------|-----|
> | Deduplicação quebrada no Purchase | ThankYou não removia `#` do número do pedido → `event_id` diferente entre browser e servidor | `order_number.replace(/^#/, '')` antes de gerar `event_id` — deduplicação restaurada |
> | Meta rejeitava Purchase (erro 2804008) | Campo `id` ausente no array `contents` enviado ao CAPI | `get-order` agora retorna `product_id` nos items → `contents: [{id, quantity, item_price}]` correto |
> | Items vazios no servidor | `process-events` tentava selecionar `meta_retailer_id` direto de `order_items` (coluna inexistente) | Lookup na tabela `products` para resolver `meta_retailer_id` |
> | Valor subnotificado (1.52 vs 151.95) | Divisão por 100 no `process-events` — banco armazena em Reais, não centavos | Removido `/100` |
> | `content_ids` null | `product_id` não disponível no retorno de `get-order` | Com `product_id` disponível, `resolveMetaContentId` resolve corretamente |
>
> #### Correções v8.24.0 — Março 2026
>
> | Problema | Causa | Fix |
> |----------|-------|-----|
> | IP mismatch ~60% dos PageView | Servidor enviava IPv6 enquanto Pixel do browser reporta IPv4 | `marketing-capi-track` agora coleta IPs de todos os headers e **prioriza IPv4** (dotted-quad) |
> | `fbp`/`fbc`/`visitor_id` ausentes na sessão | Cookies do Pixel ainda não existiam no momento do `checkout-session-start` | Heartbeat agora envia `visitor_id`, `fbp` e `fbc` a cada batida; servidor faz **backfill** apenas se campos estiverem vazios |
>
> **Impacto esperado v8.24.0:** Score de PageView deve subir de 5.3 para ~7+ e ViewContent de 4.5 para ~6+ nos diagnósticos da Meta.

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
| Listas | ✅ Ready | Segmentação por tags, listas padrão, sync automático |
| Templates | ✅ Ready | Editor visual drag-and-drop com blocos |
| Campanhas | ✅ Ready | Broadcast com wizard 3 steps |
| Automações | ✅ Ready | Builder visual React Flow com 9 tipos de nós |
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

> **Especificação completa extraída para:** `docs/especificacoes/marketing/gestor-trafego.md`
>
> **Rota:** `/ads` | **Status:** ✅ Ready | **Versão:** 6.11.0

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

### Ajuste Escopado de Campanhas (v1.20.0 — 2026-02-20)

O botão **"Ajustar"** em cada card de campanha pendente aciona uma revisão restrita diretamente no Motor Estrategista, sem passar pelo chat.

#### Fluxo

1. Usuário clica "Ajustar" em uma campanha específica e digita o feedback (ex: "Transformar em campanha de catálogo com todos os kits")
2. O frontend invoca `ads-autopilot-strategist` com `trigger: "revision"` e `revision_context` contendo:
   - `campaign_name`: nome da campanha sendo ajustada
   - `feedback`: texto do usuário
   - `other_pending_campaigns`: lista de nomes das demais campanhas pendentes (protegidas)
3. O motor entra em **modo de revisão restrita**:
   - A IA recebe instrução explícita para criar APENAS UMA nova campanha substituindo a rejeitada
   - As demais campanhas pendentes são listadas como **protegidas** — a IA é PROIBIDA de recriá-las ou modificá-las
   - A ação original é marcada como `rejected` com o feedback como `rejection_reason`
4. O resultado aparece como nova ação `pending_approval` para o usuário avaliar

#### Regras

| Regra | Descrição |
|-------|-----------|
| **Escopo único** | Apenas a campanha solicitada é reprocessada |
| **Proteção de pendentes** | Outras campanhas pendentes são passadas como `protectedList` e não podem ser tocadas |
| **Catálogo** | Se o feedback mencionar "catálogo", a IA usa objetivo `OUTCOME_PRODUCT_CATALOG_SALES` |
| **Rejeição automática** | A ação original + child actions (adsets) são rejeitadas automaticamente antes de gerar a revisão |

#### Correção de Criativos por Funil (v1.20.0)

**Problema identificado:** A IA usava os mesmos criativos para campanhas de público frio (TOF) e remarketing (BOF), pois o matching era apenas por `product_id` sem considerar `funnel_stage`.

**Correção:**
1. **Fase de geração:** O `generate_creative` agora inclui `funnel_stage` no prompt e nos metadados do criativo
2. **Fase de montagem:** O matching de criativos para campanhas usa `product_id + funnel_stage` como filtro duplo
3. **Fallback:** Se não houver criativo específico para o funil, a IA gera um novo com ângulo adequado (urgência para remarketing, educação para público frio)

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/AdsPendingActionsTab.tsx` | Invoca `ads-autopilot-strategist` diretamente com `trigger: "revision"` |
| `src/components/ads/AdsPendingApprovalTab.tsx` | Passa `other_pending_campaigns` para proteção |
| `supabase/functions/ads-autopilot-strategist/index.ts` | Lógica de `protectedList` e instrução de escopo único |

---

### Agrupamento de AdSets por Sessão (v5.15.1 — 2026-02-20)

**Problema identificado:** A IA do Estrategista gerava nomes de campanha nos adsets que não batiam exatamente com os nomes das campanhas criadas na mesma sessão (ex: `[AI] Vendas | Testes (CBO) | Fast Upgrade | 2026-02-19` vs `[AI] TESTES | Vendas (CBO) | Fast Upgrade | 2026-02-20`). Isso fazia com que os adsets aparecessem como cards órfãos separados em vez de aninhados dentro do card da campanha pai.

**Correção:** A lógica de agrupamento em `AdsPendingActionsTab` e `AdsPendingApprovalTab` agora usa **dois passes de matching**:

| Passo | Lógica | Descrição |
|-------|--------|-----------|
| **1 — Exact Name** | `adset.campaign_name === campaign.campaign_name` | Match exato por nome (comportamento original) |
| **2 — Session Fallback** | `adset.session_id === campaign.session_id` + similaridade de nome | Para adsets não pareados, busca campanhas da mesma sessão e usa score de similaridade para encontrar o melhor match |

**Regras:**
- Adsets pareados no Passo 1 **nunca** são reavaliados no Passo 2
- Adsets que permanecem sem match após ambos os passes são exibidos como `OrphanAdsetGroupCard` (agrupados pelo nome da campanha referenciada)
- O score de similaridade usa normalização alfanumérica (lowercase, remove caracteres especiais) com matching de substrings de 3 caracteres

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/AdsPendingActionsTab.tsx` | Lógica de dois passes (exact + session fallback) |
| `src/components/ads/AdsPendingApprovalTab.tsx` | Mesma lógica de dois passes |

---

### Tag de Tipo de Campanha nos Cards de Aprovação (v5.15.2 — 2026-02-20)

**Funcionalidade:** Os cards de aprovação (`ActionApprovalCard`) agora exibem uma badge colorida com o **tipo de campanha** (ex: Venda Direta, Remarketing, Teste, Catálogo, Tráfego) na área de chips, junto com orçamento, criativos e conjuntos.

**Inferência do tipo** — função `inferCampaignType(data)` usa 3 fontes em ordem de prioridade:

| Prioridade | Fonte | Exemplo |
|------------|-------|---------|
| 1 | Campo explícito `campaign_type` ou `objective` em `action_data` / `preview` | `sales`, `catalog_sales`, `traffic` |
| 2 | Padrão no nome da campanha (`campaign_name`) | `[AI] TESTES | ...` → Teste |
| 3 | Fallback por `funnel_stage` | `tof` → Venda Direta, `bof` → Remarketing |

**Tipos suportados:**

| Chave(s) | Label | Cor |
|----------|-------|-----|
| `sales`, `conversions` | Venda Direta | Emerald |
| `remarketing`, `retargeting` | Remarketing | Orange |
| `test`, `testing` | Teste | Purple |
| `traffic`, `link_clicks` | Tráfego | Sky |
| `catalog`, `catalog_sales`, `product_catalog_sales` | Catálogo | Amber |
| `awareness`, `brand_awareness` | Reconhecimento | Indigo |
| `reach` | Alcance | Teal |
| `engagement` | Engajamento | Pink |
| `leads`, `lead_generation` | Geração de Leads | Green |
| `video_views` | Visualização de Vídeo | Rose |

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/ActionApprovalCard.tsx` | Novo mapa `CAMPAIGN_TYPE_LABELS`, função `inferCampaignType`, badge na área de chips |

---

### Visão Completa da Campanha — Modal com Abas (v5.15.4 — 2026-02-20)

**Funcionalidade:** O modal "Ver conteúdo completo" (`FullContentDialog`) utiliza uma interface com **3 abas** para apresentar uma visão **100% completa** da campanha proposta pela IA, com todos os campos traduzidos para PT-BR.

| Aba | Conteúdo |
|-----|----------|
| **Criativos & Copys** | Galeria de criativos, headlines (variações numeradas), textos principais (versões), descrições, CTA |
| **Detalhes da Campanha** | Visão exaustiva organizada em seções temáticas (ver tabela abaixo) |
| **Conjuntos & Público** | Ad sets com nome, orçamento individual, público-alvo, faixa etária, públicos personalizados |

#### Componente `CampaignDetailsTab` (v2.1)

Renderiza todos os detalhes da campanha organizados em **11 seções temáticas** com ícones:

| Seção | Ícone | Campos incluídos |
|-------|-------|------------------|
| **Campanha** | Target | Nome da Campanha, Objetivo (traduzido), Tipo de Campanha (inferido), Etapa do Funil |
| **Produto** | Package | Produto, ID do Catálogo, ID do Conjunto de Produtos |
| **Orçamento** | DollarSign | Orçamento Diário, Orçamento Vitalício, Tipo de Orçamento (CBO/ABO) |
| **Otimização** | BarChart3 | Otimização (traduzida), Meta de Desempenho (`performance_goal`), Local da Conversão (`conversion_location`), Modelo de Atribuição (`attribution_model`), Cobrança por, Meta de Custo por Resultado |
| **Posicionamentos** | Globe | Posicionamentos (traduzidos individualmente), Plataformas, Dispositivos, Tipo de Posicionamento. **Fallback:** se nenhum campo de posicionamento estiver presente, exibe "Automático (Advantage+)" |
| **Link & CTA** | Link2 | Link de Destino (`destination_url`, `website_url`, `link`, `object_url`), Link Exibido, Botão CTA (traduzido), Parâmetros UTM |
| **Agendamento** | Calendar | Data de Início, Data de Término |
| **Público** | Users | Público-alvo, Faixa Etária, Gênero, Públicos Personalizados, Lookalikes, Interesses, Localização |
| **Conjuntos** | Layers | Nome de cada Conjunto de Anúncios (de `childActions`), Orçamento individual por conjunto |
| **Criativos** | ImageIcon | Nome do Anúncio (`ad_name`, `creative_name`), Formato do Anúncio (`ad_format`, `creative_format`, `format`) |
| **Outros** | Settings2 | Pixel, Evento de Conversão + **qualquer campo não mapeado** (catch-all automático) |

#### Fallback de Dados via `childActions`

O helper `f(key)` busca campos na seguinte ordem de prioridade:
1. `preview` (dados de preview da ação principal)
2. `data` (action_data da ação principal)
3. `childActions` (primeiro ad set filho que contenha o campo)

Isso garante que campos como `destination_url`, `placements`, `ad_name` etc. que só existem no nível de ad set sejam exibidos corretamente na visão da campanha.

#### Tradução Exaustiva de Termos Técnicos

O componente implementa dicionários de tradução para **todos** os valores técnicos da Meta Ads API:

| Dicionário | Exemplos de tradução |
|------------|---------------------|
| `OBJECTIVE_LABELS` | `OUTCOME_SALES` → "Vendas", `OUTCOME_LEADS` → "Geração de Leads", `OUTCOME_TRAFFIC` → "Tráfego", `OUTCOME_AWARENESS` → "Reconhecimento", `OUTCOME_ENGAGEMENT` → "Engajamento", `OUTCOME_APP_PROMOTION` → "Promoção de App" |
| `OPTIMIZATION_LABELS` | `OFFSITE_CONVERSIONS` → "Conversões no site", `LINK_CLICKS` → "Cliques no link", `IMPRESSIONS` → "Impressões", `REACH` → "Alcance", `LANDING_PAGE_VIEWS` → "Visualizações da página", `VALUE` → "Valor da conversão" |
| `PERFORMANCE_GOAL_LABELS` | `Maximizar Conversões` → "Maximizar Conversões", `Maximizar Valor das Conversões` → "Maximizar Valor das Conversões" |
| `CONVERSION_LOCATION_LABELS` | `Site` → "Site", `Site e App` → "Site e App", `App` → "App" |
| `ATTRIBUTION_MODEL_LABELS` | `Padrão` → "Padrão", `Incremental` → "Incremental" |
| `BILLING_EVENT_LABELS` | `IMPRESSIONS` → "Impressões (CPM)", `LINK_CLICKS` → "Cliques no link (CPC)", `THRUPLAY` → "ThruPlay (CPV)" |
| `CTA_LABELS` | `SHOP_NOW` → "Comprar agora", `LEARN_MORE` → "Saiba mais", `SIGN_UP` → "Cadastre-se", `SEND_WHATSAPP_MESSAGE` → "Enviar mensagem no WhatsApp", `GET_OFFER` → "Obter oferta" |
| `POSITION_LABELS` | `feed` → "Feed", `story` → "Stories", `reels` → "Reels", `right_hand_column` → "Coluna da direita", `search` → "Resultados de pesquisa", `marketplace` → "Marketplace", `video_feeds` → "Feeds de vídeo", `instream_video` → "Vídeos in-stream", `reels_overlay` → "Sobreposição de Reels" |
| `CONVERSION_EVENT_LABELS` | `PURCHASE` → "Compra", `ADD_TO_CART` → "Adição ao carrinho", `INITIATED_CHECKOUT` → "Início de checkout", `LEAD` → "Lead", `COMPLETE_REGISTRATION` → "Cadastro completo", `VIEW_CONTENT` → "Visualização de conteúdo" |

#### Catch-All Automático

Qualquer campo presente em `action_data` que **não** esteja mapeado nas seções conhecidas (`KNOWN_KEYS`) é automaticamente:
1. Formatado com `formatFieldValue` (arrays → lista, objetos → JSON legível, valores primitivos → tradução genérica)
2. Exibido na seção "Outros" com label gerado via `formatKey` (snake_case → Title Case PT-BR)

Isso garante que **nenhum dado é omitido**, mesmo quando a IA envia campos novos não previstos.

#### Regras

- Planos Estratégicos (`strategic_plan`) **não** usam abas — mantêm o layout original com `StrategicPlanContent`
- Se nenhum campo de detalhe estiver preenchido, a aba "Detalhes" exibe um empty state informativo
- A aba "Conjuntos & Público" só aparece se houver ad sets vinculados ou se a ação for do tipo `create_adset`
- `childActions` (ad sets agrupados sob a campanha) são passados ao `CampaignDetailsTab` para extrair dados de público e targeting

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/ActionApprovalCard.tsx` | `CampaignDetailsTab` v2.1 com 11 seções, 7 dicionários de tradução, catch-all automático, `childActions` prop com fallback de dados, seções Conjuntos e Criativos |

---

### Correções v5.12.9 (2026-02-19)

| Item | Correção | Aceite |
|------|----------|--------|
| **Meu Drive (ordenação)** | `useFiles.ts` ordena por `created_at DESC` (não mais por `filename ASC`). Criativos mais recentes aparecem no topo. | Últimos criativos gerados no topo; nenhum nome se repete |
| **Insights (escopo + linguagem)** | `AdsInsightsTab.tsx` sanitiza 15+ termos técnicos em inglês para PT-BR simples (ex: "underinvest" → "investindo abaixo do orçamento", "pacing" → "ritmo de gasto"). Texto com `whitespace-pre-wrap` sem truncamento. | Sem jargão; texto completo acessível |
| **Audience Discovery (Meta)** | `ads-autopilot-analyze` v5.13.0 busca **dois endpoints**: `/customaudiences` (Custom Audiences com campos `id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status`) e `/saved_audiences` (Saved Audiences com campos `id,name,targeting`). Paginação completa (até 1000) via cursor `after`. Campo `approximate_count` **NÃO existe** na API v21.0 — usar `approximate_count_lower_bound`/`upper_bound`. Erros HTTP logados com status + body. | Públicos Custom e Saved encontrados; erro real exibido se falhar |
| **Limite de campanhas** | Análise ampliada de 50 para **200 campanhas** com paginação (Meta, Google, TikTok). | Diagnóstico reporta ≥200 quando existir |
| **Budget Filling** | Prompt obriga IA a calcular gap = limit - active - reserved. Se gap > R$50, deve propor ações para preencher ou explicar por quê não. Budget tratado como **meta de investimento** (não apenas teto). | IA tenta cobrir o orçamento ou explica claramente |
| **Estratégia (remarketing/testes)** | Regras de prompt: remarketing prioriza catálogo se disponível; sem "single-ad pobre"; testes com ≥2 variações. | Propostas com variações coerentes |
| **Context Digest** | Cada execução registra resumo auditável: configs lidas, campanhas/audiências/produtos carregados, itens ignorados. Disponível em "Detalhes técnicos". | Auditável; pontos cegos identificáveis |
| **UI overflow (chat/pending)** | `AdsPendingActionsTab.tsx` e `ActionApprovalCard.tsx` com `min-w-0`, `overflow-hidden`, `break-all`. | Nenhum conteúdo cortado à direita |

## Google Ads — Integração CRUD Completa (v2.0 — 2026-02-23)

### Visão Geral

Integração completa com Google Ads REST API v18 para criação e gestão de campanhas Search, Performance Max (PMax), Shopping e Display. Opera com o mesmo pipeline de IA (Motor Estrategista + Guardião + Chat) que a Meta, com particularidades da plataforma.

### Tabelas de Cache Local

| Tabela | Descrição | Chave UNIQUE |
|--------|-----------|--------------|
| `google_ad_campaigns` | Campanhas (já existia — sync read-only, agora com CRUD) | `(tenant_id, google_campaign_id)` |
| `google_ad_groups` | Grupos de anúncios com bids e targeting | `(tenant_id, google_adgroup_id)` |
| `google_ad_ads` | Anúncios (RSA, RDA, Shopping, PMax) com headlines/descriptions | `(tenant_id, google_ad_id)` |
| `google_ad_keywords` | Keywords para Search com match type e quality score | `(tenant_id, google_keyword_id)` |
| `google_ad_assets` | Assets (imagens, textos, vídeos) para PMax e Display | `(tenant_id, google_asset_id)` |
| `google_ad_insights` | Métricas de performance por campanha/dia (já existia) | `(tenant_id, google_campaign_id, date)` |

### Edge Functions Google Ads

| Function | Versão | Ações | Descrição |
|----------|--------|-------|-----------|
| `google-ads-campaigns` | v2.0 | list, sync, create, update, pause, activate, remove | CRUD completo de campanhas (Search, PMax, Shopping, Display) |
| `google-ads-adgroups` | v1.0 | list, sync, create, update, pause, activate, remove | CRUD de grupos de anúncios |
| `google-ads-ads` | v1.0 | list, sync, create, update, pause, activate | CRUD de anúncios (RSA, RDA) |
| `google-ads-keywords` | v1.0 | list, sync, create, update, pause, activate, remove | CRUD de keywords com match types |
| `google-ads-assets` | v1.0 | list, sync, upload_image, create_text, link, remove | Upload de imagens e textos para PMax/Display |
| `google-ads-insights` | v1.0 | summary, sync | Métricas de performance (já existia) |
| `google-ads-audiences` | v1.0 | list, sync | Audiências (já existia) |

### Padrão de API Google Ads REST v18

Todas as operações de mutação usam o padrão `mutate`:

```typescript
// Criação
POST /v18/customers/{customerId}/{resource}:mutate
Body: { operations: [{ create: { ...fields } }] }

// Atualização
POST /v18/customers/{customerId}/{resource}:mutate
Body: { operations: [{ update: { resourceName, ...fields }, updateMask: "field1,field2" }] }

// Remoção
POST /v18/customers/{customerId}/{resource}:mutate
Body: { operations: [{ remove: "customers/{id}/{resource}/{id}" }] }

// Consulta (GAQL)
POST /v18/customers/{customerId}/googleAds:searchStream
Body: { query: "SELECT ... FROM ... WHERE ..." }
```

### Tipos de Campanha Suportados

| Tipo | `campaign_type` | Requer | Particularidades |
|------|----------------|--------|------------------|
| **Search** | `SEARCH` | Keywords + RSA | Ad groups obrigatórios, bidding CPC/CPA/ROAS |
| **Performance Max** | `PERFORMANCE_MAX` | Assets (imagens, textos, vídeos) | Sem ad groups tradicionais, asset groups, automação total |
| **Shopping** | `SHOPPING` | Merchant Center linkado | Feed de produtos, bidding por produto |
| **Display** | `DISPLAY` | Imagens em vários tamanhos | Responsive Display Ads, targeting por audiência/tópico |

### Tipos de Match (Keywords — Search)

| Match Type | Símbolo | Descrição |
|------------|---------|-----------|
| `BROAD` | (nenhum) | Variações amplas |
| `PHRASE` | `"keyword"` | Contém a frase |
| `EXACT` | `[keyword]` | Correspondência exata |

### Executor Google Ads (`ads-autopilot-execute-approved` v4.0)

Pipeline de execução sequencial para ações Google Ads aprovadas:

| Etapa | Ação | API |
|-------|------|-----|
| 1 | Criar Campanha | `POST /campaigns:mutate` com `advertisingChannelType`, `biddingStrategy`, `campaignBudget` |
| 2 | Criar Ad Group | `POST /adGroups:mutate` com `campaign` resource name, `cpcBidMicros` |
| 3 | Criar Keywords (Search) | `POST /adGroupCriteria:mutate` com `keyword.text`, `keyword.matchType` |
| 4 | Criar Anúncio (RSA/RDA) | `POST /adGroupAds:mutate` com headlines[], descriptions[], finalUrls[] |

**Regras:**
- Todas as entidades criadas como `PAUSED` (mesma regra da Meta)
- `budgetAmountMicros` = valor em micros (R$ × 1.000.000)
- `cpcBidMicros` = CPC em micros
- Resource names seguem formato: `customers/{id}/campaigns/{id}`

### Mapeamento Tabela → Edge Function (Google Ads)

| Tabela | Edge Functions |
|--------|----------------|
| `google_ad_campaigns` | `google-ads-campaigns`, `ads-autopilot-analyze`, `ads-autopilot-strategist`, `ads-autopilot-guardian` |
| `google_ad_groups` | `google-ads-adgroups`, `ads-autopilot-execute-approved` |
| `google_ad_ads` | `google-ads-ads`, `ads-autopilot-execute-approved` |
| `google_ad_keywords` | `google-ads-keywords`, `ads-autopilot-execute-approved` |
| `google_ad_assets` | `google-ads-assets`, `ads-autopilot-execute-approved` |
| `google_ad_insights` | `google-ads-insights`, `ads-autopilot-analyze`, `ads-autopilot-strategist` |

### Hook `useGoogleAds.ts`

| Método | Descrição |
|--------|-----------|
| `campaigns` | Lista de campanhas do cache local |
| `syncCampaigns` | Sincroniza campanhas da API Google |
| `syncInsights` | Sincroniza insights da API Google |
| `audiences` | Lista de audiências |
| `syncAudiences` | Sincroniza audiências |
| `syncAll` | Sincroniza tudo em paralelo |

### Diferenças Google vs Meta no Autopilot

| Aspecto | Meta Ads | Google Ads |
|---------|----------|------------|
| **Estrutura** | Campanha → Ad Set → Ad | Campanha → Ad Group → Ad (+Keywords/Assets) |
| **Orçamento** | Ad Set level (ABO) ou Campaign level (CBO) | Campaign Budget (compartilhado) |
| **Bidding** | `bid_strategy` no campaign | `biddingStrategyType` + `cpcBidMicros` no ad group |
| **Valores monetários** | Centavos (÷ 100) | Micros (÷ 1.000.000) |
| **Limite de ajuste** | ±20% a cada 48h | ±20% a cada 7 dias |
| **Learning Phase** | ~50 conversões em 7 dias | ~30 conversões em 14 dias |
| **Criação de anúncio** | AdCreative separado | Inline no AdGroupAd |
| **API pattern** | Graph API REST | Google Ads REST v18 (mutate pattern) |

---

## Pendências

- [ ] Dashboard de atribuição
- [x] Integração Google Ads (CRUD completo — Search, PMax, Shopping, Display)
- [x] Motor Estrategista com tool calls Google Ads (v1.45.0)
- [x] Ads Chat com comandos Google Ads (v5.17.0)
- [x] Guardian sync Google Ads — métricas de campanhas e insights (v1.2.0)
- [ ] Guardian sync completo Google (ad groups + ads + keywords)
- [ ] UI Google — exibir ad groups, keywords e anúncios
- [x] Motor Estrategista com tool calls TikTok Ads (v1.47.0)
- [x] Ads Chat com comandos TikTok Ads (v5.18.0)
- [x] Guardian sync TikTok Ads — métricas de campanhas e insights (v1.3.0)
- [x] AdsOverviewTab cross-channel — suporte a Google Ads e TikTok Ads
- [ ] Módulo de email marketing completo
- [ ] Automações de marketing
- [x] Gestor de Tráfego IA — Fase 1: DB (3 tabelas + RLS)
- [x] Gestor de Tráfego IA — Fase 2: Edge Function `ads-autopilot-analyze`
- [x] Gestor de Tráfego IA — Fase 3: Edge Function `ads-autopilot-creative`
- [x] Gestor de Tráfego IA — Fase 4: Hook `useAdsAutopilot`
- [x] Gestor de Tráfego IA — Fase 5-8: UI completa
- [x] Gestor de Tráfego IA — Fase 9: Ad Sets (tabela `meta_ad_adsets` + edge function `meta-ads-adsets` + UI expandível)
- [x] Gestor de Tráfego IA — Fase 10: Métricas por objetivo + filtro de datas + saldo + link externo
- [x] Gestor de Tráfego IA — Fase 10.1: Correção de sync (marketplace/is_active), extração de action_values, colunas Alcance/Frequência/Custo por resultado, balance com funding_source_details
- [x] Gestor de Tráfego IA — Fase 10.2: Colunas personalizáveis (até 7 métricas selecionáveis pelo usuário via Column Selector), botão "Atualizar" (sync unificado de campanhas+insights+adsets), métricas disponíveis: Resultados, Alcance, Impressões, Frequência, Cliques, CTR, Custo por Resultado, CPC, CPM, Gasto, Orçamento, ROAS, Conversões, Valor de Conversão
- [x] Gestor de Tráfego IA — Fase 10.3: Correção de paginação na edge function `meta-ads-campaigns` v1.3.0 — `graphApi` agora suporta URLs absolutas no campo `paging.next` da Meta Graph API, garantindo sync completo de contas com 100+ campanhas. Biblioteca de métricas expandida para 28 métricas em 4 categorias (Desempenho, Custo, Conversão, Engajamento) com extração de actions JSONB. Deep-link "Abrir Meta Ads" aponta para a campanha de maior investimento.
- [x] Gestor de Tráfego IA — Fase 10.4: Persistência de seleção de contas via localStorage, sync de métricas do dia atual (dual preset), refresh de saldo via API, trigger automático do Autopilot ao ativar canal, anúncios individuais (tabela `meta_ad_ads` + edge function `meta-ads-ads` v1.0.0 + UI expandível 3 níveis: Campanha > Conjunto > Anúncio com pause/play)
- [x] Gestor de Tráfego IA — Fase 10.5: Suporte a `effective_status` em campanhas, conjuntos e anúncios. Coluna adicionada nas tabelas `meta_ad_campaigns`, `meta_ad_adsets` e `meta_ad_ads`. Edge functions (`meta-ads-campaigns` v1.4.0, `meta-ads-adsets` v1.1.0, `meta-ads-ads` v1.1.0) agora extraem `effective_status` da Meta Graph API. UI filtra e conta por `effective_status` (estado real de entrega) em vez de `status` (toggle). Permite identificar campanhas ACTIVE mas não entregando (ex: `CAMPAIGN_PAUSED`, `ADSET_PAUSED`, `WITH_ISSUES`).
- [x] Gestor de Tráfego IA — Fase 10.6: Ativação da IA por conta de anúncios (não mais por canal). Cada conta tem toggle de Bot independente nos chips de seleção. Configurações (orçamento, ROI ideal, ROI mín frio/quente, prompt estratégico) são individuais por conta, armazenadas em `safety_rules.account_configs[account_id]`. Lista de contas com IA ativa em `safety_rules.ai_enabled_accounts[]`. Removido `AdsGlobalConfig` e `AdsChannelRoasConfig`, substituídos por `AdsAccountConfig`.
- [x] Gestor de Tráfego IA — Fase 10.6b: Regra de campanha ativa = campaign ACTIVE + pelo menos 1 adset ACTIVE (ou ad sets não sincronizados).
- [x] Gestor de Tráfego IA — Fase 10.7: Relatórios por conta de anúncios. `AdsReportsTab` agrupa insights por `account_id` (mapeamento campaign→account via `campaignAccountMap`) e exibe cards de métricas individuais por conta selecionada. Dados (campanhas, configurações, métricas, saldos, relatórios) são todos segregados por conta de anúncios.
- [x] Gestor de Tráfego IA — Fase 10.8: UX do ícone Bot (🤖 abre configurações, não toggle direto; ativação via Switch interno no card). Detecção de `funding_source_type` para exibir "Cartão de crédito" quando aplicável. Edge function `meta-ads-adsets` v1.2.0 com `funding_source` + `funding_source_details`.
- [x] Gestor de Tráfego IA — Fase 10.9: Regra de campanha ativa refinada com `stop_time` (campanhas expiradas = "Concluída"). Mapeamento numérico de `funding_source_details.type` (1→CREDIT_CARD, 20→PREPAID). Edge function `meta-ads-adsets` v1.3.0.
- [x] Gestor de Tráfego IA — Sprint 3 (v4 Mandatory Config): Tabela normalizada `ads_autopilot_account_configs` com configurações individuais por conta de anúncios (budget_cents, target_roi, min_roi_cold, min_roi_warm, user_instructions, strategy_mode, funnel_split_mode, funnel_splits, kill_switch, human_approval_mode). Hook `useAdsAccountConfigs.ts` com CRUD + `toggleAI` + `toggleKillSwitch` + `isAccountConfigComplete` (validação obrigatória). UI `AdsAccountConfig.tsx` com estratégia (aggressive/balanced/long_term), splits de funil (manual com validação 100% ou AI decides), Kill Switch com AlertDialog de confirmação. Toggle de IA desabilitado até todas as configs obrigatórias preenchidas.
- [x] Gestor de Tráfego IA — Sprint 4 (Weekly Insights Engine): Edge function `ads-autopilot-weekly-insights` v1.0.0 com context collector (unit economics, 30d orders, cross-channel performance), prompt diagnóstico GPT-5.2 com 7 categorias (budget, funnel, creative, audience, channel_mix, conversion, competitive), auto-archive de insights >7d. Cron job `ads-weekly-insights` (Monday 11:00 UTC). Hook `useAdsInsights.ts` com `generateNow` mutation. Tabela `ads_autopilot_insights` (channel, ad_account_id, title, body, evidence, recommended_action, priority, category, sentiment, status).
- [x] Gestor de Tráfego IA — Sprint 5 (Analyze v4.0.0 Per-Account): Edge function `ads-autopilot-analyze` refatorada de v3.0.0→v4.0.0. Arquitetura per-account: lê `ads_autopilot_account_configs` em vez de `safety_rules` JSONB. Cada conta de anúncios com IA ativa recebe sua própria chamada ao LLM com system prompt individualizado contendo: `target_roi`, `min_roi_cold`, `min_roi_warm`, `strategy_mode` (aggressive/balanced/long_term com descrições detalhadas), `funnel_splits` (manual ou AI decides), `user_instructions`, `budget_cents`. Validação respeita `kill_switch` por conta (bloqueia todas as ações). Suporte a `human_approval_mode: "all"` (status `pending_approval`). Campanhas filtradas por `ad_account_id` (mapping campaign→account no Meta). Removida dependência de global `SafetyRules` JSONB — safety defaults agora em constante `DEFAULT_SAFETY`. Removido Allocator cross-channel (decisão agora é por conta, não por canal). Contexto de negócio mantido (products, orders, lowStock).
- [x] Gestor de Tráfego IA — Sprint 6a (Experiments + Creation Tools): Edge function `ads-autopilot-experiments-run` v1.0.0 — avalia experimentos ativos (métricas por campanha), promove vencedores, cancela perdedores, estende insuficientes, sugere novos testes. Tools: promote_winner, cancel_experiment, extend_experiment, suggest_new_experiment. Limite de 3 experimentos/conta. Cron job `ads-experiments-run` (terça 11:00 UTC). Hook `useAdsExperiments.ts` com CRUD + `runExperiments` mutation + `getActiveExperiments` helper. Analyze v4.1.0: novas tools `create_campaign` (templates: cold_conversion/remarketing/creative_test/leads, naming [AI], respeita splits de funil) e `create_adset` (targeting cold/warm/hot). Phase 2 gate: criação requer 7+ dias de dados E 10+ conversões. Ações de criação sempre ficam com status `pending_approval`.
- [x] Gestor de Tráfego IA — Sprint 6b (Creative Generate + Human Approval): Edge function `ads-autopilot-creative-generate` v1.0.0 — analisa top 5 produtos por receita (30d), usa GPT-5-mini para planejar briefs criativos (format, angle, headline, copy, CTA), evita duplicatas recentes (7d), insere como draft em `ads_creative_assets`. Cron job `ads-creative-generate` (quarta 11:00 UTC). Human Approval UI em `AdsActionsTab.tsx`: ações `pending_approval` aparecem primeiro com destaque âmbar, banner de contagem, botões Aprovar (→executed) e Rejeitar (→rejected com motivo). Novos status no STATUS_CONFIG: `pending_approval`, `approved`, `expired`. Mutations inline com invalidação de cache.
- [x] Gestor de Tráfego IA — Sprint 7 (Tracking Health + Pacing + ROI): Analyze v4.2.0 com `checkTrackingHealth` (discrepância atribuição vs pedidos reais, queda de conversões >30%, anomalia CPC >3x, colapso CTR <50%), persiste em `ads_tracking_health`. `checkPacing` (underspend/overspend detection por conta, projeção mensal). Tracking degraded/critical bloqueia escala de budget via `validateAction`. Contexto de pacing e health injetado no system prompt por conta. Nova aba "ROI Real" em `AdsRoiReportsTab.tsx`: ROI real = (Receita - COGS - Taxas 4%) / Spend, com breakdown visual (COGS via `order_items.cost_price`), margem de lucro, Progress bar de distribuição de receita.
- [x] Gestor de Tráfego IA — Sprint 8 (Saldo & Monitoramento): Popover de saldo por conta em `AdsCampaignsTab.tsx` com resumo financeiro (total investido + saldo restante por conta prepaid, badge "Cartão" para CC). Indicador visual de saldo baixo (<R$50) com ícone pulsante vermelho. Hook `useAdsBalanceMonitor.ts` reutiliza `useMetaAds` para agregar: totalAccounts, prepaidCount, lowBalanceCount, zeroBalanceCount, activeCampaigns. Card de monitoramento em `Central de Execuções` (/executions) com alertas por conta (nome + saldo restante), badge de contagem, 3 métricas (contas monitoradas, saldo baixo, campanhas ativas). Threshold: R$50,00 (5000 cents). Contas CC excluídas do monitoramento de saldo.
- [x] Gestor de Tráfego IA — Sprint 9 (Rollback + Drive + Criativos v1.1): **Rollback expandido** em `AdsActionsTab.tsx` — agora suporta desfazer `adjust_budget`, `allocate_budget` e `activate_campaign` (além de `pause_campaign`), restaurando orçamento/status anterior via API e atualizando status para `rolled_back`. **Pasta Drive "Gestor de Tráfego IA"** — edge function `ads-autopilot-creative` v1.1.0 cria automaticamente pasta dedicada na tabela `files` para organizar criativos gerados pela IA de tráfego. **Dados enriquecidos** — `action_data` de ações `generate_creative` agora inclui `product_name`, `channel`, `format`, `variations`, `generation_style`, `folder_name`, `campaign_objective`, `target_audience`. **Schema migration** — `roas_scaling_threshold` adicionado a `ads_autopilot_account_configs`, colunas obsoletas `roas_scale_up_threshold`, `roas_scale_down_threshold`, `budget_increase_pct`, `budget_decrease_pct` removidas.
- [x] Gestor de Tráfego IA — Sprint 9 (UI Polish): Visão Geral refatorada com seletor de plataforma (Meta/Google/TikTok) em vez de contas individuais. Campanhas com rodapé de totais agregados (TableFooter com gasto total, ROAS médio, resultados, alcance, etc.). DateRangeFilter padrão aplicado em todas as abas de Ads. Widget `AdsAlertsWidget` na Central de Execuções mostrando insights não lidos, contas sem saldo e saldo baixo. Balance via `funding_source_details.current_balance` para saldo real-time preciso.
- [x] Gestor de Tráfego IA — Sprint 10 (Regras Internas v4.3-v4.6): Analyze v4.3.0: `approve_high_impact` agora exige aprovação manual para ajustes de budget >20% (além de criações). Analyze v4.4.0: (1) Primeira ativação de IA em conta dispara análise imediata com `trigger_type: "first_activation"` e lookback de 7 dias, gerando insights e ações baseado nas configurações da conta. (2) Ajustes de orçamento (adjust_budget) são agendados para o próximo 00:01 (meia-noite + 1min) em vez de executados imediatamente — ação fica com `status: "scheduled"` e `scheduled_for` timestamp; o cron de 6h verifica e executa ações scheduled quando `scheduled_for <= now()`. Analyze v4.5.0: (3) **Primeira Ativação com Acesso Total** — quando `trigger_type === "first_activation"`, a IA recebe acesso irrestrito a TODAS as ferramentas (pause, adjust_budget, create_campaign, create_adset, report_insight) sem restrições de fase (min_data_days, min_conversions). O objetivo é "colocar a casa em ordem": analisar todas campanhas dos últimos 7d, pausar as ruins, programar ajustes de orçamento, criar campanhas se houver oportunidade, e gerar insights completos. Após esta primeira execução, o fluxo normal com restrições de fase progressiva é aplicado. Analyze v4.6.0: (4) **Remoção da dependência do config global** — `ads_autopilot_configs` (channel=global) não é mais gate de ativação. O controle de ativação é 100% por conta via `ads_autopilot_account_configs.is_ai_enabled`. O registro global é usado apenas como mutex de sessão (lock/unlock). Se não existir registro global, o lock é gerado em memória. AI model default: `openai/gpt-5.2` (fallback quando globalConfig ausente).
- [x] Gestor de Tráfego IA — Sprint 11 (v4.7-v4.11 Prioridade de Métricas + Redistribuição + Learning Phase + Auto-Exec): Analyze v4.7.0-v4.8.0: Métricas da plataforma de anúncios (ROAS, CPA, Conversões da Meta/Google/TikTok) são a **fonte primária de verdade**. Pedidos internos do tenant (`orders`) são usados apenas como fallback informativo e para cálculo de ROI Real (COGS + taxas). Discrepâncias entre plataforma e pedidos geram alertas `Info` mas **nunca bloqueiam** ações da IA. Analyze v4.9.0: **Redistribuição Obrigatória de Orçamento** — se a IA pausou campanhas economizando R$ X/dia, a soma de `adjust_budget` + `create_campaign` DEVE cobrir esses R$ X/dia. Orçamento definido pelo usuário não pode ficar ocioso nem um dia. Na primeira ativação, todas as fases são liberadas e limites por ciclo (±10-20%) são removidos para permitir reestruturação agressiva. Analyze v4.10.0: **Proteção de Learning Phase** — mesmo na primeira ativação, cada campanha ativa só pode receber no máximo **+20%** de aumento de budget (`first_activation_max_increase_pct: 20`). Reduções/pausas permanecem livres. Se o orçamento economizado não cabe dentro do limite de +20% nas campanhas existentes, a IA é **obrigada** a criar novas campanhas (`create_campaign`) para absorver o excedente. Analyze v4.11.0: **Respeito total ao modo de aprovação** — quando `human_approval_mode = "auto"`, NENHUMA ação exige aprovação manual, incluindo `create_campaign` e `create_adset`. Criações só exigem aprovação nos modos `"all"` ou `"approve_high_impact"`. Removida a regra anterior que forçava `pending_approval` em criações independentemente do modo.
- [x] Gestor de Tráfego IA — Sprint 12 (v5.1.0-v5.1.2 Deployment Fixes): **Bid Strategy padrão** — `meta-ads-campaigns` v1.5.0 agora define `bid_strategy: "LOWEST_COST_WITHOUT_CAP"` como padrão para campanhas criadas pela IA, evitando erro "Invalid parameter" ao criar Ad Sets sem `bid_amount`. **Balance simplificado** — `meta-ads-adsets` v1.4.0 remove dependência de `funding_source_details.current_balance` (campo depreciado pela Meta) e usa apenas `Math.abs(balance)` do nível superior da API para contas prepaid. **Geração de Prompt Estratégico com IA** — nova edge function `ads-autopilot-generate-prompt` v1.0.0 agrega dados do tenant (nome da loja, descrição, top 10 produtos com margens, categorias) e gera prompt estratégico personalizado via GPT-5-mini no formato de Gestor de Tráfego Sênior (Missão, Contexto, Compliance, Fontes de Verdade, Funil, Criativos). Botão "✨ Gerar com IA" adicionado ao painel de Prompt Estratégico em `AdsAccountConfig.tsx`. **CBO vs ABO na criação de Ad Sets** — `ads-autopilot-analyze` v5.1.1 corrige conflito de orçamento: quando a campanha pai usa CBO (tem `daily_budget_cents` definido na campanha), o Ad Set é criado **sem** o campo `daily_budget_cents`, evitando erro "Invalid parameter" da Meta que proíbe orçamento simultâneo em campanha e conjunto. Regra: todas as campanhas criadas pela IA usam CBO por padrão, portanto Ad Sets nunca recebem budget próprio. **Sync escopado por conta na primeira ativação** — v5.1.2 corrige timeout: o sync de dados da Meta durante `first_activation` agora é limitado à conta-alvo (`target_account_id`) passando `ad_account_id` para `meta-ads-campaigns`, `meta-ads-insights` e `meta-ads-adsets`, em vez de sincronizar todas as contas do tenant. Regra fundamental: a IA é exclusiva por conta de anúncios — cada conta tem suas próprias configurações via `ads_autopilot_account_configs`, e a ativação/sync/análise opera sempre no escopo de uma única conta.
- [x] Gestor de Tráfego IA — Sprint 13 (v6.0 Dual-Motor + Chat IA): **Arquitetura Dual-Motor** — separação em Motor Guardião (diário: 12h/13h/16h/00h01 BRT, proteção de orçamento) e Motor Estrategista (Start/Semanal/Mensal, pipeline em 5 fases). **Chat de Tráfego IA** — tabelas `ads_chat_conversations` + `ads_chat_messages` com RLS, edge function `ads-chat` v1.0.0 com streaming SSE via `google/gemini-3-flash-preview`, context collector profundo (configs, campanhas, insights, produtos, vendas). Hook `useAdsChat.ts` + componente `AdsChatTab.tsx` com Markdown, sidebar de conversas, realtime. Disponível em 2 níveis: global (tab mãe) e por conta (sub-tab). Limites de budget documentados: Meta ±20%/48h, Google ±20%/7d, TikTok ±15%/48h. Coluna `last_budget_adjusted_at` em `ads_autopilot_account_configs` + `motor_type` em `ads_autopilot_sessions`.
- [x] Gestor de Tráfego IA — Sprint 14 (Motor Guardião edge function): Edge function `ads-autopilot-guardian` v1.0.0 com ciclos diários automatizados (12h/13h/16h/00h01 BRT), tools restritos (pause_campaign, adjust_budget, report_insight), limites de plataforma (Meta ±20%/48h, Google ±20%/7d, TikTok ±15%/48h), cron `1 3,15,16,19 * * *` UTC.
- [x] Gestor de Tráfego IA — Sprint 15 (Motor Estrategista edge function): Edge function `ads-autopilot-strategist` v1.0.0 com pipeline em 5 fases (Planning → Creatives → Audiences → Assembly → Publication). Triggers: `start` (primeira ativação/reestruturação), `weekly` (sábados, implementação domingo 00:01), `monthly` (dia 1). Tools: `create_campaign`, `create_adset`, `generate_creative`, `create_lookalike_audience`, `adjust_budget`, `strategic_plan`. Modelo: `openai/gpt-5.2`. Context collector profundo (30d insights, audiences, experiments, creative cadence). Cron: `0 3 * * 0,1` (domingo/segunda 00:00 UTC = sábado/domingo 21:00 BRT). Hook `useAdsAutopilot` atualizado com `triggerStrategist` mutation.
- [x] Gestor de Tráfego IA — Sprint 16 (Cron Jobs Finais): Configuração de cron schedules para os 3 motores semanais pendentes: `ads-autopilot-weekly-insights` (segunda 11:00 UTC = `0 11 * * 1`), `ads-autopilot-experiments-run` (terça 11:00 UTC = `0 11 * * 2`), `ads-autopilot-creative-generate` (quarta 11:00 UTC = `0 11 * * 3`). Todas as edge functions já existiam (Sprints 4, 6a, 6b) mas não tinham schedule configurado em `config.toml`. Pipeline completo do Gestor de Tráfego IA agora tem 7 cron jobs ativos: Guardian (4x/dia), Strategist (sáb/dom), Weekly Insights (seg), Experiments (ter), Creative Generate (qua).
- [x] Gestor de Tráfego IA — Sprint 17 (Pipeline Criativo Completo): **3 correções críticas**: 1) `ads-autopilot-strategist` v1.1.0 — AdSet agora envia `promoted_object` com `pixel_id` + `custom_event_type` (PURCHASE/LEAD) buscado de `marketing_integrations`, contexto inclui `images` dos produtos e `metaPixelId`; 2) `creative-image-generate` v3.1.0 — bypass de auth M2M (service role) para chamadas entre edge functions, mantendo auth de usuário para chamadas diretas; 3) `ads-autopilot-creative` v1.2.0 — auto-fetch de `product_image_url` via `product_images` ou `products.images` quando não fornecida. Pipeline completo: Strategist → generate_creative (com imagem) → ads-autopilot-creative → creative-image-generate (Gemini+OpenAI) → Storage → Imagem pronta.
- [x] Gestor de Tráfego IA — Sprint 18 (v5.10.0 Agendamento Nativo Meta): **Agendamento nativo** — campanhas criadas pela IA com `human_approval_mode = "auto"` usam `status: ACTIVE` + `start_time` futuro (00:01-04:00 BRT), fazendo com que apareçam como **"Programada"** no Meta Ads Manager nativamente. Removido o agendamento interno (`activate_campaign`). **Nova aba "Agendadas"** no filtro de campanhas (`AdsCampaignsTab.tsx`) com bolinha azul e contagem dedicada. `StatusDot` atualizado para exibir "Agendada" quando `start_time` está no futuro. `meta-ads-campaigns` v1.6.0 suporta `start_time` e `stop_time` no payload de criação e persistência local.
- [ ] Relatórios de ROI (avançado — comparativo de períodos)
- [x] Gestão de Criativos (UI básica)
- [x] Gestão de Criativos (Tabela creative_jobs)
- [x] Gestão de Criativos (Edge Functions generate/process)
- [x] Gestão de Criativos (Galeria visual)
- [ ] Gestão de Criativos (Webhook fal.ai)
- [x] Gestor de Tráfego IA — v5.12.8 (UI/UX Polish): **Zoom de criativos** — `ActionApprovalCard` exibe overlay com ícone de lupa (ZoomIn) no hover de imagens de preview, abrindo Dialog ampliado para inspeção antes da aprovação. Placeholder com ícone `ImageIcon` quando preview ausente. **Sanitização de texto** — função `sanitizeDisplayText` aplicada em todos os textos visíveis ao usuário (insights, cards de aprovação, chat) para remover UUIDs, IDs técnicos (`act_...`), tags internas (`[NOVO]`) e parênteses vazios. **Orçamento como meta de investimento** — prompt do `ads-autopilot-analyze` atualizado para tratar `budget_cents` como meta obrigatória de investimento (não apenas limite máximo). A IA deve planejar ações que busquem utilizar 100% do valor configurado, redistribuindo verbas ou criando campanhas. Se identificar que não deve gastar o total, deve sugerir via Insights. **Overflow do chat corrigido** — containers de chat e sidebar com `overflow-hidden` e `min-w-0` para evitar corte horizontal de conteúdo. **Labels localizados** — prioridades de insights exibidas em português (Crítico/Alto/Médio/Baixo).
- [x] Gestor de Tráfego IA — v5.13.0 (Strategist Context Expansion + Insights UI): **Motor Estrategista v1.3.0** — context collector expandido de 11 para 18 fontes de dados. Novas fontes: `meta_ad_ads` (performance individual de anúncios), `store_settings` (URLs da loja, SEO), `tenants` (domínios customizados), `store_pages` (páginas institucionais), `ai_landing_pages` (landing pages IA), `ads_autopilot_configs` (instruções globais), `categories` (categorias de produtos). System prompt enriquecido com: URLs da loja e checkout, margens de produto, landing pages específicas como destino de campanhas. **Insights UI** — preview de 150 caracteres com botão expandir para texto completo (`whitespace-pre-wrap`). Filtro "Estratégia" adicionado às categorias. Sanitização de termos técnicos em PT-BR.
- [x] Gestor de Tráfego IA — v1.10.0 (Revision Trigger + Auto Re-trigger): **Motor Estrategista v1.10.0** — novo trigger `revision` que permite re-executar o estrategista com feedback do usuário após rejeição de um plano. Parâmetro `revision_feedback` injetado no prompt via placeholder `{{APPROVED_PLAN_CONTENT}}`, incluindo o diagnóstico do plano anterior e as instruções de ajuste. **Frontend `AdsPendingApprovalTab`** — `adjustAction` agora dispara automaticamente `ads-autopilot-strategist` com trigger `revision` + `revision_feedback` após rejeitar a ação, eliminando a necessidade de re-trigger manual. Toast atualizado: "Feedback enviado! A IA está gerando um novo plano com seus ajustes...". Invalidação de queries inclui `ads-autopilot-sessions`. **Bugfix implement_approved_plan** — filtro de busca do plano aprovado corrigido de `.eq("status", "approved")` para `.in("status", ["approved", "executed"])`, pois a `execute-approved` marca o plano como `executed` antes de disparar o estrategista.
- [x] Gestor de Tráfego IA — v5.13.1 (Approval UX Cleanup): **Filtro de ações internas** — `create_adset` e `activate_campaign` removidos da visão de aprovação do usuário em `AdsPendingApprovalTab`, `useAdsPendingActions` e `AdsPendingActionsTab`. Apenas `create_campaign`, `strategic_plan` e ações de alto nível são exibidas. **Bugfix product_price** — campo `product_price` no `ActionApprovalCard` corrigido: valor já está em BRL (ex: 319.33), não em centavos. Removido `formatCents()` e substituído por formatação direta `R$ ${Number(val).toFixed(2)}`. **Limpeza de dados** — lotes duplicados de propostas rejeitados automaticamente; `create_adset` pendentes marcados como `executed` internamente.
- [x] Gestor de Tráfego IA — v5.13.2 (Creative URL Race Condition Fix): **Causa raiz** — `generate_creative` é assíncrono; quando `create_campaign` executa logo em seguida, `asset_url` ainda é `null` no banco, causando cards sem preview visual. **Correção em 2 camadas:** 1. **Backend (Motor Estrategista v1.11.0)** — passo de pós-processamento após TODOS os tool calls que busca ações `pending_approval` do tipo `create_campaign` sem `creative_url` e resolve via: creative asset do produto → imagem do catálogo (`product_images` com `sort_order`). Atualiza `action_data.creative_url` e `action_data.preview.creative_url`. 2. **Frontend (`useResolvedCreativeUrl` hook)** — fallback inteligente no `ActionApprovalCard` (v5.13.2): se `creative_url` é null mas `product_id` existe, busca automaticamente em `ads_creative_assets` e depois em `product_images`. Cache de 60s via `staleTime`. **Garantia anti-regressão** — mesmo que o backend falhe no pós-processamento, o frontend sempre resolve uma imagem.
- [x] Gestor de Tráfego IA — v1.12.0 (Product Price & Selection Fix): **Bug crítico global** — campo `price` em `products` armazena valores em BRL (ex: 89.70), mas 4 edge functions dividiam por 100, fazendo o LLM ver preços absurdos (R$0.90 em vez de R$89.70). Isso causava confusão na seleção de produtos e preços errados nos cards de aprovação. **Funções corrigidas:** `ads-autopilot-strategist` (prompt + preview), `ads-autopilot-analyze` (prompt + `product_price_display`), `ads-autopilot-generate-prompt` (prompt), `generate-seo` (contexto de preço). **Enriquecimento do `create_campaign`** — no Motor Estrategista, `create_campaign` agora resolve o produto completo: match inteligente por nome (exato → starts with → includes), resolve imagem via `imagesByProduct`, formata preço em BRL, preenche preview com headline, copy, targeting, budget display e `product_price_display`. **Regra reforçada:** `products.price` e `products.cost_price` são SEMPRE em BRL — PROIBIDO dividir por 100 em qualquer edge function.
- [x] Gestor de Tráfego IA — v1.13.0 (Product Priority Bias Fix): **Causa raiz** — query de produtos ordenava por `price DESC`, fazendo variantes bulk (ex: "Shampoo Preventive Power (12x)" R$499.90) aparecerem como "Top Produto #1" no prompt, induzindo a IA a priorizá-las sobre o produto carro-chefe definido no prompt estratégico do lojista. **Correções:** 1. **Ordenação neutra** — produtos agora ordenados por `name ASC` (sem viés de preço), limite aumentado de 20→30 para catálogo completo. 2. **Rótulo "Catálogo Completo"** — substituído "Top Produtos" (5 itens) por lista completa com preço, margem e estoque. 3. **Instrução explícita no prompt** — aviso mandatório: "A prioridade de produtos é definida EXCLUSIVAMENTE pelo Prompt Estratégico do lojista. NÃO use a ordem do catálogo como indicador de importância." 4. **Filtro de variantes na cadência criativa** — regex `\(\d+x\)|\(FLEX\)|\(Dia\)|\(Noite\)` aplicado para excluir variantes da seleção de "mainProducts" para cadência criativa, focando nos produtos-base. **Regra reforçada:** A IA NUNCA deve inferir importância de produtos pela posição no catálogo ou preço — somente o `user_instructions` (prompt estratégico) define prioridades.
- [x] Gestor de Tráfego IA — v1.22.0 + v3.0.0 (Full Meta Ads Params): **Strategist v1.22.0** — `create_campaign` expandido de ~10 para 35+ parâmetros, incluindo: `bid_strategy` (LOWEST_COST/BID_CAP/COST_CAP/MINIMUM_ROAS), `optimization_goal` (9 opções), `billing_event` (IMPRESSIONS/LINK_CLICKS/THRUPLAY), `conversion_event` (12 eventos Pixel), `geo_locations` (countries/regions/cities), `interests`, `behaviors`, `excluded_audience_ids`, `publisher_platforms` (4 plataformas), `position_types` (16 posições), `device_platforms`, `destination_url` (OBRIGATÓRIO), `ad_format` (SINGLE_IMAGE/VIDEO/CAROUSEL/COLLECTION), `cta` (13 CTAs), `utm_params`, `special_ad_categories`. `create_adset` expandido com 25+ parâmetros espelhados. Required fields incluem: `optimization_goal`, `conversion_event`, `destination_url`. **Executor v3.0.0** — `ads-autopilot-execute-approved` refatorado para propagar TODOS os parâmetros da `action_data` dinamicamente. Removidos hardcodes: `billing_event: "IMPRESSIONS"`, `geo_locations: {countries: ["BR"]}`, `promoted_object` fixo. Posicionamentos mapeados para keys da Meta API (`facebook_positions`, `instagram_positions`). `destination_url` + UTM params propagados para o anúncio. Scheduling nativo: dentro da janela 00:01-04:00 BRT → ACTIVE imediato; fora → ACTIVE + start_time futuro.
- [x] Gestor de Tráfego IA — v1.38.0 (Timeout Fix para Contas Grandes): **Causa raiz** — contas com >1500 entidades (273 campanhas, 800 adsets, 500 ads) causavam timeout na edge function porque `fetchDeepHistoricalInsights` fazia ~30+ chamadas paginadas à Graph API com delays de 2-5s entre páginas/níveis (total estimado: 120-180s apenas na coleta, ultrapassando o limite de 150s do runtime). **Correção** — substituído `fetchDeepHistoricalInsights` (Graph API re-fetch) por `buildDeepHistoricalFromLocalData` que usa exclusivamente dados já sincronizados nas tabelas locais (`meta_ad_campaigns`, `meta_ad_adsets`, `meta_ad_ads`, `meta_ad_insights`). Zero chamadas de API externas. Performance: <2s para qualquer tamanho de conta. **Tradeoff** — insights por adset/ad individuais não estão disponíveis no DB local (apenas por campanha), mas os metadados (nomes, targeting, creative_id) são preservados para referência da IA.
- [x] Gestor de Tráfego IA — UI Startup Progress (AdsStartupProgress): Novo componente `AdsStartupProgress.tsx` que exibe barra de progresso e log em tempo real durante a primeira ativação (`strategist_start`). Polled via `ads_autopilot_sessions` a cada 3s. 11 estágios visuais (boot → coleta → IA → salvamento). Desaparece automaticamente ao finalizar, invalidando caches de ações/sessões. Integrado em `AdsActionsTab.tsx` (acima da lista de ações e no empty state). Apenas para trigger `strategist_start`.
- [x] Gestor de Tráfego IA — v1.39.0 (Lifetime Sync obrigatório no Start): **Causa raiz** — v1.38.0 trocou o deep historical para dados locais (`buildDeepHistoricalFromLocalData`), mas o sync de background (`meta-ads-insights`) apenas sincronizava os últimos 30 dias. Resultado: o trigger `start` mostrava "30 dias" mesmo pedindo análise lifetime. **Correção** — antes de chamar `buildDeepHistoricalFromLocalData`, o trigger `start` agora invoca `meta-ads-insights` com `date_preset: "maximum"` para cada `ad_account_id`, garantindo que os insights lifetime estejam no DB local antes da leitura. Limite de rows aumentado de 2000→5000. **Regra:** O trigger `start` DEVE sincronizar insights lifetime da Meta API ANTES de montar o deep historical local. Triggers `weekly`/`monthly` NÃO fazem sync adicional (usam dados já no DB).
- [x] Gestor de Tráfego IA — v5.14.0 (Guard isFirstEver no toggleAI): **Causa raiz** — `toggleAI.onSuccess` disparava o Strategist toda vez que `enabled === true`, incluindo re-ativações (toggle off→on), gerando sessões "fantasma" duplicadas. **Correção** — `mutationFn` retorna `{ isFirstEver }` e `onSuccess` só dispara o Strategist quando `enabled && result?.isFirstEver`. Re-ativações são tratadas pelos ciclos automáticos de background (weekly/monthly).
- [x] Meta Ads Insights — v1.5.0 (Chunked Fallback para Contas Grandes): **Causa raiz** — `date_preset: "maximum"` falhava silenciosamente para contas com muitas campanhas (273+) porque a Meta API retornava erro `code: 1` ("Please reduce the amount of data"). O sync fazia `continue` e pulava a conta inteira, resultando em apenas ~30 dias de insights no DB local. **Correção** — quando `maximum` falha com `error.code === 1`, o sistema agora faz fallback para chunks trimestrais (3 meses por requisição). Determina a data de início pela campanha mais antiga da conta (filtro `start_time > 2010`), aplica clamp de 36 meses (limite da Meta API), e itera os chunks com delay de 1s entre eles para evitar rate limiting. **Resultado:** conta com 273 campanhas passou de 267→813 rows de insights, cobrindo set/2023→fev/2026 (3 anos completos). **Regra:** registros agregados (date_start != date_stop) devem ser evitados — usar sempre `time_increment=1` para granularidade diária.
- [x] Gestor de Tráfego IA — v1.40.0 (Skip LIFETIME Sync quando DB Local tem dados): **Causa raiz** — v1.39.0 fazia sync LIFETIME obrigatória no trigger `start`, consumindo ~154s dos 150s de timeout da Edge Function, sem sobrar tempo para a chamada de IA (Gemini). **Correção** — antes de iniciar a sync, o strategist verifica `meta_ad_insights` do tenant. Se existem >100 rows, a sync LIFETIME é pulada (fast path) e o sistema usa diretamente os dados locais. **Regra:** A sync LIFETIME só é executada quando o DB local está vazio ou com poucos dados (<100 rows). Após um reset de dados + re-sync manual, a re-ativação do toggle aproveitará os dados já sincronizados sem desperdício de tempo.
- [x] Gestor de Tráfego IA — v5.16.0 (Rejeição com Duas Opções): **Substituição do campo de texto livre** — o fluxo de rejeição em `ActionApprovalCard` e `OrphanAdsetGroupCard` agora oferece duas opções em vez de textarea: **Opção 1 ("Não quero esta proposta")** — rejeita o plano/ação com `reason: "Usuário não quer esta proposta"`, a IA continua apenas com controles automáticos (diários/semanais/mensais). **Opção 2 ("Quero outra proposta")** — rejeita com `reason: "Usuário solicitou nova proposta"` e dispara automaticamente `ads-autopilot-strategist` com trigger `revision` para gerar um novo plano estratégico substituto. **Componentes afetados:** `ActionApprovalCard.tsx` (type `RejectMode = "discard" | "regenerate"`, dialog com RadioGroup), `AdsPendingActionsTab.tsx` e `AdsPendingApprovalTab.tsx` (handler `onReject` verifica modo e dispara strategist se `regenerate`). **Regra:** O feedback de texto livre foi removido — a decisão é binária (descartar vs. regenerar).
- [x] Gestor de Tráfego IA — v1.41.0 (Fix 0 Ads no Deep Historical + Recalibração UI): **Bug 1 — 0 ads no contexto:** `buildDeepHistoricalFromLocalData` consultava coluna inexistente `creative_data` na tabela `meta_ad_ads`. A coluna correta é `creative_id`. Resultado: query silenciosamente retornava 0 ads, mesmo com 850 ads no DB. **Correção:** `.select()` e mapeamento de `DeepInsight` corrigidos de `creative_data` para `creative_id`. **Bug 2 — Progress bar travada em 88%:** `AdsStartupProgress` usava timers calibrados para execução de ~360s (v1.38.0). Com v1.40.0 executando em ~70s, os estágios `ai_thinking` (140s), `saving` (280s) e `done` (360s) nunca eram alcançados. **Correção:** `STAGE_TIMES_MS` recalibrado para ~90s total (boot:0, campaigns:2s, insights:5s, adsets:8s, ..., ai_thinking:30s, saving:60s, done:90s). **Regra:** Sempre que o tempo de execução do strategist mudar significativamente, recalibrar `STAGE_TIMES_MS` no `AdsStartupProgress.tsx`.
- [x] Gestor de Tráfego IA — v1.45.0 (Google Ads no Motor Estrategista): Motor Estrategista expandido para suportar Google Ads com `GOOGLE_STRATEGIST_TOOLS` (create_google_campaign, toggle_google_entity_status, update_google_budget), prompt especializado para Search/PMax/Shopping/Display, orçamentos em micros (÷1.000.000), context collector com `google_ad_campaigns` e `google_ad_insights`.
- [x] Gestor de Tráfego IA — v5.17.0 (Ads Chat Google Ads): Chat expandido com ferramentas de leitura (`get_google_campaigns` com métricas agregadas) e escrita (`create_google_campaign`, `toggle_google_entity_status`, `update_google_budget`) para Google Ads. System prompt atualizado com referência a Google Ads.
- [x] Gestor de Tráfego IA — Guardian v1.2.0 (Google Ads Sync): Guardian expandido para coletar métricas de `google_ad_campaigns` e `google_ad_insights`, convertendo `cost_micros` para centavos. Cálculo de ROAS/CPA/CTR para janelas 7d e 3d. Prompt dinâmico com `google_campaign_id` e orçamentos em micros.
- [x] Gestor de Tráfego IA — v1.47.0 (TikTok Ads no Motor Estrategista): Motor Estrategista expandido para suportar TikTok Ads com `TIKTOK_STRATEGIST_TOOLS` (create_tiktok_campaign, toggle_tiktok_entity_status, update_tiktok_budget), prompt especializado para boas práticas TikTok (UGC, Sound On, orçamentos mínimos), context collector com `tiktok_ad_campaigns` e `tiktok_ad_insights`. Execution loop seleciona ferramentas TikTok quando `config.channel === "tiktok"`.
- [x] Gestor de Tráfego IA — v5.18.0 (Ads Chat TikTok Ads): Chat expandido com ferramentas de leitura (`get_tiktok_campaigns` com métricas agregadas Spend/ROAS/CPA/CTR) e escrita (`create_tiktok_campaign`, `toggle_tiktok_entity_status`, `update_tiktok_budget`) para TikTok Ads. System prompt atualizado com referência a TikTok Ads e boas práticas de conteúdo para a plataforma.
- [x] Gestor de Tráfego IA — Guardian v1.3.0 (TikTok Ads Sync): Guardian expandido para coletar métricas de `tiktok_ad_campaigns` e `tiktok_ad_insights`, com cálculo de performance (ROAS, CPA, CTR) em janelas 7d e 3d. Prompt dinâmico com referência a `tiktok_campaign_id` e orçamentos em centavos.
- [x] AdsOverviewTab cross-channel (Meta + Google + TikTok): Dashboard de Visão Geral atualizado para receber e exibir dados de Google Ads (`googleInsights`, `googleCampaigns`) e TikTok Ads no breakdown por canal.
- [x] Meta Catalog Sync — v6.0.0 (External ID por Canal / meta_retailer_id): **Causa raiz** — SKU 0042 ficou com registro "envenenado" no Commerce Manager da Meta (estado interno corrompido, imagem não renderizava apesar de payload correto). Teste A/B com novo ID (`0042_TEST_V2`) provou que o mesmo produto com novo retailer_id aparece com imagem normalmente. **Correção estrutural** — (1) Novo campo `products.meta_retailer_id` (TEXT, nullable, default NULL = usa SKU). Permite override do ID externo por produto quando necessário. (2) Nova tabela `meta_retired_ids` (tombstone) que registra IDs antigos problemáticos e impede reutilização. (3) Edge function `meta-catalog-sync` v6.0.0 usa `meta_retailer_id || sku || id` como retailer_id no payload. (4) Antes de cada sync, a function exclui automaticamente IDs tombstoned da Meta via DELETE batch. **SKU 0042:** `meta_retailer_id = '0042__meta_v2'`, ID antigo `0042` tombstoned com razão documentada. **Regra:** SKU interno ≠ ID externo por canal. Nunca assumir que o SKU bruto é o retailer_id da Meta — sempre usar `meta_retailer_id` quando disponível. IDs problemáticos devem ser tombstoned, não reutilizados.
- [x] Meta Pixel/CAPI content_id Fix — v6.1.0 (Matching estrutural Catálogo ↔ Pixel): **Causa raiz** — `marketingTracker.ts` enviava `product.id` (UUID) como `content_ids` em todos os eventos Meta (ViewContent, AddToCart, InitiateCheckout, Purchase, AddShippingInfo, AddPaymentInfo), enquanto o catálogo usava SKU/meta_retailer_id como retailer_id. Isso quebrava o matching de remarketing dinâmico para TODOS os produtos. **Correção** — (1) Nova função `resolveMetaContentId()` em `marketingTracker.ts`: `metaContentId || sku || id`. (2) Todos os 6 eventos Meta usam `resolveMetaContentId()` para content_ids e contents[].id. (3) `useMarketingEvents.ts` reescrito para propagar `sku` e `meta_retailer_id` em todos os fluxos (ViewContent, AddToCart, InitiateCheckout, Purchase, AddShippingInfo, AddPaymentInfo). (4) `CartItem` expandido com `meta_retailer_id?: string | null`. (5) Callers atualizados: `StorefrontProduct`, `ProductCTAs`, `CartItemsList`, `ThankYouContent`. **Regra estrutural:** O content_id enviado ao Pixel/CAPI DEVE ser idêntico ao retailer_id do catálogo Meta. Função `resolveMetaContentId()` é a fonte única de verdade. Google/TikTok usam `sku || id`. UUID só como último fallback.
- [x] Gestor de Tráfego IA — v5.21.0 (Campanhas Pausadas Visíveis): **Causa raiz** — `getCampaignPerformance` retornava `paused_campaigns_sample: slice(0, 10)`, truncando campanhas pausadas. System prompt instruía "PRIORIZAR CAMPANHAS ATIVAS", reforçando o viés. **Correção** — (1) `getCampaignPerformance` e `getGoogleCampaigns` retornam `paused_campaigns` (lista completa) sem truncamento. (2) System prompt alterado para "ANALISAR TODAS AS CAMPANHAS (ATIVAS E PAUSADAS)". (3) Tool description atualizada para explicitar que retorna ativas + pausadas.
- [x] Gestor de Tráfego IA — v5.22.0 (Anti-Promessa Vazia + Filler Detection): **Causa raiz** — a IA respondia com "Aguarde enquanto preparo a criação das primeiras campanhas!" sem chamar nenhuma ferramenta de criação. O texto era retornado como resposta final, e o usuário ficava esperando uma ação que nunca acontecia. **Correção** — (1) Novo bloco `⚠️ REGRA ANTI-PROMESSA VAZIA` no system prompt com lista explícita de frases proibidas ("Aguarde enquanto...", "Vou começar a criar...", "Estou preparando..."). (2) **Filler Phrase Detection** no path de resposta direta (sem tool calls): regex patterns detectam promessas vazias e forçam retry com `tool_choice: "required"`, injetando mensagem de sistema que exige execução imediata. (3) Se o retry produz tool calls, executa o loop normal de ferramentas. Se falha, retorna o texto original como fallback. **Padrões detectados:** `/aguarde\s+(enquanto)/i`, `/vou\s+(começar|criar|gerar|preparar|disparar)/i`, `/estou\s+(preparando|criando|gerando)/i`.
- [x] Gestor de Tráfego IA — v5.23.0 (SSE Progress Events + UI de Processamento): **Causa raiz** — durante execução de ferramentas (30-90s+), o usuário via apenas "Analisando..." genérico sem saber o que a IA estava fazendo. **Correção** — (1) **Backend**: Tool loop refatorado para usar `TransformStream`, enviando SSE `progress` events (`{ type: "progress", label: "Consultando campanhas" }`) em tempo real antes de cada round de ferramentas. 35+ mapeamentos tool→label em português. (2) **Frontend**: `useAdsChat` parseia eventos `progress` via novo state `progressLabel`. `AdsChatTab` passa o label dinâmico ao `ChatTypingIndicator` (ex: "Consultando campanhas...", "Gerando arte...", "Criando campanha Meta..."). (3) Quando o conteúdo final começa a chegar, o progressLabel é limpo automaticamente. **Arquivos:** `ads-chat/index.ts`, `useAdsChat.ts`, `AdsChatTab.tsx`.
- [x] Gestor de Tráfego IA — v5.24.0 (Nomes Exatos de Campanhas via Meta API Live): **Causa raiz** — `getCampaignPerformance` usava tabela local `meta_ad_campaigns` como fonte de nomes, que podia estar desatualizada (nomes renomeados, campanhas não sincronizadas). A IA inventava nomes como "CBO NOITE" que não existiam no Gerenciador. Campanhas presentes na Meta API mas ausentes no DB local eram silenciosamente descartadas (`if (!c) continue`). **Correção** — (1) **`fetchMetaCampaignsLive()` (NOVA)**: busca lista de campanhas diretamente da Meta Graph API (`/act_{id}/campaigns`) com paginação completa, retornando nomes EXATOS do Gerenciador de Anúncios. (2) **`getCampaignPerformance` refatorada**: usa `fetchMetaCampaignsLive()` como fonte primária, DB local apenas como fallback. (3) **Insights live-first**: busca insights primeiro da Meta API, depois DB. (4) **Campanhas orphans**: campanhas que aparecem nos insights mas não na lista são criadas dinamicamente usando `campaign_name` do insight. (5) **System prompt**: nova regra "NOMES EXATOS DAS CAMPANHAS" — proíbe inventar/abreviar/modificar nomes, exige retornar exatamente N resultados quando pedido. (6) **Sem limite artificial**: paginação Meta API busca TODAS as campanhas. **Arquivos:** `ads-chat/index.ts`.
- [x] Gestor de Tráfego IA — v5.31.0 (Refatoração Targeting: Cache Progressivo + Paginação Completa): **Causa raiz** — v5.30.0 limitava `fetchMetaAdsetsLive` a 3 páginas com timeout de 15s via `AbortController`, e `getAdsetTargeting` com timeout de 12s por adset (máx 10). Contas grandes com >200 adsets tinham dados cortados e frequentes timeouts. **Nova Arquitetura — Sync & Cache**: (1) **`fetchMetaAdsetsLive` refatorada** — paginação COMPLETA sem limite de páginas (safety: 500 adsets máx). Sem `AbortController` artificial. Rate limiting tratado com retry automático (429 → espera `Retry-After`). Cada adset buscado é sincronizado no banco `meta_ad_adsets` via upsert fire-and-forget (targeting completo salvo como JSONB). (2) **`getAdsetTargeting` refatorada** — limite aumentado de 10→20 adsets por chamada. Sem timeout artificial. Rate limiting com retry. Cada resultado sincronizado no banco via `syncAdsetToCache()`. (3) **Nova função `syncAdsetToCache()`** — upsert atômico de targeting completo no `meta_ad_adsets`. (4) **Tool descriptions atualizadas** — `get_meta_adsets` e `get_adset_targeting` documentam que dados são sincronizados automaticamente no cache local. **Resultado:** Contas com >200 adsets agora retornam TODOS os dados sem timeout, e os dados ficam cacheados no banco para consultas futuras sem necessidade de nova chamada à API Meta.
- [x] Edge HTML Marketing Events — v6.2.0 (Eventos Pixel no Edge HTML): **Causa raiz** — A storefront pública servida via Edge HTML (`storefront-html`) só disparava `PageView`. Eventos ViewContent (produto), ViewCategory, AddToCart e InitiateCheckout estavam implementados apenas no SPA React (`MarketingTrackerProvider` + `useMarketingEvents`), que NÃO é carregado na vitrine Edge. Resultado: remarketing dinâmico e otimização de conversão quebrados para 100% dos visitantes. **Correção** — (1) **`generateMarketingPixelScripts()` refatorada** — recebe `trackingData` com routeType + dados do produto/categoria. Cada pixel (Meta/Google/TikTok) ao carregar seta `window._sfMetaReady` etc. e executa eventos pendentes enfileirados. (2) **`generateRouteTrackingScript()`** (NOVA) — gera script inline que enfileira ViewContent (produtos) ou ViewCategory (categorias) para disparo após carregamento dos pixels. Usa `resolveMetaContentId()` (meta_retailer_id || sku || id) para paridade catálogo↔pixel. (3) **`addToCart()` refatorada** — recebe `sku` e `metaRetailerId` como parâmetros, dispara AddToCart em Meta/Google/TikTok com content_id correto. (4) **InitiateCheckout** — adicionado no botão "Iniciar Compra" do cart drawer (`data-sf-action="initiate-checkout"`) e no buy-now com tracking completo do carrinho. (5) **`meta_retailer_id`** adicionado ao SELECT da query de produtos no route handler. (6) **`data-product-sku`/`data-product-meta-id`** adicionados aos botões add-to-cart e buy-now no `product-details.ts`. **Cobertura de eventos Edge HTML:** PageView ✅, ViewContent ✅, ViewCategory ✅, AddToCart ✅, InitiateCheckout ✅. **Eventos restantes no SPA:** Purchase (ThankYou), Lead, AddShippingInfo, AddPaymentInfo (checkout SPA). **Arquivos:** `storefront-html/index.ts`, `block-compiler/blocks/product-details.ts`, `block-compiler/types.ts`.
- [x] Purchase Event Fix — v6.2.1 (Purchase dispara em todos os métodos de pagamento): **Causa raiz** — O evento Purchase na página de obrigado (`ThankYouContent.tsx`) usava `purchaseEventTiming` com default `'paid_only'`, o que impedia o disparo para pedidos PIX/Boleto (que ficam em `pending` até confirmação). Resultado: 0% de eventos Purchase rastreados para PIX/Boleto. **Correção** — (1) **`CheckoutStepWizard.tsx`** — `trackPurchase()` agora é chamado diretamente no momento da criação do pedido (`handleFinalSubmit`), ANTES do redirecionamento para a página de obrigado. Isso garante disparo independente do método de pagamento e do status. (2) **`ThankYouContent.tsx`** — Removida a restrição `paid_only` no backup de Purchase. A página de obrigado funciona como fallback confiável: dispara Purchase se o pedido existir e ainda não foi rastreado (dedup via `trackOnce` key `purchase_{orderId}`). (3) **Cobertura final:** Purchase dispara para PIX ✅, Boleto ✅, Cartão ✅ — tanto no checkout quanto na página de obrigado (backup). **Arquivos:** `CheckoutStepWizard.tsx`, `ThankYouContent.tsx`.
- [x] Meta CAPI + Deduplicação Fix — v6.3.0 (Server-side events + eventID correction): **4 bugs corrigidos:** (1) **eventID na posição errada (SPA)** — `trackMetaEvent()` colocava `eventID` dentro do 3º parâmetro (dados do evento) ao invés do 4º parâmetro (options). A Meta ignorava o eventID em TODOS os eventos, impossibilitando deduplicação Pixel↔CAPI. Fix: eventID agora vai no 4º param `fbq('track', eventName, params, {eventID: id})`. (2) **PageView sem eventID (SPA)** — `fbq('track','PageView')` era chamado sem eventID. Fix: agora usa `fbq('track','PageView',{},{eventID:eid})`. (3) **Storefront HTML sem CAPI** — Lojas com domínio customizado (Edge HTML) disparavam eventos apenas via Pixel do navegador, sem enviar a cópia servidor (CAPI). Como a maioria do tráfego vem de domínios customizados, isso causava diferença massiva entre eventos navegador vs servidor no Gerenciador de Eventos. Fix: nova função `_sfCapi()` injetada no HTML que envia cada evento para `marketing-capi-track` via fetch keepalive. (4) **Storefront HTML sem eventID** — Nenhum evento do HTML (ViewContent, AddToCart, InitiateCheckout, PageView) incluía eventID no `fbq()`. Fix: todos agora geram `_sfEvtId()` e passam no 4º param. **Helper injetado:** `_sfCapi(eventName, eventId, customData, userData)` — captura `_fbp` (cookie) e `_fbc` (fbclid→localStorage) automaticamente. **Eventos cobertos:** PageView ✅, ViewContent ✅, ViewCategory ✅, AddToCart ✅, InitiateCheckout ✅. **Arquivos:** `marketingTracker.ts`, `storefront-html/index.ts`.
- [x] Meta CAPI Diagnóstico Fix — v8.16.0 (FBC persistence + IPv6 + IP matching): **3 diagnósticos corrigidos:** (1) **FBC vazio no servidor para PageViews** — `_sfCapi()` no Edge HTML lia `_fbc` apenas de `localStorage`, mas o primeiro hit vindo de anúncio (com `fbclid` na URL) ainda não tinha o valor persistido. Fix: script inline agora persiste `fbclid` → `_fbc` tanto em cookie first-party (90 dias) quanto em localStorage imediatamente ao carregar a página, ANTES do disparo do PageView CAPI. `_sfCapi()` lê na ordem: cookie → localStorage → null. (2) **Client IP mismatch (IPv4 vs IPv6)** — `marketing-capi-track` usava `x-forwarded-for` como primeira opção de IP, que frequentemente retornava IPv4 do proxy/CDN enquanto o Pixel via IPv6 do visitante real. Fix: prioridade de headers atualizada para `cf-connecting-ip` (Cloudflare, preserva IPv6) > `x-real-ip` > `x-forwarded-for` (fallback). (3) **Cobertura Pixel vs CAPI** — diagnóstico residual da janela móvel de 7 dias. Não há perda real de cobertura ativa; os fixes de FBC e IP devem melhorar o score de matching automaticamente. **Arquivos:** `storefront-html/index.ts`, `marketing-capi-track/index.ts`.
- [x] Meta CAPI Auditoria Crítica — v8.20.0 (events_inbox constraint + beacon CORS + content_id): **3 bugs críticos corrigidos:** (1) **events_inbox check constraint rejeitava 'pending'** — A tabela `events_inbox` tinha constraint `status_check` que aceitava apenas `['new','processed','ignored','error']`. Seis edge functions (pagarme-webhook, mercadopago-storefront-webhook, shipment-ingest, tracking-poll, checkout-session-complete, scheduler-tick) inseriam com `status: 'pending'`, causando falha silenciosa. O process-events também usava `'processing'` como status intermediário, que também falhava. **Fix:** (a) Migration para adicionar `'pending'` e `'processing'` ao constraint. (b) Todas as 6 functions corrigidas para usar `status: 'new'` por padronização. **Impacto:** TODOS os eventos de pagamento aprovado (Pagar.me e MercadoPago) estavam sendo descartados silenciosamente, impedindo notificações E disparo de Purchase CAPI via server-side no modo paid_only. (2) **sendBeacon com application/json causava preflight CORS** — v8.19.0 adicionou `navigator.sendBeacon` com `Blob({ type: 'application/json' })` para Lead, InitiateCheckout e Purchase. O Content-Type `application/json` NÃO é CORS-safelisted, causando preflight que beacon não suporta. Resultado: Lead CAPI = ZERO, InitiateCheckout CAPI intermitente. **Fix:** Estratégia híbrida — Lead e InitiateCheckout usam `fetch + keepalive` (sem redirect risk). Purchase usa `fetch + keepalive` como primário, com `sendBeacon` + `text/plain` como fallback de último recurso apenas quando fetch falha (page unload). Edge function `marketing-capi-track` atualizada para aceitar `Content-Type: text/plain`. (3) **resolveMetaContentId retornava string vazia** — Quando produto não tinha SKU nem meta_retailer_id, `resolveMetaContentId()` retornava `''`. Meta rejeitava o payload com "conteúdos inválidos". **Fix:** Função agora usa product_id/UUID como fallback obrigatório e registra `console.warn` quando isso ocorre, para visibilidade de quais produtos precisam de SKU/meta_retailer_id. **Regra paid_only:** A fonte primária do Purchase continua sendo server-side via webhook → events_inbox → process-events. O browser atua como complemento/fallback, não como fonte principal. **Arquivos:** Migration `fix_events_inbox_status_constraint`, `pagarme-webhook/index.ts`, `mercadopago-storefront-webhook/index.ts`, `shipment-ingest/index.ts`, `tracking-poll/index.ts`, `checkout-session-complete/index.ts`, `scheduler-tick/index.ts`, `_shared/meta-capi-sender.ts`, `marketingTracker.ts`, `marketing-capi-track/index.ts`.
- [x] Meta CAPI Cobertura de Parâmetros — v8.20.1 (external_id + fbp sync + identity persistence): **4 correções de cobertura:** (1) **`_sf_vid` síncrono** — `getOrCreateVisitorId()` era chamado apenas dentro de `initialize()` do tracker (deferido via requestIdleCallback/setTimeout 2s). Eventos CAPI disparados antes da inicialização iam sem `external_id`. **Fix:** chamada síncrona no body do `MarketingTrackerProvider`, antes de qualquer useEffect. (2) **Retry de `_fbp`** — O cookie `_fbp` é criado pelo script Meta Pixel que também carrega deferido. ViewContent/AddToCart CAPI disparavam antes do cookie existir (0.95% cobertura). **Fix:** `sendServerEvent` agora usa `waitForFbp()` que faz polling a cada 200ms por até 1.5s para eventos ViewContent/AddToCart/PageView, aguardando a criação do `_fbp` antes de enviar. (3) **Identidade na checkout_sessions** — Purchase CAPI server-side (process-events para paid_only) ia sem `client_ip`, `user_agent`, `fbp`, `fbc`, `external_id` porque esses dados não eram persistidos. **Fix:** (a) Migration adicionou colunas `visitor_id`, `fbp`, `fbc`, `client_ip`, `client_user_agent` na tabela `checkout_sessions`. (b) `checkout-session-start` salva esses dados no momento do checkout. (c) `process-events` busca a checkout_session vinculada ao pedido e inclui a identidade no `sendCapiPurchase`. (4) **IP capture no checkout** — `checkout-session-start` agora captura IP do visitante via cadeia de headers HTTP (cf-connecting-ip > true-client-ip > x-real-ip > x-forwarded-for). **Arquivos:** Migration, `MarketingTrackerProvider.tsx`, `marketingTracker.ts`, `checkoutSession.ts`, `checkout-session-start/index.ts`, `process-events/index.ts`.
- [x] Meta CAPI fbp Universal Wait — v8.21.1 (waitForFbp em todos os eventos do funil): **Causa raiz** — Apenas PageView, ViewContent e AddToCart aguardavam o cookie `_fbp` antes de enviar CAPI. Eventos de meio/fundo de funil (InitiateCheckout, Lead, AddShippingInfo, AddPaymentInfo, ViewCategory) disparavam imediatamente sem `_fbp`, reduzindo o quality score de matching. **Correção** — `needsFbpWait = true` agora é aplicado a TODOS os eventos Meta em `sendServerEvent()` no `marketingTracker.ts`. Polling de até 1.5s (200ms interval) aguarda o cookie `_fbp` antes de enviar qualquer evento CAPI. **Parâmetros que NÃO precisam de correção (limitações naturais):** `fbc` (só existe para tráfego vindo de anúncios Meta, ~40-50%), `email/phone` em ViewContent/PageView (visitante ainda não se identificou), `Facebook Login ID` (requer integração Facebook Login, ganho de 0.01%). **Arquivos:** `marketingTracker.ts`, `.lovable/memory/infrastructure/marketing/meta-tracking-standards-v8-21.md`.
