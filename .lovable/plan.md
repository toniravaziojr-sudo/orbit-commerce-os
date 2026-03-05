

# Plano V8.0 — Variation Engine (Execução Final)

## Estado Atual do Código

O sistema V7.1 gera **sempre a mesma estrutura**: `buildBaseSchema()` (linha 351 do generate) empilha seções em ordem fixa (Hero → Benefits → Testimonials → SocialProof → Pricing → FAQ → Guarantee → CTA). Cada seção tem 1 layout. O `visualStyle` é quase sempre `premium` (dark/gold). O `sceneVibe` no enhance-images tem 6 nichos mas todos seguem o mesmo padrão de prompt. O asset resolver busca social proof por `filename.ilike` com filtros frágeis.

---

## Fase A — Templates + Variants + Preflight (80% do impacto)

### 1. Schema: novos campos com retrocompatibilidade

**Arquivo**: `src/lib/landing-page-schema.ts`

- `version` aceita `'7.0' | '8.0'` (não quebra LPs antigas)
- Novos campos opcionais no `LPSchema`: `templateId?: string`, `mood?: string`, `variantSeed?: number`
- Defaults quando ausentes: `templateId = 'direct_offer'`, `mood = 'premium'`, `variantSeed = 0`
- `variant` já existe no tipo `LPSection` — sem mudança

### 2. Templates de narrativa (6 receitas)

**Arquivo**: `supabase/functions/ai-landing-page-generate/index.ts`

Nova função `selectTemplate(seed, hasReviews, hasSocialProof)` que retorna um dos 6 templates com **pesos por disponibilidade de dados**:

| Template | Seções | Peso base |
|----------|--------|-----------|
| `direct_offer` | Hero, Pricing, Benefits, Testimonials*, FAQ, CTA | 20 |
| `proof_first` | Hero, SocialProof*, Testimonials*, Pricing, Guarantee, CTA | 15 (0 se sem provas) |
| `problem_solution` | Hero, Benefits, Testimonials*, Pricing, Guarantee, FAQ, CTA | 20 |
| `routine` | Hero, Benefits, SocialProof*, Pricing, FAQ, CTA | 15 |
| `comparison` | Hero, Benefits, Pricing, Testimonials*, FAQ, CTA | 15 |
| `minimal_premium` | Hero, Benefits, Pricing, Guarantee, FAQ, CTA | 15 |

Regras:
- Template que depende de SocialProof/Testimonials tem peso 0 se dados insuficientes
- Seed determina escolha (reprodutível)
- Hero + Pricing + CTA obrigatórios em todos

Refatorar `buildBaseSchema()` para montar `sections[]` conforme template selecionado em vez da ordem fixa.

### 3. Variantes de layout por seção

Cada bloco recebe `variant` via seed. O `LPSchemaRenderer.tsx` passa `section.variant` como prop.

| Seção | Variantes | Mudança no componente |
|-------|-----------|----------------------|
| **Hero** | `split_right` (atual), `centered`, `glass_overlay` | `LPHero.tsx`: switch com 3 layouts |
| **Benefits** | `alternating_rows` (atual), `grid_cards`, `icon_list` | `LPBenefits.tsx`: switch com 3 layouts |
| **Testimonials** | `cards` (atual), `quote_wall` | `LPTestimonials.tsx`: switch com 2 layouts |
| **Pricing** | `horizontal_3col` (atual), `single_highlight` | `LPPricing.tsx`: switch com 2 layouts |

Regra de contrato: **nenhuma variant exige campo extra** — todas usam os mesmos props.

Regra de preflight:
- Benefits sem imageUrl válido → forçar `icon_list`
- FAQ com < 3 items → não incluir seção
- Guarantee sem copy → não incluir seção

### 4. Alternância de contraste entre seções

No `buildBaseSchema()`, ao montar as seções, alternar o fundo:
- Seção ímpar: `var(--lp-bg)`
- Seção par: `var(--lp-bg-alt)`

Isso já acontece parcialmente no Benefits (linha 21), mas deve ser sistemático.

