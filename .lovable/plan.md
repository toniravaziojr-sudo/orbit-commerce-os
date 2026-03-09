# Plano: Aderência Total da Loja à Renderização Edge

## Status: MAPEAMENTO COMPLETO ✅

---

## TODOS OS BLOCOS DO BUILDER (Inventário Completo)

### Blocos de Layout (`src/components/builder/blocks/layout/`)
| Bloco | Compilador Edge | Status |
|-------|----------------|--------|
| Page | page.ts | ✅ Pronto |
| Section | section.ts | ✅ Pronto |
| Container | ❌ | 🔴 **FALTA** |
| Columns | ❌ | 🔴 **FALTA** |
| Column | ❌ | 🔴 **FALTA** |
| Grid | ❌ | 🔴 **FALTA** |

### Blocos de Conteúdo (`src/components/builder/blocks/content/`)
| Bloco | Compilador Edge | Status |
|-------|----------------|--------|
| Text | text.ts | ✅ Pronto |
| RichText | rich-text.ts | ✅ Pronto |
| Image | image.ts | ✅ Pronto |
| Button | button.ts | ✅ Pronto |
| Spacer | spacer.ts | ✅ Pronto |
| Divider | divider.ts | ✅ Pronto |
| Hero | ❌ (usa HeroBanner?) | ⚠️ Verificar |

### Blocos Interativos (`src/components/builder/blocks/interactive/`)
| Bloco | Compilador Edge | Status |
|-------|----------------|--------|
| Newsletter | ❌ | 🔴 **FALTA** |
| NewsletterForm | ❌ | 🔴 **FALTA** |
| NewsletterPopup | ❌ | 🔴 **FALTA** (global injection) |
| FAQ | ❌ | 🔴 **FALTA** |
| Testimonials | ❌ | 🔴 **FALTA** |
| ContactForm | ❌ | 🟡 Baixa prioridade |
| Map | ❌ | 🟡 Baixa prioridade |
| PricingTable | ❌ | 🟡 Admin/landing only |
| PopupModal | ❌ | 🟡 Client-side only |
| QuizEmbed | ❌ | 🟡 Embed externo |
| EmbedSocialPost | ❌ | 🟡 Embed externo |
| SocialFeed | ❌ | 🟡 API externa |
| LivePurchases | ❌ | 🟡 Realtime |
| PersonalizedProducts | ❌ | 🟡 Sessão do usuário |

### Blocos E-commerce (root `blocks/`)
| Bloco | Compilador Edge | Status |
|-------|----------------|--------|
| HeroBanner | hero-banner.ts | ✅ Pronto |
| Banner | banner.ts | ✅ Pronto |
| FeaturedCategories | featured-categories.ts | ✅ Pronto |
| FeaturedProducts | featured-products.ts | ✅ Pronto |
| ImageCarousel | image-carousel.ts | ✅ Pronto |
| InfoHighlights | info-highlights.ts | ✅ Pronto |
| CategoryBanner | category-banner.ts | ✅ Pronto |
| CategoryPageLayout | category-page-layout.ts | ✅ Pronto |
| ProductDetails | product-details.ts | ✅ Pronto (Reviews, Compre Junto, Relacionados, Variantes) |
| ProductGrid | ❌ | 🔴 **FALTA** |
| ProductCarousel | ❌ | 🔴 **FALTA** |
| CategoryList | ❌ | 🔴 **FALTA** |
| CollectionSection | ❌ | 🔴 **FALTA** |
| BannerProducts | ❌ | 🔴 **FALTA** |
| Reviews | ❌ | ⚠️ Dentro de ProductDetails |
| TextBanners | ❌ | 🔴 **FALTA** |
| YouTubeVideo | ❌ | 🔴 **FALTA** |
| VideoUpload | ❌ | 🔴 **FALTA** |
| VideoCarousel | ❌ | 🔴 **FALTA** |
| TrackingLookup | ❌ | 🟡 Página system standalone |
| BlogListing | ❌ | ⚠️ Standalone em blog.ts |
| BlogPostDetail | ❌ | ⚠️ Standalone em blog.ts |
| PageContent | ❌ | ⚠️ Standalone em institutional-page.ts |
| CategoryFilters | ❌ | ⚠️ Embutido em CategoryPageLayout |
| Accordion | ❌ | 🔴 **FALTA** |
| HTMLSection | ❌ | 🔴 **FALTA** |
| CountdownTimer | ❌ | 🔴 **FALTA** |
| LogosCarousel | ❌ | 🔴 **FALTA** |
| StatsNumbers | ❌ | 🔴 **FALTA** |
| ImageGallery | ❌ | 🔴 **FALTA** |
| ContentColumns | ❌ | 🔴 **FALTA** |
| FeatureList | ❌ | 🔴 **FALTA** |
| StepsTimeline | ❌ | 🔴 **FALTA** |
| CartDemo | ❌ | ✅ SPA-only |
| CheckoutDemo | ❌ | ✅ SPA-only |

### Blocos de Slots (`src/components/builder/blocks/slots/`)
| Bloco | Compilador Edge | Onde renderiza | Status |
|-------|----------------|----------------|--------|
| CompreJuntoSlot | ❌ | Página Produto | ⚠️ Já em ProductDetails |
| CrossSellSlot | ❌ | **Carrinho** | 🔴 **FALTA** |
| UpsellSlot | ❌ | **Página Obrigado** | 🔴 **FALTA** |

