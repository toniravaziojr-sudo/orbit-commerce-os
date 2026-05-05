# Plano — Data de nascimento + enriquecimento Meta + gatilhos de aniversário

## Escopo aprovado
1. Toggle "Pedir data de nascimento" + "Obrigatório" no Builder → Checkout.
2. Campo no Step1 do checkout, persistido em checkout_sessions, orders, customers.
3. `db` (date_of_birth) hashado SHA-256 no cofre `_sf_identity` e enviado via CAPI em todos os eventos do funil.
4. 4 quick wins Meta: `delivery_category`, `external_id` array, `predicted_ltv`, `lead_id`.
5. Exportador `audience-sync-weekly` enriquecido com FN/LN/CT/ST/ZIP/COUNTRY/DOBY/DOBM/DOBD/GEN via JOIN customers.
6. Trigger `customer_birthday` em E-mail Marketing (cron diário 08:00 BRT).
7. Evento `customer_birthday` em Notificações (E-mail + WhatsApp).
8. (Cupom de aniversário NÃO entra — usuário cria manualmente se quiser.)
9. Validação técnica obrigatória + atualização de docs (meta-tracking, builder, mapa-ui, email-marketing, audience-sync, configurações de notificações) + memória.

## Ordem de execução
1. Migração schema.
2. Builder toggles + Step1 + persistência.
3. Cofre + tracker + 4 quick wins + `db`.
4. `audience-sync-weekly` enriquecido.
5. `birthday-daily-trigger` + UIs.
6. Validação técnica.
7. Atualização docs + memória.
