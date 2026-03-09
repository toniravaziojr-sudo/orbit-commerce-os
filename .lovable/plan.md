

# Resumo Completo do Plano de Implementação

---

## Status Atual

| Categoria | Quantidade | Status |
|-----------|------------|--------|
| **Compiladores Edge prontos** | 19 blocos + 3 standalone | ✅ Funcional |
| **Bugs críticos pendentes** | 4 | 🔴 Urgente |
| **Blocos sem compilador** | 23 | 📋 Backlog |
| **Páginas SPA-only** | 4 (Carrinho, Checkout, Obrigado, Conta) | ✅ Não precisa edge |

---

## FASE 0: Bugs Críticos (Urgente)

| # | Bug | Diagnóstico | Correção |
|---|-----|-------------|----------|
| 1 | ~~Botão "Adicionar ao Carrinho" não funciona~~ | Propagação de clique | ✅ CORRIGIDO |
| 2 | **Banner de categoria não renderiza** | Template customizado pode omitir `CategoryBanner` | Injetar automaticamente no `storefront-html` quando `banner_desktop_url` existir |
| 3 | **Galeria de imagens estática** | JS de hidratação (swipe/dots) não executa | Verificar e corrigir script `sf-gallery-track` |
| 4 | **Produtos relacionados não herdam configurações** | Cards usam estilos hardcoded | Refatorar para usar `categorySettings` (showRatings, showBadges, quickBuy) |
| 5 | **Botões CTA da página de produto** | Dependem de hidratação JS | Verificar execução de `data-sf-action` handlers |

---

## FASE 1-5: Compiladores Pendentes (23 blocos)

| Fase | Blocos | Prioridade |
|------|--------|------------|
| **Fase 1** | Container, Columns, Column, Grid | Layout base |
| **Fase 2** | Newsletter, FAQ, Testimonials, Accordion | Alta conversão |
| **Fase 3** | YouTubeVideo, VideoCarousel, HTMLSection, ImageGallery | Mídia |
| **Fase 4** | CountdownTimer, LogosCarousel, StatsNumbers, ContentColumns, FeatureList, StepsTimeline, TextBanners | Marketing |
| **Fase 5** | ProductGrid, ProductCarousel, CategoryList, CollectionSection, BannerProducts | E-commerce avançado |

---

## FASE 6: Verificações Globais

1. **Pixels de Marketing** — Confirmar injeção no `<head>` (Google Analytics, Meta Pixel, etc.)
2. **Newsletter Popup** — Verificar carregamento lazy no público
3. **Consent Banner (LGPD)** — Verificar exibição

---

## FASE 7: Auditoria e Centralização

| Item | Problema | Solução |
|------|----------|---------|
| **Sistema de Cores** | Duplicação em 3 lugares (Builder hook, React injector, Edge inline) | Criar arquivo único de design tokens compartilhado |
| **Frete Grátis** | Lógica duplicada entre React hooks e Edge Function | Centralizar cálculo em único ponto de verdade |
| **Divergências Visuais** | Builder vs Público podem ter diferenças | Auditoria visual completa com tenant `respeiteohomem` |

---

## Cleanup

- Remover dead code: `_shared/block-compiler/blocks/product-page.ts`

---

## Ordem de Execução Recomendada

```
1. Fase 0 → Corrigir bugs críticos (banner, galeria, relacionados, CTAs)
2. Fase 1 → Layout (Container, Columns, Grid)
3. Fase 2 → Interativos (Newsletter, FAQ)
4. Fases 3-5 → Demais blocos
5. Fase 6 → Injeções globais
6. Fase 7 → Auditoria final
```

