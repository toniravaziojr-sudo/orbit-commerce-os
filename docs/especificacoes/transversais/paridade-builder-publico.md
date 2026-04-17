# Paridade Builder ↔ Público — Regra Universal

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / Transversais  
> **Migrado de:** `docs/regras/paridade-builder-publico.md`  
> **Última atualização:** 2026-04-03  
> **Escopo:** Toda alteração em blocos React (Builder) ou compiladores HTML (Edge)

---

## 1. Princípio Fundamental

```
┌─────────────────────────────────────────────────────────────────────┐
│  O QUE O LOJISTA VÊ NO BUILDER = O QUE O CLIENTE VÊ NO PÚBLICO    │
│                                                                     │
│  React Component (Builder)  ←→  HTML Compiler (Edge)               │
│  São DUAS implementações do MESMO contrato visual/funcional.       │
│  Qualquer divergência é um BUG, não um "detalhe".                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Regra de ouro:** Alterar UM lado sem alterar o OUTRO é **PROIBIDO**.

---

## 2. Regra de Alteração Simultânea (OBRIGATÓRIA)

### Ao alterar qualquer bloco:

| Passo | Ação | Obrigatório |
|-------|------|-------------|
| 1 | Identificar o par React ↔ Compiler (ver Seção 5) | ✅ |
| 2 | Ler AMBOS os arquivos antes de implementar | ✅ |
| 3 | Aplicar a mesma mudança em AMBOS | ✅ |
| 4 | Verificar que props, defaults e fallbacks são idênticos | ✅ |
| 5 | Verificar breakpoints mobile/desktop (ver Seção 3) | ✅ |
| 6 | Deploy da edge function `storefront-html` | ✅ |
| 7 | Invalidar cache de prerender (status='stale') | ✅ |

### Exceções (não requer par):
- Blocos exclusivos do Builder (CartDemoBlock, CheckoutDemoBlock) — não existem no público
- Blocos SPA-only (Carrinho, Checkout, Minha Conta) — renderizados pelo React no público também

---

## 3. Contrato de Responsividade Desktop/Mobile

### 3.1 Breakpoints Padrão

| Breakpoint | Contexto | Valor |
|------------|----------|-------|
| Mobile | `@media(max-width:639px)` | < 640px |
| Tablet | `@media(max-width:768px)` | < 769px |
| Desktop | Padrão (sem media query) | ≥ 769px |

**REGRA:** Ambos os lados (React e Compiler) DEVEM usar os mesmos breakpoints.

### 3.2 Padrão de Decisão Desktop vs Mobile

#### No React (Builder):
```tsx
// Usar Tailwind responsive classes OU container queries
<div className="grid grid-cols-4 sm:grid-cols-2">
// OU via viewport prop do contexto:
const isMobile = context?.viewport === 'mobile' || containerWidth < 640;
```

#### No Compiler (Edge):
```typescript
// Usar @media queries com os MESMOS breakpoints
const style = `
  @media(max-width:639px) {
    .sf-block-grid { grid-template-columns: repeat(${columnsMobile}, 1fr) !important; }
  }
`;
```

### 3.3 Props Responsivas Obrigatórias

Quando um bloco tem comportamento diferente entre desktop e mobile, DEVE ter props explícitas:

| Prop Pattern | Exemplo | Descrição |
|-------------|---------|-----------|
| `{prop}Desktop` / `{prop}Mobile` | `columnsDesktop`, `columnsMobile` | Valores numéricos separados |
| `{prop}DesktopUrl` / `{prop}MobileUrl` | `bannerDesktopUrl`, `bannerMobileUrl` | Recursos visuais separados |

**NUNCA** usar uma prop única para desktop que é ignorada no mobile, ou vice-versa.

---

## 4. Contrato de Props (Anti-Divergência)

### 4.1 Leitura de Props

| Regra | Descrição |
|-------|-----------|
| **Mesmo nome** | A prop DEVE ter o mesmo nome em ambos os lados |
| **Mesmo default** | Se React usa `paddingY = 32`, Compiler usa `(props.paddingY as number) ?? 32` |
| **Mesmo fallback** | Se React faz `title \|\| 'Sem título'`, Compiler faz `(props.title as string) \|\| 'Sem título'` |
| **Mesma fonte de dados** | Se React lê de `context.categorySettings.X`, Compiler lê de `context.categorySettings.X` — NUNCA de `props.X` |

### 4.2 Fontes de Dados por Prioridade

```
1. context.{settings} (tema, categoria, produto) → Fonte primária
2. props.{campo}                                  → Configuração do bloco
3. Valor default hardcoded                        → Último recurso
```

**REGRA:** Se uma fonte de dados muda no React, DEVE mudar no Compiler na mesma mensagem.

---

## 5. Mapeamento React ↔ Compiler

| React Component | Compiler File | Notas |
|-----------------|---------------|-------|
| `layout/SectionBlock.tsx` | `blocks/section.ts` | |
| `layout/ColumnBlock.tsx` | `blocks/column.ts` | |
| `layout/ColumnsBlock.tsx` | `blocks/columns.ts` | |
| `layout/ContainerBlock.tsx` | `blocks/container.ts` | |
| `layout/GridBlock.tsx` | `blocks/grid.ts` | |
| `layout/SpacerBlock.tsx` | `blocks/spacer.ts` | |
| `layout/DividerBlock.tsx` | `blocks/divider.ts` | |
| `layout/PageBlock.tsx` | `blocks/page.ts` | |
| `BannerBlock.tsx` | `blocks/banner.ts` | |
| `BannerProductsBlock.tsx` | `blocks/banner-products.ts` | Vitrine — registrado em `DYNAMIC_PRODUCT_FETCH_BLOCKS` |
| `HeroBannerBlock.tsx` | `blocks/hero-banner.ts` | Legado |
| `AccordionBlock.tsx` | `blocks/accordion.ts` | |
| `CategoryBannerBlock.tsx` | `blocks/category-banner.ts` | |
| `CategoryListBlock.tsx` | `blocks/category-list.ts` | Alias de `CategoryShowcase` (style=circles) |
| `CategoryPageLayout.tsx` | `blocks/category-page-layout.ts` | Complexo |
| `CollectionSectionBlock.tsx` | `blocks/collection-section.ts` | Alias de `ProductShowcase` (source=category + showViewAll) |
| `ContentColumnsBlock.tsx` | `blocks/content-columns.ts` | |
| `CountdownTimerBlock.tsx` | `blocks/countdown-timer.ts` | |
| `FeatureListBlock.tsx` | `blocks/feature-list.ts` | |
| `FeaturedCategoriesBlock.tsx` | `blocks/featured-categories.ts` | Alias de `CategoryShowcase` (style=cards) |
| `FeaturedProductsBlock.tsx` | `blocks/featured-products.ts` | Alias de `ProductShowcase` (source=manual) |
| `HTMLSectionBlock.tsx` | `blocks/html-section.ts` | |
| `ImageCarouselBlock.tsx` | `blocks/image-carousel.ts` | |
| `ImageGalleryBlock.tsx` | `blocks/image-gallery.ts` | |
| `InfoHighlightsBlock.tsx` | `blocks/info-highlights.ts` | |
| `LogosCarouselBlock.tsx` | `blocks/logos-carousel.ts` | |
| `ProductCarouselBlock.tsx` | `blocks/product-carousel.ts` | Alias de `ProductShowcase` (layout=carousel) |
| `ProductGridBlock.tsx` | `blocks/product-grid.ts` | Alias de `ProductShowcase` (layout=grid) |
| `product-showcase/ProductShowcaseBlock.tsx` | `blocks/product-showcase.ts` | **Orquestrador oficial — v1.4.0+** |
| `category-showcase/CategoryShowcaseBlock.tsx` | `blocks/category-showcase.ts` | **Orquestrador oficial — v1.4.0+** |
| `ReviewsBlock.tsx` | `blocks/reviews.ts` | |
| `StatsNumbersBlock.tsx` | `blocks/stats-numbers.ts` | |
| `StepsTimelineBlock.tsx` | `blocks/steps-timeline.ts` | |
| `TextBannersBlock.tsx` | `blocks/text-banners.ts` | |
| `VideoCarouselBlock.tsx` | `blocks/video-carousel.ts` | |
| `VideoUploadBlock.tsx` | `blocks/video-upload.ts` | |
| `YouTubeVideoBlock.tsx` | `blocks/youtube-video.ts` | |
| `content/RichTextBlock.tsx` | `blocks/rich-text.ts` | |
| `content/ImageBlock.tsx` | `blocks/image.ts` | |
| `content/ButtonBlock.tsx` | `blocks/button.ts` | |
| `content/TextBlock.tsx` | `blocks/text.ts` | Legado |
| `content/FAQBlock.tsx` | `blocks/faq.ts` | |
| `content/NewsletterBlock.tsx` | `blocks/newsletter.ts` | |
| `content/TestimonialsBlock.tsx` | `blocks/testimonials.ts` | |
| `BlogListingBlock.tsx` | `blocks/blog.ts` | |
| `ecommerce/ProductDetailsBlock.tsx` | `blocks/product-details.ts` | Complexo |
| — (Header é slot fixo) | `blocks/header.ts` | |
| — (Footer é slot fixo) | `blocks/footer.ts` | |
| `PageContentBlock.tsx` | `blocks/institutional-page.ts` | |

### Pré-busca de dados (extractors no compiler)

> Vitrines (produtos/categorias) só renderizam no público se o orquestrador `storefront-html` pré-carregar os dados no `CompilerContext`. Esta tabela é a fonte de verdade dos blocos cobertos.

| Extractor (`supabase/functions/_shared/block-compiler/index.ts`) | Blocos cobertos |
|------------------------------------------------------------------|-----------------|
| `extractProductIds` (set `MANUAL_PRODUCT_ID_BLOCKS`) | `ProductShowcase` (source=manual), `FeaturedProducts` |
| `extractProductFetchSpecs` (set `DYNAMIC_PRODUCT_FETCH_BLOCKS`) | `ProductShowcase`, `ProductGrid`, `ProductCarousel`, `CollectionSection`, `BannerProducts` |
| `extractCategoryIds` | `FeaturedCategories`, `CategoryShowcase` |

**Regra:** ao criar/renomear bloco de vitrine, atualizar o set correspondente E o orquestrador. Detalhes do contrato em `docs/especificacoes/storefront/builder.md` › "Pipeline de Pré-busca de Dados (Edge)".

### Blocos sem par (Builder-only):
- `CartDemoBlock.tsx` — Demo no builder, SPA no público
- `CheckoutDemoBlock.tsx` — Demo no builder, SPA no público
- `TrackingLookupBlock.tsx` — SPA no público
- `CategoryFilters.tsx` — Subcomponente de CategoryPageLayout
- `SkeletonBlocks.tsx` — Loading states (Builder only)

---

## 6. Checklist de Validação (OBRIGATÓRIO antes de finalizar)

Ao alterar qualquer bloco, verificar TODOS os itens:

```
□ Props lidas com mesmo nome em React e Compiler
□ Defaults idênticos (números, strings, booleans)
□ Fallbacks idênticos (|| e ??)
□ Fonte de dados idêntica (context vs props)
□ Breakpoints mobile usam mesmo valor (639px / 768px)
□ Classes CSS/estilos inline produzem o mesmo layout visual
□ Badges, ratings, preços usam mesma lógica de exibição
□ Botões (add-to-cart, buy-now) usam mesmo padrão de visibilidade
□ Imagens usam mesmo aspect-ratio e object-fit
□ Deploy + cache invalidation executados
```

---

## 7. Fluxo de Deploy Obrigatório

Após qualquer alteração em compiler (Edge):

```
1. Editar arquivo em supabase/functions/_shared/block-compiler/blocks/
2. Deploy: deploy_edge_functions(['storefront-html'])
3. Invalidar cache: UPDATE storefront_prerendered_pages SET status = 'stale' WHERE page_type IN (tipos afetados)
4. Aguardar 2-5 min para re-render
5. Hard refresh (Ctrl+Shift+R) para validar
```

**NUNCA** finalizar uma correção de compiler sem os passos 2-3.

---

## 8. Proibições

| Proibido | Motivo |
|----------|--------|
| Alterar React sem alterar Compiler (ou vice-versa) | Cria divergência visual |
| Usar breakpoints diferentes entre React e Compiler | Layout inconsistente entre builder e público |
| Ler props de fontes diferentes (ex: React lê `context.X`, Compiler lê `props.X`) | Valores divergem |
| Usar defaults diferentes (ex: React `gap=16`, Compiler `gap=12`) | Espaçamento diverge |
| Ignorar deploy + cache invalidation após alterar compiler | Público fica com versão antiga |
| Adicionar funcionalidade apenas no React "para depois fazer no compiler" | Dívida técnica vira bug permanente |

---

## 9. Histórico

| Data | Versão | Alteração |
|------|--------|-----------|
| 2026-04-17 | v1.2.0 | **Pipeline de pré-busca documentado**: orquestradores oficiais `ProductShowcase` / `CategoryShowcase` adicionados ao mapa de paridade. Tabela de extractors (`MANUAL_PRODUCT_ID_BLOCKS`, `DYNAMIC_PRODUCT_FETCH_BLOCKS`, `extractCategoryIds`) declarada como contrato anti-regressão. Aliases legados marcados explicitamente. |
| 2026-03-16 | v1.1.0 | **Hardening do Banner**: CTA responsivo no compiler (padding, font-size, button size adaptam mobile/desktop via @media). IDs únicos por instância em Banner e HeroBanner (evita colisões CSS). Removido min-height:400px hardcoded, usando aspect-ratio consistente. maxWidth:55% só no desktop. Validação estrutural completa em todas as famílias de página. |
| 2026-03-10 | v1.0.0 | Criação do documento. Regra universal de paridade obrigatória entre Builder (React) e Público (Edge Compiler). Mapeamento completo de 45+ blocos. Checklist de validação. Fluxo de deploy obrigatório. |
