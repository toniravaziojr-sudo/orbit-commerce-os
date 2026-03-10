# Sistema de Cores — Regras e Especificações

> **Status:** ✅ Produção (v2.1 — Fases 1–5 concluídas e validadas)

## Fonte Única de Verdade

| Item | Localização |
|------|-------------|
| Tipagem canônica | `ThemeColors` em `src/hooks/useThemeSettings.ts` |
| Defaults | `DEFAULT_THEME_COLORS` em `src/hooks/useThemeSettings.ts` |
| Pipeline CSS (React) | `src/lib/storefront-theme-utils.ts` |
| Pipeline CSS (Edge) | `supabase/functions/_shared/theme-tokens.ts` |
| Injetor SPA público | `src/components/storefront/StorefrontThemeInjector.tsx` |
| Injetor Builder preview | `src/hooks/useBuilderThemeInjector.ts` |
| Gerador CSS público | `getStorefrontThemeCss()` em `src/hooks/usePublicThemeSettings.ts` |
| Page overrides | `src/components/storefront/PageColorsInjector.tsx` + `src/hooks/usePageColors.ts` |

> **[REMOVIDO]** `src/contexts/ThemeContext.tsx` — tipo `ThemeColors` legado, `useStorefrontTheme()`, `getThemeCssVariables()`, `ThemeProvider`. Deletado na Fase 1 (zero consumidores).

---

## Propriedades do Tema (20 tokens)

| Grupo | Propriedade | CSS Variable | Fallback |
|-------|-------------|--------------|----------|
| Botão Primário | `buttonPrimaryBg` | `--theme-button-primary-bg` | `#1a1a1a` |
| | `buttonPrimaryText` | `--theme-button-primary-text` | `#ffffff` |
| | `buttonPrimaryHover` | `--theme-button-primary-hover` | `#333333` |
| Botão Secundário | `buttonSecondaryBg` | `--theme-button-secondary-bg` | `#e5e5e5` |
| | `buttonSecondaryText` | `--theme-button-secondary-text` | `#1a1a1a` |
| | `buttonSecondaryHover` | `--theme-button-secondary-hover` | `#d5d5d5` |
| WhatsApp | `whatsappColor` | `--theme-whatsapp-color` | `#25D366` |
| | `whatsappHover` | `--theme-whatsapp-hover` | `#128C7E` |
| Textos | `textPrimary` | `--theme-text-primary` | `#1a1a1a` |
| | `textSecondary` | `--theme-text-secondary` | `#666666` |
| Preço | `priceColor` | `--theme-price-color` | herda `textPrimary` |
| Accent | `accentColor` | `--theme-accent-color` | `#22c55e` |
| Tags | `successBg/Text` | `--theme-success-bg/text` | herda accent / `#ffffff` |
| | `warningBg/Text` | `--theme-warning-bg/text` | `#f97316` / `#ffffff` |
| | `dangerBg/Text` | `--theme-danger-bg/text` | `#ef4444` / `#ffffff` |
| | `highlightBg/Text` | `--theme-highlight-bg/text` | `#3b82f6` / `#ffffff` |

---

## Pipeline de Injeção (3 camadas)

```
┌─────────────────────────────────────────────────────────┐
│  1. GLOBAL — Tema da Loja                               │
│  Gerado por: generateColorCssVars() + generateButton*   │
│  Injetado via:                                          │
│    Builder → useBuilderThemeInjector.ts                  │
│    SPA     → StorefrontThemeInjector.tsx                 │
│    Edge    → storefront-html (inline <style>)           │
├─────────────────────────────────────────────────────────┤
│  2. ZONA — Header / Footer / NoticeBar                  │
│  Configs próprias (footerBgColor, headerBg, etc.)       │
│  Aplicadas via inline style nos componentes de zona     │
│  Override autorizado — não é sistema paralelo           │
├─────────────────────────────────────────────────────────┤
│  3. CONTEXTO/PÁGINA — Carrinho / Checkout               │
│  pageSettings.cart.buttonPrimaryBg, etc.                │
│  Injetado via PageColorsInjector.tsx                    │
│  Sobrescreve vars globais quando preenchido             │
└─────────────────────────────────────────────────────────┘
```

