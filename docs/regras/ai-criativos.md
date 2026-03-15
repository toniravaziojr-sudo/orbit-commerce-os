# Padrão de Qualidade Criativa — IA

> Versão: 2.1.0 (Banner v2 — Correção Estrutural)
> Última atualização: 2026-03-15
> Status: Banner v2 implementado + correção de proporções/layout/campanha

---

## 1. Visão Geral

O sistema de geração de criativos por IA (`ai-block-fill-visual`) produz imagens e textos para blocos do builder (Banner, futuro: BannerProducts, TextBanners, etc.).

Este documento define o **padrão de qualidade** que todo criativo gerado deve atender.

---

## 2. Banner v2 — Proporções e Render

### 2.1 Proporções (atualizado v2.0.0)

| Contexto | Proporção | Dimensão Gerada | Aspect Ratio CSS |
|----------|-----------|------------------|------------------|
| Banner Desktop | 12:5 | 1920×800 | `aspect-[12/5]` |
| Banner Mobile | 4:5 | 750×940 | `aspect-[4/5]` |

### 2.2 Arquivos com aspect-ratio

| Arquivo | Classe/Style |
|---------|-------------|
| `BannerBlock.tsx` | `aspect-[4/5] md:aspect-[12/5]` |
| `HeroBannerBlock.tsx` | `aspect-[4/5] md:aspect-[12/5]` |
| `banner.ts` (compiler) | `.sf-banner-auto{aspect-ratio:4/5;}@media(min-width:768px){…12/5}` |
| `hero-banner.ts` (compiler) | `.sf-hero-banner{aspect-ratio:4/5;}@media(min-width:768px){…12/5}` |

### 2.3 Tipografia do Banner (v2.0.0)

| Elemento | React Classes | Compiler Inline |
|----------|---------------|-----------------|
| Headline | `text-4xl md:text-5xl lg:text-6xl` | `clamp(28px,5vw,60px)` |
| Subtitle | `text-xl md:text-2xl` | `clamp(16px,2.5vw,24px)` |
| CTA Button | `px-10 py-4 text-lg` | `padding:16px 40px; font-size:18px` |
| Padding lateral | `px-6 md:px-16` | `padding:24px 64px` |
| Área de texto | `maxWidth: 55%` (quando left/right) | `max-width:55%` |

---

## 3. Track A — Correções Implementadas (v2.3.0)

### A1. Copy per-slide no Carousel
- **Antes**: Todos os slides usavam contexto do slide 0.
- **Depois**: Cada slide recebe seu próprio contexto (produto/categoria) no prompt.

### A2. CTA/Overlay no Compilador Estático do Carousel
- **Antes**: O HTML público do carousel renderizava apenas imagem + dots.
- **Depois**: Renderiza overlay + título + subtítulo + botão por slide.

### A3. Fallback de Modelo Melhorado
- `gemini-3-pro-image-preview` → `gemini-3.1-flash-image-preview` → `gemini-2.5-flash-image`

### A4. Prompt de Copy com Tom Contextual
- Detecção automática de tom: promocional, premium, categoria, institucional, produto.
- Variação obrigatória de vocabulário entre slides.

---

## 4. Banner v2 — Geração Criativa (v2.0.0)

### 4.1 Detecção de Campanha (v2.1.0 — melhorado)

O `buildBannerImagePrompt` detecta automaticamente campanhas sazonais e ofertas no briefing, e agora mapeia cada tema a uma direção visual específica:

| Gatilho | Exemplo | Direção Visual |
|---------|---------|----------------|
| Páscoa | "páscoa", "easter" | Tons dourados, chocolate, ovos decorativos sutis, atmosfera acolhedora |
| Natal | "natal" | Tons vermelho/dourado/verde, luzes bokeh, atmosfera natalina elegante |
| Black Friday | "black friday" | Tons escuros (preto/dourado), contraste dramático, urgência |
| Dia das Mães | "dia das mães" | Tons suaves e sofisticados, flores sutis, atmosfera carinhosa |
| Dia dos Pais | "dia dos pais" | Tons sóbrios (azul marinho/cinza), atmosfera masculina |
| Dia dos Namorados | "dia dos namorados" | Tons românticos (vermelho/rosa dourado), atmosfera íntima |
| Verão/Inverno | "verão", "inverno" | Cores quentes/frias conforme estação |
| Oferta/desconto | "35% off", "desconto", "promoção" | Atmosfera de urgência, iluminação dramática |
| Ambos | "Páscoa até 35% OFF" | Cenário temático + urgência |

### 4.1.1 Regras de Seção/Layout (v2.1.0)

- **Seções**: Default de padding mudado de 32/16 para 0/0 (React + compilador)
- **Motivo**: Blocos como Banner precisam encostar no header sem espaço indesejado
- **Controle**: Usuário pode ajustar padding manualmente pela UI do builder
- **Impacto**: Afeta React (`SectionBlock.tsx`) e compilador (`section.ts`)

### 4.2 Composição Obrigatória

