---
name: Meta Tracking — Paridade do cofre _sf_identity entre tracker React e snippets do edge
description: Qualquer novo ponto de disparo CAPI fora do tracker React (snippet inline, edge function emissora direta, rota SSR nova) DEVE mesclar o cofre _sf_identity hashado antes de enviar — espelhando marketingTracker.ts sendServerEvent.
type: constraint
---

## Regra

Todo despachante de eventos CAPI à Meta — Pixel + Conversions API — DEVE mesclar o cofre persistente `_sf_identity` (localStorage, TTL 30d, mantido por `src/lib/visitorIdentity.ts`) no `user_data` antes do envio. Isso inclui, sem exceção:

- Tracker React (`src/lib/marketingTracker.ts` → `sendServerEvent`) — já cumpre.
- Snippet inline `_sfCapi` emitido por `supabase/functions/storefront-html/index.ts` — passou a cumprir em v8.35.0 via helper `_sfGetIdentity()`.
- Qualquer nova edge function que emita CAPI direto.
- Qualquer nova rota SSR ou snippet inline novo.

## Campos a mesclar (apenas hashes prontos, NUNCA plaintext)

`email_hashed`, `phone_hashed`, `first_name_hashed`, `last_name_hashed`, `city_hashed`, `state_hashed`, `zip_hashed`, `country_hashed`, `date_of_birth_hashed`, `gender_hashed`.

Adicionalmente: `customer_id` deve compor `external_id` como array `[visitor_id, customer_id]` quando ambos presentes; `lead_id` deve entrar em `custom_data.lead_id` quando ausente.

## Regra de precedência

Campos explícitos do caller (`ud` no snippet, `payload.user_data` no tracker) **sempre vencem**. O cofre só completa o que estiver faltando — nunca sobrescreve.

## Por que existe

Entre v8.28.0 e v8.34.0 o cofre `_sf_identity` era populado e o tracker React mesclava corretamente, mas o snippet inline do edge HTML (que dispara PageView/ViewCategory/ViewContent/AddToCart/InitiateCheckout antes do React carregar em loja SSR) ignorava o cofre. Resultado: 0% de cobertura de nome/cidade/UF/CEP nesses eventos mesmo para visitantes recorrentes, derrubando o EMQ de topo de funil para 5.8–6.7 quando deveria estar 7.5–8.5. Gap silencioso de ~4 ondas.

## Proibições

- **Proibido enviar PII em plaintext do navegador para esses campos.** Hashing acontece exclusivamente em `src/lib/visitorIdentity.ts` antes de gravar no cofre.
- **Proibido replicar a lógica de hash em outro lugar.** Único ponto de SHA-256 PII = `visitorIdentity.ts`.
- **Proibido sintetizar `_fbp` em ponto novo.** Só `_sfEnsureFbp` no edge e `ensureFbp()` no client (v8.33.0).
- **Proibido criar IDs concorrentes para `external_id` ou `customer_id`** — vêm exclusivamente do cofre.

## Validação obrigatória pós-mudança

Toda alteração no compiler/edge HTML que envolva emissão CAPI:
1. Deploy do edge.
2. `UPDATE storefront_prerendered_pages SET status='stale' WHERE status='active'` — reemitir HTML com snippet novo.
3. Aguardar 24-48h de tráfego e conferir cobertura de `first_name_hashed`/`city_hashed`/`zip_hashed` em `marketing_events_log` para eventos de topo do tenant alvo.
4. Janela de 7 dias para EMQ refletir no Events Manager.

## Doc-mãe

`docs/especificacoes/marketing/meta-tracking.md` — seção "Auditoria 2026-06-01 — Onda 7 (v8.35.0)".