---

## Hierarquia de Precedência (Fase 2 — sem !important)

| Nível | Escopo | Mecanismo | Especificidade |
|-------|--------|-----------|---------------|
| 1 (base) | Tema Global | CSS vars + regras em `.storefront-container` | 0,2,0+ |
| 2 | Zona Estrutural | Inline styles em Header/Footer/NoticeBar | — (inline) |
| 3 | Página/Contexto | CSS vars redefinidas em `.sf-page-cart` / `.sf-page-checkout` | 0,3,0+ |
| 4 | Estado | `:hover`, `:active`, `:disabled` nos seletores | +pseudo |

### Classes de Página

O container principal recebe automaticamente a classe `sf-page-{type}`:
- `.sf-page-cart` — via `PublicTemplateRenderer` (pageType="cart")
- `.sf-page-checkout` — via `StorefrontCheckout.tsx` (hardcoded)
- `.sf-page-home`, `.sf-page-category`, `.sf-page-product`, etc.

Isso permite que overrides de página vençam regras globais **por especificidade natural**, sem `!important`.

---

## Mecanismo de Aplicação de Cores de Texto

### SPA (React)

O `getStorefrontThemeCss()` e `useBuilderThemeInjector` aplicam cores de texto em 3 níveis:

1. **Override de Tailwind vars** — dentro de `.storefront-container`:
   - `--foreground` → HSL de `textPrimary` (afeta `text-foreground`)
   - `--muted-foreground` → HSL de `textSecondary` (afeta `text-muted-foreground`)
   - `--primary` → HSL de `buttonPrimaryBg`
   - `--primary-foreground` → HSL de `buttonPrimaryText`

2. **Color base** — `color: var(--theme-text-primary, #1a1a1a)` no `.storefront-container`

3. **Classes semânticas** — via `generateTextColorCssRules()`:
   - `.sf-price-color` → `var(--theme-price-color)`
   - `.sf-text-secondary` → `var(--theme-text-secondary)`

### Edge (SSR)

O `generateThemeCss()` aplica `color: var(--theme-text-primary, #1a1a1a)` no `body`. Blocos Edge usam `var(--theme-text-secondary, #666)` para textos secundários via inline style com fallback.

### Conversão Hex → HSL

A função `hexToHslValues()` em `storefront-theme-utils.ts` converte cores hex para formato HSL sem wrapper (`"H S% L%"`) para uso em CSS variables do Tailwind.

---

## Padrões de Consumo (Contrato)

### ✅ Permitido
- Classes semânticas: `.sf-btn-primary`, `.sf-btn-secondary`, `.sf-btn-outline-primary`, `.sf-btn-outline-secondary`
- Classes de cor: `.sf-price-color`, `.sf-accent-icon`, `.sf-accent-bg`, `.sf-accent-text`, `.sf-accent-border`
- Classes de texto: `.sf-text-secondary`
- Classes de tag: `.sf-tag-success`, `.sf-tag-warning`, `.sf-tag-danger`, `.sf-tag-highlight`
- Classes de flag: `.sf-checkout-flag`, `.sf-flag-text`
- Tailwind semântico: `text-foreground`, `text-muted-foreground` (overridden pelo tema)
- CSS vars com fallback: `style={{ color: 'var(--theme-accent-color, #22c55e)' }}`
- CSS vars de texto: `var(--theme-text-primary, #1a1a1a)`, `var(--theme-text-secondary, #666)`
- Inline styles para overrides de zona: `style={{ backgroundColor: footerBgColor }}`
- `color: inherit` em elementos que devem herdar do parent

### ❌ Proibido
- Tailwind arbitrary hex: `bg-[#1a1a1a]`, `text-[#fff]`
- Hex hardcoded sem var(): `style={{ color: '#22c55e' }}`, `style="color:#666"`
- Criar CSS vars fora do pipeline central
- Usar `!important` como solução estrutural (Fase 2)
- Importar de `ThemeContext.tsx` (deletado)

---

## Mapeamento de Botões por Contexto

### Cor Primária (`sf-btn-primary` → `--theme-button-primary-bg/text/hover`)