```
DESKTOP (12:5 — 1920×800)
┌──────────────────────────────────────────────────────┐
│  ████████████████████████████     │                   │
│  █ SAFE AREA TEXTO (60-70%) █    │  PRODUTO (≤30%)   │
│  █ Gradiente escuro natural  █   │  Bem iluminado     │
│  █ Overlay ≥ 35%             █   │  Contextual        │
│  █ Headline + Subtitle + CTA █   │  Proporcionado     │
│  ████████████████████████████     │                   │
└──────────────────────────────────────────────────────┘

MOBILE (4:5 — 750×940)
┌──────────────────┐
│ ██████████████████│
│ █ SAFE AREA (35%)█│  ← Topo escuro: headline + subtitle
│ ██████████████████│
│                   │
│    PRODUTO        │  ← Centro (≤40% da altura)
│    Proporcionado  │
│                   │
│ ██████████████████│
│ █ CTA AREA       █│  ← Base: botão
│ ██████████████████│
└──────────────────┘
```

### 4.3 Briefing como Direção Criativa Primária

Quando o usuário fornece briefing (ex: "Banners para campanha de páscoa com até 35% de desconto"):
- **Imagem**: O cenário reflete o tema da campanha (elementos visuais temáticos sutis)
- **Copy**: A headline ou subtitle DEVE conter a informação de oferta/campanha
- **CTA**: Deve ser específico ao contexto da campanha

### 4.4 Regras de Enquadramento do Produto

| Regra | Desktop | Mobile |
|-------|---------|--------|
| Largura/altura máxima do produto | ≤30% da largura | ≤40% da altura |
| Posição | Terço direito | Centro vertical |
| Corte | Nunca cortado | Nunca cortado |
| Proporção | Integrado ao cenário | Integrado ao cenário |

---

## 5. Padrão Global de Qualidade (Banner)

### 5.1 Critérios de Aprovação

| # | Critério | Regra |
|---|----------|-------|
| 1 | Produto reconhecível | Se vinculado a produto, deve ser visualmente identificável |
| 2 | Enquadramento desktop | Produto no terço direito (≤30%), safe area escura à esquerda (≥60%) |
| 3 | Enquadramento mobile | Produto centro (≤40% altura), safe area escura no topo |
| 4 | Headline | ≤30 chars, verbo de ação ou benefício, nome real do produto |
| 5 | Subtitle | ≤60 chars, complementar, sem repetir headline |
| 6 | CTA | ≤15 chars, ação específica ao contexto |
| 7 | Overlay | ≥35% quando há texto sobre imagem |
| 8 | Sem texto na imagem | Nenhuma letra, número ou logo gerado na imagem |
| 9 | Desktop/Mobile coerentes | Mesmo produto, mesma atmosfera, composição adaptada |
| 10 | Banner = peça comercial | Deve parecer campanha real, não foto de catálogo |

### 5.2 Tons Criativos (Detecção Automática)

| Tom | Gatilho | Instrução |
|-----|---------|-----------|
| Promocional | Preço com desconto, briefing com "oferta"/"promoção" | Urgência + benefício, destaque preço |
| Premium | Briefing com "premium"/"luxo"/"exclusivo" | Exclusividade + craft |
| Categoria | Associação = categoria | Exploração + variedade |
| Institucional | Sem associação de produto/categoria | Confiança + identidade de marca |
| Produto | Produto vinculado sem indicação de promoção | Benefício + ação direta |

---

## 6. Track B — Padrão Futuro (Não Implementado)

### 6.1 Presets Criativos no Wizard
- `hero-product`, `hero-promo`, `hero-category`, `hero-brand`, `hero-premium`
- **Status**: Apenas documentado, não implementado

### 6.2 Validação Pós-Geração
- Verificação automática de aspecto/resolução
- **Status**: Futuro

### 6.3 Escalabilidade para Outros Blocos

| Bloco | Proporção | Safe Area | Fase |
|-------|-----------|-----------|------|
| BannerProducts | 16:9 / 4:3 | Centro | Fase 2 |
| TextBanners | 3:4 (retrato) | Inferior | Fase 2 |
| ContentColumns | 1:1 ou 4:3 | Inferior | Fase 3 |
| ImageCarousel | 1:1 | Nenhuma | Fase 3 |
| ImageGallery | Variável | Nenhuma | Fase 3 |

---

## 7. Arquivos Relacionados

| Arquivo | Papel |
|---------|-------|
| `supabase/functions/ai-block-fill-visual/index.ts` | Pipeline de geração (imagem + copy) |
| `supabase/functions/_shared/block-compiler/blocks/banner.ts` | Compilador estático Banner (público) |
| `supabase/functions/_shared/block-compiler/blocks/hero-banner.ts` | Compilador estático HeroBanner (público) |
| `src/components/builder/blocks/BannerBlock.tsx` | Componente React Banner (builder/preview) |
| `src/components/builder/blocks/HeroBannerBlock.tsx` | Componente React HeroBanner (builder/preview) |
| `src/hooks/useAIWizardGenerate.ts` | Hook frontend do wizard |
| `src/lib/builder/aiWizardRegistry.ts` | Contratos de geração (frontend) |
