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

### ✅ Prontos no Edge (38 compiladores + 3 standalone)
- **Layout**: Page, Section, Container, Columns, Column, Grid
- **Conteúdo**: Text, RichText, Image, Button, Spacer, Divider
- **E-commerce**: HeroBanner, Banner, ImageCarousel, InfoHighlights, FeaturedCategories, FeaturedProducts, CategoryBanner, CategoryPageLayout
- **Produto**: ProductDetails (Reviews, Compre Junto, Relacionados, Variantes, Galeria+Lightbox)
- **Interativo**: FAQ, Testimonials, AccordionBlock, Newsletter, NewsletterForm
- **Mídia**: YouTubeVideo, VideoCarousel, HTMLSection, ImageGallery
- **Marketing**: CountdownTimer, LogosCarousel, StatsNumbers, ContentColumns, FeatureList, StepsTimeline, TextBanners
- **Estrutural**: Header, Footer
- **Standalone**: Blog, Institucional

### 🔴 FALTA Compilador (8 blocos)

**E-commerce (5)**: ProductGrid, ProductCarousel, CategoryList, CollectionSection, BannerProducts

**Outros**: NewsletterPopup, Reviews (standalone), VideoUpload

---

## 🚀 PLANO DE EXECUÇÃO

### Fase 0: Bugs Críticos ✅ CONCLUÍDA
1. ✅ Corrigir botões add-to-cart
2. ✅ Corrigir banner de categoria (auto-injeção)
3. ✅ Verificar galeria de imagens (funcional)
4. ✅ Produtos relacionados herdar categorySettings
5. ✅ Verificar botões CTA (funcionais)

### Fase 1: Blocos de Layout ✅ CONCLUÍDA
6. ✅ Container
7. ✅ Columns + Column
8. ✅ Grid

### Fase 2: Blocos Interativos de Alta Conversão ✅ CONCLUÍDA
9. ✅ Newsletter / NewsletterForm (compilador com layouts horizontal/vertical/card)
10. ✅ FAQ (accordion nativo com `<details>/<summary>`)
11. ✅ Testimonials (grid responsivo com estrelas e imagens)
12. ✅ AccordionBlock (variantes default/separated/bordered, defaultOpen)

### Fase 3: Blocos de Mídia ✅ CONCLUÍDA
13. ✅ YouTubeVideo (iframe responsivo com aspect ratio configurável)
14. ✅ VideoCarousel (primeiro vídeo embed + thumbnail strip)
15. ✅ HTMLSection (HTML sanitizado inline com CSS scoped)
16. ✅ ImageGallery (grid responsivo com hover effects e captions)

### Fase 4: Blocos de Marketing ✅ CONCLUÍDA
17. ✅ CountdownTimer (server-render + JS hydration via data-sf-countdown)
18. ✅ LogosCarousel (grid responsivo com grayscale e otimização de imagem)
19. ✅ StatsNumbers (layout horizontal/grid com animação JS)
20. ✅ ContentColumns (imagem + texto + features com ícones SVG)
21. ✅ FeatureList (lista vertical com ícones SVG)
22. ✅ StepsTimeline (layout horizontal/vertical com círculos numerados)
23. ✅ TextBanners (texto + 2 imagens com CTA sf-btn-primary)

### Fase 5: Blocos E-commerce Avançados ✅ CONCLUÍDA
24. ✅ ProductGrid (grid configurável com renderProductCard compartilhado)
25. ✅ ProductCarousel (scroll horizontal com snap + setas desktop)
26. ✅ CategoryList (grid/lista com source custom/auto)
27. ✅ CollectionSection (título + "Ver todos" + grid/carousel)
28. ✅ BannerProducts (banner + produtos lado a lado)
29. ✅ Shared: product-card-html.ts (renderProductCard reutilizável)

### Fase 6: Verificações Globais
20. Pixels de marketing no `<head>`
21. Newsletter Popup injection
22. Consent Banner injection

### Fase 7: Auditoria Visual + Centralização
23. Comparar builder vs público
24. Centralizar sistema de cores (design tokens únicos)
25. Centralizar lógica de frete grátis

---

## Cleanup Realizado
- ✅ Removido `_shared/block-compiler/blocks/product-page.ts` (dead code)
