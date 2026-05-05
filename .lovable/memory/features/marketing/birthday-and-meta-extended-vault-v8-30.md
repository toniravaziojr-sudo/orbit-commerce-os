---
name: birthday-and-meta-extended-vault-v8-30
description: Coleta opcional de data de nascimento (checkout, popup, footer, bloco newsletter), cofre _sf_identity estendido (db_hash/ge_hash/lead_id/customer_id), 4 quick wins Meta CAPI, audience-sync-weekly v1.2.0 enriquecido, gatilho diário de aniversário.
type: feature
---

# Data de Nascimento + Meta CAPI v8.30 + Aniversário

## Captura de data de nascimento (opcional, controlada por toggle)

Pontos de coleta:
- **Checkout** — Builder > Tema > Página Checkout > "Pedir data de nascimento" (`requestBirthDate` + `birthDateRequired`).
- **Footer Newsletter** — Builder > Tema > Rodapé > Newsletter > "Pedir data de nascimento" (`newsletterShowBirthDate` + `newsletterBirthDateRequired`).
- **Bloco Newsletter Form** — props `showBirthDate` / `birthDateRequired`.
- **Popup Newsletter** — props `showBirthDate` / `birthDateRequired`.

Validação universal: idade ≥13 e ≤120 anos.

Persistência:
- `checkout_sessions.customer_birth_date` (DATE)
- `orders.customer_birth_date` (DATE)
- `customers.birth_date` (DATE — preenchido na primeira ocorrência via política de enriquecimento)
- Cofre `_sf_identity.db_hash` (SHA-256 do `YYYYMMDD`)
- Índice `idx_customers_birthday_mmdd` por `to_char(birth_date, 'MM-DD')`

## Cofre _sf_identity v8.30 — campos novos

- `db_hash` — SHA-256 de YYYYMMDD
- `ge_hash` — SHA-256 de m/f
- `lead_id` — UUID gerado em `trackLead`, replicado em Purchase via `custom_data`
- `customer_id` — quando logado, usado em `external_id` array

## 4 Quick Wins Meta CAPI

1. `external_id` como array `[sf_vid, customer_id]` em todos os eventos (quando customer logado).
2. `predicted_ltv = value × 1.8` em Purchase.
3. `delivery_category: 'home_delivery'` em AddToCart, InitiateCheckout, AddShippingInfo, AddPaymentInfo, Purchase.
4. `lead_id` propagado em `custom_data` de Lead e Purchase.

EMQ esperado pós-v8.30: Lead ≥9.3, Purchase ≥9.5.

## audience-sync-weekly v1.2.0

LEFT JOIN com `customers` por email/telefone. Envia hashado SHA-256:
- Meta: EMAIL, PHONE, FN, LN, CT, ST, ZIP, COUNTRY, DOBY, DOBM, DOBD, GEN
- Google Ads: hashedEmail, hashedPhoneNumber, hashedFirstName, hashedLastName, ZIP, countryCode

Schema multi-key dinâmico (envia apenas chaves preenchidas).

## Gatilho diário de aniversário

- Edge `birthday-daily-trigger` agendada via pg_cron (Job 52) — `0 11 * * *` (08:00 BRT).
- Varre `customers WHERE to_char(birth_date,'MM-DD') = today_brt`.
- Enfileira eventos `customer.birthday` em `events_inbox` com idempotência diária (`birthday_<customer_id>_<YYYYMMDD>`).
- `process-events` mapeia `rule_type='customer_birthday'` → `customer.birthday`.
- UI: `RuleTypeSelector` mostra opção "Aniversário"; e-mail marketing pode usar como gatilho de fluxo.

## Docs canônicos
- `docs/especificacoes/marketing/meta-tracking.md` (Técnica 7)
- `docs/especificacoes/marketing/audience-sync-weekly.md` (v1.2.0)
- `docs/especificacoes/storefront/checkout.md`
- `docs/especificacoes/storefront/footer.md`
- `docs/especificacoes/marketing/email-marketing.md`

## Anti-regressão
- `db_hash` e `ge_hash` NUNCA podem ser enviados em texto puro do browser. Hashing exclusivo em `src/lib/visitorIdentity.ts`.
- Campo `customer_birth_date` nunca pode ser obrigatório por default — sempre opcional, controlado pelo lojista.
- Toggle de obrigatoriedade só é respeitado quando `requestBirthDate=true` (resp. `newsletterShowBirthDate`).
