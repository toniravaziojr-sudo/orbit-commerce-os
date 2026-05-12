---
name: SPA-Only Route _fbp Seed
description: SPA routes that bypass storefront-html edge MUST rely on ensureFbp() from MarketingTracker.initialize() — never synthesize _fbp elsewhere
type: constraint
---

# SPA-Only Route `_fbp` Seed (v8.33.0)

## Regra
Toda rota servida apenas client-side (SPA), sem passar pelo edge `storefront-html`, depende exclusivamente de `ensureFbp()` em `src/lib/visitorIdentity.ts`, chamado em `MarketingTracker.initialize()`. Esse helper:

1. Respeita `window.__sfFbp` se já semeado pelo edge.
2. Espelha cookie `_fbp` existente para `window.__sfFbp`.
3. Caso ambos ausentes, sintetiza `fb.1.<ms>.<10-digit-rand>` (formato canônico Meta), persiste cookie 90d (`Path=/; SameSite=Lax`) e expõe em `window.__sfFbp`.

## Proibido
- **Nunca** sintetizar `_fbp` em outros pontos do código (criaria IDs concorrentes — quebra dedup Pixel↔CAPI no painel Meta).
- **Nunca** alterar `getEffectiveFbp()` para escrever — ele é read-only por contrato.
- **Nunca** reintroduzir polling de `_fbp` em rotas SPA-only assumindo que o edge HTML semeou — se for SPA-only, o edge não rodou.

## Por que existe
Auditoria 2026-05-12: Purchase ficou em 76% de cobertura `_fbp` pós-v8.32.0 porque `/thank-you` é SPA-only. Clientes que entram direto após redirect de gateway (Mercado Pago) ou em sessões privadas chegavam sem cookie `_fbp` e sem seed do edge. CAPI ia sem `fbp` → EMQ degradado no evento mais crítico.

## Validação
Após qualquer mudança no fluxo de inicialização do tracker ou em rotas SPA-only que disparem eventos Meta, validar:
```sql
SELECT event_name,
  ROUND(100.0*SUM(((event_data->'user_data_keys')?'fbp')::int)/COUNT(*),0) AS fbp_pct
FROM marketing_events_log
WHERE provider='meta' AND created_at >= now() - interval '24 hours'
GROUP BY 1;
```
Critério: Purchase ≥99%, demais eventos ≥95%.

## Doc oficial
`docs/especificacoes/marketing/meta-tracking.md` — seção "Auditoria 2026-05-12 — Gap residual de `_fbp` em Purchase (v8.33.0)".
