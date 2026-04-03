# Página de Produto — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core + Seções + Variantes + Galeria Mobile + Lightbox/Zoom + Pix Badge + Paridade CTA + Paridade Visual  
> **Última atualização:** 2026-03-10  
> **Arquitetura:** v8.3.0 — Paridade visual completa Builder↔Edge (badges, ordem, botões, cores)

> **Camada:** Layer 3 — Especificações / Storefront  
> **Migrado de:** `docs/regras/pagina-produto.md`  
> **Última atualização:** 2026-04-03


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

### Ordem dos elementos na coluna de informações (OBRIGATÓRIA)

A ordem dos elementos é idêntica no Builder (SPA) e no Público (Edge):

```
1. Badges (Frete Grátis — sem badge de desconto separado)
2. Estrelas de avaliação (rating)
3. Nome do produto (h1)
4. Marca (se existir)
5. Preço (com compare_at_price + badge -X% inline)
6. Badge Pix
7. Descrição curta
8. Estoque
9. Variantes
10. Quantidade
11. CTAs (Comprar Agora → Adicionar ao Carrinho → WhatsApp)
12. Calculadora de frete
13. Imagens de destaque adicional
```

### Diagrama

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │                            │  │  BADGES (Frete Grátis via SVG)     │ │
│  │      GALERIA DE IMAGENS    │  │  ★★★★★ (avaliações)               │ │
│  │                            │  │  NOME DO PRODUTO                   │ │
│  │   [Img principal]          │  │  Marca                              │ │
│  │                            │  │  R$ 199,90  ~~R$ 249,90~~ -20%    │ │
│  │   [thumb] [thumb] [thumb]  │  │  em até 12x de R$ 16,66            │ │
│  │                            │  │  Descrição curta                   │ │
│  └────────────────────────────┘  │  Estoque: N unidades               │ │
│                                  │                                    │ │
│                                  │  [COMPRAR AGORA]  (primary, pill)  │ │
│                                  │  [ADICIONAR AO CARRINHO] (outline) │ │
│                                  │  [COMPRAR PELO WHATSAPP] (outline) │ │
│                                  │                                    │ │
│                                  │  Calcular frete: [CEP] [OK]        │ │
│                                  │  [Imagens de destaque adicional]   │ │
│                                  └────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  DESCRIÇÃO (HTML do produto)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Regras de Paridade Visual (v8.3.0)

| Elemento | Regra | Builder | Edge |
|----------|-------|---------|------|
| **Badge Frete Grátis** | SVG icon Truck, texto "Frete Grátis" (caps), fundo verde claro | ✅ Lucide `<Truck>` | ✅ SVG inline |
| **Badge Desconto** | NÃO exibir como badge separado. Mostrar `-X%` inline no preço com cores `--theme-danger-bg/text` | ✅ | ✅ |
| **Emojis** | PROIBIDO em elementos de UI. Usar SVG/Lucide icons | ✅ | ✅ (corrigido v8.3.0) |
| **Botão Comprar Agora** | `.sf-btn-primary`, pill (`rounded-full`), `uppercase`, `letter-spacing` | ✅ | ✅ |
| **Botão Adicionar** | `.sf-btn-secondary border`, pill, outline, `uppercase`, `letter-spacing`. Cor respeita tema Secundário (Background, Text, Hover) | ✅ (corrigido v8.5.0) | ✅ (corrigido v8.5.0) |
| **Botão WhatsApp** | Outline verde, pill, `uppercase`, hover → solid verde escuro | ✅ | ✅ (corrigido v8.3.0) |
| **Desconto inline** | `--theme-danger-bg` (vermelho) + `--theme-danger-text` (branco) | ✅ | ✅ (corrigido v8.3.0) |

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
| Zoom | Hover/Pinch zoom | ✅ Lightbox com zoom +/- e pinch-to-zoom mobile |
| Lightbox | Click abre fullscreen | ✅ Overlay fullscreen com navegação e zoom |

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
| `currentProductVariants` | array | Variantes ativas com option1/2/3, preço, estoque, imagem |
| `productSettings` | object | Settings extraídos de `themeSettings.pageSettings.product` |
| `storeSettings` | object | `social_whatsapp`, `contact_phone`, etc. |

---

## Pendências / Divergências Conhecidas

### Funcionalidades Ausentes no Compilador

