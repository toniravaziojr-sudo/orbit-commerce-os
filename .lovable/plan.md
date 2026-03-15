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

# Fase 2 — "Preencher com IA" — Diagnóstico Operacional Completo

## 1. Arquitetura Real dos Blocos

### Fonte de verdade
- **Registro central:** `src/lib/builder/registry.ts` (3490 linhas)
- **Tipos:** `src/lib/builder/types.ts` → `BlockDefinition`, `BlockPropsSchema`
- **Store:** `src/hooks/useBuilderStore.ts` → `updateProps(blockId, props)` com undo/redo (MAX_HISTORY=50)
- **PropsEditor:** `src/components/builder/PropsEditor.tsx` (749 linhas) — schema-driven, com tratamento especial por `blockType` para arrays

### Como o PropsEditor funciona
- Itera `Object.entries(definition.propsSchema)` e renderiza campo por tipo
- `onChange(key, value)` → chama `props.onChange({ ...props, [key]: value })`
- No VisualBuilder: `store.updateProps(blockId, newProps)` → cria snapshot no history → isDirty=true
- **Undo/Redo já existe**: Ctrl+Z/Y funcional via history stack

---

## 2. Lista Real de Todos os Blocos (55 tipos registrados)

### EXCLUÍDOS do preenchimento por IA (34 blocos)

| Tipo | Motivo |
|------|--------|
| Page | Layout/sistema, sem texto preenchível |
| Section | Layout puro |
| Container | Layout puro |
| Columns | Layout puro |
| Divider | Layout visual |
| Spacer | Layout visual |
| Header | Sistema (PropsEditor redireciona) |
| Footer | Sistema (PropsEditor redireciona) |
| PageContent | Renderiza conteúdo da página, sem props |
| Image | Apenas mídia |
| VideoUpload | Apenas mídia |
| CategoryList | E-commerce — dados reais |
| ProductGrid | E-commerce — dados reais |
| CategoryPageLayout | Sistema, sem propsSchema |
| ProductCarousel | E-commerce — dados reais |
| FeaturedProducts | E-commerce — dados reais |
| ProductCard | E-commerce — dados reais |
| ProductDetails | Sistema, sem propsSchema |
| CartSummary | Sistema, sem propsSchema |
| CheckoutSteps | Sistema, sem propsSchema |
| CollectionSection | E-commerce — dados reais |
| CategoryBanner | Sistema, sem propsSchema |
| BannerProducts | Híbrido — depende de produtos/categorias reais |
| FeaturedCategories | E-commerce — dados reais |
| Cart | Sistema |
| Checkout | Sistema |
| ThankYou | Sistema |
| AccountHub | Sistema |
| OrdersList | Sistema |
| OrderDetail | Sistema |
| TrackingLookup | Sistema |
| BlogListing | Sistema |
| CompreJuntoSlot | Sistema |
| CrossSellSlot | Sistema |
| UpsellSlot | Sistema |
| CustomBlock | HTML/CSS raw |
| HTMLSection | HTML/CSS raw |
| VideoCarousel | Mídia (título sim, vídeos não — tratado abaixo) |
| ImageCarousel | Mídia (título sim, imagens não — tratado abaixo) |
| ImageGallery | Mídia (título sim, imagens não — tratado abaixo) |
| LogosCarousel | Mídia + imagens |
| EmbedSocialPost | URL técnica |
| QuizEmbed | ID técnico |
| NewsletterPopup | Muito técnico (triggers, frequência, overlay) |
| PersonalizedProducts | Apenas título/subtítulo genéricos |
| LivePurchases | Apenas título, dados fake |

### ELEGÍVEIS para preenchimento por IA (21 blocos)

