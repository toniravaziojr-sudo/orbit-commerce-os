# Página de Categoria — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core implementado

## Visão Geral

Página de listagem de produtos filtrados por categoria.

---

## Rota

`/loja/:slug/categoria/:categorySlug`

---

## Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  BREADCRUMB: Home > Categoria                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     BANNER DA CATEGORIA                            │  │
│  │              (imagem desktop / imagem mobile)                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  NOME DA CATEGORIA                                                       │
│  Descrição opcional da categoria                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐                                                        │
│  │  FILTROS    │  ┌─────────────────────────────────────────────────┐  │
│  │  (sidebar)  │  │  [Ordenar: Relevância ▼]  [X produtos]          │  │
│  │             │  ├─────────────────────────────────────────────────┤  │
│  │ □ Subcat 1  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │  │
│  │ □ Subcat 2  │  │  │ Pro │ │ Pro │ │ Pro │ │ Pro │              │  │
│  │             │  │  │ 1   │ │ 2   │ │ 3   │ │ 4   │              │  │
│  │ Preço       │  │  └─────┘ └─────┘ └─────┘ └─────┘              │  │
│  │ R$ [__-__]  │  │                                                 │  │
│  │             │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │  │
│  │ Tamanho     │  │  │ Pro │ │ Pro │ │ Pro │ │ Pro │              │  │
│  │ □ P □ M □ G │  │  │ 5   │ │ 6   │ │ 7   │ │ 8   │              │  │
│  │             │  │  └─────┘ └─────┘ └─────┘ └─────┘              │  │
│  └─────────────┘  │                                                 │  │
│                   │  [Carregar mais] ou [Paginação]                 │  │
│                   └─────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontCategory` | `src/pages/storefront/StorefrontCategory.tsx` | Página container |
| `CategoryPageLayout` | `src/components/builder/blocks/CategoryPageLayout.tsx` | Layout principal |
| `ProductGrid` | `src/components/storefront/ProductGrid.tsx` | Grid de produtos |
| `ProductCard` | `src/components/storefront/ProductCard.tsx` | Card individual |
| `CategoryFilters` | `src/components/storefront/CategoryFilters.tsx` | Sidebar de filtros |
| `CategoryBanner` | `src/components/storefront/CategoryBanner.tsx` | Banner topo |

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
| `customButtonEnabled` | boolean | false | Botão custom |
| `customButtonText` | string | "" | Texto do botão |
| `customButtonColor` | string | "" | Cor do texto (deprecated, usar customButtonTextColor) |
| `customButtonLink` | string | "" | Link do botão |
| `customButtonBgColor` | string | "" | Cor de fundo do botão |
| `customButtonTextColor` | string | "" | Cor do texto do botão |
| `customButtonHoverColor` | string | "" | Cor de fundo no hover |

---

## Hooks

| Hook | Função |
|------|--------|
| `usePublicCategory` | Busca categoria + produtos |
| `useCart` | Operações de carrinho |

---

## Banner da Categoria

| Campo | Fonte |
|-------|-------|
| Desktop | `category.banner_desktop_url` |
| Mobile | `category.banner_mobile_url` |
| Fallback | `category.image_url` |

### Overlay

| Prop | Default | Descrição |
|------|---------|-----------|
| `overlayOpacity` | `0` | Opacidade do overlay escuro (0-100). Default 0 = sem escurecimento |

> **Nota (2025-01-25):** Default alterado de 40 para 0 para evitar escurecimento automático dos banners.

---

## Ordenação

| Opção | Descrição |
|-------|-----------|
| `relevance` | Ordem padrão (sort_order) |
| `price_asc` | Menor preço |
| `price_desc` | Maior preço |
| `name_asc` | A-Z |
| `name_desc` | Z-A |
| `newest` | Mais recentes |
| `bestseller` | Mais vendidos |

---

## Filtros Disponíveis

| Filtro | Tipo |
|--------|------|
| Subcategorias | Checkbox |
| Faixa de preço | Range slider |
| Atributos (cor, tamanho) | Checkbox/Swatch |
| Disponibilidade | Toggle |
| Avaliação mínima | Stars |

---

## Product Card

| Elemento | Visibilidade |
|----------|--------------|
| Imagem | Sempre |
| Nome | Sempre |
| Preço | Sempre |
| Preço original | Se houver desconto |
| Estrelas | Se `showRatings=true` |
| Badges | Se `showBadges=true` |
| Botão carrinho | Se `showAddToCartButton=true` |

---

## Paginação

| Modo | Comportamento |
|------|---------------|
| `infinite` | Scroll infinito |
| `loadMore` | Botão "Carregar mais" |
| `pagination` | Paginação numérica |

---

## SEO

| Meta | Fonte |
|------|-------|
| `<title>` | `category.seo_title` ou `category.name` |
| `description` | `category.seo_description` ou `category.description` |
| OG Image | `category.image_url` |
| Schema | CollectionPage + ItemList (JSON-LD) |

---

## Responsividade

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Grid | 4 colunas | 2 colunas |
| Filtros | Sidebar fixa | Drawer/Modal |
| Banner | Full width | Aspect ajustado |

---

## Pendências

- [ ] Filtros dinâmicos por atributos
- [ ] Quick view modal
- [ ] Comparar produtos
- [ ] Salvar filtros na URL
- [ ] Skeleton loading avançado
