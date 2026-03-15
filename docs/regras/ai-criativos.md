# Padrão de Qualidade Criativa — IA

> Versão: 1.0.0
> Última atualização: 2026-03-15
> Status: Track A implementado, Track B documentado (futuro)

---

## 1. Visão Geral

O sistema de geração de criativos por IA (`ai-block-fill-visual`) produz imagens e textos para blocos do builder (Banner, futuro: BannerProducts, TextBanners, etc.).

Este documento define o **padrão de qualidade** que todo criativo gerado deve atender.

---

## 2. Track A — Correções Implementadas (v2.3.0)

### A1. Copy per-slide no Carousel
- **Antes**: Todos os slides usavam contexto do slide 0.
- **Depois**: Cada slide recebe seu próprio contexto (produto/categoria) no prompt.
- **Arquivo**: `supabase/functions/ai-block-fill-visual/index.ts`
- **Como funciona**: `generateTexts` recebe `slideContexts[]` com dados individuais. O prompt lista `SLIDE 1: ...`, `SLIDE 2: ...` etc.

### A2. CTA/Overlay no Compilador Estático do Carousel
- **Antes**: O HTML público do carousel renderizava apenas imagem + dots.
- **Depois**: Renderiza overlay + título + subtítulo + botão por slide (paridade com React `BannerBlock.tsx`).
- **Arquivo**: `supabase/functions/_shared/block-compiler/blocks/banner.ts`

### A3. Fallback de Modelo Melhorado
- **Antes**: `gemini-3-pro-image-preview` → `gemini-2.5-flash-image`
- **Depois**: `gemini-3-pro-image-preview` → `gemini-3.1-flash-image-preview` → `gemini-2.5-flash-image`
- **Arquivo**: `supabase/functions/ai-block-fill-visual/index.ts`

### A4. Prompt de Copy com Tom Contextual
- **Antes**: Um único tom genérico para todos os banners.
- **Depois**: Detecção automática de tom: promocional, premium, categoria, institucional, produto.
- **Função**: `detectCreativeTone()` analisa contexto (preço, compare_at_price, briefing, tipo de associação).
- **Regras adicionadas**:
  - Nunca repetir verbo inicial entre slides
  - CTA específico ao produto (não "Comprar agora" genérico)
  - Variação obrigatória de vocabulário

---

## 3. Padrão Global de Qualidade (Banner)

### 3.1 Critérios de Aprovação

| # | Critério | Regra |
|---|----------|-------|
| 1 | Produto reconhecível | Se vinculado a produto, deve ser visualmente identificável |
| 2 | Enquadramento desktop | Produto no terço direito (~30-40%), safe area escura à esquerda (~60%) |
| 3 | Enquadramento mobile | Produto centro-inferior (~50-60%), safe area escura no topo |
| 4 | Headline | ≤30 chars, verbo de ação ou benefício, nome real do produto |
| 5 | Subtitle | ≤60 chars, complementar, sem repetir headline |
| 6 | CTA | ≤15 chars, ação específica ao contexto |
| 7 | Overlay | ≥35% quando há texto sobre imagem |
| 8 | Sem texto na imagem | Nenhuma letra, número ou logo gerado na imagem |
| 9 | Desktop/Mobile coerentes | Mesmo produto, mesma atmosfera, composição adaptada |
| 10 | Sem fundo chapado | Sempre contextual com profundidade |

### 3.2 Proporções

| Contexto | Proporção | Dimensão |
|----------|-----------|----------|
| Banner Desktop | 21:7 | 1920×700 |
| Banner Mobile | ~750×420 | 750×420 |

### 3.3 Safe Areas

```
DESKTOP (21:7)
┌──────────────────────────────────────────────────────┐
│  ████████████████████████     │                      │
│  █ SAFE AREA TEXTO (60%) █   │  PRODUTO (30-40%)    │
│  █ Gradiente escuro       █  │  Bem iluminado        │
│  █ Overlay ≥ 35%          █  │  Contextual           │
│  ████████████████████████     │                      │
└──────────────────────────────────────────────────────┘

MOBILE (750×420)
┌──────────────────┐
│ ██████████████████│
│ █ SAFE AREA (40%)█│  ← Topo escuro para texto
│ ██████████████████│
│                   │
│    PRODUTO        │  ← Centro-inferior
│    (50-60%)       │
│                   │
└──────────────────┘
```

### 3.4 Tons Criativos (Detecção Automática)

| Tom | Gatilho | Instrução |
|-----|---------|-----------|
| Promocional | Preço com desconto, briefing com "oferta"/"promoção" | Urgência + benefício, destaque preço |
| Premium | Briefing com "premium"/"luxo"/"exclusivo" | Exclusividade + craft |
| Categoria | Associação = categoria | Exploração + variedade |
| Institucional | Sem associação de produto/categoria | Confiança + identidade de marca |
| Produto | Produto vinculado sem indicação de promoção | Benefício + ação direta |

---

## 4. Track B — Padrão Futuro (Não Implementado)

### 4.1 Presets Criativos no Wizard
- `hero-product`, `hero-promo`, `hero-category`, `hero-brand`, `hero-premium`
- Detecção automática pelo backend, sem step adicional no wizard
- **Status**: Apenas documentado, não implementado

### 4.2 Validação Pós-Geração
- Verificação automática de aspecto/resolução
- Retry se artefatos detectados
- Score de qualidade
- **Status**: Futuro

### 4.3 Escalabilidade para Outros Blocos

| Bloco | Proporção | Safe Area | Fase |
|-------|-----------|-----------|------|
| BannerProducts | 16:9 / 4:3 | Centro | Fase 2 |
| TextBanners | 3:4 (retrato) | Inferior | Fase 2 |
| ContentColumns | 1:1 ou 4:3 | Inferior | Fase 3 |
| ImageCarousel | 1:1 | Nenhuma | Fase 3 |
| ImageGallery | Variável | Nenhuma | Fase 3 |

---

## 5. Arquivos Relacionados

| Arquivo | Papel |
|---------|-------|
| `supabase/functions/ai-block-fill-visual/index.ts` | Pipeline de geração (imagem + copy) |
| `supabase/functions/_shared/block-compiler/blocks/banner.ts` | Compilador estático (público) |
| `src/components/builder/blocks/BannerBlock.tsx` | Componente React (builder/preview) |
| `src/hooks/useAIWizardGenerate.ts` | Hook frontend do wizard |
| `src/lib/builder/aiWizardRegistry.ts` | Contratos de geração (frontend) |