| # | blockType | Arquivo registro | Componente |
|---|-----------|-----------------|------------|
| 1 | Banner | registry.ts L616 | BannerBlock.tsx |
| 2 | RichText | registry.ts L795 | content/RichTextBlock.tsx |
| 3 | Button | registry.ts L1019 | content/ButtonBlock.tsx |
| 4 | FAQ | registry.ts L1162 | interactive/FAQBlock.tsx |
| 5 | Testimonials | registry.ts L1203 | interactive/TestimonialsBlock.tsx |
| 6 | FeatureList | registry.ts L1229 | FeatureListBlock.tsx |
| 7 | ContentColumns | registry.ts L1298 | ContentColumnsBlock.tsx |
| 8 | InfoHighlights | registry.ts L1849 | InfoHighlightsBlock.tsx |
| 9 | TextBanners | registry.ts L2244 | TextBannersBlock.tsx |
| 10 | StepsTimeline | registry.ts L2494 | StepsTimelineBlock.tsx |
| 11 | CountdownTimer | registry.ts L2524 | CountdownTimerBlock.tsx |
| 12 | StatsNumbers | registry.ts L2586 | StatsNumbersBlock.tsx |
| 13 | AccordionBlock | registry.ts L2646 | AccordionBlock.tsx |
| 14 | Reviews | registry.ts L2165 | ReviewsBlock.tsx |
| 15 | Newsletter | registry.ts L2746 | (inline) |
| 16 | ContactForm | registry.ts L2793 | (inline) |
| 17 | Map | registry.ts L2858 | (inline) |
| 18 | SocialFeed | registry.ts L2931 | (inline) |
| 19 | PricingTable | registry.ts L3077 | (inline) |
| 20 | PopupModal | registry.ts L3106 | (inline) |
| 21 | NewsletterForm | registry.ts L3172 | (inline) |

---

## 3. Tabela de Props Preenchíveis por Bloco

### Legenda
- ✅ = preenchível por IA
- ❌ = NUNCA preencher por IA

### Banner
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | 3-8 palavras | "Coleção Verão 2025" |
| subtitle | string | ✅ | 1 frase | "Até 50% off em peças selecionadas" |
| buttonText | string | ✅ | 2-4 palavras CTA | "Ver Coleção" |
| buttonUrl | string | ❌ | URL real | — |
| linkUrl | string | ❌ | URL real | — |
| imageDesktop/Mobile | image | ❌ | Mídia | — |
| mode/height/alignment/cores | * | ❌ | Estilo | — |
| slides | array | ❌ | Contém imagens | — |

### RichText
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| content | richtext | ✅ | HTML sanitizado (p,strong,ul,li,h2,h3) | `<h2>Sobre Nós</h2><p>Texto...</p>` |
| fontFamily/fontSize/fontWeight | select | ❌ | Estilo | — |

### Button
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| text | string | ✅ | 2-5 palavras CTA | "Comprar Agora" |
| url | string | ❌ | URL real | — |
| variant/size/cores/fonts | * | ❌ | Estilo | — |

### FAQ
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | Título da seção | "Perguntas Frequentes" |
| items | array | ✅ | 3-6 itens, cada { question: s, answer: s } | — |
| titleAlign/allowMultiple | * | ❌ | Config visual | — |

### Testimonials
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | Título | "O que dizem nossos clientes" |
| items | array | ✅ | 3-5 itens { name, content, rating:4-5, role? } | — |
| items[].image | string | ❌ | Avatar | — |

### FeatureList
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Por que escolher a gente" |
| subtitle | string | ✅ | | |
| items | array | ✅ | 3-5 itens { icon, text } | icon="Check" |
| buttonText | string | ✅ | CTA | "Saiba mais" |
| buttonUrl | string | ❌ | URL | — |
| cores | * | ❌ | Estilo | — |

### ContentColumns
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Nossa História" |
| subtitle | string | ✅ | | |
| content | richtext | ✅ | HTML simples | `<p>Desde 2010...</p>` |
| features | array | ✅ | 0-4 itens { icon, text } | — |
| buttonText | string | ✅ | CTA | "Conheça" |
| buttonUrl | string | ❌ | URL | — |
| imagens/cores/layout | * | ❌ | Visual | — |

### InfoHighlights
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| items | array | ✅ | 3-4 itens { icon, title, description? } | icon="Truck" |
| layout/cores | * | ❌ | Visual | — |

### TextBanners
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Conheça nossa marca" |
| text | textarea | ✅ | 2-4 frases | |
| ctaText | string | ✅ | CTA | "Saiba mais" |
| ctaUrl | string | ❌ | URL | — |
| imagens/cores/layout | * | ❌ | Visual | — |