| Contexto | Botão | Componente SPA | Compilador Edge |
|----------|-------|----------------|-----------------|
| Product Card | "Comprar agora" | `ProductCard.tsx` | `product-card-html.ts` / `featured-products.ts` |
| Página Produto | "Comprar agora" | `ProductCTAs.tsx` | `product-details.ts` |
| Carrinho | "Finalizar" / "Iniciar Compra" | `CartSummary.tsx` | `storefront-html/index.ts` |
| Checkout | "Continuar" / "Finalizar Pedido" | `CheckoutStepWizard.tsx` | — (SPA only) |
| Checkout | "Copiar código do boleto" | `PaymentResult.tsx` | — (SPA only) |
| Builder | Bloco de Botão (variante primary) | `ButtonBlock.tsx` | `button.ts` |

### Cor Secundária (`sf-btn-secondary` → `--theme-button-secondary-bg/text/hover`)

| Contexto | Botão | Componente SPA | Compilador Edge |
|----------|-------|----------------|-----------------|
| Página Produto | "Adicionar ao carrinho" | `ProductCTAs.tsx` | `product-details.ts` |
| Carrinho | "Continuar comprando" / "Ir para o Carrinho" | `CartSummary.tsx` | `storefront-html/index.ts` |
| Builder | Bloco de Botão (variante secondary) | `ButtonBlock.tsx` | `button.ts` |

### Outline Primary (`sf-btn-outline-primary`)

| Contexto | Botão | Componente SPA | Compilador Edge |
|----------|-------|----------------|-----------------|
| Product Card | "Adicionar" (ícone carrinho) | `ProductCard.tsx` | `product-card-html.ts` |
| Produtos Relacionados | "Adicionar" | `ProductCard.tsx` | `product-details.ts` |

### WhatsApp (`--theme-whatsapp-color/hover`)

| Contexto | Botão | Componente SPA | Compilador Edge |
|----------|-------|----------------|-----------------|
| Página Produto | "Comprar pelo WhatsApp" | `ProductCTAs.tsx` | `product-details.ts` |

> **Nota:** Product Cards com `customButtonBgColor` definido pelo lojista usam inline styles, bypassando as classes semânticas.

---

## Mapeamento de Cores de Texto por Contexto

### Texto Primário (`--theme-text-primary`)

| Contexto | Elemento | Mecanismo SPA | Mecanismo Edge |
|----------|----------|---------------|----------------|
| Todos os blocos | Títulos (h1-h6) | `color: inherit` via `.storefront-container` | `color: inherit` via `body` |
| Todos os blocos | Texto do corpo | `text-foreground` (Tailwind override) | `color: inherit` via `body` |
| Info Highlights | Texto do item | `text-foreground` | `var(--theme-text-primary, #1f2937)` |
| Product Details | Breadcrumbs, nome, rating | `text-foreground` | `var(--theme-text-primary, #1a1a1a)` |

### Texto Secundário (`--theme-text-secondary`)

| Contexto | Elemento | Mecanismo SPA | Mecanismo Edge |
|----------|----------|---------------|----------------|
| Todos os blocos | Subtítulos | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Testimonials | Texto do depoimento | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Testimonials | Cargo/role | `text-muted-foreground` | `var(--theme-text-secondary, #888)` |
| FAQ/Accordion | Resposta/conteúdo | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Stats Numbers | Label do stat | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Steps Timeline | Descrição do passo | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Feature List | Subtítulo | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Content Columns | Subtítulo | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Newsletter | Subtítulo, disclaimer | `text-muted-foreground` | `var(--theme-text-secondary, #666/999)` |
| Text Banners | Texto descritivo | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Logos Carousel | Subtítulo | `text-muted-foreground` | `var(--theme-text-secondary, #666)` |
| Reviews | Texto da review | `text-muted-foreground` | `var(--theme-text-secondary, #6b7280)` |
| Blog | Data, excerpts | `text-muted-foreground` | `var(--theme-text-secondary, #999)` |
| Image Gallery | Subtítulo | `text-muted-foreground` | `var(--theme-text-secondary, #888)` |
| Image Carousel | Caption | `text-muted-foreground` | `var(--theme-text-secondary, #6b7280)` |
| Video Carousel | Contador | `text-muted-foreground` | `var(--theme-text-secondary, #888)` |
| Collection Section | "Ver todos" link | `text-muted-foreground` | `var(--theme-text-secondary, #888)` |
| Info Highlights | Descrição do item | `text-muted-foreground` | `var(--theme-text-secondary, #6b7280)` |

