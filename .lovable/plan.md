# Plano — Data de nascimento + enriquecimento Meta + gatilhos de aniversário

## ✅ Concluído nesta rodada
1. **Migração schema** — `customer_birth_date` em `checkout_sessions` e `orders`; índice `idx_customers_birthday_mmdd`.
2. **Builder** — toggles `requestBirthDate` + `birthDateRequired` em PageSettings (Checkout).
3. **Step1 do checkout** — campo opcional/obrigatório com validação (≥13 / ≤120 anos), persistido no draft, repassado a `useOrderDraft`, `useCheckoutPayment` e `checkout-create-order`.
4. **Cofre `_sf_identity` (v8.30)** — novos campos `db_hash`, `ge_hash`, `lead_id`, `customer_id`. `storeIdentity` aceita `birthDate`, `gender`, `leadId`, `customerId`.
5. **CAPI sender (`sendCapi`)** — agora hidrata automaticamente `date_of_birth_hashed`, `gender_hashed`, e `external_id` em **array** (visitor + customer) em todos os eventos do funil. `lead_id` é injetado em `custom_data`.
6. **4 quick wins Meta**:
   - `delivery_category: 'home_delivery'` em AddToCart, InitiateCheckout, AddShippingInfo, AddPaymentInfo, Purchase.
   - `external_id` como array `[sf_vid, customer_id]` quando logado.
   - `predicted_ltv` = `value × 1.8` em Purchase.
   - `lead_id` (UUID) gerado em `trackLead`, persistido no cofre, propagado para Lead/Purchase via `custom_data`.
7. **Lead/Purchase** — `trackLead` agora aceita `birthDate` (Step1 → cofre); `trackPurchase` recebe `birthDate` do `OrderDetails` (campo exposto via `get-order` edge function).
8. **`useOrderDetails` + `get-order`** — retornam `customer_birth_date`.

## ⏭ Pendente próxima rodada
1. **`audience-sync-weekly` enriquecido** — LEFT JOIN `customers` por email/telefone normalizado, envio hashado de FN/LN/CT/ST/ZIP/COUNTRY/DOBY/DOBM/DOBD/GEN tanto pra Meta quanto pra Google Ads. Atualizar doc `audience-sync-weekly.md`.
2. **Gatilho de aniversário**:
   - Edge `birthday-daily-trigger` (08:00 BRT) varre `customers` por `to_char(birth_date,'MM-DD') = today`, dispara eventos `customer_birthday` em e-mail marketing e notificações.
   - UI: novo `trigger_type='customer_birthday'` no builder de fluxos de e-mail; novo `event_type='customer_birthday'` em Notificações (E-mail + WhatsApp).
   - Cron via padrão 3 (Edge direta).
3. **Validação técnica** — testar e2e (checkout com toggle on, evento Lead com `db_hash` e `lead_id`, Purchase com `predicted_ltv` e `external_id` array), Pixel + CAPI Test Events, EMQ ≥ 9.5 após 24h.
4. **Documentação obrigatória** — atualizar `meta-tracking.md` (parâmetros + cofre + 4 quick wins), `builder.md` (toggles checkout), `mapa-ui.md` (campo + gatilho), `email-marketing.md` (trigger aniversário), `audience-sync-weekly.md` (novos campos), `configuracoes.md` (notificações). Atualizar memória `meta-tracking-quality-strategy` com Regras 9 (cofre db/ge/lead_id) e 10 (4 quick wins).
