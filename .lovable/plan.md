# Plano: Aderência Total da Loja à Renderização Edge

---

## 🐛 BUGS CRÍTICOS IDENTIFICADOS

### BUG 1: Botão "Adicionar ao Carrinho" não funciona (CORRIGIDO ✅)
**Correção**: Adicionado `onclick="event.stopPropagation()"` em featured-products.ts e category-page-layout.ts.

### BUG 2: Banner de categoria não renderiza (CORRIGIDO ✅)
**Correção**: Auto-injeção no `storefront-html` quando `category.banner_desktop_url` existe e template não contém `CategoryBanner`.

### BUG 3: Galeria de imagens do produto (VERIFICADO ✅)
**Status**: JS de hidratação verificado — swipe/dots (mobile), thumbnail click (desktop) e lightbox+zoom estão implementados corretamente. O código está funcional; requer re-publicação para aplicar.

### BUG 4: Produtos relacionados não herdam categorySettings (CORRIGIDO ✅)
**Correção**: Refatorada seção de relacionados em `product-details.ts` para usar `categorySettings` (showRatings, showBadges, showAddToCartButton, quickBuyEnabled) com mesma estrutura visual do `category-page-layout.ts`.

### BUG 5: Botões de CTA na página de produto (VERIFICADO ✅)
**Status**: Handlers `data-sf-action` verificados — add-to-cart, buy-now, qty-minus/plus e calc-shipping todos funcionais no script de hidratação.

---

## 📊 RESUMO: Sistema de Cores da Loja

### Arquitetura Geral
```
┌───────────────────────────────────────────────────────────────────┐
│              FONTE DE VERDADE: storefront_template_sets           │
│                                                                    │
│  draft_content.themeSettings.colors    → Builder (preview)        │
│  published_content.themeSettings.colors → Loja pública            │
└───────────────────────────────────────────────────────────────────┘
                              ↓
┌───────────────────────────────────────────────────────────────────┐
│              INJEÇÃO DE CSS (2 caminhos paralelos)                │
├───────────────────────────────────────────────────────────────────┤
│  BUILDER:        useBuilderThemeInjector.ts                       │
│  LOJA PÚBLICA:   StorefrontThemeInjector.tsx                      │
│  EDGE HTML:      CSS inline no <head> via storefront-html         │
└───────────────────────────────────────────────────────────────────┘
```

### Grupos de Cores Disponíveis

| Grupo | Variáveis CSS | Uso |
|-------|--------------|-----|
| **Botão Primário** | `--theme-button-primary-bg`, `--theme-button-primary-text`, `--theme-button-primary-hover` | CTAs principais |
| **Botão Secundário** | `--theme-button-secondary-bg`, `--theme-button-secondary-text`, `--theme-button-secondary-hover` | Botões secundários |
| **WhatsApp** | `--theme-whatsapp-color`, `--theme-whatsapp-hover` | Botão WhatsApp |
| **Preço** | `--theme-price-color` | Valor principal do preço |
| **Promo/Tags** | `--theme-promo-bg`, `--theme-promo-text` | Tags promocionais |

### Pontos de Melhoria
1. Duplicação em 3 sistemas diferentes
2. Edge HTML duplica lógica CSS do React
3. Falta centralização (design tokens)

---

## 📦 RESUMO: Sistema de Frete Grátis

### Hierarquia de Precedência
1. **Produto**: `products.free_shipping` (boolean)
2. **Cupom**: `discounts.type = 'free_shipping'`
3. **Regras de Logística**: `free_shipping_rules`

### Pontos de Melhoria
1. Lógica duplicada React/Edge
2. Badge "Frete Grátis" com estilos inconsistentes

---

## 📋 INVENTÁRIO DE BLOCOS