### Preço (`--theme-price-color`)

| Contexto | Elemento | Mecanismo SPA | Mecanismo Edge |
|----------|----------|---------------|----------------|
| Product Card | Preço | `.sf-price-color` | `.sf-price-color` |
| Product Details | Preço | `.sf-price-color` | `.sf-price-color` |

---

## Blocos com Cores Customizáveis (Não Usam Tema Global)

Estes blocos possuem props de cor próprias (`backgroundColor`, `textColor`, `accentColor`, etc.) que sobrescrevem os tokens do tema quando definidas pelo lojista:

| Bloco | Props de Cor | Comportamento |
|-------|-------------|---------------|
| `ButtonBlock` | `backgroundColor`, `textColor`, `borderColor`, `hoverBgColor`, `hoverTextColor` | Inline style override |
| `CountdownTimer` | `backgroundColor`, `textColor`, `accentColor` | Inline style override total |
| `FeatureList` | `iconColor`, `textColor` | Fallback para `--theme-accent-color` (ícone) |
| `ContentColumns` | `iconColor`, `textColor` | Fallback para `--theme-accent-color` (ícone) |
| `StatsNumbers` | `accentColor`, `textColor` | Fallback para `--theme-button-primary-bg` (números) |
| `StepsTimeline` | `accentColor` | Fallback para `--theme-button-primary-bg` (círculos) |
| `InfoHighlights` | `iconColor`, `textColor` | Fallback para `--theme-text-primary` |
| `Newsletter` | `backgroundColor`, `textColor`, `buttonBgColor`, `buttonTextColor` | Fallback para `--theme-button-primary-bg/text` |
| `TextBanners` | `ctaBgColor`, `ctaTextColor` | Botão usa `sf-btn-primary` quando vazio |

**Regra:** Se a prop de cor estiver **vazia/não definida**, o bloco DEVE herdar do tema global via `var(--theme-*)`, `inherit`, ou classes Tailwind semânticas (`text-foreground`, `text-muted-foreground`).

---

## Overrides Autorizados por Zona

| Zona | Fonte da Config | Escopo |
|------|----------------|--------|
| Header | `headerConfig` (published_content) | Inline no componente |
| NoticeBar | `noticeBarConfig` | Inline no componente |
| Footer | `footerConfig` | Inline no componente |
| Carrinho | `pageSettings.cart` | `PageColorsInjector` |
| Checkout | `pageSettings.checkout` | `PageColorsInjector` |

Zonas que **não** possuem override: páginas de produto, categoria, blog, institucionais — usam tema global.

---

## Funções e Hooks

