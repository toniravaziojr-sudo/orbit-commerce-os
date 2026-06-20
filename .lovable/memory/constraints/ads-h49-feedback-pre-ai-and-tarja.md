---
name: Ads H.4.9 — Feedback é aprendizado antes da IA + tarja humana
description: Gravação de aprendizado a partir de feedback inline (copy/imagem) acontece SEMPRE antes da chamada de IA, com title humano e metadata padronizada. UI mostra tarja "Feedback de Título/Texto/Descrição/Copy/Imagem — Produto".
type: constraint
---

# Regra (Onda H.4.9 — 2026-06-20)

Complementa H.4.6 sem revogar. Foco: garantir que NENHUM feedback do
lojista seja perdido por falha/timeout/saída vazia da IA, e que o card
de Aprendizado seja humanamente legível.

## Gravação universal de feedback (backend)
- `ads-creative-inline-generate` (`regen_copy_field`, `regen_image`) e
  `ads-creative-revise` (`regenerate_copy`, `regenerate_image`) DEVEM
  gravar o aprendizado em `ads_ai_learnings` IMEDIATAMENTE após
  validar feedback ≥5 chars e resolver o briefing/produto — ANTES de
  chamar a IA/gerador.
- Vale também quando o produto não é resolvido: gravar com
  `metadata.product_resolved=false` para não perder a direção do
  lojista. Não duplicar gravação pós-sucesso.
- Title canônico:
  - Copy: `Feedback de {Título|Texto|Descrição|Copy} — {Produto|"anúncio"}`
  - Imagem: `Feedback de Imagem — {Produto|"anúncio"}`
- Metadata obrigatória: `subtype` (`creative_copy_feedback` |
  `creative_image_feedback`), `product_name` (ou null),
  e para copy: `field` (`headline|primary_text|description|copy`) +
  `field_label_pt`. `before` (estado anterior) quando aplicável.

## UI (`AdsAILearningsTab`)
- Quando `metadata.subtype` ∈ {`creative_copy_feedback`,
  `creative_image_feedback`}, renderizar tarja colorida ANTES dos
  badges de status/categoria, no formato:
  `Feedback de {Título|Texto|Descrição|Copy|Imagem} — {Produto}`.
- Tarja não substitui badges de status/categoria — adiciona.

## Proibições
- Gravar aprendizado APENAS após sucesso da IA (regressão da H.4.6).
- Title técnico do tipo "Campo headline do anúncio #1 regenerado".
- Esconder ou esconder atrás de toggle a origem `user_feedback`.
- Duplicar gravação (antes + depois) para o mesmo feedback.

## Implementação
- Edges: `supabase/functions/ads-creative-inline-generate/index.ts`,
  `supabase/functions/ads-creative-revise/index.ts`.
- UI: `src/components/ads/AdsAILearningsTab.tsx` + `useAdsAILearnings`
  (expõe `metadata`).
