# Plano — Data de nascimento + enriquecimento Meta + gatilhos de aniversário

## ✅ Concluído (v8.30.0 — 2026-05-05)

### Captura
- Migração: `customer_birth_date` em `checkout_sessions` e `orders`; índice `idx_customers_birthday_mmdd`.
- Toggles no Builder: Checkout (`requestBirthDate`/`birthDateRequired`), Footer Newsletter (`newsletterShowBirthDate`/`newsletterBirthDateRequired`), Bloco Newsletter Form e Popup (`showBirthDate`/`birthDateRequired`).
- UI Step 1 do checkout com `DatePickerField` e validação 13-120 anos.
- Footer Newsletter com `DatePickerField` e envio para `marketing-form-submit`.

### Cofre `_sf_identity` v8.30 + 4 quick wins Meta
- Novos campos no cofre: `db_hash`, `ge_hash`, `lead_id`, `customer_id`.
- `external_id` como array `[sf_vid, customer_id]` em todos os eventos.
- `predicted_ltv = value × 1.8` em Purchase.
- `delivery_category: 'home_delivery'` em AddToCart, InitiateCheckout, AddShippingInfo, AddPaymentInfo, Purchase.
- `lead_id` UUID gerado em Lead, propagado em Purchase via `custom_data`.
- Backend `meta-capi-sender.ts` aceita `date_of_birth_hashed` e `gender_hashed`.

### Audience Sync Weekly v1.2.0
- LEFT JOIN com `customers` por email/telefone normalizado.
- Envio hashado SHA-256: Meta (FN, LN, CT, ST, ZIP, COUNTRY, DOBY, DOBM, DOBD, GEN) e Google Ads (FN, LN, ZIP, COUNTRY).
- Schema multi-key dinâmico (apenas chaves preenchidas).

### Aniversário (gatilho diário)
- Edge `birthday-daily-trigger` + pg_cron Job 52 (`0 11 * * *` UTC = 08:00 BRT).
- Enfileira eventos `customer.birthday` com idempotência diária.
- `process-events` mapeia `rule_type='customer_birthday'` → `customer.birthday`.
- UI: opção "Aniversário" em `RuleTypeSelector` (Notificações E-mail + WhatsApp) e tipo de gatilho em fluxos de E-mail Marketing.

### Documentação
- `meta-tracking.md` v8.30.0 — Técnica 7 + entrada no versionamento.
- `audience-sync-weekly.md` — seção Meta enriquecida + histórico v1.2.0.
- `checkout.md` — seção "Data de Nascimento (opcional)".
- `footer.md` — seção "Newsletter — Data de Nascimento (opcional)".
- `email-marketing.md` — seção "Gatilho de Aniversário".
- Memória: `mem://features/marketing/birthday-and-meta-extended-vault-v8-30` + entrada no índice.

## 🔍 Validação técnica pendente (depende do usuário em produção)

1. Após 24-48h do deploy, verificar no Events Manager da Meta:
   - Lead EMQ ≥ 9.3
   - Purchase EMQ ≥ 9.5
   - Presença de `db` no `user_data` quando o cliente preencheu nascimento.
2. Executar `audience-sync-weekly` manual em um tenant com clientes que têm `birth_date` populado e verificar log de match.
3. No próximo dia 5 (aniversário do tenant teste), confirmar que a edge `birthday-daily-trigger` enfileirou e disparou notificação.
