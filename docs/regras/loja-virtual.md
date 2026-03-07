# Loja Virtual — Documentação Completa do Módulo

> **Status:** MÓDULO CORE ✅ — Sistema central de e-commerce do Comando Central

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Rotas do Storefront](#rotas-do-storefront)
4. [Páginas Padrões](#páginas-padrões)
5. [Builder Visual](#builder-visual)
6. [Blocos Disponíveis](#blocos-disponíveis)
7. [Header e Footer](#header-e-footer)
8. [Interconexões entre Módulos](#interconexões-entre-módulos)
9. [Contextos Globais](#contextos-globais)
10. [Regras Gerais](#regras-gerais)

---

## Visão Geral

A Loja Virtual é o módulo central de e-commerce que permite criar, personalizar e publicar lojas online completas. Integra-se com todos os demais módulos da plataforma.

### Características Principais

| Característica | Descrição |
|----------------|-----------|
| **Builder Visual** | Editor drag-and-drop para todas as páginas |
| **Multi-tenant** | Cada tenant tem sua própria loja isolada |
| **Templates** | Sistema de templates publicáveis (draft → published) |
| **Domínios** | Suporte a domínio próprio e subdomínio gratuito |
| **Responsivo** | Container queries para adaptação automática |
| **SEO** | Metadados configuráveis por página |

---

## Arquitetura

### Modelo Dual: SPA (Admin/Preview) + Edge-Rendered (Produção)

A partir da v5.0.0, o storefront público opera em **dois modos**:

| Modo | Quando | Como |
|------|--------|------|
| **Edge-Rendered** (v8.0.0) | Domínio custom ou subdomínio `.shops.` em produção | Edge Function `storefront-html` retorna HTML completo via block-compiler |
| **SPA Bootstrap** (v4.0.0) | Preview no admin (`/store/{slug}`) e fallback | React SPA com `storefront-bootstrap` JSON |

### Arquitetura Edge-Rendered (Produção)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOMÍNIOS DE ACESSO                              │
├─────────────────────────────────────────────────────────────────────────┤
│  • Domínio próprio: loja.cliente.com.br                                 │
│  • Subdomínio gratuito: {tenant}.shops.comandocentral.com.br           │
└─────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│             EDGE FUNCTION: storefront-html (v8.0.0)                     │
│  Arquivo: supabase/functions/storefront-html/index.ts                  │
│  Resolução: supabase/functions/_shared/resolveTenant.ts                │
├─────────────────────────────────────────────────────────────────────────┤
│  1. Recebe hostname (query param, x-forwarded-host ou POST)            │
│  2. resolveTenantFromHostname() → tenant_id + tenant_slug              │
│  3. Pre-render lookup: storefront_prerendered_pages (fast path)        │
│  4. Live fallback: queries paralelas + renderização via block-compiler │
│  5. Retorna text/html com Cache-Control: s-maxage=120                  │
│  6. Server-Timing headers para diagnóstico                             │
├─────────────────────────────────────────────────────────────────────────┤
│  Block-to-HTML Compiler (v8.0.0) — TODAS as rotas:                     │
│  • Home: compileBlockTree() com published_content (fonte de verdade)   │
│  • Header: headerToStaticHTML() via block-compiler                     │
│  • Footer: footerToStaticHTML() via block-compiler                     │
│  • Produto: productPageToStaticHTML() via block-compiler               │
│  • Categoria: categoryPageToStaticHTML() via block-compiler            │
│  • Blog: blogIndexToStaticHTML() / blogPostToStaticHTML()              │
│  • Institucional: institutionalPageToStaticHTML()                       │
│  • Compiladores co-localizados: _shared/block-compiler/blocks/         │
│  • Blocos de home: Page, Section, HeroBanner, Banner,                  │
│    FeaturedCategories, FeaturedProducts, ImageCarousel, InfoHighlights  │
│  • ZERO renderers manuais legados restantes                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Rotas suportadas:                                                      │
│  • / → Home (block-compiler: header + blocos + footer)                 │
│  • /produto/:slug → Página de produto (galeria + info + JSON-LD)       │
│  • /categoria/:slug → Página de categoria (banner + grid)              │
│  • /p/:slug → Página institucional (store_pages)                       │
│  • /blog → Índice do blog (grid 3 colunas)                             │
│  • /blog/:slug → Post do blog (capa + conteúdo + JSON-LD BlogPosting) │
│  • /:slug → Fallback para página institucional por slug direto         │
├─────────────────────────────────────────────────────────────────────────┤
│  Hidratação JS (vanilla ~4KB):                                         │
│  • Carrinho: localStorage, drawer lateral, add/remove                  │
│  • Busca: overlay com search em tempo real via REST API                │
│  • Menu mobile: toggle com overlay fullscreen                          │
│  • Botões usam data-sf-action="add-to-cart|toggle-search|open-cart"    │
├─────────────────────────────────────────────────────────────────────────┤
│  Cart Bridge Edge↔SPA (Phase 8 - v5.1.0):                              │
│  • Formato unificado: storefront_cart_{slug} (mesmo do React)          │
│  • Items: {id, product_id, variant_id, name, sku, price, quantity}     │
│  • Migração automática do formato antigo (sf_cart_{slug})              │
│  • Transição edge→SPA preserva carrinho (mesmo localStorage key)      │
├─────────────────────────────────────────────────────────────────────────┤
│  Cache Invalidation (Phase 5 - v1.0.0):                                │
│  • Edge Function: storefront-cache-purge                               │
│  • Client utility: src/lib/storefrontCachePurge.ts                     │
│  • Hooks integrados: useTemplateSetSave, useProducts, useCategories,   │
│    useMenus, useMenuItems, useStoreSettings                            │
│  • Fire-and-forget: não bloqueia fluxo do admin                        │
├─────────────────────────────────────────────────────────────────────────┤
│  Cloudflare Worker routing (Phase 4):                                   │
│  • Worker verifica Accept: text/html em GET requests                   │
│  • Rotas SPA-only (carrinho, checkout, obrigado, minha-conta) → SPA   │
│  • Demais rotas → storefront-html Edge Function primeiro              │
│  • Se edge function falha → fallback automático para SPA              │
│  • Header X-CC-Render-Mode: edge-html indica modo ativo               │
├─────────────────────────────────────────────────────────────────────────┤
│  LCP & Font Optimization (Phase 7 - v5.0.0):                           │
│  • <link rel="preload" as="style"> para Google Fonts CSS               │
│  • <link rel="preload" as="image" imagesrcset> responsivo para banner  │
│  • <link rel="preload" as="image"> para imagem principal do produto    │
│  • <link rel="preload" as="image"> para capa do blog post             │
│  • dns-prefetch para wsrv.nl, fonts.googleapis.com, fonts.gstatic.com │
│  • fetchpriority="high" em imagens LCP (banner, produto, blog cover)  │
├─────────────────────────────────────────────────────────────────────────┤
│  Performance: TTFB ~300-500ms (vs ~2-4s no modelo SPA)                 │
│  Cache: public, s-maxage=120, stale-while-revalidate=300               │
│  Dados no window: __SF_SERVER_RENDERED, __SF_TIMING, __SF_TENANT       │
└─────────────────────────────────────────────────────────────────────────┘

### Arquitetura SPA Bootstrap (Admin Preview / Fallback)

```
┌─────────────────────────────────────────────────────────────────────────┐
│               RESOLUÇÃO DE TENANT + BOOTSTRAP UNIFICADO                  │
│  Arquivo: supabase/functions/storefront-bootstrap (v4.0.0)              │
│  Lógica de resolução: supabase/functions/_shared/resolveTenant.ts       │
├─────────────────────────────────────────────────────────────────────────┤
│  • Aceita hostname → resolve tenant + carrega todos os dados            │
│  • Aceita tenant_slug ou tenant_id → carrega dados diretamente          │
│  • 1 ÚNICA chamada Edge Function para domínios custom (antes eram 2)    │
│  • resolve-domain ainda existe como fallback (usa _shared/resolveTenant)│
└─────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      LAYOUT DO STOREFRONT                               │
│  Arquivos: StorefrontLayout.tsx, TenantStorefrontLayout.tsx            │
├─────────────────────────────────────────────────────────────────────────┤
│  • TenantStorefrontLayout: usa useStorefrontBootstrapByHostname        │
│  • CartProvider (estado global do carrinho)                             │
│  • DiscountProvider (cupons aplicados)                                  │
│  • StorefrontConfigProvider (configs de frete, benefícios, ofertas)    │
│  • MarketingTrackerProvider (UTM, atribuição)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         PÁGINAS DE CONTEÚDO                             │
│  Arquivos: src/pages/storefront/Storefront*.tsx                        │
├─────────────────────────────────────────────────────────────────────────┤
│  • Busca template publicado ou draft (preview)                         │
│  • Busca dados reais (produtos, categorias, pedidos)                   │
│  • Monta BlockRenderContext                                             │
│  • Renderiza via PublicTemplateRenderer                                │
│  • TODAS passam bootstrapGlobalLayout ao PublicTemplateRenderer        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Rotas do Storefront

### Rotas Públicas

| Rota | Página | Componente |
|------|--------|------------|
| `/` | Home | `StorefrontHome.tsx` |
| `/categoria/:slug` | Categoria | `StorefrontCategory.tsx` |
| `/produto/:slug` | Produto | `StorefrontProduct.tsx` |
| `/carrinho` | Carrinho | `StorefrontCart.tsx` |
| `/checkout` | Checkout | `StorefrontCheckout.tsx` |
| `/obrigado` | Obrigado | `StorefrontThankYou.tsx` |
| `/rastreio` | Rastreio | `StorefrontTracking.tsx` |
| `/p/:slug` | Página institucional | `StorefrontPage.tsx` |
| `/blog` | Lista de posts | `StorefrontBlog.tsx` |
| `/blog/:slug` | Post | `StorefrontBlogPost.tsx` |
| `/minha-conta` | Área do cliente | `StorefrontAccount.tsx` |
| `/minha-conta/pedidos` | Meus pedidos | `StorefrontOrdersList.tsx` |
| `/minha-conta/pedido/:id` | Detalhes do pedido | `StorefrontOrderDetail.tsx` |

### Rotas do Builder (Admin)

| Rota | Descrição |
|------|-----------|
| `/storefront` | Gerenciador de templates e páginas |
| `/storefront/builder` | Editor visual de templates |
| `/pages` | Gerenciador de páginas institucionais |
| `/pages/:id/builder` | Editor de página institucional |
| `/blog` | Gerenciador de posts |
| `/blog/:id/builder` | Editor de post |
| `/menus` | Gerenciador de menus (header/footer) |

---

## Páginas Padrões

### 1. Home

| Característica | Descrição |
|----------------|-----------|
| **Template** | `storefront_template_sets.draft_content.home` |
| **Blocos essenciais** | Header, Footer |
| **Blocos opcionais** | Banner (carrossel), FeaturedProducts, CategoryList, etc. |

### 2. Categoria

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showRatings` | boolean | true | Estrelas nas thumbs |
| `showBadges` | boolean | true | Selos de oferta |
| `showAddToCartButton` | boolean | true | Botão adicionar |
| `showBanner` | boolean | true | Banner da categoria |
| `buyNowButtonText` | string | "Comprar agora" | Texto do CTA |

### 3. Produto

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showGallery` | boolean | true | Galeria de imagens |
| `showDescription` | boolean | true | Descrição completa |
| `showVariants` | boolean | true | Seletor de variantes |
| `showReviews` | boolean | true | Avaliações |
| `showBuyTogether` | boolean | true | Compre Junto |
| `showRelatedProducts` | boolean | true | Produtos relacionados |
| `relatedProductsTitle` | string | "Produtos Relacionados" | Título customizável (visível quando `showRelatedProducts` = true) |
| `showShippingCalculator` | boolean | true | Calculadora de frete |

### 4. Carrinho

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showCrossSell` | boolean | true | Cross-sell |
| `showCouponField` | boolean | true | Campo de cupom |
| `showShippingCalculator` | boolean | true | Calculadora de frete |
| `showTrustBadges` | boolean | true | Selos de confiança |

### 5. Checkout

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderSummary` | boolean | true | Resumo do pedido |
| `showCouponField` | boolean | true | Campo de cupom |
| `showOrderBump` | boolean | true | Order bump |
| `showTestimonials` | boolean | true | Prova social |

### 6. Obrigado (Thank You)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Detalhes do pedido |
| `showRelatedProducts` | boolean | true | Produtos relacionados |
| `showTrackingInfo` | boolean | true | Info de rastreio |
| `showUpsell` | boolean | true | Upsell |

---

## Builder Visual

### Arquitetura do Builder

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VISUAL BUILDER                                   │
│  Arquivo: src/components/builder/VisualBuilder.tsx                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────┐  ┌─────────────────┐  │
│  │   Block         │  │        Canvas           │  │   Properties    │  │
│  │   Palette       │  │  (Preview interativo)   │  │   Panel         │  │
│  │                 │  │                         │  │                 │  │
│  │   - Layout      │  │   Header ───────────    │  │   - Props       │  │
│  │   - Content     │  │   Section ─────────     │  │   - Toggles     │  │
│  │   - Media       │  │     Container ────      │  │   - Colors      │  │
│  │   - E-commerce  │  │       Block ─────       │  │   - Imagens     │  │
│  │   - Slots       │  │   Footer ───────────    │  │                 │  │
│  └─────────────────┘  └─────────────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes do Builder

| Componente | Arquivo | Função |
|------------|---------|--------|
| `VisualBuilder` | `VisualBuilder.tsx` | Container principal |
| `BlockPalette` | `BlockPalette.tsx` | Paleta de blocos |
| `BuilderCanvas` | `BuilderCanvas.tsx` | Canvas de edição |
| `PropertiesPanel` | `PropertiesPanel.tsx` | Painel de propriedades |
| `BlockRenderer` | `BlockRenderer.tsx` | Renderizador de blocos |
| `ThemeSettings` | `ThemeSettings.tsx` | Configurações do tema |

### Fluxo de Dados

```
draft_content (edição) → Publicar → published_content (público)
```

| Estado | Fonte | Uso |
|--------|-------|-----|
| **Draft** | `storefront_template_sets.draft_content` | Builder + Preview |
| **Published** | `storefront_template_sets.published_content` | Storefront público |

### Hook de Preview: `usePreviewTemplate`

**Arquivo:** `src/hooks/usePreviewTemplate.ts`

O hook `usePreviewTemplate` é responsável por carregar o conteúdo do rascunho quando o parâmetro `?preview=1` está presente na URL. A ordem de resolução dos dados é:

1. **Fonte primária:** `storefront_template_sets.draft_content[pageType]` — lê do template set vinculado via `store_settings.published_template_id`
2. **Fallback legado:** `storefront_page_templates` + `store_page_versions` — para lojas que ainda não migraram para o sistema multi-template

> **IMPORTANTE:** O Preview sempre usa `draft_content`, nunca `published_content`. A publicação (botão "Publicar") copia `draft_content` → `published_content` via `useTemplateSetSave.publishTemplateSet`.

---

## Blocos Disponíveis

### Layout

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `Page` | `PageBlock.tsx` | Container raiz |
| `Section` | `SectionBlock.tsx` | Seção com background |
| `Container` | `ContainerBlock.tsx` | Container com max-width |
| `Columns` | `ColumnsBlock.tsx` | Layout de colunas |
| `Column` | `ColumnBlock.tsx` | Coluna individual |
| `Grid` | `GridBlock.tsx` | Grid CSS |

### Conteúdo

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `RichText` | `RichTextBlock.tsx` | Texto formatado |
| `Text` | `TextBlock.tsx` | Texto simples |
| `Image` | `ImageBlock.tsx` | Imagem única |
| `Button` | `ButtonBlock.tsx` | Botão CTA |
| `Divider` | `DividerBlock.tsx` | Divisor |
| `Spacer` | `SpacerBlock.tsx` | Espaçamento |

### Media

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `Banner` | `BannerBlock.tsx` | Banner único ou carrossel (modo: `single` / `carousel`) |
| `ImageCarousel` | `ImageCarouselBlock.tsx` | Carrossel de imagens |
| `ImageGallery` | `ImageGalleryBlock.tsx` | Galeria de imagens |
| `VideoCarousel` | `VideoCarouselBlock.tsx` | Carrossel de vídeos |
| `YouTubeVideo` | `YouTubeVideoBlock.tsx` | Embed YouTube |
| `VideoUpload` | `VideoUploadBlock.tsx` | Vídeo hospedado |
| `LogosCarousel` | `LogosCarouselBlock.tsx` | Carrossel de logos |

### E-commerce

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `ProductGrid` | `ProductGridBlock.tsx` | Grid de produtos |
| `ProductCarousel` | `ProductCarouselBlock.tsx` | Carrossel de produtos |
| `FeaturedProducts` | `FeaturedProductsBlock.tsx` | Produtos em destaque |
| `CategoryList` | `CategoryListBlock.tsx` | Lista de categorias |
| `FeaturedCategories` | `FeaturedCategoriesBlock.tsx` | Categorias em destaque |
| `BannerProducts` | `BannerProductsBlock.tsx` | Banner + produtos |
| `CollectionSection` | `CollectionSectionBlock.tsx` | Coleção de produtos |
| `CategoryPageLayout` | `CategoryPageLayout.tsx` | Layout de categoria |
| `CategoryBanner` | `CategoryBannerBlock.tsx` | Banner de categoria |
| `Reviews` | `ReviewsBlock.tsx` | Avaliações |
| `TrackingLookup` | `TrackingLookupBlock.tsx` | Busca de rastreio |

### Interativos

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `Accordion` | `AccordionBlock.tsx` | Accordion/FAQ |
| `CountdownTimer` | `CountdownTimerBlock.tsx` | Contador regressivo |
| `StepsTimeline` | `StepsTimelineBlock.tsx` | Timeline de etapas |
| `StatsNumbers` | `StatsNumbersBlock.tsx` | Estatísticas numéricas |
| `FeatureList` | `FeatureListBlock.tsx` | Lista de features |
| `ContentColumns` | `ContentColumnsBlock.tsx` | Colunas de conteúdo |
| `TextBanners` | `TextBannersBlock.tsx` | Banners de texto |
| `InfoHighlights` | `InfoHighlightsBlock.tsx` | Destaques informativos |

### Slots de Ofertas

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `CompreJuntoSlot` | `CompreJuntoSlotBlock.tsx` | Compre Junto (PDP) |
| `CrossSellSlot` | `CrossSellSlotBlock.tsx` | Cross-sell (Carrinho) |
| `UpsellSlot` | `UpsellSlotBlock.tsx` | Upsell (Obrigado) |

### Especiais

| Bloco | Arquivo | Descrição |
|-------|---------|-----------|
| `CartDemo` | `CartDemoBlock.tsx` | Preview do carrinho |
| `CheckoutDemo` | `CheckoutDemoBlock.tsx` | Preview do checkout |
| `BlogListing` | `BlogListingBlock.tsx` | Lista de posts |
| `BlogPostDetail` | `BlogPostDetailBlock.tsx` | Conteúdo do post |
| `PageContent` | `PageContentBlock.tsx` | Conteúdo de página |
| `HTMLSection` | `HTMLSectionBlock.tsx` | HTML customizado |
| `CustomBlockRenderer` | `CustomBlockRenderer.tsx` | Blocos customizados |

---

## Header e Footer

### Header

**Arquivo:** `src/components/storefront/StorefrontHeader.tsx`

| Elemento | Descrição |
|----------|-----------|
| **Barra de Aviso** | Texto animado com CTA opcional |
| **Logo** | Logo ou nome da loja |
| **Menu** | Navegação hierárquica (3 níveis) |
| **Busca** | Campo de busca de produtos |
| **Carrinho** | Ícone com contador |
| **Conta** | Link para área do cliente |
| **Atendimento** | Dropdown com contatos |
| **Promoções** | Badge de destaque configurável |

Ver documentação completa: [`header.md`](./header.md)

### Footer

**Arquivo:** `src/components/storefront/StorefrontFooter.tsx`

| Elemento | Descrição |
|----------|-----------|
| **Logo/Info** | Logo + nome + descrição da loja |
| **SAC** | WhatsApp, telefone, email, horário |
| **Redes Sociais** | Facebook, Instagram, TikTok, YouTube |
| **Menu Footer 1** | Links institucionais |
| **Menu Footer 2** | Links de políticas |
| **Selos** | Pagamento, segurança, frete |
| **Copyright** | Texto de copyright |

Ver documentação completa: [`footer.md`](./footer.md)

---

## Interconexões entre Módulos

### Carrinho & Checkout

```
CartContext → Carrinho → Checkout → Obrigado
     ↓            ↓          ↓
  addItem    CrossSell   OrderBump    Upsell
```

### Ofertas (Aumentar Ticket)

| Tipo | Local | Fonte de Dados |
|------|-------|----------------|
| **Cross-sell** | Carrinho / Mini-cart | `offer_rules` type='cross_sell' |
| **Order Bump** | Checkout | `offer_rules` type='order_bump' |
| **Upsell** | Obrigado | `offer_rules` type='upsell' |
| **Compre Junto** | Página do Produto | `buy_together_rules` |

Ver documentação: [`ofertas.md`](./ofertas.md)

### Avaliações

```
Produto → ProductReviews → ReviewsBlock
              ↓
         useProductReviews()
              ↓
       Tabela: product_reviews
```

Ver documentação: [`avaliacoes.md`](./avaliacoes.md)

### Cupons de Desconto

```
Carrinho/Checkout → CouponInput → DiscountContext
                         ↓
                   useDiscount()
                         ↓
                  Tabela: discounts
```

Ver documentação: [`descontos.md`](./descontos.md)

### Páginas Institucionais

```
Menu Header/Footer → Link → StorefrontPage
                              ↓
                      usePublicPageTemplate()
                              ↓
                       Tabela: store_pages
```

Ver documentação: [`paginas-institucionais.md`](./paginas-institucionais.md)

### Blog

```
Menu Header/Footer → Link → StorefrontBlog
                              ↓
                      usePublicBlogPosts()
                              ↓
                       Tabela: blog_posts
```

Ver documentação: [`blog.md`](./blog.md)

### Menus

```
Menus Admin → menu_items → Header/Footer
                 ↓
           item_type: category | page | external | landing_page
```

### Frete e Benefícios

```
store_settings.shipping_config → ShippingEstimator
store_settings.benefit_config → BenefitProgressBar
```

---

## Contextos Globais

### CartContext

| Método | Descrição |
|--------|-----------|
| `addItem` | Adiciona item ao carrinho |
| `removeItem` | Remove item |
| `updateQuantity` | Atualiza quantidade |
| `clearCart` | Limpa carrinho |
| `items` | Lista de itens |
| `subtotal` | Subtotal |
| `total` | Total com frete/desconto |

### DiscountContext

| Método | Descrição |
|--------|-----------|
| `applyDiscount` | Aplica cupom |
| `removeDiscount` | Remove cupom |
| `appliedDiscount` | Cupom aplicado |
| `discountAmount` | Valor do desconto |

### StorefrontConfigContext

| Propriedade | Descrição |
|-------------|-----------|
| `shippingConfig` | Configurações de frete |
| `benefitConfig` | Configurações de benefícios |
| `cartConfig` | Configurações do carrinho |
| `checkoutConfig` | Configurações do checkout |

---

## Regras Gerais

### Container Queries

Usar classes `sf-*` (container queries) em vez de `md:`, `lg:` (media queries):

| Classe | Breakpoint | Uso |
|--------|------------|-----|
| `.sf-*-mobile` | Container < 768px | Versão mobile |
| `.sf-*-desktop` | Container ≥ 768px | Versão desktop |

### Dados Demo no Builder

| Contexto | Dados Reais | Dados Demo |
|----------|-------------|------------|
| **Builder** (`isEditing=true`) | ✅ Exibe | ✅ Fallback |
| **Storefront Público** | ✅ Exibe | ❌ Não renderiza |

### Slots de Ofertas

**REGRA CRÍTICA:** Slots devem usar `context` em vez de hooks de router:

```typescript
// ❌ ERRADO - causa erro no builder
const tenantSlug = useTenantSlug();

// ✅ CORRETO - funciona em todos os contextos
const tenantSlug = context?.tenantSlug || '';
```

### Publicação de Templates

```
1. Admin edita draft_content
2. Admin clica "Publicar"
3. draft_content → published_content
4. Storefront público usa published_content
```

### SEO

| Página | Fonte de Metadados | Geração IA |
|--------|-------------------|------------|
| Home | `storefront_page_settings.home.seo_*` | ✅ Disponível |
| Categoria | `categories.seo_*` | ✅ Disponível |
| Produto | `products.seo_*` | ✅ Disponível |
| Página | `store_pages.meta_*` | ✅ Disponível |
| Blog Post | `blog_posts.seo_*` | ✅ Disponível |

#### SEO da Página Inicial (Home)

Configurável em: **Loja Virtual → Configurações de Tema → Página Inicial**

| Campo | Limite | Descrição |
|-------|--------|-----------|
| `seo_title` | 60 caracteres | Título para metatag e OG |
| `seo_description` | 160 caracteres | Meta description |

**Geração com IA:** Botão "Gerar SEO com IA" utiliza `GenerateSeoButton` com type `page` e passa o nome da loja como contexto.

#### Edge Function: generate-seo

Endpoint centralizado para geração de SEO otimizado via IA (Gemini).

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `type` | `'product' \| 'category' \| 'blog' \| 'page'` | ✅ | Tipo de conteúdo |
| `name` | string | ✅ | Nome/título do item |
| `description` | string | ❌ | Descrição curta |
| `content` | string | ❌ | Conteúdo HTML (será limpo) |
| `excerpt` | string | ❌ | Resumo |
| `tags` | string[] | ❌ | Tags relacionadas |
| `price` | number | ❌ | Preço em centavos |
| `storeName` | string | ❌ | Nome da loja |

**Retorno:**
```json
{
  "seo_title": "Título otimizado (máx 60 chars)",
  "seo_description": "Descrição otimizada (máx 160 chars)"
}
```

---

## Tabelas do Banco de Dados

### Templates

| Tabela | Descrição |
|--------|-----------|
| `storefront_template_sets` | Templates do storefront (draft + published) |
| `storefront_global_layout` | Configs globais (header_config, footer_config) |
| `page_templates` | Templates de páginas institucionais |

### Conteúdo

| Tabela | Descrição |
|--------|-----------|
| `store_pages` | Páginas institucionais |
| `blog_posts` | Posts do blog |
| `menus` | Menus (header, footer_1, footer_2) |
| `menu_items` | Itens de menu |

### E-commerce

| Tabela | Descrição |
|--------|-----------|
| `products` | Produtos |
| `categories` | Categorias |
| `product_categories` | Relação produto-categoria |
| `product_images` | Imagens de produtos |
| `product_variants` | Variantes de produtos |
| `product_reviews` | Avaliações |

### Ofertas

| Tabela | Descrição |
|--------|-----------|
| `offer_rules` | Regras de cross-sell, order-bump, upsell |
| `buy_together_rules` | Regras de compre junto |

### Checkout

| Tabela | Descrição |
|--------|-----------|
| `orders` | Pedidos |
| `order_items` | Itens do pedido |
| `checkout_sessions` | Sessões de checkout |
| `discounts` | Cupons de desconto |

---

## Arquivos Relacionados

| Se for editar... | Leia primeiro... |
|------------------|------------------|
| `src/components/storefront/StorefrontHeader*.tsx` | [`header.md`](./header.md) |
| `src/components/storefront/StorefrontFooter*.tsx` | [`footer.md`](./footer.md) |
| `src/components/builder/*` | [`builder.md`](./builder.md) |
| `src/components/storefront/checkout/*` | [`checkout.md`](./checkout.md) |
| `src/components/storefront/cart/*` | [`carrinho.md`](./carrinho.md) |
| `src/pages/storefront/StorefrontProduct.tsx` | [`pagina-produto.md`](./pagina-produto.md) |
| `src/pages/storefront/StorefrontCategory.tsx` | [`pagina-categoria.md`](./pagina-categoria.md) |
| `src/pages/storefront/StorefrontThankYou.tsx` | [`pagina-obrigado.md`](./pagina-obrigado.md) |
| `src/pages/Pages.tsx`, `store_pages` | [`paginas-institucionais.md`](./paginas-institucionais.md) |
| `src/pages/Blog.tsx`, `blog_posts` | [`blog.md`](./blog.md) |
| `src/pages/Offers.tsx`, `offer_rules` | [`ofertas.md`](./ofertas.md) |
| `src/pages/Reviews.tsx`, `product_reviews` | [`avaliacoes.md`](./avaliacoes.md) |
| `src/pages/Discounts.tsx`, `discounts` | [`descontos.md`](./descontos.md) |

---

## Storefront Bootstrap (Otimização de Performance)

### Visão Geral

O storefront utiliza uma Edge Function `storefront-bootstrap` (v4.0.0) que consolida **12 queries paralelas + resolução de domínio** em uma única chamada server-side.

**Evolução:**
- **v2.0.0**: 8 queries paralelas, resolve-domain separado (2 Edge Function calls)
- **v3.0.0**: +2 queries (store_pages, footer_2 menu), Footer/Header consomem bootstrap via props
- **v4.0.0**: Aceita `hostname` — unifica resolve-domain + bootstrap em 1 chamada

### Arquitetura

```
Browser → storefront-bootstrap (Edge Function v4.0.0)
              ├─ [hostname?] → _shared/resolveTenant.ts (resolve tenant internamente)
              ├─ Q1: store_settings
              ├─ Q2: header menu + items
              ├─ Q3: footer menu + items (footer_1 / legacy 'footer')
              ├─ Q4: categories (active)
              ├─ Q5: template set (published_content)
              ├─ Q6: custom domain (skip se já resolvido via hostname)
              ├─ Q7: storefront_global_layout
              ├─ Q8: storefront_page_overrides
              ├─ Q9: store_pages (published — para Header/Footer menu links)
              ├─ Q10: footer_2 menu + items
              └─ Q11: products (opcional)
         ← Single JSON response
```

### Resolução de Domínio Compartilhada

A lógica de resolução de domínio foi extraída para `supabase/functions/_shared/resolveTenant.ts`:
- Usada por `storefront-bootstrap` (quando recebe `hostname`)
- Usada por `resolve-domain` (que agora é wrapper fino)
- **PROIBIDO** duplicar lógica de resolução em outras funções

### Dados Derivados do Template (sem queries extras)

O hook `usePublicStorefront` extrai automaticamente do `published_content` do template:
- `globalLayout` → `published_content.themeSettings.globalLayout`
- `pageOverrides` → `published_content.themeSettings.pageOverrides`
- `categorySettings` → `published_content.themeSettings.pageSettings.category`

**PROIBIDO**: Fazer queries separadas para `usePublicTemplate`, `usePublicGlobalLayout` ou `categorySettings` quando `usePublicStorefront` já fornece esses dados via bootstrap.

### Hooks

| Hook | Arquivo | Uso |
|------|---------|-----|
| `useStorefrontBootstrap` | `src/hooks/useStorefrontBootstrap.ts` | Bootstrap por `tenant_slug` |
| `useStorefrontBootstrapById` | `src/hooks/useStorefrontBootstrap.ts` | Bootstrap por `tenant_id` |
| `useStorefrontBootstrapByHostname` | `src/hooks/useStorefrontBootstrap.ts` | Bootstrap por `hostname` (unifica resolve + bootstrap) |
| `usePublicStorefront` | `src/hooks/useStorefront.ts` | Hook público que usa bootstrap + extrai layout/settings |

### Dados Retornados por `usePublicStorefront`

| Campo | Tipo | Origem |
|-------|------|--------|
| `tenant` | object | bootstrap |
| `storeSettings` | object | bootstrap |
| `headerMenu` | object | bootstrap |
| `footerMenu` | object | bootstrap |
| `footer2Menu` | object | bootstrap (v3.0.0+) |
| `categories` | array | bootstrap |
| `template` | object | bootstrap (published_content completo) |
| `globalLayout` | object | bootstrap (storefront_global_layout published columns) |
| `pageOverrides` | object | bootstrap (storefront_page_templates) |
| `categorySettings` | object | extraído de template.themeSettings.pageSettings |
| `customDomain` | string \| null | bootstrap (tenant_domains) |
| `pages` | array | bootstrap (store_pages published, v3.0.0+) |

### Cache

| Configuração | Valor | Motivo |
|--------------|-------|--------|
| `staleTime` | 2 minutos | Dados de storefront mudam raramente |
| `gcTime` | 5 minutos | Mantém cache por mais tempo |
| `Cache-Control` (HTTP) | `public, max-age=60, s-maxage=120` | Cache CDN |

### Regras

| Regra | Descrição |
|-------|-----------|
| **Proibido** queries individuais para dados iniciais | Usar `usePublicStorefront` que chama bootstrap |
| **Proibido** `usePublicTemplate` em páginas storefront | Dados já vêm via bootstrap |
| **Proibido** query separada para `global_layout` | Usar `globalLayout` de `usePublicStorefront` |
| **Proibido** query separada para `custom_domain` | Usar `customDomain` de `usePublicStorefront` |
| **Proibido** query separada para `store_pages` | Usar `pages` de `usePublicStorefront` |
| **Proibido** query separada para `footer_2` menu | Usar `footer2Menu` de `usePublicStorefront` |
| **Proibido** `StorefrontHead` fazer query própria | Recebe `storeSettings` via props |
| **Proibido** `usePublicThemeSettings` sem bootstrap | Passar `bootstrapTemplate` como 2º param |
| **Proibido** Header/Footer fazer queries próprias (público) | Recebem dados via props do bootstrap |
| **Obrigatório** `staleTime` ≥ 2 min | Evitar re-fetches desnecessários |
| **Obrigatório** todas as páginas passarem `bootstrapGlobalLayout` | Ao `PublicTemplateRenderer` para evitar query extra |
| **Opcional** `include_products` | Só incluir produtos quando necessário (home) |

### Componentes que Recebem Dados via Props (sem queries próprias no modo público)

| Componente | Arquivo | Props do Bootstrap |
|------------|---------|-------------------|
| `StorefrontHead` | `StorefrontHead.tsx` | `storeSettings` (favicon, title, SEO) |
| `LcpPreloader` | `LcpPreloader.tsx` | `bootstrapTemplate` (extrai banner do home) |
| `StorefrontThemeInjector` | `StorefrontThemeInjector.tsx` | `bootstrapTemplate` (passa para `usePublicThemeSettings`) |
| `StorefrontFooterContent` | `StorefrontFooterContent.tsx` | `bootstrapStoreSettings`, `bootstrapCategories`, `bootstrapFooterMenus`, `bootstrapPages` |
| `StorefrontHeader` / `HeaderBlock` | `StorefrontHeader.tsx` | `bootstrapPages`, `bootstrapGlobalLayout` |

**IMPORTANTE — Favicon**: `StorefrontHead` NÃO restaura favicon da plataforma no cleanup.

**IMPORTANTE — Header/Footer**: No modo `isEditing=true` (builder), Header e Footer continuam usando queries próprias. As props de bootstrap são usadas apenas no storefront público.

### Mapeamento

| Tabela | Edge Function |
|--------|---------------|
| `store_settings` | `storefront-bootstrap` |
| `menus` + `menu_items` | `storefront-bootstrap` (header, footer_1, footer_2) |
| `categories` | `storefront-bootstrap` |
| `storefront_template_sets` | `storefront-bootstrap` |
| `tenant_domains` | `storefront-bootstrap` |
| `storefront_global_layout` | `storefront-bootstrap` |
| `storefront_page_templates` | `storefront-bootstrap` |
| `store_pages` | `storefront-bootstrap` |
| `products` + `product_images` | `storefront-bootstrap` (opcional) |

### Páginas que Passam bootstrapGlobalLayout ao PublicTemplateRenderer

| Página | Arquivo |
|--------|---------|
| Home | `StorefrontHome.tsx` |
| Produto | `StorefrontProduct.tsx` |
| Categoria | `StorefrontCategory.tsx` |
| Carrinho | `StorefrontCart.tsx` |
| Blog | `StorefrontBlog.tsx` |
| Blog Post | `StorefrontBlogPost.tsx` |
| Rastreio | `StorefrontTracking.tsx` |
| Obrigado | `StorefrontThankYou.tsx` |
| Página Institucional | `StorefrontPage.tsx` |
| Landing Page | `StorefrontLandingPage.tsx` |
| Checkout | `StorefrontCheckout.tsx` |

---

## Otimizações PageSpeed (Padrões Obrigatórios)

### Code Splitting (Lazy Loading de Rotas)

Todas as páginas do storefront em `src/App.tsx` DEVEM usar `React.lazy()` + `Suspense`:

```tsx
// ✅ CORRETO
const StorefrontHome = lazy(() => import('./pages/storefront/StorefrontHome'));
<Suspense fallback={<LoadingFallback />}><StorefrontHome /></Suspense>

// ❌ ERRADO - import estático de páginas storefront
import StorefrontHome from './pages/storefront/StorefrontHome';
```

### Atributos de Imagem Obrigatórios

| Contexto | `loading` | `decoding` | `fetchPriority` | `width/height` |
|----------|-----------|------------|-----------------|----------------|
| Banner/Hero (LCP) | omitir | `async` | `high` | `1920`/`686` |
| ProductCard | `lazy` | `async` | omitir | `400`/`400` |
| ImageBlock | `lazy` | `async` | omitir | conforme config |
| CartPromoBanner | `lazy` | `async` | omitir | omitir |

### Regras

1. **LCP (Largest Contentful Paint):** Banner principal DEVE ter `fetchPriority="high"` e NÃO ter `loading="lazy"`
2. **CLS (Layout Shift):** Todas as `<img>` DEVEM ter `width` e `height` explícitos
3. **Lazy loading:** Imagens abaixo da dobra DEVEM ter `loading="lazy"` e `decoding="async"`
4. **`<picture>` responsivo:** Storefront usa `<source media="(max-width: 767px)">` para imagens mobile

### Otimização de Imagens via wsrv.nl Proxy

Todas as imagens de storage do Supabase são automaticamente roteadas pelo proxy **wsrv.nl** (`https://wsrv.nl/`) para redimensionamento, conversão WebP e cache CDN (1 ano). Apenas URLs do Supabase Storage são transformadas; imagens externas são retornadas como estão.

O helper centralizado é `src/lib/imageTransform.ts`:

| Contexto | Helper | Largura | Qualidade | Formato |
|----------|--------|---------|-----------|---------|
| ProductCard | `getProductCardImageUrl()` | 480px | 80 | WebP |
| HeroBanner desktop | `getHeroBannerImageUrl(url, 'desktop')` | 1920px | 80 | WebP |
| HeroBanner mobile | `getHeroBannerImageUrl(url, 'mobile')` | 768px | 75 | WebP |
| ImageBlock | `getBlockImageUrl(url, maxWidth)` | custom | 80 | WebP |
| Logo (header/footer) | `getLogoImageUrl(url, 200)` | 200px | 85 | WebP |
| Footer selos/badges | `getLogoImageUrl(url, 200)` | 200px | 85 | WebP |
| FeaturedCategories thumbs | `getLogoImageUrl(url, 200)` | 200px | 85 | WebP |

**Regras:**
- **NUNCA** chamar URLs de storage diretamente em `<img>` — sempre usar os helpers
- **NUNCA** alterar o proxy sem validar impacto no PageSpeed
- Imagens não-Supabase (URLs externas, placeholders) NÃO passam pelo proxy

### LCP Preloading

O componente `LcpPreloader` (`src/components/storefront/LcpPreloader.tsx`) é montado nos layouts do storefront e injeta `<link rel="preload">` para a imagem do primeiro banner hero, com media queries separadas para desktop e mobile.

### Defer de Scripts de Marketing

O `MarketingTrackerProvider` usa `requestIdleCallback` (fallback `setTimeout 2s`) para atrasar a injeção dos pixels (Meta, Google, TikTok), evitando bloqueio do FCP/TBT.

---

## Detecção de Domínio — Regras Obrigatórias

### Contexto

O sistema de URLs do storefront precisa distinguir entre três cenários:

| Cenário | Exemplo | `basePath` |
|---------|---------|------------|
| **Domínio customizado** | `loja.cliente.com.br` | `` (vazio) |
| **Subdomínio plataforma** | `tenant.shops.comandocentral.com.br` | `` (vazio) |
| **App/Legacy/Preview** | `app.comandocentral.com.br`, `*.lovableproject.com` | `/store/{tenantSlug}` |

### Domínios de Preview/Dev — NÃO são domínios de tenant

**REGRA CRÍTICA:** Domínios de preview e desenvolvimento **NUNCA** devem ser tratados como domínios de tenant (custom domain ou platform subdomain). Caso contrário, os links do storefront ficam sem o prefixo `/store/{tenantSlug}` e apontam para rotas administrativas.

**Domínios que DEVEM retornar `false` em `isOnTenantHost()` e `isCustomDomain()`:**

| Domínio | Tipo |
|---------|------|
| `*.lovableproject.com` | Preview Lovable |
| `*.lovable.app` | Preview/Publish Lovable |
| `localhost` / `127.0.0.1` | Desenvolvimento local |

**Arquivos afetados:**

| Arquivo | Função | Regra |
|---------|--------|-------|
| `src/lib/canonicalDomainService.ts` | `isAppDomain()` | Deve incluir `*.lovableproject.com` e `*.lovable.app` |
| `src/lib/publicUrls.ts` | `isOnTenantHost()` | Deve excluir domínios de preview/dev antes de retornar `true` |
| `src/lib/urlGuards.ts` | `isCustomDomain()` | Deve retornar `false` para domínios de preview/dev |
| `src/hooks/useStorefrontUrls.ts` | `isOnTenantHost()` | Mesma lógica — herda de `canonicalDomainService` |

### Hooks de URL

| Hook | Uso | Arquivo |
|------|-----|---------|
| `useStorefrontUrls()` | Gera URLs relativas para navegação interna | `src/hooks/useStorefrontUrls.ts` |
| `useCanonicalUrls()` | Gera URLs absolutas para SEO/meta tags | `src/hooks/useCanonicalUrls.ts` |
| `useSafeNavigation()` | Navegação com validação de URLs | `src/hooks/useSafeNavigation.ts` |

**REGRA:** Sempre usar `useStorefrontUrls()` para gerar links de navegação no storefront. Nunca montar URLs manualmente com concatenação de strings.

---

## AI Landing Pages — Engine V5.0 (JSON-to-React)

### Arquitetura V5

A geração de landing pages por IA opera na arquitetura **Engine V5.0**, que utiliza **tool calling** para gerar estrutura JSON de blocos React reais (mesmos componentes do Builder visual), em vez de HTML bruto.

```
Briefing (UI) → resolveEnginePlan() → Prompt V5 → Gemini Tool Call → assembleBlockTree() → BlockNode → PublicTemplateRenderer
```

### Diferença Fundamental: V4 (HTML) vs V5 (Blocks)

| Aspecto | V4 (HTML) | V5 (Blocks) |
|---------|-----------|-------------|
| **Output da IA** | HTML/CSS bruto | JSON via tool call `build_landing_page` |
| **Renderização** | iframe + srcDoc | `PublicTemplateRenderer` (React nativo) |
| **Responsividade** | CSS manual da IA | Tailwind nativo dos componentes |
| **Editável** | Não | Sim (Builder visual — futuro) |
| **Consistência** | Variável | Componentes padronizados |
| **Armazenamento** | `generated_html` + `generated_css` | `generated_blocks` (JSONB) |
| **Fallback** | N/A | Se `generated_blocks` vazio → renderiza HTML legado via iframe |

### Componentes da Pipeline

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| **Engine Plan** | `supabase/functions/_shared/marketing/engine-plan.ts` | Decisões determinísticas (arquétipo, seções, profundidade) |
| **Block Assembler** | `supabase/functions/_shared/marketing/block-assembler.ts` | Tool definition + conversão JSON → BlockNode |
| **Gerador** | `supabase/functions/ai-landing-page-generate/index.ts` | Pipeline completa (12 steps) |
| **Fallback Prompts** | `supabase/functions/_shared/marketing/fallback-prompts.ts` | Enriquecimento de tom/estilo visual |
| **UI Briefing** | `src/components/landing-pages/CreateLandingPageDialog.tsx` | Coleta de briefing estratégico |

### Mapeamento Seção → Componente (block-assembler.ts)

| Tipo de Seção (tool call) | Componente React Real |
|---------------------------|----------------------|
| `hero_banner` | `Banner` (mode: single) |
| `info_highlights` | `InfoHighlights` |
| `content_columns` | `ContentColumns` |
| `feature_list` | `FeatureList` |
| `testimonials` | Section + Text + Grid (depoimentos) |
| `pricing_table` | Section + Grid (cards de preço) |
| `faq` | `Accordion` |
| `image_gallery` | `ImageGallery` |
| `steps_timeline` | `StepsTimeline` |
| `stats_numbers` | `StatsNumbers` |
| `text_section` | `RichText` |
| `button_cta` | `Button` |
| `countdown` | `CountdownTimer` |
| `video_embed` | `YouTubeVideo` |

### Renderização no Frontend

**Arquivo**: `src/pages/storefront/StorefrontAILandingPage.tsx`

```
if (generated_blocks com children) → PublicTemplateRenderer (React)
else if (generated_html) → iframe com buildDocumentShell (HTML legado)
else → "Página não gerada"
```

**Preview**: `src/components/landing-pages/LandingPagePreviewDialog.tsx`
- Mesma lógica: blocks → BlockRenderer, HTML → iframe

### Briefing Estruturado (Coluna `briefing` jsonb)

| Campo | Enums (valor salvo em inglês) | Obrigatório |
|---|---|---|
| `objective` | `lead \| whatsapp \| sale \| checkout \| scheduling \| quiz \| signup \| download` | ✅ |
| `trafficTemp` | `cold \| warm \| hot` | ✅ |
| `trafficSource` | `meta \| google \| organic \| email \| remarketing \| direct` | ✅ |
| `awarenessLevel` | `unaware \| pain_aware \| solution_aware \| product_aware \| ready` | ✅ |
| `preferredCTA` | `whatsapp \| buy \| signup \| schedule \| download` | ❌ |
| `restrictions` | `no_countdown \| no_video \| no_comparisons` | ❌ |

> **REGRA:** A UI exibe labels em PT-BR, mas o valor serializado/salvo DEVE ser o enum em inglês.

### Engine Plan (`resolveEnginePlan`)

Função determinística em TypeScript que resolve:

| Decisão | Fonte | Valores possíveis |
|---|---|---|
| `resolvedNiche` | product_type + tags | `ecommerce`, `clinica`, `saas`, `infoproduto`, `servico_local`, `servico_premium` |
| `resolvedArchetype` | objetivo × offerType | 7 arquétipos (ver abaixo) |
| `resolvedDepth` | temperatura + ticket | `short`, `medium`, `long` |
| `resolvedVisualWeight` | nicho + tráfego | `minimalista`, `comercial`, `premium`, `direto`, `informativo` |
| `proofStrength` | count de reviews | `weak`, `medium`, `strong` |
| `defaultCTA` | objetivo | texto do CTA padrão |

#### 7 Arquétipos

| ID | Nome | Seções |
|---|---|---|
| `lp_captura` | Lead capture curta | 3-5 |
| `lp_whatsapp` | WhatsApp push | 5-7 |
| `lp_produto_fisico` | Produto físico/DTC | 7-9 |
| `lp_click_through` | Click-through para checkout | 5-6 |
| `sales_page_longa` | Sales page longa | 9-12 |
| `lp_servico_premium` | Serviço/consultoria | 6-8 |
| `lp_saas` | SaaS/software | 7-9 |

### Pipeline de Geração (12 Steps)

1. **STEP 1**: Fetch produtos + auto-discover kits via `product_components`
2. **STEP 2**: Business context (reviews + criativos de ads)
3. **STEP 3**: Drive references + social proof folders (feedback/review/prova/resultado)
4. **STEP 4**: Drive folder para salvar assets gerados
5. **STEP 5**: Lifestyle image via Gemini Image
6. **STEP 6**: Hero creative via Gemini Image
7. **STEP 7**: Resolve Engine Plan
8. **STEP 8**: Build V5 system prompt (mapeamento seção→componente)
9. **STEP 9**: Enrich prompt (fallback prompts)
10. **STEP 10**: AI tool call `build_landing_page`
11. **STEP 11**: Parse tool call response
12. **STEP 12-13**: `assembleBlockTree()` → persist `generated_blocks`

### Auto-Descoberta de Kits (STEP 1)

- Consulta `product_components` para encontrar kits (`with_composition`) contendo os produtos selecionados
- **IMPORTANTE**: `product_components` NÃO tem coluna `tenant_id` — filtra via JOIN com `products`
- Busca imagens primárias dos kits e adiciona ao `productPrimaryImageMap`

### Busca de Provas Sociais (STEP 3B)

- Busca pastas cujo nome contém: feedback, review, prova, resultado, depoimento, antes/depois
- Imagens de `tenant-files` (privado) → URLs assinadas (1h)
- Imagens de `store-assets` (público) → URLs públicas
- Até 5 imagens passadas como `socialProofImageUrls`

### Fallback Prompts (Enriquecimento)

| ID | Nicho | Papel |
|---|---|---|
| `dark-authority` | Saúde, beleza, premium | Paleta dark, tom de autoridade |
| `editorial-clean` | Moda, lifestyle | Branco editorial, tom aspiracional |
| `tech-futurista` | Tech, gadgets | Dark neon, glassmorphism |
| `organico-sensorial` | Alimentos, naturais | Tons quentes, texturas orgânicas |
| `urgencia-conversao` | Universal | Urgência, escassez, FOMO |

> **REGRA CRÍTICA:** Fallbacks NÃO definem seções ou estrutura. Isso é responsabilidade exclusiva do `engine-plan.ts`.

### Metadata V5

| Campo | Descrição |
|---|---|
| `engineVersion` | `"v5.0"` |
| `briefingSchemaVersion` | `"1.0"` |
| `enginePlanInput` | Input completo do engine plan |
| `toolCallSections` | Número de seções geradas |
| `parseError` | Erro de parsing (se houver) |
| `fallbackPromptUsed` | ID do fallback prompt usado |

### Integração com Ads Autopilot

Quando o `ads-autopilot-strategist` dispara geração de LP, passa briefing com defaults conservadores:

```json
{
  "objective": "sale",
  "trafficTemp": "cold",
  "trafficSource": "meta",
  "awarenessLevel": "pain_aware",
  "preferredCTA": "buy",
  "restrictions": [],
  "assumedBySystem": true
}
```

---

---

## AI Landing Pages — Engine V7.0 (Schema-First + React Renderer)

### Arquitetura V7

A V7 substitui o modelo de HTML gerado por IA por uma arquitetura **schema-first**, onde a IA gera um JSON estruturado (`LPSchema`) e o frontend renderiza com componentes React reais.

```
Briefing → Asset Resolver → IA (Gemini Flash) → LPSchema JSON → LPSchemaRenderer (React) → Página publicada
```

### Diferença Fundamental: V5/V6 vs V7

| Aspecto | V5/V6 | V7 |
|---------|-------|----|
| **Output da IA** | HTML/CSS ou BlockNode JSON | `LPSchema` JSON estruturado |
| **Renderização** | iframe (HTML) ou BlockRenderer (blocks) | `LPSchemaRenderer` (React nativo, sem iframe) |
| **Componentes** | Genéricos do Builder ou HTML string | Blocos LP dedicados (`LPHero`, `LPPricing`, etc.) |
| **Ajuste via chat** | Mutação de HTML bruto | Patch de schema JSON |
| **Assets** | IA escolhe livremente | Asset Resolver determinístico por slot |
| **Validação** | Sanitizer HTML | Zod schema estrito |
| **Armazenamento** | `generated_html` / `generated_blocks` | `generated_schema` (JSONB) |
| **Color scheme** | CSS inline / tema do builder | CSS variables `--lp-*` escopadas |

### Prioridade de Renderização

Em todos os pontos de renderização (`StorefrontAILandingPage`, `LandingPageEditor`, `LandingPagePreviewDialog`):

```
1. generated_schema  → LPSchemaRenderer (V7, React nativo)
2. generated_html    → iframe via buildDocumentShell (V6 fallback)
3. generated_blocks  → BlockRenderer (V5 legado)
```

### Schema Types (`src/lib/landing-page-schema.ts`)

```typescript
interface LPSchema {
  version: '7.0';
  visualStyle: 'premium' | 'comercial' | 'minimalista' | 'direto';
  colorScheme: LPColorScheme;  // 18 tokens de cor + fontes
  showHeader: boolean;
  showFooter: boolean;
  sections: LPSection[];       // 2-12 seções
}
```

**Tipos de seção permitidos:** `hero`, `benefits`, `testimonials`, `social_proof`, `pricing`, `faq`, `guarantee`, `cta_final`

Cada tipo tem **props tipadas** (não `Record<string, any>`). Validação via Zod (`zLPSchema`).

### Componentes LP React (`src/components/landing-pages/blocks/`)

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| `LPHero` | `LPHero.tsx` | Hero split: imagem + copy + CTA → `#ofertas` |
| `LPBenefits` | `LPBenefits.tsx` | Grid de benefícios com imagens alternadas |
| `LPTestimonials` | `LPTestimonials.tsx` | Grid de depoimentos com estrelas |
| `LPSocialProof` | `LPSocialProof.tsx` | Galeria de provas sociais (imagens do Drive) |
| `LPPricing` | `LPPricing.tsx` | Cards de ofertas com destaque no kit recomendado |
| `LPFaq` | `LPFaq.tsx` | Accordion de perguntas frequentes |
| `LPGuarantee` | `LPGuarantee.tsx` | Seção de garantia com badges |
| `LPCtaFinal` | `LPCtaFinal.tsx` | CTA final com imagem do produto e preço |

**Regras dos componentes:**
- Consomem CSS variables `--lp-*` (nunca inline colors soltas)
- Nativamente responsivos via Tailwind
- Sem iframe — renderizados como React nativo
- Tipografia carregada via `<link>` no `LPSchemaRenderer`

### Color Scheme — CSS Variables Escopadas

As variáveis LP são namespaced (`--lp-*`) e ficam no wrapper da LP para não colidirem com `--theme-*` ou `--sf-*` do storefront:

| Variável | Uso |
|----------|-----|
| `--lp-bg` / `--lp-bg-alt` | Fundos principal e alternativo |
| `--lp-text` / `--lp-text-muted` | Texto e texto secundário |
| `--lp-accent` | Cor de destaque |
| `--lp-cta-bg` / `--lp-cta-text` | Botões CTA |
| `--lp-card-bg` / `--lp-card-border` | Cards |
| `--lp-price-current` / `--lp-price-old` | Preços |
| `--lp-badge-bg` / `--lp-badge-text` | Badges |
| `--lp-shadow` / `--lp-divider` | Sombras e divisores |
| `--lp-font-display` / `--lp-font-body` | Tipografia |

### LPSchemaRenderer (`src/components/landing-pages/LPSchemaRenderer.tsx`)

- Recebe `LPSchema` como prop
- Injeta `--lp-*` como CSS variables no wrapper
- Carrega fontes via `<link rel="stylesheet">`
- Mapeia `sections[]` → componente React correto
- Usado em: `StorefrontAILandingPage`, `LandingPageEditor`, `LandingPagePreviewDialog`

### Asset Resolver (`supabase/functions/_shared/landing-page-asset-resolver.ts`)

Função determinística que resolve imagens por slot antes da IA agir:

| Slot | Fonte |
|------|-------|
| `heroImageUrl` | Imagem primária do produto principal |
| `heroBackgroundUrl` | Stock por nicho |
| `offerCardImages` | Map `product_id → primary_image_url` (kits) |
| `socialProofImages` | Pastas do Drive (feedback, review, prova, resultado, depoimento) |
| `benefitImages` | Imagens secundárias do produto + stock |

**REGRA:** A IA não escolhe imagens livremente. Ela recebe o mapa de assets resolvido.

### CTA Links — Regra de 2 Níveis

| Contexto | Destino |
|----------|---------|
| Hero / CTA final / CTAs contextuais | `#ofertas` (scroll) |
| Botões dentro dos cards de pricing | Deep link real do kit (cart/checkout) |

**REGRA:** Não usar a PDP do produto base como CTA quando a LP vende kits/ofertas.

### Strategy Planner (IA → Schema)

**Geração:** IA recebe contexto + assets + blocos disponíveis → retorna `LPSchema` JSON via tool calling → valida com Zod → salva em `generated_schema`

**Ajuste via chat:** IA recebe schema atual + pedido → retorna schema patch → aplica → valida → salva nova versão

**REGRA:** Ajuste via chat opera exclusivamente por schema patch. Nada de HTML.

### Header/Footer — Sem Alteração

- A IA **nunca** gera header/footer dentro da LP
- `show_header` / `show_footer` continuam como flags do banco (fonte de verdade)
- O runtime público injeta `StorefrontHeader` / `StorefrontFooter` reais fora do conteúdo
- Container queries: `containerType: inline-size`, `containerName: storefront`
- **REGRA:** Exatamente a mesma lógica de V5/V6. Sem alteração.

### Presets Visuais

| Style | Fundo | Tipografia Display | Tipografia Body |
|-------|-------|--------------------|-----------------|
| `premium` | Dark (#0a0a0a) | Playfair Display | Inter |
| `comercial` | Branco (#fff) | Montserrat | Open Sans |
| `minimalista` | Off-white (#fafafa) | Sora | Inter |
| `direto` | Branco (#fff) | Inter | Inter |

### Compatibilidade / Fallbacks

- LPs com `generated_html` (V6) continuam funcionando via iframe
- LPs com `generated_blocks` (V5) continuam funcionando via BlockRenderer
- `buildDocumentShell`, `sanitizeAILandingPageHtml` mantidos para legado
- Marketing pixels mantidos em LPs HTML (iframe)
- Favicon/branding mantidos

### Hero Banner IA (Fase 2 — Futuro)

Geração de hero com IA de imagem é opcional e não bloqueia a V7:
- Schema já suporta `backgroundImageUrl` no hero
- Quando disponível, o sistema atualiza o schema com o asset gerado
- Usa pipeline existente do `creative-image-generate`

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-03-07 | **PERFORMANCE FASE 6**: App.tsx — 100% dos imports convertidos para `lazy()`. Admin (~80 pages + AppShell) e Storefront (Layout + páginas) em bundles isolados. Suspense global com spinner. 5 imports não utilizados removidos. Redução estimada de ~60-70% no bundle inicial para visitantes da storefront. |
| 2026-03-07 | **PERFORMANCE FASE 4+4B+5**: Removido `include_products` do bootstrap (payload ~30-50% menor). BannerBlock agora aplica wsrv.nl transform em modo público (match com LcpPreloader). index.html limpo de branding "Comando Central" (title genérico "Carregando...", sem favicon/OG/meta da plataforma). AppShell injeta `document.title = 'Comando Central'` para rotas admin. |
| 2026-03-06 | **PERFORMANCE FASES 1-3**: Bootstrap v4.0.0 com 12 queries paralelas (+ store_pages Q9, footer_2 Q10). Header/Footer usam bootstrap props (zero queries extras). Unificação resolve-domain + bootstrap via _shared/resolveTenant.ts. Todas as páginas passam bootstrapGlobalLayout. |
| 2026-03-05 | **ENGINE V7.0**: Migração para Schema-First + React Renderer. IA gera `LPSchema` JSON (não HTML). 8 blocos LP React com CSS variables `--lp-*`. Asset Resolver determinístico por slot. Ajustes via chat por schema patch. Renderização nativa sem iframe. Prioridade: schema > HTML > blocks. Coluna `generated_schema` (JSONB) em `ai_landing_pages`. |
| 2026-03-04 | **ENGINE V5.0**: Migração para JSON-to-React — tool calling com `build_landing_page`, `assembleBlockTree()`, `generated_blocks` (JSONB), render via `PublicTemplateRenderer`. Auto-descoberta de kits via `product_components`. Busca de provas sociais em pastas do Drive. Fallback HTML legado mantido. |
| 2026-03-04 | **AI LP CONTAINER FIX**: Wrappers de Header/Footer em `StorefrontAILandingPage.tsx` devem incluir `containerName: 'storefront'` para que Container Queries funcionem corretamente |
| 2026-03-04 | **ENGINE V4.1**: Sanitização HTML (sanitizeAILandingPageHtml), prioridade de ativos (criativos > lifestyle > catálogo), badges condicionais, proibição de footer pela IA, CSS safety suavizado |
| 2026-03-04 | **ENGINE V4.0**: Pipeline determinística completa — engine-plan.ts, prompt modular, parser JSON+HTML, hard checks, briefing UI, metadata expandido |
| 2026-03-01 | **DOMÍNIOS**: Regras de detecção de domínio para preview/dev (lovableproject.com, lovable.app) |
| 2026-02-28 | **PERFORMANCE**: Footer selos e FeaturedCategories thumbs agora usam `getLogoImageUrl()` com lazy loading |
| 2026-02-28 | Image Proxy: wsrv.nl para auto-resize + WebP + CDN cache em todas as imagens Supabase |
| 2026-02-28 | PageSpeed Mobile: LCP preload, defer marketing scripts, autoplay defer 3s |
| 2025-02-28 | PageSpeed: code splitting, lazy loading, fetchPriority, width/height em imagens |
| 2025-02-28 | Storefront Bootstrap: Edge Function de carregamento consolidado + hooks com cache agressivo |
| 2025-01-26 | SEO Home: configuração de meta título/descrição + geração IA em Configurações do Tema |
| 2025-01-25 | Newsletter Popup: campo `icon_image_url` para ícone customizado do incentivo |
| 2025-01-25 | Footer: aviso de itens ocultos quando páginas não estão publicadas |
| 2025-01-19 | Documentação inicial completa do módulo |
| 2025-01-19 | Adicionadas interconexões entre módulos |
| 2025-01-19 | Catalogados todos os blocos disponíveis |
