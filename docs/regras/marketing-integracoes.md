# Marketing (Integrações, Atribuição, Campanhas) — Regras e Especificações

> **STATUS:** 🟧 Pending (parcialmente implementado)

## Visão Geral

Módulo de marketing: integrações com plataformas, atribuição de vendas, gestão de mídias e campanhas.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Integrações Marketing | `/marketing` | 🟧 Pending |
| Atribuição de venda | `/marketing/atribuicao` | 🟧 Pending |
| Email Marketing | `/email-marketing` | 🟧 Pending |
| Aumentar Ticket | `/offers` | ✅ Ready (ver ofertas.md) |
| Avaliações | `/reviews` | ✅ Ready (ver avaliacoes.md) |
| Gestão de Mídias | `/media` | 🟧 Pending |
| Criador de campanhas | `/campaigns` | 🟧 Pending |

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

## 4. Gestão de Mídias

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

## 5. Criador de Campanhas

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

## Pendências

- [ ] Dashboard de atribuição
- [ ] Integração Google Ads
- [ ] Módulo de email marketing completo
- [ ] Automações de marketing
- [ ] Gestão de campanhas
- [ ] Relatórios de ROI
