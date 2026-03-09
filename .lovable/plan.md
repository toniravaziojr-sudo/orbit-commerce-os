# Plano: Aderência Total da Loja à Renderização Edge

## Status: MAPEAMENTO CONCLUÍDO ✅

---

## Diagnóstico: O que JÁ funciona no Edge Rendering

### Compiladores de Bloco Existentes (19 blocos registrados + 2 estruturais)
| Bloco | Compilador | Status |
|-------|-----------|--------|
| Page | page.ts | ✅ |
| Section | section.ts | ✅ |
| HeroBanner | hero-banner.ts | ✅ |
| Banner | banner.ts | ✅ |
| FeaturedCategories | featured-categories.ts | ✅ |
| FeaturedProducts | featured-products.ts | ✅ |
| ImageCarousel | image-carousel.ts | ✅ |
| InfoHighlights | info-highlights.ts | ✅ |
| CategoryBanner | category-banner.ts | ✅ |
| CategoryPageLayout | category-page-layout.ts | ✅ |
| ProductDetails | product-details.ts | ✅ (Reviews, Compre Junto, Relacionados, Variantes, Frete, Galeria+Lightbox) |
| Header | header.ts | ✅ (renderizado separadamente) |
| Footer | footer.ts | ✅ (renderizado separadamente) |
| Text | text.ts | ✅ |
| RichText | rich-text.ts | ✅ |
| Image | image.ts | ✅ |
| Button | button.ts | ✅ |
| Spacer | spacer.ts | ✅ |
| Divider | divider.ts | ✅ |

### Renderizadores Standalone (fora do registry)
| Página | Função | Status |
|--------|--------|--------|
| Blog Index | blogIndexToStaticHTML() | ✅ |
| Blog Post | blogPostToStaticHTML() | ✅ |
| Institucional | institutionalPageToStaticHTML() | ✅ |

### Seções da Página de Produto (dentro de product-details.ts)
| Seção | Status |
|-------|--------|
| Reviews (resumo + distribuição + cards) | ✅ |
| Compre Junto (layout + CTA combo) | ✅ |
| Produtos Relacionados (grid 2→4 col) | ✅ |
| Variantes (botões + hydration JS) | ✅ |
| Galeria + Lightbox (desktop + mobile swipe + zoom) | ✅ |
| Cálculo de Frete (placeholder + hydration) | ✅ |
| WhatsApp (botão com link) | ✅ |
| JSON-LD Schema.org | ✅ |
| Breadcrumb | ✅ |
| Badges/Selos dinâmicos | ✅ |

---

## O que FALTA: Blocos sem compilador

### Fase 1: Alta Prioridade (afetam lojas reais)
| # | Bloco | Complexidade | Descrição |
|---|-------|-------------|-----------|
| 1 | **Newsletter** | Baixa | Form email + submit via hydration |
| 2 | **FAQ** | Baixa | `<details>/<summary>` nativo |
| 3 | **Testimonials** | Baixa | Grid de cards com foto/nome/texto |
| 4 | **YouTubeVideo** | Baixa | Iframe responsivo |
| 5 | **HTMLSection** | Baixa | Pass-through de HTML customizado |
| 6 | **Container** | Baixa | Div com max-width/padding |
| 7 | **Columns + Column** | Baixa | CSS Grid multi-coluna |

### Fase 2: Complementares
| # | Bloco | Complexidade |
|---|-------|-------------|
| 8 | CountdownTimer | Média (JS inline) |
| 9 | VideoCarousel | Média |
| 10 | LogosCarousel | Baixa (marquee) |
| 11 | StatsNumbers | Baixa |
| 12 | Accordion | Baixa |
| 13 | Map | Baixa (iframe) |
| 14 | NewsletterPopup | Média (overlay + timing) |
| 15 | ContentColumns | Baixa |
| 16 | FeatureList | Baixa |
| 17 | StepsTimeline | Baixa |
| 18 | ImageGallery | Baixa |

### Fase 3: Verificações Globais
| # | Item | Status |
|---|------|--------|
| 19 | Pixels de marketing injetados no `<head>` | Verificar |
| 20 | Newsletter Popup config global | Verificar |
| 21 | Consent Banner (LGPD) | Verificar |

### Fase 4: Auditoria Visual
| # | Item |
|---|------|
| 22 | Comparar loja respeiteohomem builder vs público |
| 23 | Corrigir divergências |

### NÃO precisa de compilador edge
| Bloco | Motivo |
|-------|--------|
| CartDemo / CheckoutDemo | SPA-only |
| CustomBlock | Lógica por tenant |
| PersonalizedProducts | Dados de sessão |
| LivePurchases | Realtime/WebSocket |
| PopupModal | Client-side only |
| QuizEmbed / EmbedSocialPost | Embeds externos |
| PricingTable | Admin/landing only |
| TrackingLookup | Já tem página system standalone |
| BlogListing / BlogPostDetail | Já standalone |
| PageContent | Já em institutionalPageToStaticHTML |
| CategoryFilters | Embutido em CategoryPageLayout |
| SocialFeed | API externa client-side |

---

## Dead Code para Remover
- `_shared/block-compiler/blocks/product-page.ts` (confirmado morto)