### ✅ Prontos no Edge (43 compiladores + 3 standalone + 1 shared)
- **Layout**: Page, Section, Container, Columns, Column, Grid
- **Conteúdo**: Text, RichText, Image, Button, Spacer, Divider
- **E-commerce**: HeroBanner, Banner, ImageCarousel, InfoHighlights, FeaturedCategories, FeaturedProducts, CategoryBanner, CategoryPageLayout
- **Produto**: ProductDetails (Reviews, Compre Junto, Relacionados, Variantes, Galeria+Lightbox)
- **Interativo**: FAQ, Testimonials, AccordionBlock, Newsletter, NewsletterForm
- **Mídia**: YouTubeVideo, VideoCarousel, HTMLSection, ImageGallery
- **Marketing**: CountdownTimer, LogosCarousel, StatsNumbers, ContentColumns, FeatureList, StepsTimeline, TextBanners
- **Estrutural**: Header, Footer
- **Standalone**: Blog, Institucional

- **E-commerce Avançado**: ProductGrid, ProductCarousel, CategoryList, CollectionSection, BannerProducts
- **Shared**: product-card-html.ts (renderProductCard reutilizável)

### 🔴 FALTA Compilador (0 blocos — todos compiladores de conteúdo implementados)

**Nota**: NewsletterPopup é edge-rendered diretamente no `storefront-html` (fora da árvore de blocos), não precisa de compilador na registry.
**Blocos sem compilador restantes são apenas blocos de sistema/demo**: TrackingLookup, BlogListing, BlogPostDetail, PageContent, ContactForm, CategoryFilters, CartDemo, CheckoutDemo, etc.

---

## 🚀 PLANO DE EXECUÇÃO (Edge Rendering)

### Fase 0: Bugs Críticos ✅ CONCLUÍDA
### Fase 1: Blocos de Layout ✅ CONCLUÍDA
### Fase 2: Blocos Interativos ✅ CONCLUÍDA
### Fase 3: Blocos de Mídia ✅ CONCLUÍDA
### Fase 4: Blocos de Marketing ✅ CONCLUÍDA
### Fase 5: Blocos E-commerce Avançados ✅ CONCLUÍDA
### Fase 6: Verificações Globais ✅ CONCLUÍDA
### Fase 7: Auditoria Visual + Centralização ✅ CONCLUÍDA

---

## Cleanup Realizado
- ✅ Removido `_shared/block-compiler/blocks/product-page.ts` (dead code)

---
---

# Fase 2 — "Preencher com IA" nos Blocos do Builder

## Diagnóstico Técnico da Arquitetura Real

### 1. Arquitetura dos Blocos

**Registry (fonte de verdade única):** `src/lib/builder/registry.ts` (3490 linhas)
- Contém TODAS as definições de blocos em `blockDefinitions: BlockDefinition[]`
- Cada bloco tem: `type`, `label`, `category`, `icon`, `defaultProps`, `propsSchema`, `canHaveChildren`, `isRemovable`
- `propsSchema` é o mapa completo de props com `type`, `label`, `defaultValue`, `options`, `placeholder`, `showWhen`, `helpText`
- O `BlockRegistry` é uma classe singleton exportada como `blockRegistry`

**PropsEditor (100% schema-driven):** `src/components/builder/PropsEditor.tsx` (749 linhas)
- Monta o formulário inteiramente a partir de `definition.propsSchema`
- Não tem lógica manual por bloco, exceto:
  - Roteamento de arrays para editores específicos (FAQEditor, TestimonialsEditor, etc.) via `if (blockType === 'FAQ' && name === 'items')`
  - Agrupamento de props de "Aviso Geral" no Header
  - Blocos de sistema (SYSTEM_BLOCKS) são redirecionados para Theme Settings

**onChange:** `PropsEditor` recebe `onChange: (props: Record<string, unknown>) => void` que faz merge via `handleChange(key, value) → onChange({ ...props, [key]: value })`. O state é gerenciado no `useBuilderStore` (`src/hooks/useBuilderStore.ts`), que mantém array de history para undo/redo.

### 2. Formato do RichText

**Formato: HTML string simples.**
- O `RichTextEditor` (`src/components/builder/RichTextEditor.tsx`) trabalha com HTML sanitizado.
- Entrada/saída = string HTML (ex: `<p>Texto</p><ul><li>Item</li></ul>`)
- NÃO usa Tiptap JSON, ProseMirror JSON ou Markdown.
- Sanitização: whitelist de tags (`p, br, strong, b, em, i, u, a, ul, ol, li, h1-h4, span, div`) e atributos (`href, target, class, style`).
- **A IA DEVE devolver HTML já no formato aceito** (tags da whitelist, sem style inline complexo).

