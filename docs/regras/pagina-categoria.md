# Página de Categoria — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core + Filtros + Ordenação + Paginação  
> **Última atualização:** 2026-03-07  
> **Arquitetura:** v8.1.2 — block-compiler com filtros/sort/load-more client-side

## Visão Geral

Página de listagem de produtos filtrados por categoria.

---

## Rota

`/loja/:slug/categoria/:categorySlug`

---

## Arquitetura de Renderização (v8.1.0)

### Fluxo Público (Edge Function `storefront-html`)

```
1. Resolve tenant pelo hostname
2. Busca published_content do storefront
3. Se published_content.category existe:
   → compileBlockTree(published_content.category, context)
4. Se NÃO existe:
   → Fallback: árvore de blocos padrão (CategoryBanner + CategoryPageLayout)
5. Dados injetados no CompilerContext:
   - currentCategory (dados da categoria)
   - categoryProducts (produtos com imagens, ratings, etc.)
   - categorySettings (settings do tema)
```

### Compiladores de Bloco Usados

| Bloco | Compilador | Arquivo |
|-------|-----------|---------|
| `CategoryBanner` | `categoryBannerToStaticHTML` | `_shared/block-compiler/blocks/category-banner.ts` |
| `CategoryPageLayout` | `categoryPageLayoutToStaticHTML` | `_shared/block-compiler/blocks/category-page-layout.ts` |

### Arquivo Legado (DEAD CODE)

> ⚠️ `_shared/block-compiler/blocks/category-page.ts` (`categoryPageToStaticHTML`) é código morto — não é importado por nenhum arquivo. Mantido temporariamente. Pode ser removido.

---

## Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     BANNER DA CATEGORIA                            │  │
│  │              (imagem desktop / imagem mobile)                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  NOME DA CATEGORIA                                                       │
│  Descrição opcional da categoria                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  [X produtos]                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                                       │
│  │ Pro │ │ Pro │ │ Pro │ │ Pro │                                       │
│  │ 1   │ │ 2   │ │ 3   │ │ 4   │                                       │
│  └─────┘ └─────┘ └─────┘ └─────┘                                       │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                                       │
│  │ Pro │ │ Pro │ │ Pro │ │ Pro │                                       │
│  │ 5   │ │ 6   │ │ 7   │ │ 8   │                                       │
│  └─────┘ └─────┘ └─────┘ └─────┘                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

### React (Builder / SPA)

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontCategory` | `src/pages/storefront/StorefrontCategory.tsx` | Página container |
| `CategoryPageLayout` | `src/components/builder/blocks/CategoryPageLayout.tsx` | Layout principal com filtros + grid |
| `CategoryBannerBlock` | `src/components/builder/blocks/CategoryBannerBlock.tsx` | Banner topo |
| `ProductCard` | `src/components/builder/blocks/shared/ProductCard.tsx` | Card compartilhado |
| `CategoryFilters` | `src/components/builder/blocks/CategoryFilters.tsx` | Sidebar de filtros |

### Compiladores (Edge Function)

| Compilador | Arquivo | Mirror de |
|-----------|---------|-----------|
| `categoryBannerToStaticHTML` | `_shared/block-compiler/blocks/category-banner.ts` | `CategoryBannerBlock.tsx` |
| `categoryPageLayoutToStaticHTML` | `_shared/block-compiler/blocks/category-page-layout.ts` | `CategoryPageLayout.tsx` |

---

## Settings (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showRatings` | boolean | true | Estrelas nos cards |
| `showBadges` | boolean | true | Selos nos cards |
| `showAddToCartButton` | boolean | true | Botão carrinho |
| `quickBuyEnabled` | boolean | false | Compra rápida |
| `buyNowButtonText` | string | "Comprar agora" | Texto CTA |
| `showBanner` | boolean | true | Banner da categoria |
| `showCategoryName` | boolean | true | Nome da categoria |
| `bannerOverlayOpacity` | number | 0 | Opacidade overlay (0-100) |
| `customButtonEnabled` | boolean | false | Botão custom |
| `customButtonText` | string | "" | Texto do botão |
| `customButtonBgColor` | string | "" | Cor de fundo do botão |
| `customButtonTextColor` | string | "#ffffff" | Cor do texto do botão |
| `customButtonHoverColor` | string | "" | Cor de fundo no hover |
| `customButtonLink` | string | "" | Link do botão |

---

## Banner da Categoria

| Campo | Fonte |
|-------|-------|
| Desktop | `category.banner_desktop_url` |
| Mobile | `category.banner_mobile_url` |
| Fallback | `category.image_url` (apenas no React; compilador não usa fallback) |

### Overlay

| Prop | Origem | Default | Descrição |
|------|--------|---------|-----------|
| `bannerOverlayOpacity` | Theme settings | `0` | Opacidade do overlay escuro (0-100). Default 0 = sem escurecimento |

> **Nota:** O compilador usa `overlayOpacity` da prop do bloco, enquanto o React usa `bannerOverlayOpacity` do theme settings. Essa é uma **divergência de paridade** conhecida.

---

## Ordem dos Botões no Card

A ordem dos botões nos cards de produto é fixa e obrigatória:

1. **Adicionar ao carrinho** (se `showAddToCartButton = true`)
2. **Botão personalizado** (se `customButtonEnabled = true`)
3. **Comprar agora / CTA principal** (sempre visível)

> Compilador e React devem respeitar essa mesma ordem.

---

## Grid Responsivo

| Breakpoint | Colunas |
|-----------|---------|
| < 640px | 2 colunas |
| 640px+ | 3 colunas |
| 1024px+ | N colunas (prop `columns`, default 4) |

---

## SEO

| Meta | Fonte |
|------|-------|
| `<title>` | `category.seo_title` ou `category.name \| storeName` |
| `description` | `category.seo_description` ou `category.description` |
| OG Image | `category.banner_desktop_url` ou `category.image_url` |
| Schema | CollectionPage + numberOfItems (JSON-LD) |

---

## Dados no CompilerContext

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `currentCategory` | object | `{ id, name, slug, description, banner_desktop_url, banner_mobile_url, image_url, seo_title, seo_description }` |
| `categoryProducts` | array | Produtos com `product_images`, `avg_rating`, `review_count`, `free_shipping` |
| `categorySettings` | object | Settings extraídos de `themeSettings.pageSettings.category` |

---

## Pendências / Divergências Conhecidas

- [ ] **Filtros**: React tem sidebar com filtros dinâmicos (`CategoryFilters`) — compilador NÃO tem filtros
- [ ] **Paginação/Load More**: React suporta — compilador renderiza até 48 produtos fixo
- [ ] **Ordenação**: React tem seletor de ordenação — compilador não tem
- [ ] **Quick Buy**: React suporta compra rápida — compilador não tem
- [ ] **Mini Cart Drawer**: React integra com `MiniCartDrawer` — compilador usa drawer genérico do shell
- [ ] **Product Badge System**: React usa `useProductBadgesForProducts` com badges dinâmicos — compilador só tem "FRETE GRÁTIS" e desconto %
- [ ] **Banner overlay**: React usa `bannerOverlayOpacity` do theme settings; compilador usa `overlayOpacity` da prop
- [ ] **Banner fallback**: React faz fallback para `image_url`; compilador só usa `banner_desktop_url`
- [ ] **Hover effects**: React tem estados hover nos botões — compilador não tem
- [ ] `category-page.ts` é dead code — pode ser removido
