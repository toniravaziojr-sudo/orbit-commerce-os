# Página de Categoria — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core + Filtros + Ordenação + Paginação + Badges Dinâmicos  
> **Última atualização:** 2026-03-13  
> **Arquitetura:** v8.5.0 — Filtros sidebar (desktop) + Sheet (mobile) — paridade total Builder/Público
> **Regra de paridade:** Ver `docs/especificacoes/transversais/paridade-builder-publico.md`

> **Camada:** Layer 3 — Especificações / Storefront  
> **Migrado de:** `docs/regras/pagina-categoria.md`  
> **Última atualização:** 2026-04-03


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

### Regras de Renderização (v8.4.2)

| Regra | Descrição |
|-------|-----------|
| **URLs diretas (CRÍTICO)** | O compilador Edge usa URLs diretas do Supabase Storage (SEM proxy wsrv.nl). Motivo: wsrv.nl falha silenciosamente no browser por rate limits, referer checks ou CDN issues, causando banner cinza vazio. Essa regra é **não-negociável** e qualquer alteração que reintroduza wsrv.nl em banners é PROIBIDA. |
| **Altura automática** | O banner NÃO usa altura fixa. Usa `height:auto` com `width:100%` e `display:block` para respeitar a proporção original da imagem (paridade com o Builder React). |
| **Overlay (CRÍTICO — PARIDADE)** | Controlado EXCLUSIVAMENTE por `context.categorySettings.bannerOverlayOpacity` (0-100). Default 0 = sem escurecimento. O compilador NÃO deve ler `props.overlayOpacity` (legado). React e compilador devem usar a mesma fonte: `categorySettings.bannerOverlayOpacity`. Qualquer leitura de `props.overlayOpacity` no compilador é PROIBIDA — causa divergência entre builder e público. |
| **Builder** | Auto-seleciona a primeira categoria ativa quando `exampleCategoryId` está vazio (v8.4.2). |
| **Paridade Desktop-Mobile** | Banner aparece em AMBOS. Desktop usa `banner_desktop_url`, mobile usa `banner_mobile_url` via `<picture><source media>`. |
| **Cache de Prerender** | Ao corrigir o compilador do banner, é OBRIGATÓRIO invalidar o cache de prerender (set status='stale') e redeploiar a edge function. Sem isso, o HTML antigo continua sendo servido. |
| **Deploy da Edge Function** | Após editar `category-banner.ts`, é OBRIGATÓRIO fazer deploy explícito via `deploy_edge_functions(['storefront-html'])` e verificar que `X-Storefront-Version` reflete a nova versão. |
| **Sequência obrigatória (CRÍTICO)** | 1º) Editar código → 2º) Deploy da edge function → 3º) Invalidar cache (status='stale'). Se inverter a ordem (invalidar antes do deploy), o re-render usa o código ANTIGO e o bug persiste no HTML cacheado. |

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

- [x] ~~**Filtros**: React tem sidebar com filtros dinâmicos~~ → Implementado v8.1.2 (frete grátis, promoção, faixa de preço — client-side JS)
- [x] ~~**Paginação/Load More**: React suporta~~ → Implementado v8.1.2 (24 por página + "Carregar mais")
- [x] ~~**Ordenação**: React tem seletor de ordenação~~ → Implementado v8.1.2 (relevância, preço, nome, desconto)
- [ ] **Quick Buy**: React suporta compra rápida — compilador não tem
- [ ] **Mini Cart Drawer**: React integra com `MiniCartDrawer` — compilador usa drawer genérico do shell
- [ ] **Product Badge System**: React usa `useProductBadgesForProducts` com badges dinâmicos — compilador só tem "FRETE GRÁTIS" e desconto %
- [x] ~~**Banner overlay**: React usa `bannerOverlayOpacity` do theme settings; compilador usa `overlayOpacity` da prop~~ → Corrigido v8.4.2: compilador agora lê de `context.categorySettings.bannerOverlayOpacity` (paridade total)
- [ ] **Banner fallback**: React faz fallback para `image_url`; compilador só usa `banner_desktop_url`
- [ ] **Hover effects**: React tem estados hover nos botões — compilador não tem
- [ ] `category-page.ts` é dead code — pode ser removido

