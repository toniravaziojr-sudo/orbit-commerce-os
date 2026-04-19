---
name: purchase-event-emission-rules
description: Regras invioláveis para emissão e dedup do evento Purchase (Meta Pixel + CAPI). Persistência 30d, event_id determinístico normalizado, soberania do tenant sobre purchaseEventTiming, leitura correta de inflação aparente vs real.
type: constraint
---

# Regras de Emissão do Evento Purchase

## Regra 1 — Persistência 30d obrigatória (anti re-fire)
O dedup do Purchase no navegador DEVE usar `localStorage` com TTL de 30 dias. Chave: `sf_purchase_fired_<tenant>_<order>`. Memória de aba (`useRef`) não basta — reabrir o link de obrigado, refresh, back-button ou compartilhar URL re-disparariam o evento.

Implementação canônica: `src/lib/purchaseDedup.ts` (`hasPurchaseAlreadyFired`, `markPurchaseAsFired`, `cleanupExpiredPurchaseDedup`).

## Regra 2 — `event_id` em formato único e normalizado
Browser e servidor DEVEM produzir o mesmo `event_id` byte-a-byte. Formato:
`purchase_<mode>_<order_id_normalizado>` onde mode ∈ {created, paid} e order_id_normalizado = só `[a-z0-9]` em lowercase.

Implementações canônicas:
- Browser: `src/lib/marketingTracker.ts` → `generateDeterministicPurchaseEventId`
- Server: `supabase/functions/_shared/purchase-event-id.ts` → `buildDeterministicPurchaseEventId`

Qualquer divergência quebra dedup Pixel↔CAPI no painel da Meta.

## Regra 3 — `purchaseEventTiming` é soberania do tenant
Os valores `all_orders` e `paid_only` em `store_settings.checkout_config.purchaseEventTiming` são decisão de negócio do dono da loja. **Proibido** alterar sem autorização explícita do tenant. Não propor "mudar para paid_only para reduzir falsos positivos" — sob `all_orders`, contar pedidos PIX expirados é comportamento por design.

## Regra 4 — Antes de declarar inflação, conferir BRT e dedup
Antes de afirmar "inflação de Purchase", validar:
1. Janela em fuso `America/Sao_Paulo` (não UTC).
2. Painel da Meta deduplicação Pixel+CAPI: 1 pedido sob `all_orders` produz 2 eventos no log bruto (browser + server) que contam como **1 conversão** no painel.
3. Re-fires antigos no log podem ser pré-correção (v8.27.0). Eventos novos respeitam dedup persistente.

## Doc formal de referência
`docs/especificacoes/marketing/meta-tracking.md` — seção "Regras de Emissão do Evento Purchase".