### 3. Undo/Redo

**Sim, existe e funciona.**
- `useBuilderStore` mantém `history: BlockNode[]` e `historyIndex: number`
- `canUndo` / `canRedo` derivados do index
- Cada `updateBlockProps` cria nova entrada no history
- **O preenchimento por IA será desfeito com um Ctrl+Z** — basta chamar `onChange` normalmente.

### 4. Contexto Disponível para a IA

**`store_settings` (tabela real no banco):** Campos disponíveis:
- `store_name`, `logo_url`, `primary_color`, `secondary_color`, `accent_color`
- `contact_phone`, `contact_email`, `contact_address`, `contact_support_hours`
- `social_instagram`, `social_facebook`, `social_whatsapp`
- `store_description`

**`StoreSettingsContext` (interface TypeScript):** já definida em `src/lib/builder/types.ts` (linhas 131-148).

**NÃO existe hoje:**
- Segmento/nicho da loja
- Tom de voz / brand rules
- Público-alvo
- Contexto de blocos vizinhos

### 5. Infra de IA Existente

- **Lovable AI Gateway:** já configurada (`LOVABLE_API_KEY` como secret)
- **Modelo padrão:** `google/gemini-3-flash-preview`
- **Edge function de IA para pages:** `ai-page-architect` (já existe, gera estrutura de blocos)
- **Tool calling / structured output:** já usado no `ai-page-architect`
- **Toast/loading:** padrão `sonner` toast já em uso no projeto
- **NÃO existe:** edge function, hook ou helper para preenchimento de conteúdo de blocos individuais

---

## Classificação Completa dos Blocos

### EXCLUÍDOS (não preenchíveis por IA) — 23 blocos de sistema/infra

| Tipo | Motivo |
|------|--------|
| Page, Section, Container, Columns | Infraestrutura |
| Divider, Spacer | Sem texto |
| Header, Footer | Sistema (Theme Settings) |
| Cart, CartSummary, Checkout, CheckoutSteps, ThankYou | Sistema |
| AccountHub, OrdersList, OrderDetail, TrackingLookup | Sistema |
| CategoryPageLayout, ProductDetails | Sistema |
| CompreJuntoSlot, CrossSellSlot, UpsellSlot, CategoryBanner | Sistema |

### EXCLUÍDOS (dados reais / mídia / técnico) — 14 blocos

| Tipo | Motivo |
|------|--------|
| ProductGrid, ProductCarousel, FeaturedProducts, ProductCard | Dados de produtos reais |
| CategoryList, FeaturedCategories, CollectionSection, BannerProducts | Dados reais |
| Image, VideoUpload | Só mídia |
| CustomBlock, HTMLSection, PageContent | Técnico |
| BlogListing, EmbedSocialPost, QuizEmbed | Sistema/embed |

### ELEGÍVEIS — 21 blocos

#### Grupo A: Texto simples (props string/richtext)