| Função | Localização | Descrição |
|--------|-------------|-----------|
| `hexToHslValues()` | `storefront-theme-utils.ts` | Converte hex (#RRGGBB) para formato HSL sem wrapper ("H S% L%") para Tailwind |
| `generateColorCssVars()` | `storefront-theme-utils.ts` / `theme-tokens.ts` | Gera array de CSS var declarations a partir de ThemeColors |
| `generateButtonCssRules()` | `storefront-theme-utils.ts` / `theme-tokens.ts` | Gera regras CSS para `.sf-btn-*` (primary, secondary, outline) |
| `generateTextColorCssRules()` | `storefront-theme-utils.ts` | Gera regras para `.sf-price-color` e `.sf-text-secondary` |
| `generateAccentAndTagCssRules()` | `storefront-theme-utils.ts` | Gera regras para `.sf-accent-*` e `.sf-tag-*` |
| `generateThemeCss()` | `theme-tokens.ts` | Gera CSS completo para Edge HTML (vars + body + headings) |
| `getStorefrontThemeCss()` | `usePublicThemeSettings.ts` | Gera CSS completo para SPA (vars + Tailwind overrides + regras) |
| `getPageColorsCss()` | `usePageColors.ts` | Gera CSS de override por página (cart/checkout) |
| `useBuilderThemeInjector()` | `useBuilderThemeInjector.ts` | Hook que injeta CSS no builder preview (draft > saved) |
| `usePublicThemeSettings()` | `usePublicThemeSettings.ts` | Hook que lê themeSettings publicados (bootstrap > query) |

---

## Pendências

- [x] ~~Fase 1: Remover tipo legado ThemeContext.tsx~~
- [x] ~~Fase 2: Remover dependência de `!important` em `storefront-theme-utils.ts`, `usePageColors.ts` e `theme-tokens.ts`~~
- [x] ~~Fase 2: Implementar hierarquia CSS por especificidade controlada via `.sf-page-*`~~
- [x] ~~Fase 3: Reorganizar UI admin em grupos visuais (Accordion: Cores Globais / Botões e Estados / Tags e Badges)~~
- [x] ~~Fase 4: Corrigir paridade Edge — "Adicionar ao carrinho" em product-details de `sf-btn-outline-primary` para `sf-btn-secondary`~~
- [x] ~~Fase 4: Corrigir mini-cart Edge — "Ir para o Carrinho" de hardcoded para `sf-btn-secondary`~~
- [x] ~~Fase 4: Adicionar `sf-btn-outline-secondary` ao Edge `theme-tokens.ts`~~
- [x] ~~Fase 5: Substituir cores de texto hardcoded por `var(--theme-text-secondary)` em TODOS os compiladores Edge~~
- [x] ~~Fase 5: Override de `--foreground` e `--muted-foreground` no `.storefront-container` para integração Tailwind~~
- [x] ~~Fase 5: Documentar mapeamento completo de cores de texto por contexto/bloco~~

### Blocos Edge Corrigidos na Fase 5

| Bloco | Arquivo | Cor Corrigida |
|-------|---------|---------------|
| Testimonials | `testimonials.ts` | body `#666` → `var(--theme-text-secondary)`, role `#888` → `var(--theme-text-secondary)` |
| Feature List | `feature-list.ts` | subtitle `#666` → `var(--theme-text-secondary)` |
| Stats Numbers | `stats-numbers.ts` | subtitle `#666` → `var(--theme-text-secondary)`, label default `#666` → `var(--theme-text-secondary)` |
| Steps Timeline | `steps-timeline.ts` | subtitle `#666` → `var(--theme-text-secondary)`, description `#666` → `var(--theme-text-secondary)` |
| FAQ | `faq.ts` | answer `#666` → `var(--theme-text-secondary)` |
| Accordion | `accordion.ts` | content `#666` → `var(--theme-text-secondary)`, subtitle `#888` → `var(--theme-text-secondary)` |
| Newsletter | `newsletter.ts` | subtitle `#666` → `var(--theme-text-secondary)`, disclaimer `#999` → `var(--theme-text-secondary)` |
| Content Columns | `content-columns.ts` | subtitle `#666` → `var(--theme-text-secondary)` |
| Info Highlights | `info-highlights.ts` | icon `#1a1a1a` → `var(--theme-text-primary)`, text `#1f2937` → `var(--theme-text-primary)`, desc `#6b7280` → `var(--theme-text-secondary)` |
| Text Banners | `text-banners.ts` | text `#666` → `var(--theme-text-secondary)` |
| Logos Carousel | `logos-carousel.ts` | subtitle `#666` → `var(--theme-text-secondary)` |
| Reviews | `reviews.ts` | body `#6b7280` → `var(--theme-text-secondary)`, product name `#6b7280` → `var(--theme-text-secondary)` |
| Blog | `blog.ts` | date `#999` → `var(--theme-text-secondary)`, empty `#999` → `var(--theme-text-secondary)` |
| Image Gallery | `image-gallery.ts` | subtitle `#888` → `var(--theme-text-secondary)` |
| Image Carousel | `image-carousel.ts` | caption `#6b7280` → `var(--theme-text-secondary)` |
| Video Carousel | `video-carousel.ts` | counter `#888` → `var(--theme-text-secondary)` |
| Collection Section | `collection-section.ts` | "Ver todos" `#888` → `var(--theme-text-secondary)` |
