# Marketing — Regras e Especificações

> **STATUS:** 🟧 Pending (parcialmente implementado)  
> **Última atualização:** 2025-01-27

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
| Meta (FB/IG) | ✅ Ready | Pixel, Catálogo, CAPI |
| Google Ads | 🟧 Pending | Conversions, Merchant |
| TikTok | 🟧 Pending | Pixel, Events |
| Pinterest | 🟧 Pending | Tag, Catálogo |

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

## 5. Gestor de Tráfego IA

> **Antigo nome:** Criador de Campanhas

### Tipos de Campanha
| Tipo | Descrição |
|------|-----------|
| `flash_sale` | Venda relâmpago |
| `seasonal` | Sazonal |
| `launch` | Lançamento |
| `clearance` | Queima de estoque |

### Elementos de Campanha
| Elemento | Descrição |
|----------|-----------|
| Landing page | Página específica |
| Cupom | Desconto vinculado |
| Timer | Contagem regressiva |
| Banner | Visual da campanha |

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
- [ ] Integração Google Ads
- [ ] Módulo de email marketing completo
- [ ] Automações de marketing
- [ ] Gestão de tráfego IA completa
- [ ] Relatórios de ROI
- [x] Gestão de Criativos (UI básica)
- [x] Gestão de Criativos (Tabela creative_jobs)
- [x] Gestão de Criativos (Edge Functions generate/process)
- [x] Gestão de Criativos (Galeria visual)
- [ ] Gestão de Criativos (Webhook fal.ai)