| # | blockType | Props preenchíveis por IA | Props NÃO preenchíveis |
|---|-----------|--------------------------|------------------------|
| 1 | **Banner** | `title`, `subtitle`, `buttonText` | `imageDesktop`, `imageMobile`, `buttonUrl`, `linkUrl`, todas as cores/estilo |
| 2 | **RichText** | `content` (HTML) | `fontFamily`, `fontSize`, `fontWeight` |
| 3 | **Button** | `text` | `url`, `variant`, `size`, todas as cores/estilo |
| 4 | **TextBanners** | `title`, `text`, `ctaText` | `ctaUrl`, imagens, cores, layout |
| 5 | **ContentColumns** | `title`, `subtitle`, `content` (richtext) | `buttonText`, `buttonUrl`, imagens, cores |
| 6 | **CountdownTimer** | `title`, `subtitle`, `expiredMessage`, `buttonText` | `endDate`, `buttonUrl`, cores |
| 7 | **Newsletter** | `title`, `subtitle`, `incentiveText` | `placeholder`, `buttonText`, `successMessage`, cores |
| 8 | **ContactForm** | `title`, `subtitle` | labels, `buttonText`, `successMessage`, dados de contato reais, cores |
| 9 | **Map** | `title`, `subtitle` | `address`, `embedUrl`, dados de contato reais, cores |
| 10 | **SocialFeed** | `title`, `subtitle` | `profileUsername`, `profileUrl`, `followButtonText`, cores |
| 11 | **PopupModal** | `title`, `subtitle` | `buttonText`, `discountCode`, cores |
| 12 | **PersonalizedProducts** | `title`, `subtitle` | layout, colunas |
| 13 | **LivePurchases** | `title` | layout, stats |
| 14 | **PricingTable** | `title`, `subtitle` | layout, toggle |
| 15 | **YouTubeVideo** | `title` | `youtubeUrl`, width, aspect |
| 16 | **VideoCarousel** | `title` | `videos`, aspect |
| 17 | **ImageCarousel** | `title` | `images`, aspect |
| 18 | **ImageGallery** | `title`, `subtitle` | `images`, colunas |
| 19 | **LogosCarousel** | `title`, `subtitle` | `logos`, colunas, grayscale |
| 20 | **NewsletterForm** | `title`, `subtitle` | `listId`, `buttonText`, `successMessage`, cores |
| 21 | **NewsletterPopup** | `title`, `subtitle` | `listId`, `buttonText`, `successMessage`, trigger, cores |

#### Grupo B: Texto + Arrays estruturados

| # | blockType | Props texto | Array prop | Estrutura do item | Faixa ideal |
|---|-----------|-------------|------------|-------------------|-------------|
| 1 | **FAQ** | `title` | `items` | `{ question, answer }` | 3-6 |
| 2 | **Testimonials** | `title` | `items` | `{ name, content, rating, role? }` | 3-6 |
| 3 | **FeatureList** | `title`, `subtitle` | `items` | `{ icon, text }` | 3-6 |
| 4 | **ContentColumns** | (listado acima) | `features` | `{ icon, text }` | 3-5 |
| 5 | **InfoHighlights** | (sem título) | `items` | `{ icon, title, description? }` | 3-4 |
| 6 | **StepsTimeline** | `title`, `subtitle` | `steps` | `{ number, title, description }` | 3-5 |
| 7 | **StatsNumbers** | `title`, `subtitle` | `items` | `{ number, label }` | 3-4 |
| 8 | **AccordionBlock** | `title`, `subtitle` | `items` | `{ title, content }` | 2-6 |
| 9 | **Reviews** | `title` | `reviews` | `{ name, rating, text }` | 3-6 |

---

## Decisão Arquitetural: Metadata no Registry vs Arquivo Separado

### RECOMENDAÇÃO: Adicionar campo `aiFillable` ao `BlockPropsSchema`

**Por quê:**
1. O `propsSchema` JÁ É a fonte de verdade para tipo, label, default de cada prop
2. Adicionar `aiFillable` à interface elimina drift
3. O PropsEditor e a edge function leem do MESMO schema
4. Nenhum arquivo separado para manter sincronizado

**Proposta na interface `BlockPropsSchema` (em `src/lib/builder/types.ts`):**
```typescript
aiFillable?: boolean | {
  hint?: string;        // Ex: "Título chamativo, 3-8 palavras"
  count?: { min: number; max: number }; // Para arrays
  itemHints?: Record<string, string>;   // Hints por campo do item do array
};
```

**Exemplo de uso no registry (FAQ):**
```typescript
title: {
  type: 'string',
  label: 'Título',
  defaultValue: 'Perguntas Frequentes',
  aiFillable: { hint: 'Título da seção FAQ, 2-5 palavras' },
},
items: {
  type: 'array',
  label: 'Perguntas',
  aiFillable: {
    count: { min: 3, max: 6 },
    itemHints: {
      question: 'Pergunta frequente do cliente',
      answer: 'Resposta clara, 1-3 frases',
    },
  },
},
```

---

## Campos que NUNCA devem ser preenchidos pela IA