### StepsTimeline
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Como Funciona" |
| subtitle | string | ✅ | | |
| steps | array | ✅ | 3-5 itens { number, title, description } | — |
| layout/cores/showNumbers | * | ❌ | Visual | — |

### CountdownTimer
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Oferta por tempo limitado" |
| subtitle | string | ✅ | | |
| expiredMessage | string | ✅ | | "Oferta encerrada" |
| buttonText | string | ✅ | CTA | "Aproveitar agora" |
| buttonUrl/endDate | * | ❌ | URL / Data real | — |
| cores/show* | * | ❌ | Visual | — |

### StatsNumbers
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Nossos Números" |
| subtitle | string | ✅ | | |
| items | array | ✅ | 3-4 itens { number: string, label: string } | "10k+", "Clientes" |
| layout/cores/animate | * | ❌ | Visual | — |

### AccordionBlock
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Mais Informações" |
| subtitle | string | ✅ | | |
| items | array | ✅ | 2-5 itens { title, content } | — |
| variant/cores/config | * | ❌ | Visual | — |

### Reviews
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Avaliações dos Clientes" |
| reviews | array | ✅ | 3-5 itens { name, rating:4-5, text } | — |
| reviews[].productName/Url/Image | * | ❌ | Dados reais | — |
| visibleCount | number | ❌ | Config | — |

### Newsletter
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Receba nossas novidades" |
| subtitle | string | ✅ | | |
| buttonText | string | ✅ | CTA | "Inscrever-se" |
| placeholder | string | ✅ | | "Digite seu e-mail" |
| successMessage | string | ✅ | | "Inscrição confirmada!" |
| incentiveText | string | ✅ | | "🎁 Ganhe 10% OFF!" |
| layout/show*/cores | * | ❌ | Visual | — |

### ContactForm
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Entre em Contato" |
| subtitle | string | ✅ | | |
| nameLabel | string | ✅ | Label | "Seu nome" |
| emailLabel | string | ✅ | Label | "Seu e-mail" |
| phoneLabel | string | ✅ | Label | "Telefone" |
| subjectLabel | string | ✅ | Label | "Assunto" |
| messageLabel | string | ✅ | Label | "Sua mensagem" |
| buttonText | string | ✅ | CTA | "Enviar" |
| successMessage | string | ✅ | | "Mensagem enviada!" |
| contactEmail/Phone/Address/Hours | string | ❌ | Dados reais | — |
| layout/show*/cores | * | ❌ | Visual | — |

### Map
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Onde Estamos" |
| subtitle | string | ✅ | | |
| directionsButtonText | string | ✅ | | "Como Chegar" |
| contactTitle | string | ✅ | | "Nosso Endereço" |
| address/embedUrl/lat/lng | * | ❌ | Dados reais | — |
| contactAddress/Phone/Email/Hours | * | ❌ | Dados reais | — |
| layout/zoom/show*/cores | * | ❌ | Visual | — |

### SocialFeed
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Siga-nos no Instagram" |
| subtitle | string | ✅ | | |
| followButtonText | string | ✅ | CTA | "Seguir" |
| profileUsername/profileUrl | * | ❌ | Username real | — |
| layout/show*/cores | * | ❌ | Visual | — |

### PricingTable
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Escolha o Plano Ideal" |
| subtitle | string | ✅ | | |
| layout/toggle/discount | * | ❌ | Config | — |

### PopupModal
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Oferta Exclusiva!" |
| subtitle | string | ✅ | | |
| buttonText | string | ✅ | CTA | "Quero meu desconto!" |
| discountCode | string | ❌ | Código real | — |
| type/layout/show* | * | ❌ | Config | — |

### NewsletterForm
| Prop | Tipo | IA? | Restrição | Exemplo |
|------|------|-----|-----------|---------|
| title | string | ✅ | | "Receba nossas novidades" |
| subtitle | string | ✅ | | |
| buttonText | string | ✅ | CTA | "Cadastrar" |
| successMessage | string | ✅ | | "Cadastro realizado!" |
| listId | string | ❌ | ID técnico | — |
| show*/layout/cores | * | ❌ | Visual | — |

