# Página de Produto — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core + Seções + Variantes + Galeria Mobile implementados  
> **Última atualização:** 2026-03-07  
> **Arquitetura:** v8.1.3 — block-compiler com variantes, swipe mobile, thumbnail click, quick buy

## Visão Geral

Página de detalhes do produto com galeria, variantes, avaliações e ofertas.

---

## Rota

`/loja/:slug/produto/:productSlug`

---

## Arquitetura de Renderização (v8.1.0)

### Fluxo Público (Edge Function `storefront-html`)

```
1. Resolve tenant pelo hostname
2. Busca published_content do storefront
3. Se published_content.product existe:
   → compileBlockTree(published_content.product, context)
4. Se NÃO existe:
   → Fallback: árvore de blocos padrão (Section > ProductDetails)
5. Dados injetados no CompilerContext:
   - currentProduct (dados do produto)
   - currentProductImages (imagens ordenadas)
   - productSettings (settings do tema)
   - storeSettings (WhatsApp, telefone, etc.)
```

### Compiladores de Bloco Usados

| Bloco | Compilador | Arquivo |
|-------|-----------|---------|
| `ProductDetails` | `productDetailsToStaticHTML` | `_shared/block-compiler/blocks/product-details.ts` |

### Arquivo Legado (DEAD CODE)

> ⚠️ `_shared/block-compiler/blocks/product-page.ts` (`productPageToStaticHTML`) é código morto — não é importado por nenhum arquivo. Pode ser removido.

---

## Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │                            │  │  BADGES (Frete Grátis, -X% OFF)   │ │
│  │      GALERIA DE IMAGENS    │  │  NOME DO PRODUTO                   │ │
│  │                            │  │  Marca                              │ │
│  │   [Img principal]          │  │  R$ 199,90  ~~R$ 249,90~~ -20%    │ │
│  │                            │  │  em até 12x de R$ 16,66            │ │
│  │   [thumb] [thumb] [thumb]  │  │  Descrição curta                   │ │
│  │                            │  │  Estoque (últimas N / em estoque)  │ │
│  └────────────────────────────┘  │                                    │ │
│                                  │  [🛒 ADICIONAR AO CARRINHO]        │ │
│                                  │  [💬 COMPRAR PELO WHATSAPP]        │ │
│                                  │                                    │ │
│                                  │  📦 Calcular Frete: [CEP] [OK]     │ │
│                                  │  [Imagens de destaque adicional]   │ │
│                                  └────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  DESCRIÇÃO (HTML do produto)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