- [x] ~~**Variantes**: Sem renderização de seletores~~ → Implementado v8.1.3 (botões + hydration JS)
- [x] ~~**Avaliações**: Seção de reviews não renderizada~~ → Implementado v8.1.1
- [x] ~~**Compre Junto**: Seção não renderizada~~ → Implementado v8.1.1
- [x] ~~**Produtos Relacionados**: Carousel não renderizado~~ → Grid responsivo v8.1.1
- [x] ~~**Breadcrumb**: React tem — compilador não tem~~ → Implementado v8.1.0
- [x] ~~**Galeria mobile**: Sem swipe/carousel~~ → Implementado v8.1.3 (scroll-snap + dots)
- [x] ~~**Thumbnail click**: Sem troca de imagem~~ → Implementado v8.1.3
- [x] ~~**Zoom**: Sem hover/pinch zoom~~ → Implementado v8.1.4 (lightbox fullscreen + pinch-to-zoom + zoom buttons)
- [x] ~~**Lightbox**: Sem fullscreen~~ → Implementado v8.1.4 (overlay com navegação prev/next + teclado)
- [x] ~~**Botão "Comprar agora"**: Compilador não tem CTA separado~~ → Implementado v8.1.0
- [x] ~~**Quantidade**: React tem seletor de quantidade~~ → Implementado v8.1.0
- [x] ~~**Frete**: Placeholder HTML sem JS funcional~~ → Implementado v8.1.0

### Divergências de Estilo (Corrigidas v8.2.0)

- [x] ~~**Ordem dos botões**: Compilador tinha Add to Cart → Buy Now; SPA tem Buy Now → Add to Cart~~ → Corrigido v8.2.0
- [x] ~~**Pix Badge**: SPA tem PaymentBadges com destaque verde Pix; compilador tinha apenas texto de parcelas~~ → Corrigido v8.2.0
- [x] ~~**Estoque**: SPA mostra "Estoque: X unidades"; compilador mostrava "Em estoque"~~ → Corrigido v8.2.0
- [x] ~~**Layout CTAs**: Compilador tinha Buy Now full-width separado da quantidade; SPA tem [Qty + Buy Now] na mesma linha~~ → Corrigido v8.5.0
- [x] ~~**Font-size CTAs**: Compilador usava 16px; SPA usa 14px (text-sm)~~ → Corrigido v8.5.0
- [x] ~~**Alturas dos botões**: Compilador usava padding:14px (ambos); SPA usa h-10 (40px Buy Now) e h-12 (48px Add to Cart)~~ → Corrigido v8.5.0
- [ ] **Banner fallback no compilador**: Não usa `image_url` como fallback (React usa)

### Dead Code

- [ ] `_shared/block-compiler/blocks/product-page.ts` — remover

---

## Correções Aplicadas

### CEP Input — Remoção total de máscara (v8.6.2 — 2026-03-12) ✅ RESOLVIDO

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug (encerrada) |
| **Localização** | `supabase/functions/_shared/block-compiler/blocks/product-details.ts`, `supabase/functions/storefront-html/index.ts`, `src/components/storefront/product/ShippingCalculator.tsx` |
| **Contexto** | Calculadora de frete na página de produto (Edge-rendered + SPA) |
| **Problema original** | Campo de CEP inseria hífens extras ("--") no mobile e desktop, impedindo digitação completa do CEP. A causa raiz era: (1) a máscara visual `XXXXX-XXX` conflitava com o caret do navegador, e (2) as correções no React não chegavam ao runtime real porque a storefront pública usa HTML gerado por Edge Functions, não React. |
| **Solução final** | Máscara visual removida completamente. O campo aceita e exibe apenas 8 dígitos puros (sem hífen). Input nativo com `type="text"`, `inputMode="numeric"`, `maxLength="8"`. Script global de hardening (`beforeinput` + `paste`) injeta sanitização digits-only em todos os inputs `[data-sf-shipping-cep]`. |
| **Atributos do input** | `type="text"`, `inputmode="numeric"`, `maxlength="8"`, `autocomplete="new-password"`, `autocorrect="off"`, `spellcheck="false"` |
| **Camada de cache** | Após correção no código Edge, foi necessário: (1) re-prerender forçado de todas as páginas stale via `storefront-prerender`, (2) purge total do CDN Cloudflare via `cache-purge-internal`. Sem essas ações, a URL pública limpa continuava servindo o snapshot antigo com `maxlength="9"`. |
| **Validação** | URL pública `respeiteohomem.com.br/produto/*` retorna `maxlength="8"` sem bypass. Confirmado por print do cliente em 2026-03-12. |
| **Afeta** | Página de produto (Edge), mini-cart (SPA), carrinho (SPA), checkout (SPA) |
