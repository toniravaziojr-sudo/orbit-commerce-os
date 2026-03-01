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

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOMÍNIOS DE ACESSO                              │
├─────────────────────────────────────────────────────────────────────────┤
│  • Domínio próprio: loja.cliente.com.br                                 │
│  • Subdomínio gratuito: {tenant}.shops.comandocentral.com.br           │
│  • Modo preview: ?preview=1 (acesso a draft_content)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      RESOLUÇÃO DE TENANT                                │
│  Arquivo: supabase/functions/resolve-domain                            │
├─────────────────────────────────────────────────────────────────────────┤
│  • Recebe hostname → retorna tenant_id + primary_host                  │
│  • Verifica status SSL do domínio customizado                          │
│  • Redireciona para domínio canônico quando necessário                 │
└─────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      LAYOUT DO STOREFRONT                               │
│  Arquivos: StorefrontLayout.tsx, TenantStorefrontLayout.tsx            │
├─────────────────────────────────────────────────────────────────────────┤
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

O storefront utiliza uma Edge Function `storefront-bootstrap` que consolida 6+ queries em uma única chamada server-side, reduzindo drasticamente o tempo de carregamento inicial.

### Arquitetura

```
Browser → storefront-bootstrap (Edge Function)
              ├─ Q1: store_settings
              ├─ Q2: header menu + items
              ├─ Q3: footer menu + items
              ├─ Q4: categories (active)
              ├─ Q5: template set (published)
              ├─ Q6: custom domain
              └─ Q7: products (opcional)
         ← Single JSON response
```

### Hooks

| Hook | Arquivo | Uso |
|------|---------|-----|
| `useStorefrontBootstrap` | `src/hooks/useStorefrontBootstrap.ts` | Bootstrap por `tenant_slug` |
| `useStorefrontBootstrapById` | `src/hooks/useStorefrontBootstrap.ts` | Bootstrap por `tenant_id` |
| `usePublicStorefront` | `src/hooks/useStorefront.ts` | Hook público que usa bootstrap internamente |

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
| **Obrigatório** `staleTime` ≥ 2 min | Evitar re-fetches desnecessários |
| **Opcional** `include_products` | Só incluir produtos quando necessário (home) |

### Mapeamento

| Tabela | Edge Function |
|--------|---------------|
| `store_settings` | `storefront-bootstrap` |
| `menus` + `menu_items` | `storefront-bootstrap` |
| `categories` | `storefront-bootstrap` |
| `storefront_template_sets` | `storefront-bootstrap` |
| `tenant_domains` | `storefront-bootstrap` |
| `products` + `product_images` | `storefront-bootstrap` (opcional) |

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

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
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
