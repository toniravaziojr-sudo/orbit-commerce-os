

## Plano de Unificação de Blocos do Builder

**Objetivo:** Reduzir de ~55 blocos registrados para ~42, unificando blocos com funcionalidade redundante em blocos versáteis com prop `mode`/`layout`, seguindo o padrão já estabelecido na unificação do Banner (Hero+HeroBanner → Banner com `mode: single|carousel`).

---

### Inventário atual: 55 blocos

**Não tocáveis (25 blocos):** Layout (Page, Section, Container, Columns, Divider, Spacer), Header/Footer, PageContent, Button, Image, Banner, CategoryBanner, CategoryPageLayout, ProductDetails, ProductCard, Cart, CartSummary, Checkout, CheckoutSteps, ThankYou, AccountHub, OrdersList, OrderDetail, TrackingLookup, BlogListing.

**Candidatos à unificação (30 blocos → ~17):**

---

### Unificação 1 — Vitrine de Produtos (4 → 1)
**Blocos atuais:** `ProductGrid`, `ProductCarousel`, `CollectionSection`, `FeaturedProducts`
**Bloco unificado:** `ProductShowcase`
- Prop `source`: `featured` | `newest` | `all` | `category` | `manual`
- Prop `layout`: `grid` | `carousel`
- Quando `source=manual`, exibe seletor de produtos (hoje no FeaturedProducts)
- Quando `source=category`, exibe seletor de categoria (hoje no CollectionSection)
- Props comuns: `title`, `limit`, `columnsDesktop`, `columnsMobile`, `showPrice`, `showButton`
- **Impacto:** 4 componentes React, 4 compiladores Edge, BlockRenderer, registry. Aliases de compatibilidade para templates existentes.

### Unificação 2 — Categorias (2 → 1)
**Blocos atuais:** `CategoryList`, `FeaturedCategories`
**Bloco unificado:** `CategoryShowcase`
- Prop `style`: `cards` (cards grandes, atual CategoryList) | `circles` (circular, atual FeaturedCategories)
- Prop `source`: `auto` | `parent` | `custom`
- Prop `layout`: `grid` | `list` | `carousel`
- **Impacto:** 2 componentes, 2 compiladores, BlockRenderer, registry.

### Unificação 3 — Depoimentos / Avaliações (2 → 1)
**Blocos atuais:** `Testimonials`, `Reviews`
**Bloco unificado:** `SocialProof`
- Prop `mode`: `testimonials` | `reviews`
- No modo `reviews`, exibe rating com estrelas e campos de produto
- No modo `testimonials`, exibe nome+role+texto
- Props comuns: `title`, `items`, `visibleCount`
- **Impacto:** 2 componentes, 2 compiladores.

### Unificação 4 — Newsletter (3 → 1)
**Blocos atuais:** `Newsletter`, `NewsletterForm`, `PopupModal`
**Bloco unificado:** `Newsletter` (mantém o nome)
- Prop `mode`: `inline` | `form` | `popup`
- `inline`: layout atual do Newsletter (horizontal/vertical/card, só email)
- `form`: layout do NewsletterForm (com nome, telefone, data nascimento, vinculado a lista)
- `popup`: layout do PopupModal (trigger por delay/scroll/exit-intent)
- **Nota:** `NewsletterPopup` permanece separado pois tem lógica específica de trigger + frequência + vinculação a lista. Avaliar fusão posterior.
- **Impacto:** 3 componentes, 3 compiladores.

### Unificação 5 — Vídeo (2 → 1)
**Blocos atuais:** `YouTubeVideo`, `VideoUpload`
**Bloco unificado:** `Video`
- Prop `source`: `youtube` | `upload`
- YouTube: mostra campo URL
- Upload: mostra campos de upload (desktop/mobile) + controles (autoplay, loop, muted)
- Props comuns: `title`, `aspectRatio`, `widthPreset`
- `VideoCarousel` permanece separado (múltiplos vídeos, lógica distinta)
- **Impacto:** 2 componentes, 2 compiladores.

