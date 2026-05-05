---
name: meta-capi-full-coverage-v8-31
description: Cobertura completa Meta Pixel + CAPI a partir de v8.31.0 — passthrough total custom_data, delivery_category em todos eventos de conversão, predicted_ltv, order_status, paridade ViewContent
type: feature
---

# Meta Pixel + CAPI — Cobertura Máxima (v8.31.0)

A partir de **v8.31.0**, o pipeline Meta envia **todos os parâmetros recomendados** pela documentação oficial em ambos canais (Pixel browser + CAPI server):

## Pixel browser (`src/lib/marketingTracker.ts`)
- **ViewContent / AddToCart / InitiateCheckout / Purchase**: emitem `delivery_category: 'home_delivery'` (Meta usa para EMQ).
- **ViewContent**: passou a emitir `contents[]` com `item_price` (paridade com demais eventos de catálogo).
- **Purchase**: emite `order_id` no Pixel (já fazia no CAPI).

## CAPI server (`marketing-capi-track`)
- **Allowlist de `custom_data` REMOVIDA** — passthrough completo. Aceita qualquer parâmetro Meta-padrão sem precisar atualizar o edge function.
- **Purchase** adiciona automaticamente `order_status='completed'` (recomendado pela Meta para conversões finalizadas).
- `predicted_ltv = value × 1.8` continua sendo calculado em Purchase.
- `external_id` continua como **array** quando há tanto visitor_id quanto customer_id.

## Cofre `_sf_identity` (mantido v8.28.0+)
Todo evento subsequente a Lead/AddShipping/AddPayment/Purchase enriquece `user_data` com PII pré-hashada do cofre (em, ph, fn, ln, ct, st, zp, country, db, ge), sem persistir plaintext.

## Regra
Qualquer novo parâmetro Meta-padrão pode ser adicionado direto em `src/lib/marketingTracker.ts` (browser) sem tocar no edge — o passthrough é automático. **Não recriar allowlist em `marketing-capi-track`**.

## Doc formal
`docs/especificacoes/marketing/meta-tracking.md` — entrada **v8.31.0** no Versionamento.
