

## Plano Consolidado: Upgrade Completo do Gerador de Landing Pages com IA

Este plano unifica as duas frentes anteriores em uma implementação única.

---

### Frente 1: Reescrever o System Prompt com Design System + Contexto do Negócio

**Arquivo:** `supabase/functions/ai-landing-page-generate/index.ts`

**1.1 — Trocar modelo** (linha 264)
- De `google/gemini-2.5-flash` para `google/gemini-2.5-pro`

**1.2 — Buscar dados adicionais do negócio** (após linha 73, novas queries)
- `product_reviews`: Buscar reviews dos `productIds` selecionados (limite 10, ordenados por rating DESC). Dados: `reviewer_name`, `rating`, `comment`.
- `creative_contents`: Buscar últimos 5 criativos aprovados do tenant. Dados: `title`, `content_text`, `tone`, `headline`.
- Injetar esses dados como seções no system prompt:
  - `## AVALIAÇÕES REAIS DE CLIENTES (USE COMO PROVA SOCIAL):`
  - `## REFERÊNCIAS DE MARKETING (TOM, ESTILO E HEADLINES):`

**1.3 — Reescrever o system prompt** (linhas 189-247)

Substituir o prompt genérico por um prompt com Design System completo contendo:

- **Tipografia obrigatória**: Google Fonts (Inter/Poppins corpo, Playfair Display/Sora headlines), escala tipográfica (hero 48-64px, h2 32-40px, body 16-18px), letter-spacing para headings
- **Layout e Espaçamento**: max-width 1200px, padding vertical 80-120px entre seções, grid com gaps 32-48px
- **Componentes visuais**: Cards com border-radius 16px e sombras multicamada, badges/pills para destaques, ícones SVG inline, divisores visuais (waves/gradients), botões com hover transitions
- **Animações CSS**: `@keyframes` para fade-in, hover scale/shadow em cards e CTAs, pulse/glow nos CTAs principais
- **Responsividade**: Mobile-first com breakpoints em 768px e 1024px, grid 3-col → 2-col → 1-col
- **Estrutura obrigatória**: Sticky header fino → Hero full-width → Barra de confiança → Benefícios grid → Problema/Solução → Social proof → Comparativo → Oferta com preço → FAQ accordion → CTA final → Footer mínimo
- **CSS base injetado**: Reset + design tokens incluídos no prompt como snippet CSS obrigatório

---

### Frente 2: Toggle Header/Footer nas Landing Pages IA

**2.1 — Migration SQL**
- Adicionar 2 colunas em `ai_landing_pages`:
  - `show_header boolean DEFAULT true`
  - `show_footer boolean DEFAULT true`

**2.2 — Editor (LandingPageEditor.tsx, aba Config)**
- Adicionar 2 switches entre a seção SEO e a seção Informações:
  - "Exibir Cabeçalho da Loja" → salva `show_header`
  - "Exibir Rodapé da Loja" → salva `show_footer`
- Incluir esses campos no `saveSeoMutation` existente

**2.3 — Renderização pública (StorefrontAILandingPage.tsx)**
- Buscar `show_header` e `show_footer` junto com os dados da landing page
- Se `show_header === true`, renderizar `StorefrontHeader` acima do iframe (com os providers necessários: CartProvider, DiscountProvider)
- Se `show_footer === true`, renderizar `StorefrontFooter` abaixo do iframe
- Importar os componentes e providers existentes

---

### Frente 3: Verificar Toggle Header/Footer no Builder

O sistema **já suporta** toggles de Header/Footer no Builder via `usePageOverrides` + `HeaderFooterPropsEditor`. O `pageType` já aceita `'landing_page'` e `'institutional'` (linha 42 do `HeaderFooterPropsEditor.tsx`). O `PublicTemplateRenderer` já lê `headerEnabled`/`footerEnabled` dos overrides.

**Ação:** Apenas verificar que o fluxo funciona end-to-end para páginas do tipo `landing_page` no Builder. Se necessário, ajuste mínimo.

---

### Resumo das Alterações

| Arquivo | Alteração |
|---|---|
| `supabase/functions/ai-landing-page-generate/index.ts` | Design system no prompt + buscar reviews/criativos + modelo pro |
| `ai_landing_pages` (migration) | +2 colunas: `show_header`, `show_footer` |
| `src/pages/LandingPageEditor.tsx` | +2 switches na aba Config |
| `src/pages/storefront/StorefrontAILandingPage.tsx` | Renderizar header/footer condicionalmente |