### React (Builder / SPA)

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontProduct` | `src/pages/storefront/StorefrontProduct.tsx` | Página container |
| `ProductDetailsBlock` | `src/components/builder/blocks/ProductDetailsBlock.tsx` | Layout principal |
| `ProductPageSections` | `src/components/storefront/ProductPageSections.tsx` | Seções abaixo (Descrição, Reviews, Relacionados) |
| `RelatedProductsSection` | `src/components/storefront/sections/RelatedProductsSection.tsx` | Produtos relacionados |
| `ProductGallery` | `src/components/storefront/product/ProductGallery.tsx` | Galeria de imagens |
| `ProductVariantSelector` | `src/components/storefront/product/ProductVariantSelector.tsx` | Seletor de variantes |
| `ProductReviews` | `src/components/storefront/product/ProductReviews.tsx` | Seção de avaliações |
| `BuyTogetherSection` | `src/components/storefront/product/BuyTogetherSection.tsx` | Compre junto |
| `ShippingCalculator` | `src/components/storefront/ShippingCalculator.tsx` | Cálculo de frete |

### Compiladores (Edge Function)

| Compilador | Arquivo | Mirror de |
|-----------|---------|-----------|
| `productDetailsToStaticHTML` | `_shared/block-compiler/blocks/product-details.ts` | `ProductDetailsBlock.tsx` |

---

## Settings (Builder — productSettings)

| Setting | Tipo | Default | Descrição | No Compilador? |
|---------|------|---------|-----------|----------------|
| `showGallery` | boolean | true | Exibe galeria | ✅ |
| `showDescription` | boolean | true | Exibe descrição | ✅ |
| `showVariants` | boolean | true | Exibe variantes | ⚠️ Respeitado mas sem renderização de variantes |
| `showStock` | boolean | true | Exibe estoque | ✅ |
| `showReviews` | boolean | true | Exibe avaliações | ⚠️ Respeitado mas sem renderização de reviews |
| `showBuyTogether` | boolean | true | Exibe compre junto | ⚠️ Respeitado mas sem renderização |
| `showRelatedProducts` | boolean | true | Exibe relacionados | ⚠️ Respeitado mas sem renderização |
| `relatedProductsTitle` | string | "Produtos Relacionados" | Título customizável | ⚠️ Lido mas não usado |
| `showWhatsAppButton` | boolean | true | Botão WhatsApp | ✅ |
| `showAddToCartButton` | boolean | true | Botão carrinho | ✅ |
| `showBadges` | boolean | true | Selos do produto | ✅ |
| `showShippingCalculator` | boolean | true | Calculadora frete | ✅ (placeholder HTML) |
| `buyNowButtonText` | string | "Comprar agora" | Texto do CTA | ⚠️ Não usado (compilador não tem botão buy now separado) |
| `showAdditionalHighlight` | boolean | false | Imagens de destaque | ✅ |
| `additionalHighlightImagesDesktop` | array | [] | Imagens desktop | ✅ |
| `additionalHighlightImagesMobile` | array | [] | Imagens mobile | ✅ |

---

## Galeria de Imagens

| Comportamento | React | Compilador |
|---------------|-------|-----------|
| Layout desktop | Imagem grande + thumbnails | Imagem grande + thumbnails ✅ |
| Thumbnail click | ✅ Troca imagem principal | ✅ Via hydration JS |
| Layout mobile | Carousel swipe | ✅ Swipe carousel com dots |
| Zoom | Hover/Pinch zoom | ❌ Não suportado |
| Lightbox | Click abre fullscreen | ❌ Não suportado |

---

## Variantes

| Aspecto | React | Compilador |
|---------|-------|-----------|
| Swatches de cor | ✅ | ✅ Botões com seleção via hydration JS |
| Botões de tamanho | ✅ | ✅ Botões com seleção via hydration JS |
| Atualização de preço | ✅ | ✅ Via hydration JS (atualiza preço, estoque, imagem) |
| CTA bloqueado até seleção | ✅ | ✅ Botões desabilitados até variante selecionada |
| Variant ID no carrinho | ✅ | ✅ `data-variant-id` passado ao addToCart |

> **Nota:** Variantes são renderizadas como HTML estático (botões) e hidratadas via vanilla JS para interatividade completa.

---

## Compre Junto (Buy Together)

| Aspecto | React | Compilador |
|---------|-------|-----------|
| Renderização | ✅ `BuyTogetherSection` | ✅ Renderizado com preço combo e desconto |
| Adicionar ambos | ✅ | ✅ Via `data-sf-action="add-to-cart"` com `data-extra-product-*` |

---

## Avaliações

| Aspecto | React | Compilador |
|---------|-------|-----------|
| Rating resumo (topo) | ✅ Estrelas + contagem | ✅ Estrelas + contagem |
| Distribuição por nota | ✅ Barras de progresso | ✅ Barras de progresso |
| Lista de reviews | ✅ `ProductReviewsSection` | ✅ Até 10 reviews com estrelas, autor, data, mídia |
| Compra verificada | ✅ Badge verde | ✅ Badge verde |
| Formulário | ✅ | ❌ N/A (HTML estático, requer SPA) |
| Lightbox de mídia | ✅ Dialog | ❌ N/A |

---

## Produtos Relacionados

| Aspecto | React | Compilador |
|---------|-------|-----------|
| Grid responsivo | ✅ Embla Carousel | ✅ Grid 2→4 colunas |
| Herda categorySettings | ✅ | ⚠️ Parcial (badges/rating inline) |
| Título customizável | ✅ | ✅ `relatedProductsTitle` |

---

## SEO

| Meta | Fonte | Compilador |
|------|-------|-----------|
| `<title>` | `product.seo_title` ou `product.name \| storeName` | ✅ |
| `description` | `product.seo_description` ou `product.short_description` | ✅ |
| OG Image | Primeira imagem do produto | ✅ |
| Schema | Product JSON-LD (name, image, sku, brand, offers) | ✅ |
| Preload LCP | `<link rel="preload">` da imagem principal | ✅ |

---

## Cálculo de Frete

| Aspecto | React | Compilador |
|---------|-------|-----------|
| Input de CEP | ✅ | ✅ (placeholder HTML com `data-sf-shipping-cep`) |
| Chamada API | ✅ Via hook | ⚠️ Precisa de JS client-side para funcionar |
| Resultados | ✅ Lista de opções | ⚠️ `data-sf-shipping-results` placeholder |

---

## WhatsApp

| Aspecto | React | Compilador |
|---------|-------|-----------|
| Botão | ✅ | ✅ |
| Número | `storeSettings.social_whatsapp` ou `contact_phone` | ✅ |
| Mensagem | Template com nome do produto | ✅ |

---

## Dados no CompilerContext

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `currentProduct` | object | Todos os campos do produto (name, price, sku, brand, stock, etc.) |
| `currentProductImages` | array | Imagens ordenadas por `sort_order` com `is_primary` |
| `productSettings` | object | Settings extraídos de `themeSettings.pageSettings.product` |
| `storeSettings` | object | `social_whatsapp`, `contact_phone`, etc. |

---

## Pendências / Divergências Conhecidas

### Funcionalidades Ausentes no Compilador

- [ ] **Variantes**: Sem renderização de seletores (cor, tamanho, custom) — esperado para HTML estático
- [x] ~~**Avaliações**: Seção de reviews não renderizada~~ → Implementado v8.1.1
- [x] ~~**Compre Junto**: Seção não renderizada~~ → Implementado v8.1.1
- [x] ~~**Produtos Relacionados**: Carousel não renderizado~~ → Grid responsivo v8.1.1
- [x] ~~**Breadcrumb**: React tem — compilador não tem~~ → Implementado v8.1.0
- [ ] **Galeria mobile**: Sem swipe/carousel — apenas imagem estática
- [ ] **Zoom**: Sem hover/pinch zoom
- [ ] **Lightbox**: Sem fullscreen
- [x] ~~**Botão "Comprar agora"**: Compilador não tem CTA separado~~ → Implementado v8.1.0
- [x] ~~**Quantidade**: React tem seletor de quantidade~~ → Implementado v8.1.0
- [x] ~~**Frete**: Placeholder HTML sem JS funcional~~ → Implementado v8.1.0

### Divergências de Estilo

- [ ] **Banner fallback no compilador**: Não usa `image_url` como fallback (React usa)

### Dead Code

- [ ] `_shared/block-compiler/blocks/product-page.ts` — remover
- [ ] `_shared/block-compiler/blocks/category-page.ts` — remover