## Filtros, Ordenação e Paginação (v8.5.0)

### Layout Responsivo dos Filtros (React + Compilador — PARIDADE TOTAL)

| Viewport | Layout React | Layout Compilador | Classe/Breakpoint |
|----------|-------------|-------------------|-------------------|
| Desktop (≥1024px) | **Sidebar** fixa à esquerda (`CategoryFilters` com `aside.w-64.hidden.lg:block`) | **Sidebar** fixa à esquerda (`.sf-filter-sidebar`, `display:none` → `@media(min-width:1024px) display:block`) | `lg:block` / `min-width:1024px` |
| Mobile (<1024px) | **Sheet** bottom drawer (`CategoryFilters` com `Sheet` component, trigger `lg:hidden`) | **Sheet** overlay bottom (`.sf-filter-sheet-overlay`, trigger `.sf-filter-mobile-btn`) | `lg:hidden` / `max-width:1023px` |

> **CAUSA RAIZ DA DIVERGÊNCIA ANTERIOR (v8.4.4):** O React usava `isMobile = viewport === 'mobile'` para decidir qual filtro renderizar. Mas `viewport` só é setado no Builder — no público era sempre `undefined` → `isMobile = false` → filtro mobile NUNCA renderizava. O sidebar desktop tinha `hidden lg:block` → sumia abaixo de 1024px. Resultado: **nenhum filtro no mobile público**.

> **FIX (v8.5.0):** React agora renderiza AMBOS os filtros: desktop e mobile. No Builder, `viewport` prop controla qual aparece. No público, CSS responsivo (`lg:hidden` / `hidden lg:block`) controla automaticamente. Compilador Edge atualizado para usar o mesmo layout sidebar + Sheet.

> **REGRA DE PARIDADE (CRÍTICA):** Ambos (React e Compiler) DEVEM usar: 1) Sidebar sticky no desktop (≥1024px), 2) Botão "Filtrar" com Sheet/overlay no mobile (<1024px). Filtros inline em barra horizontal são PROIBIDOS. Ver `docs/regras/paridade-builder-publico.md`.

> **REGRA ANTI-REGRESSÃO:** Após alterar o compilador de filtros, é OBRIGATÓRIO: 1) Deploy da edge function, 2) Invalidar cache (status='stale'). Nessa ordem.

### Filtros Client-Side (React SPA — v8.5.2)

**Arquivos:** `CategoryPageLayout.tsx` (lógica), `CategoryFilters.tsx` (UI)

| Filtro | Tipo | Campo usado | Descrição |
|--------|------|-------------|-----------|
| Faixa de preço | Slider range | `price` | Filtra produtos por min/max. maxPrice dinâmico baseado nos produtos reais (arredondado para cima em múltiplos de 50) |
| Apenas em estoque | Checkbox | `stock_quantity` | Filtra produtos com `stock_quantity > 0` |
| Tags/Características | Checkboxes | `tags` (array) | Filtra por tags do produto. Só aparece se existem tags nos produtos |
| Ordenação | Select | `price`, `created_at` | Relevância, Menor preço, Maior preço, Mais recentes, Mais vendidos |

**Regras de implementação:**
1. **Query de produtos**: DEVE incluir `stock_quantity` e `tags` no select, além dos campos base
2. **maxPrice dinâmico**: Calculado a partir do maior preço dos produtos (`Math.ceil(max/50)*50`)
3. **Aplicação imediata**: Todos os filtros aplicam automaticamente ao alterar (sem botão "Aplicar")
4. **`filteredProducts` memo**: Recalcula quando qualquer filtro muda (`priceRange`, `sortBy`, `inStockOnly`, `selectedTags`)
5. **Limpar filtros**: Botão "Limpar filtros" aparece quando qualquer filtro está ativo
6. **Sincronização de priceRange (v8.5.2 FIX)**: `priceRange` state inicia em `[0, 500]` e é sincronizado com `computedMaxPrice` via `useEffect` quando os produtos carregam (flag `priceInitialized` evita re-sync após interação do usuário). `CategoryFilters.tsx` usa `localPriceRange` sincronizado com prop via `useEffect([priceRange])`.
7. **Espaçamento mobile (v8.5.2 FIX)**: Container usa `pt-2 sm:pt-4 pb-6` (não `py-6`) para reduzir gap entre banner e filtros no mobile.

