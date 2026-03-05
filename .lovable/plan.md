

# Plano: MVP do Gerador de Landing Pages Premium

## Diagnóstico do Problema

O sistema atual gera landing pages que parecem todas iguais porque:

1. **Os componentes React (LPHero, LPBenefits, LPPricing, etc.) compartilham o mesmo DNA visual** — variantes como `split_right` vs `centered` vs `glass_overlay` são rearranjos do mesmo design system pobre
2. **Não existem "templates premium curados"** — o sistema combina seções genéricas em ordens diferentes, mas o visual de cada seção é idêntico
3. **O chat de ajustes regenera o schema inteiro** via IA em vez de aplicar patches cirúrgicos em tokens/conteúdo
4. **Falta a arquitetura híbrida** — Hero e CTA Final precisam de designs dedicados por template, não de variantes cosméticas

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────┐
│              10 TEMPLATE MASTERS                │
│  Cada um define:                                │
│  ├── HeroTemplate (componente React dedicado)   │
│  ├── CtaFinalTemplate (componente dedicado)      │
│  ├── Seções do meio via schema editável         │
│  ├── Design tokens (cores, fonts, spacing)      │
│  └── Mood lock (quais moods são permitidos)     │
├─────────────────────────────────────────────────┤
│              PIPELINE DE GERAÇÃO                │
│  1. IA extrai cores do produto (já existe)      │
│  2. Seleciona template + mood (seed-based)      │
│  3. Monta schema com templateId → Hero/CTA      │
│     dedicados + seções do meio editáveis        │
│  4. Enhance images (já existe)                  │
├─────────────────────────────────────────────────┤
│              CHAT DE AJUSTES                    │
│  IA classifica intent → aplica JSON Patch:      │
│  ├── "mude CTA" → patch em section.props       │
│  ├── "mais premium" → troca mood/tokens         │
│  ├── "troque template" → swap templateId        │
│  └── Histórico + rollback (já existe)           │
└─────────────────────────────────────────────────┘
```

## Fases de Implementação

### Fase 1 — 10 Templates Premium (Hero + CTA dedicados)

Criar 10 componentes Hero e 10 CTA Final com designs visualmente distintos. Cada template terá identidade própria.

**Arquivo: `src/lib/landing-page-templates-registry.ts`**
- Registry com os 10 templates: `luxury_editorial`, `bold_impact`, `minimal_zen`, `organic_nature`, `corporate_trust`, `neon_energy`, `warm_artisan`, `tech_gradient`, `classic_elegant`, `urban_street`
- Cada entry define: `heroComponent`, `ctaComponent`, `allowedMoods`, `defaultTokens`

**Arquivo: `src/components/landing-pages/heroes/`** (nova pasta)
- 10 componentes Hero dedicados, cada um com design radicalmente diferente:
  - `HeroLuxuryEditorial` — tipografia gigante serif, packshot flutuante com sombra dramática, fundo escuro com glow dourado
  - `HeroBoldImpact` — Bebas Neue enorme, fundo com diagonal cortada, produto com drop-shadow colorido
  - `HeroMinimalZen` — muito espaço negativo, tipografia fina, produto centralizado pequeno
  - `HeroOrganicNature` — formas orgânicas (border-radius irregulares), tons terrosos
  - `HeroCorporateTrust` — grid estruturado, badges de confiança, tipografia sem-serif pesada
  - `HeroNeonEnergy` — fundo escuro com glows neon, bordas luminosas, tipografia condensada
  - `HeroWarmArtisan` — textura de papel, tipografia manuscrita + serif, tons quentes
  - `HeroTechGradient` — gradientes mesh vibrantes, tipografia geométrica, glassmorphism pesado
  - `HeroClassicElegant` — composição editorial tipo revista, serifada, muito espaço, linha decorativa
  - `HeroUrbanStreet` — fonte bold grotesque, elementos gráficos diagonais, alto contraste

**Arquivo: `src/components/landing-pages/ctas/`** (nova pasta)
- 10 componentes CTA Final correspondentes, cada um mantendo a identidade visual do seu Hero

**Alteração: `src/components/landing-pages/LPSchemaRenderer.tsx`**
- O renderer lê `schema.templateId` e renderiza o Hero/CTA do template correspondente
- Seções do meio (Benefits, Pricing, FAQ, Testimonials, Guarantee, SocialProof) continuam usando os componentes existentes (que já têm variantes)

### Fase 2 — Design Tokens por Template

**Arquivo: `src/lib/landing-page-template-tokens.ts`**
- Cada template define tokens padrão: `borderRadius`, `cardStyle`, `shadowIntensity`, `spacing`, `overlayType`, `accentGlow`
- Os tokens são injetados como CSS variables extras (`--lp-radius`, `--lp-glow-intensity`, etc.)
- As seções do meio consomem esses tokens para se adaptar ao estilo do template

**Alteração: `src/components/landing-pages/LPSchemaRenderer.tsx`**
- Adicionar injeção de tokens do template como CSS variables no container root

### Fase 3 — Atualizar Edge Function de Geração

**Alteração: `supabase/functions/ai-landing-page-generate/index.ts`**
- Expandir `TEMPLATES` de 6 receitas de narrativa para 10 templates premium
- Cada template mapeia para o `templateId` do registry
- `selectTemplate()` usa seed para escolher entre os 10, com diversidade garantida (min 6 diferentes para 10 gerações)
- Mood selection fica atrelada ao template (`allowedMoods`)
- Color scheme adapta-se ao template (tokens padrão do template + cores extraídas do produto)

### Fase 4 — Chat de Ajustes por Patch

**Alteração: `supabase/functions/ai-landing-page-generate/index.ts`** (fluxo `adjustment`)
- Para `promptType: 'adjustment'`, em vez de regenerar o schema completo, a IA recebe o schema atual + o pedido do usuário
- A IA retorna um JSON Patch (RFC 6902) ou objeto de mudanças parciais
- Tipos de ajuste suportados:
  - **Conteúdo**: muda texto de headline, CTA, FAQ, etc.
  - **Tokens**: muda cores, fonts, radius
  - **Template swap**: troca `templateId` (Hero/CTA mudam, seções do meio se adaptam)
  - **Mood swap**: troca mood (fonts + color scheme recalculados)
  - **Seção add/remove**: adiciona ou remove seções do meio
- Histórico e rollback já existem via `ai_landing_page_versions`

### Fase 5 — Schema v9.0

**Alteração: `src/lib/landing-page-schema.ts`**
- Adicionar campo `designTokens` ao schema (radius, glow, spacing overrides)
- Expandir `LPTemplateId` para os 10 novos templates
- Manter backward compat com v7.0/v8.0

## Detalhes Técnicos

### Cada Hero Premium terá:
- Tipografia com `clamp()` para responsividade
- Produto como overlay CSS (nunca redesenhado por IA)
- Efeitos visuais únicos (glow, gradientes, texturas, sombras)
- Min-height 100vh com composição editorial
- Animações de entrada (`lp-hero-title-enter`)
- Responsivo mobile-first

### Critérios de aceite:
- 10 gerações do mesmo produto → minimo 6 templates visualmente distintos
- Chat altera template/tokens/copy sem quebrar
- Produto nunca desaparece
- Max 2 famílias de fonte / 2 weights por página
- Sem placeholders ou seções vazias

### Arquivos afetados:
- `src/lib/landing-page-templates-registry.ts` (novo)
- `src/lib/landing-page-template-tokens.ts` (novo)
- `src/components/landing-pages/heroes/*.tsx` (10 novos)
- `src/components/landing-pages/ctas/*.tsx` (10 novos)
- `src/components/landing-pages/LPSchemaRenderer.tsx` (modificado)
- `src/lib/landing-page-schema.ts` (modificado)
- `supabase/functions/ai-landing-page-generate/index.ts` (modificado)
- `src/styles/lp-animations.css` (tokens adicionais)

### Estimativa: ~25 arquivos, implementação em 5-6 mensagens sequenciais