### Unificação 6 — Código Custom (2 → 1)
**Blocos atuais:** `CustomBlock`, `HTMLSection`
**Bloco unificado:** `CustomCode`
- Prop `source`: `inline` | `database`
- `inline`: HTML/CSS direto (atual HTMLSection)
- `database`: busca do `custom_blocks` por ID (atual CustomBlock)
- Ambos já usam `IsolatedCustomBlock` (iframe) para CSS isolation
- **Impacto:** 2 componentes (já compartilham CustomBlockRenderer), 2 compiladores.

### Unificação 7 — Lista de Benefícios (2 → 1)
**Blocos atuais:** `FeatureList`, `InfoHighlights`
**Bloco unificado:** `Highlights`
- Prop `style`: `list` (vertical com ícones, atual FeatureList) | `bar` (horizontal compacto, atual InfoHighlights)
- Props comuns: `items[]` (icon+title+description), `iconColor`, `textColor`, `backgroundColor`
- FeatureList tem `showButton` e `subtitle` — mantidos como opcionais
- **Impacto:** 2 componentes, 2 compiladores.

### Unificação 8 — Texto + Imagem (2 → 1)
**Blocos atuais:** `ContentColumns`, `TextBanners`
**Bloco unificado:** `ContentSection`
- Prop `style`: `content` (1 imagem + texto + features, atual ContentColumns) | `editorial` (2 imagens + texto, atual TextBanners)
- Props comuns: `title`, `subtitle`, `imageDesktop`, `imageMobile`, CTA
- **Impacto:** 2 componentes, 2 compiladores.

---

### Resultado

| Métrica | Antes | Depois | Redução |
|---|---|---|---|
| Total de blocos | 55 | 42 | -13 blocos |
| Blocos de produto | 4 | 1 | -3 |
| Blocos de categoria | 2 | 1 | -1 |
| Blocos de newsletter | 3 | 1 | -2 |
| Blocos de vídeo | 3 | 2 | -1 |
| Blocos de depoimentos | 2 | 1 | -1 |
| Blocos de código | 2 | 1 | -1 |
| Blocos de benefícios | 2 | 1 | -1 |
| Blocos de texto+imagem | 2 | 1 | -1 |

---

### Estratégia de migração (aplica-se a todas as unificações)

1. **Alias no BlockRenderer:** Mapear tipos antigos para o componente unificado com normalização de props automática
2. **Compilador Edge:** Manter compiladores antigos como wrappers que normalizam props e delegam ao novo compilador
3. **Registry:** Remover blocos antigos, registrar bloco unificado. Não quebra templates salvos pois o BlockRenderer trata aliases
4. **Ordem de execução:** Uma unificação por vez, começando pelas de menor risco (6 e 7) e terminando pela mais complexa (1)

### Ordem de prioridade sugerida

1. **CustomCode** (Unificação 6) — menor risco, já compartilham componente
2. **Highlights** (Unificação 7) — componentes simples, sem estado
3. **Video** (Unificação 5) — 2 blocos, lógica clara
4. **SocialProof** (Unificação 3) — 2 blocos, similar
5. **ContentSection** (Unificação 8) — 2 blocos, layout
6. **Newsletter** (Unificação 4) — 3 blocos, mais complexo
7. **CategoryShowcase** (Unificação 2) — dados dinâmicos
8. **ProductShowcase** (Unificação 1) — mais complexo, core do e-commerce

---

### Detalhes Técnicos

Cada unificação segue o padrão modular já documentado:
```text
src/components/builder/blocks/{block-name}/
  ├── types.ts          (interfaces e props)
  ├── helpers.ts         (lógica pura)
  ├── {Mode}Layout.tsx   (layout por modo)
  └── {Block}Block.tsx   (orquestrador)
```

Arquivos impactados por unificação:
- `src/lib/builder/registry.ts` (remover antigos, registrar novo)
- `src/components/builder/BlockRenderer.tsx` (aliases + novo componente)
- `supabase/functions/_shared/block-compiler/` (compiladores Edge)
- `src/components/builder/blocks/` (componentes React)

