# Página de Produto — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core implementado

## Visão Geral

Página de detalhes do produto com galeria, variantes, avaliações e ofertas.

---

## Rota

`/loja/:slug/produto/:productSlug`

---

## Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  BREADCRUMB: Home > Categoria > Produto                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │                            │  │  NOME DO PRODUTO                   │ │
│  │      GALERIA DE IMAGENS    │  │  ★★★★☆ (123 avaliações)            │ │
│  │                            │  │                                    │ │
│  │   [Img principal]          │  │  R$ 199,90  ou 12x de R$ 16,66    │ │
│  │                            │  │  ▼ Preço original: R$ 249,90       │ │
│  │   [thumb] [thumb] [thumb]  │  │                                    │ │
│  │                            │  │  [Seletor de Variantes]            │ │
│  └────────────────────────────┘  │                                    │ │
│                                  │  [Quantidade: - 1 +]               │ │
│                                  │                                    │ │
│                                  │  [🛒 ADICIONAR AO CARRINHO]        │ │
│                                  │  [💬 COMPRAR PELO WHATSAPP]        │ │
│                                  │                                    │ │
│                                  │  📦 Calcular Frete: [CEP] [OK]     │ │
│                                  └────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  COMPRE JUNTO (Buy Together)                                            │
│  [Produto A] + [Produto B] = R$ 299,90 (Economize R$ 50)               │
├─────────────────────────────────────────────────────────────────────────┤
│  DESCRIÇÃO                                                               │
│  [Conteúdo HTML/Markdown do produto]                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  AVALIAÇÕES                                                              │
│  [Lista de reviews] [Formulário para avaliar]                           │
├─────────────────────────────────────────────────────────────────────────┤
│  PRODUTOS RELACIONADOS (Slider horizontal / Embla Carousel)             │
│  [Carousel de produtos relacionados - 2 cols mobile, 4 cols desktop]    │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontProduct` | `src/pages/storefront/StorefrontProduct.tsx` | Página container |
| `ProductDetailsBlock` | `src/components/builder/blocks/ProductDetailsBlock.tsx` | Layout principal |
| `ProductGallery` | `src/components/storefront/product/ProductGallery.tsx` | Galeria de imagens |
| `ProductVariantSelector` | `src/components/storefront/product/ProductVariantSelector.tsx` | Seletor de variantes |
| `ProductReviews` | `src/components/storefront/product/ProductReviews.tsx` | Seção de avaliações |
| `BuyTogetherSection` | `src/components/storefront/product/BuyTogetherSection.tsx` | Compre junto |
| `ShippingCalculator` | `src/components/storefront/ShippingCalculator.tsx` | Cálculo de frete |

---

## Settings (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showGallery` | boolean | true | Exibe galeria |
| `showDescription` | boolean | true | Exibe descrição |
| `showVariants` | boolean | true | Exibe variantes |
| `showStock` | boolean | true | Exibe estoque |
| `showReviews` | boolean | true | Exibe avaliações |
| `showBuyTogether` | boolean | true | Exibe compre junto |
| `showRelatedProducts` | boolean | true | Exibe relacionados (slider horizontal com Embla Carousel) |
| `relatedProductsTitle` | string | "Produtos Relacionados" | Título customizável da seção |
| `showWhatsAppButton` | boolean | true | Botão WhatsApp |
| `showAddToCartButton` | boolean | true | Botão carrinho |
| `showBadges` | boolean | true | Selos do produto |
| `showShippingCalculator` | boolean | true | Calculadora frete |
| `buyNowButtonText` | string | "Comprar agora" | Texto do CTA |

---

## Hooks

| Hook | Função |
|------|--------|
| `usePublicProduct` | Busca produto por slug |
| `useProductReviews` | Avaliações do produto |
| `useBuyTogetherRules` | Regras de compre junto |
| `useCart` | Operações de carrinho |

---

## Galeria de Imagens

| Comportamento | Desktop | Mobile |
|---------------|---------|--------|
| Layout | Imagem grande + thumbnails | Carousel swipe |
| Zoom | Hover zoom | Pinch zoom |
| Lightbox | Click abre fullscreen | Tap abre fullscreen |

---

## Variantes

| Tipo | Exibição |
|------|----------|
| `color` | Swatches coloridos |
| `size` | Botões de tamanho |
| `custom` | Dropdown ou botões |

---

## Compre Junto (Buy Together)

| Regra | Descrição |
|-------|-----------|
| **Fonte** | Tabela `buy_together_rules` |
| **Filtro** | `trigger_product_id = produto atual` |
| **Desconto** | `percent` ou `fixed` |
| **Exibição** | Produto A + Produto B = Total com desconto |

---

## Avaliações

| Campo | Descrição |
|-------|-----------|
| `rating` | 1-5 estrelas |
| `title` | Título da avaliação |
| `content` | Texto da avaliação |
| `author_name` | Nome do autor |
| `is_verified` | Compra verificada |
| `is_approved` | Aprovado para exibição |

---

## SEO

| Meta | Fonte |
|------|-------|
| `<title>` | `product.seo_title` ou `product.name` |
| `description` | `product.seo_description` ou `product.short_description` |
| OG Image | Primeira imagem do produto |
| Schema | Product (JSON-LD) |

---

## Pendências

- [ ] Zoom avançado na galeria
- [ ] Vídeo na galeria
- [ ] Questions & Answers
- [ ] Notificar quando disponível
- [ ] Comparador de produtos