### Filtros Client-Side (Edge/Compilador)
| Filtro | Tipo | Descrição |
|--------|------|-----------|
| Frete grátis | checkbox | Filtra `data-free-shipping="1"` |
| Em promoção | checkbox | Filtra `data-has-discount="1"` |
| Faixa de preço | range (min/max) | Filtra por `data-price` com debounce 400ms |

### Ordenação
| Opção | Valor | Lógica |
|-------|-------|--------|
| Relevância | `relevance` / `default` | Ordem original do servidor |
| Menor preço | `price_asc` / `price-asc` | `price` / `data-price` crescente |
| Maior preço | `price_desc` / `price-desc` | `price` / `data-price` decrescente |
| A → Z | `name_asc` / `name-asc` | Nome alfabético crescente |
| Z → A | `name_desc` / `name-desc` | Nome alfabético decrescente |
| Maior desconto | `biggest_discount` / `discount` | Percentual de desconto decrescente |

### Ordenação Padrão (v8.5.4)

| Campo | Valor |
|-------|-------|
| **Tipo** | Config |
| **Localização** | `PageSettingsContent.tsx` → grupo `structure` (categoria) |
| **Setting** | `defaultSortOrder` em `CategorySettings` |
| **Valores** | `relevance` (padrão), `price_asc`, `price_desc`, `name_asc`, `name_desc`, `biggest_discount` |
| **Descrição** | Define a ordenação inicial dos produtos ao abrir qualquer página de categoria. O cliente pode alterar no seletor de filtros. |
| **Consumido em** | `CategoryPageLayout.tsx` (inicializa `sortBy` state com `categorySettings.defaultSortOrder`) |

### Paginação (Load More)
- Página inicial: 24 produtos
- Botão "Carregar mais produtos" revela próxima página
- Contador atualizado: "Exibindo X de Y produtos"
- Estado "Nenhum produto encontrado" com botão "Limpar filtros"

### Dados nos Cards
Cada card de produto tem atributos `data-*` para filtragem client-side:
- `data-price` — preço decimal
- `data-name` — nome do produto (escaped)
- `data-free-shipping` — "1" ou "0"
- `data-has-discount` — "1" ou "0"
- `data-discount-pct` — percentual de desconto
- `data-index` — posição original

### Espaçamento Mobile (v8.5.3 → v8.5.6)

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Visual |
| **Localização** | `supabase/functions/_shared/block-compiler/blocks/category-page-layout.ts` + `supabase/functions/_shared/block-compiler/index.ts` |
| **Descrição** | No mobile (< 640px), o padding-top do container da categoria é reduzido de 24px para 12px para eliminar o espaçamento desproporcional entre o banner e o botão "Filtrar" |
| **CSS** | `@media(max-width:639px) { [data-sf-cat-container] { padding-top:12px !important; } }` |

### Neutralização de Wrappers Legados (v8.5.6 — Fase 1)

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica / Runtime |
| **Localização** | `supabase/functions/_shared/block-compiler/index.ts` |
| **Descrição** | Templates legados envolvem `CategoryBanner` e `CategoryPageLayout` dentro de blocos `Section` com `paddingY: 32/48/24` e `paddingX: 16`. Isso gera gaps indesejados no mobile entre header → banner → filtros. |
| **Solução** | Função `isLegacyCategorySectionWrapper()` detecta esses wrappers pela assinatura legada exata (tipo Section + filhos Category* + padding nos valores conhecidos) e zera o padding em runtime, sem alterar dados salvos. |
| **Regra de segurança** | Só neutraliza se o padding bate exatamente com os padrões legados. Padding customizado intencional NÃO é afetado. |
| **Camada da causa raiz** | Edge compiler (`compileBlockTree`) — o Builder React já tratava isso internamente, mas o compilador público renderizava o Section com padding real. |
| **Deploy obrigatório** | Após editar `index.ts`, é OBRIGATÓRIO fazer deploy de `storefront-html` e `storefront-prerender` para que a loja pública reflita a correção. |