---

## PÁGINAS QUE PRECISAM DE EDGE RENDERING

### Páginas JÁ 100% Edge-Rendered ✅
| Página | Rota | Compilador |
|--------|------|-----------|
| **Home** | `/` | block-compiler + header.ts + footer.ts |
| **Categoria** | `/categoria/:slug` | category-banner.ts + category-page-layout.ts |
| **Produto** | `/produto/:slug` | product-details.ts (inclui Reviews, Compre Junto, Relacionados) |
| **Blog Index** | `/blog` | blogIndexToStaticHTML() |
| **Blog Post** | `/blog/:slug` | blogPostToStaticHTML() |
| **Institucional** | `/p/:slug` | institutionalPageToStaticHTML() |

### Páginas SPA-ONLY (não precisam edge) ✅
| Página | Rota | Motivo |
|--------|------|--------|
| **Carrinho** | `/carrinho` | Interatividade complexa (qty, cupom, frete) |
| **Checkout** | `/checkout` | Formulários + pagamento |
| **Obrigado** | `/obrigado/:id` | Dados do pedido + upsell 1-click |
| **Minha Conta** | `/minha-conta/*` | Autenticação obrigatória |

### Ofertas Injetadas por Página
| Oferta | Página | Fonte | Edge? |
|--------|--------|-------|-------|
| **Compre Junto** | Produto | `offer_rules.type='buy_together'` | ✅ Já em ProductDetails |
| **Cross-sell** | Carrinho | `offer_rules.type='cross_sell'` | ❌ SPA (não precisa edge) |
| **Order Bump** | Checkout | `offer_rules.type='order_bump'` | ❌ SPA (não precisa edge) |
| **Upsell** | Obrigado | `offer_rules.type='upsell'` | ❌ SPA (não precisa edge) |

---

## INJEÇÕES GLOBAIS (verificar se estão no edge HTML)

| Item | Onde | Status |
|------|------|--------|
| Pixels de Marketing (Meta, Google, TikTok) | `<head>` | 🔴 **Verificar** |
| Newsletter Popup | Global | 🔴 **Verificar** |
| Consent Banner (LGPD) | Global | 🔴 **Verificar** |
| Favicon/Branding | `<head>` | ✅ Verificado |
| Fonts Google | `<head>` | ✅ Verificado |
| Theme CSS Vars | `<style>` | ✅ Verificado |

---

## RESUMO EXECUTIVO

### ✅ 100% Pronto no Edge (19 compiladores)
1. Page, Section
2. Text, RichText, Image, Button, Spacer, Divider
3. HeroBanner, Banner, ImageCarousel, InfoHighlights
4. FeaturedCategories, FeaturedProducts
5. CategoryBanner, CategoryPageLayout
6. ProductDetails (c/ Reviews, Compre Junto, Relacionados, Variantes, Galeria, Frete)
7. Header, Footer (standalone)
8. Blog (standalone), Institucional (standalone)

### 🔴 FALTA Compilador Edge (23 blocos)
**Layout (4):**
- Container, Columns, Column, Grid

**Interativo (5 de alta prioridade):**
- Newsletter, NewsletterForm, FAQ, Testimonials, NewsletterPopup

**E-commerce (9):**
- ProductGrid, ProductCarousel, CategoryList, CollectionSection
- BannerProducts, TextBanners, YouTubeVideo, VideoUpload, VideoCarousel

**Conteúdo Avançado (5):**
- Accordion, HTMLSection, CountdownTimer, LogosCarousel, StatsNumbers
- ImageGallery, ContentColumns, FeatureList, StepsTimeline

### ✅ NÃO precisa Edge (SPA-only é correto)
- Carrinho, Checkout, Obrigado → interatividade complexa
- Cross-sell, Order Bump, Upsell → renderizam nas páginas SPA acima
- CartDemo, CheckoutDemo → blocos de preview
- LivePurchases, PersonalizedProducts → realtime/sessão
- QuizEmbed, EmbedSocialPost, SocialFeed → embeds externos

---

## PLANO DE EXECUÇÃO

### Fase 1: Blocos de Layout (essenciais para páginas customizadas)
1. Container
2. Columns + Column
3. Grid

### Fase 2: Blocos Interativos de Alta Conversão
4. Newsletter
5. FAQ (details/summary)
6. Testimonials
7. Accordion

### Fase 3: Blocos de Mídia
8. YouTubeVideo
9. VideoCarousel
10. HTMLSection
11. ImageGallery

### Fase 4: Blocos de Marketing
12. CountdownTimer
13. LogosCarousel
14. StatsNumbers
15. ContentColumns
16. FeatureList
17. StepsTimeline
18. TextBanners

### Fase 5: Blocos E-commerce Avançados
19. ProductGrid
20. ProductCarousel
21. CategoryList
22. CollectionSection
23. BannerProducts

### Fase 6: Verificações Globais
24. Pixels de marketing no `<head>`
25. Newsletter Popup injection
26. Consent Banner injection

### Fase 7: Auditoria Visual
27. Comparar loja respeiteohomem builder vs público
28. Corrigir divergências visuais

---

## Dead Code para Remover
- `_shared/block-compiler/blocks/product-page.ts` (confirmado morto)