### 5. Seed persistido

- `variantSeed = Math.floor(Math.random() * 100000)` na criação
- Salvar no schema
- Usar para `selectTemplate()` e atribuição de variants
- "Gerar variação" = novo seed

---

## Fase B — Moods visuais (fontes + cores)

### 6. Moods com gating por nicho

**Arquivos**: `ai-landing-page-generate/index.ts` + `landing-page-schema.ts`

5 moods com presets de fontes/cores, gated por nicho do produto:

| Mood | Heading | Body | Quando usar |
|------|---------|------|-------------|
| `luxury` | Playfair Display | Inter | Cosmético, perfume, joias |
| `bold` | Bebas Neue | Archivo | Suplemento, fitness, energia |
| `organic` | Lora | Montserrat | Skincare, saúde, natural |
| `corporate` | Plus Jakarta Sans | Plus Jakarta Sans | Tech, serviços |
| `minimal` | Sora | Inter | Genérico, clean |

Performance: max 2 famílias, 2 weights, `font-display: swap`.

Nova `selectMood(niche, seed)` no generate que determina mood e aplica presets de cor/fonte no `colorScheme`.

### 7. Scene prompts diversificados

**Arquivo**: `ai-landing-page-enhance-images/index.ts`

Pool de `sceneVibe` por mood no `buildCompositionPrompt()`:
- `luxury`: ["marble vanity", "velvet backdrop", "glass studio"]
- `bold`: ["concrete gym", "neon studio", "dark dramatic"]
- `organic`: ["wood table with herbs", "sunlit garden", "bamboo surface"]

Seleção via seed da LP para reprodutibilidade.

---

## Fase C — Fix do Drive (reviews/social proof)

### 8. Asset resolver robusto

**Arquivo**: `supabase/functions/_shared/landing-page-asset-resolver.ts`

O filtro atual (linha 100) usa `filename.ilike.%feedback%` que é frágil. Correção:
- Buscar TODAS as pastas do tenant que contêm imagens
- Priorizar pastas com nomes relevantes (feedback, review, prova, resultado, depoimento)
- Fallback: buscar imagens diretamente na raiz do Drive
- Logar claramente quantas pastas e imagens encontradas
- Se `socialProofImages.length === 0`, logar warning explícito

---

## Arquivos afetados

| Arquivo | Fase | Mudança |
|---------|------|---------|
| `src/lib/landing-page-schema.ts` | A+B | Version aceita 7.0/8.0, campos opcionais, moods nos presets |
| `supabase/functions/ai-landing-page-generate/index.ts` | A+B | selectTemplate, selectMood, seed, refatorar buildBaseSchema, preflight |
| `supabase/functions/ai-landing-page-enhance-images/index.ts` | B | Scene prompt por mood |
| `supabase/functions/_shared/landing-page-asset-resolver.ts` | C | Busca ampla de pastas |
| `src/components/landing-pages/LPSchemaRenderer.tsx` | A | Passar variant para blocos |
| `src/components/landing-pages/blocks/LPHero.tsx` | A | 3 variantes (split/centered/glass) |
| `src/components/landing-pages/blocks/LPBenefits.tsx` | A | 3 variantes (alternating/grid/icon_list) |
| `src/components/landing-pages/blocks/LPTestimonials.tsx` | A | 2 variantes (cards/quote_wall) |
| `src/components/landing-pages/blocks/LPPricing.tsx` | A | 2 variantes (3col/single_highlight) |

---

## Critérios de aceite

1. 10 gerações do mesmo produto geram pelo menos 4 templateIds diferentes e 3 combinações de variants
2. LPs V7.0 antigas continuam renderizando sem erro (retrocompatibilidade)
3. Nenhuma seção vazia ou com placeholder cinza
4. Benefits sem imagem usa `icon_list` automaticamente
5. Produto sempre visível no Hero/CTA (packshot overlay V4.1)
6. Fontes limitadas a 2 famílias por página
7. Reviews do Drive aparecem quando existem (log de debug)