---

## 4. Campos PROIBIDOS para IA (regra global)

| Categoria | Exemplos | Motivo |
|-----------|----------|--------|
| URLs reais | buttonUrl, ctaUrl, linkUrl, profileUrl | Link real |
| Imagens | imageDesktop, imageMobile, image, avatar | Upload |
| Cores/Estilo | backgroundColor, textColor, *Color | Design |
| Layout/Config | layout, alignment, variant, size, columns | Visual |
| Toggles | show*, sticky, autoplay, grayscale | Config |
| IDs técnicos | listId, quizId, productId, categoryId | Dados |
| Dados reais | contactEmail/Phone/Address/Hours, address, embedUrl | Lojista |
| Códigos | discountCode | Negócio |
| Usernames | profileUsername | Conta |
| Arrays de mídia | slides, videos, images, logos, posts | Mídia |
| Datas | endDate | Data real |
| Config numérica | visibleCount, zoom, limit, annualDiscount | Técnico |

---

## 5. RichText — Contrato Exato

### Formato aceito
- **HTML string simples** — NÃO é JSON estruturado
- Tags permitidas: `<p>`, `<h1>`-`<h4>`, `<strong>`, `<b>`, `<em>`, `<i>`, `<u>`, `<a>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<br>`, `<span>`, `<div>`
- **Proibido**: `<style>`, `<script>`, `<link>`, atributos `on*=`

### Sanitização existente
- `TextBlock.tsx` L16-24: sanitizeContent()
- `_shared/block-compiler/blocks/rich-text.ts` L8-15: sanitizeContent() server-side
- `sanitizeAILandingPageHtml.ts`: sanitização adicional para HTML de IA

### Recomendação
A IA deve retornar HTML bruto. O builder já sanitiza na renderização.

---

## 6. Regras de Merge (regra final)

| Situação | Comportamento |
|----------|--------------|
| Prop vazia/default | Preencher silenciosamente |
| Prop com conteúdo editado | Confirmar "Substituir conteúdo existente?" |
| Props de estilo/visual | NUNCA tocar |
| Array vazio | Gerar min-max itens novos |
| Array com itens | Perguntar: "Substituir X itens?" |
| Campos não-fillable dentro de item (image, productUrl) | Preservar |

**O undo/redo cobre qualquer preenchimento** — `updateProps()` cria snapshot.

---

## 7. Contrato Técnico do `aiFillable`

### Extensão do tipo em `src/lib/builder/types.ts`

```typescript
// Adicionar ao BlockPropsSchema[key]:
aiFillable?: boolean | {
  hint: string;           // instrução para o LLM
  format?: 'text' | 'html' | 'cta' | 'label' | 'feedback';
  minItems?: number;      // para arrays
  maxItems?: number;      // para arrays
  itemSchema?: Record<string, {
    hint: string;
    fillable: boolean;    // nem todo campo do item é preenchível
  }>;
};
```

### Representação por tipo de campo:
- **String simples**: `aiFillable: { hint: "...", format: 'text' }`
- **RichText HTML**: `aiFillable: { hint: "...", format: 'html' }`
- **CTA (botão)**: `aiFillable: { hint: "...", format: 'cta' }`
- **Label de form**: `aiFillable: { hint: "...", format: 'label' }`
- **Mensagem de feedback**: `aiFillable: { hint: "...", format: 'feedback' }`
- **Array**: `aiFillable: { minItems: 3, maxItems: 6, itemSchema: { ... } }`
- **Flag "não sobrescrever"**: controlada no merge (não no schema)

---

## 8. Contexto Disponível para a IA

### Dados existentes sem criar nada novo:

| Dado | Fonte | Campos reais |
|------|-------|-------------|
| Nome da loja | tenants.name | string |
| Slug | tenants.slug | string |
| Logo | store_settings.logo_url | URL |
| Descrição | store_settings.store_description | string? |
| Contato | store_settings | contact_phone, contact_email |
| Social | store_settings | social_instagram, social_facebook |
| Cores | theme settings | primary, secondary, accent |
| Categorias | categories (top N) | name, slug |