| Categoria | Exemplos | Motivo |
|-----------|----------|--------|
| URLs/Links | `url`, `buttonUrl`, `linkUrl`, `ctaUrl`, `youtubeUrl`, `profileUrl`, `embedUrl` | Endereços reais |
| Imagens | `imageDesktop`, `imageMobile`, `logos[].imageUrl` | Upload real |
| Vídeos | `videoDesktop`, `videoMobile`, `videos[]` | Upload real |
| Cores/Estilo | `backgroundColor`, `textColor`, `iconColor`, qualquer `*Color` | Design do tema |
| Layout | `layout`, `columns`, `alignment`, `variant`, `size`, `height`, `width` | Estrutura |
| Booleanos | `showButton`, `showIcon`, `autoplay`, `grayscale` | Config do usuário |
| Dados de contato | `contactEmail`, `contactPhone`, `contactAddress`, `contactHours` | Dados reais |
| IDs/Referências | `productId`, `categoryId`, `menuId`, `quizId`, `listId` | Dados do sistema |
| Códigos | `discountCode` | Código real |
| Usernames | `profileUsername` | Username real |
| Técnicos | `htmlContent`, `cssContent`, `baseUrl`, `videosJson` | Conteúdo técnico |
| Labels de form | `nameLabel`, `emailLabel`, etc. | Estrutura fixa |
| Mensagens sistema | `successMessage`, `expiredMessage` | Manter padrão |
| Placeholders | `placeholder` | UX decision |

---

## Regras para Arrays

| Decisão | Regra |
|---------|-------|
| **Quantidade** | Se vazio: gerar `count.min` a `count.max` itens. Se já tem itens: SOBRESCREVER todos (undo disponível) |
| **`icon` em arrays** | IA sugere ícone da lista permitida (Check, Shield, Truck, Star, etc.) |
| **`rating` em arrays** | IA gera rating 4-5 (realista para depoimentos) |
| **`number` em StepsTimeline** | Auto-incremento (1, 2, 3...) |
| **`number` em StatsNumbers** | IA gera string (ex: "10k+", "99%", "24h") |
| **`name` em Testimonials/Reviews** | IA gera nomes fictícios PT-BR |
| **`role` em Testimonials** | IA gera (ex: "Cliente desde 2023") |

---

## Plano de Implementação

### Fase 2.1 — Schema `aiFillable` (types.ts + registry.ts)
- Adicionar campo opcional `aiFillable` à interface `BlockPropsSchema`
- Marcar props preenchíveis nos 21+ blocos elegíveis do registry
- Sem mudança visual, sem risco

### Fase 2.2 — Edge Function `ai-block-fill`
- Input: `blockType`, `fillableProps` (extraídas do registry), `businessContext` (store_settings)
- Output via tool calling: JSON com valores para cada prop `aiFillable`
- Modelo: `google/gemini-3-flash-preview`
- Prompt em PT-BR, orientado a e-commerce
- Tratar 429/402

### Fase 2.3 — Hook `useAIBlockFill` + Botão no PropsEditor
- Hook: chama edge function, retorna props preenchidas
- Merge: sobrescreve APENAS props com `aiFillable`, preserva todas as outras
- Botão "✨ Preencher com IA" no topo do PropsEditor
- Loading state, toast sucesso/erro
- undo/redo funciona automaticamente via `onChange` padrão

### Fase 2.4 — (Futuro) Preenchimento em lote
- Botão na toolbar: "Preencher página inteira"
- Itera blocos da página sequencialmente
- Progress bar

---

## Riscos Técnicos

| Risco | Mitigação |
|-------|-----------|
| RichText com HTML inválido | Sanitizar retorno da IA com mesma função do RichTextEditor |
| Ícones inválidos em arrays | Lista de ícones válidos no prompt + fallback "Check" |
| Rate limiting Lovable AI | Toast informativo para 429 |
| Custo de créditos | Gemini Flash é barato. Aviso antes do preenchimento. |
| Drift do aiFillable | Impossível — está no mesmo objeto do schema |
| Sobrescrever conteúdo editado | Undo disponível. Opcional: confirmação se já tem conteúdo. |