### Contexto mínimo recomendado (Fase 2):
```typescript
interface AIFillContext {
  storeName: string;
  storeDescription?: string;
  pageTitle?: string;
  blockType: string;
  existingProps: Record<string, unknown>;
}
```

### NÃO disponível (e NÃO necessário para Fase 2):
- Segmento/nicho, tom de voz, brand rules, público-alvo, contexto de blocos vizinhos

---

## 9. Infra de IA Existente

| Item | Status | Detalhes |
|------|--------|---------|
| Lovable AI Gateway | ✅ Configurado | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| LOVABLE_API_KEY | ✅ Auto-provisionado | Secret disponível |
| Tool calling | ✅ Usado | `ai-page-architect` usa tool calling para structured output |
| CORS headers | ✅ Padrão consolidado | Copiar de qualquer edge function |
| Toast/loading | ✅ sonner | Padrão em todo o projeto |
| Rate limiting | ✅ 429/402 tratados | Padrão em várias functions |
| Modelo | ✅ `google/gemini-3-flash-preview` | Rápido, barato, bom para text generation |
| Edge function para fill | ❌ Não existe | Criar na Fase 2.2 |
| Hook useAIBlockFill | ❌ Não existe | Criar na Fase 2.3 |

**Justificativa do modelo:** Gemini 3 Flash Preview é o padrão do projeto para tarefas rápidas. Para preenchimento de texto curto (títulos, frases, FAQ), é mais que suficiente. Gemini Pro seria overkill e mais caro.

---

## 10. Fase 2.1 — Plano Detalhado

### Objetivo
Adicionar metadata `aiFillable` na definição nativa dos 21 blocos elegíveis.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/builder/types.ts` | Adicionar `aiFillable` ao tipo `BlockPropsSchema` |
| `src/lib/builder/registry.ts` | Adicionar `aiFillable` nas props dos 21 blocos (~80 props) |

### Arquivos NÃO alterados
- PropsEditor.tsx
- Edge functions
- Hooks
- Componentes visuais

### Riscos de regressão
1. **Tipo `BlockPropsSchema`** — campo opcional, não quebra nada
2. **Registry.ts** — alteração pontual em props (não na lógica)
3. **`aiFillable` é opcional** — blocos sem a prop funcionam normalmente

### Como testar
1. `npm run build` sem erros
2. PropsEditor renderiza normalmente
3. `blockRegistry.get('FAQ')?.propsSchema.items.aiFillable` retorna objeto
4. `blockRegistry.get('ProductGrid')?.propsSchema.title.aiFillable` retorna undefined

### Critérios de aceite
- [ ] `BlockPropsSchema` tem tipo `aiFillable` opcional
- [ ] 21 blocos elegíveis têm `aiFillable` nas props corretas
- [ ] 34 blocos excluídos NÃO têm `aiFillable`
- [ ] Build compila sem erro
- [ ] PropsEditor continua funcional

---

## 11. Arquivos Impactados — Fase 2.1

```
src/lib/builder/types.ts          → ADD aiFillable to BlockPropsSchema type
src/lib/builder/registry.ts       → ADD aiFillable metadata to 21 blocks (~80 props)
```

## 12. Checklist de Testes

- [ ] `npm run build` sem erros
- [ ] Abrir builder → selecionar bloco → PropsEditor renderiza
- [ ] Console: `blockRegistry.get('FAQ')?.propsSchema.items.aiFillable` → objeto
- [ ] Console: `blockRegistry.get('ProductGrid')?.propsSchema.title.aiFillable` → undefined
- [ ] Nenhum campo visual/estilo/URL tem aiFillable

## 13. Recomendação Final

✅ **PODE IMPLEMENTAR a Fase 2.1**

A alteração é:
- **Aditiva** (campo opcional novo em tipo existente)
- **Sem impacto runtime** (nenhuma lógica lê `aiFillable` ainda)
- **Reversível** (remover o campo não quebra nada)
- **Testável** (build + inspeção visual + console check)

A Fase 2.2 (edge function) e 2.3 (botão no PropsEditor) só devem ser implementadas APÓS validação da 2.1.
