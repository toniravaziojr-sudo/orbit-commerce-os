---
name: WhatsApp Meta Webhook Fields Mandatory
description: Toda chamada POST /{WABA_ID}/subscribed_apps DEVE enviar subscribed_fields explícitos. Sem isso o app fica vinculado mas não recebe eventos — sintoma "saída funciona / entrada não chega" pós migração teste→produção.
type: constraint
---
**Regra:** Toda chamada `POST https://graph.facebook.com/{version}/{WABA_ID}/subscribed_apps` precisa enviar no body o array `subscribed_fields` com pelo menos `["messages","message_template_status_update","account_update","phone_number_quality_update","phone_number_name_update"]`.

**Por quê:** A Graph API aceita o POST sem `subscribed_fields` e retorna `success:true`, mas a inscrição fica vazia — o app aparece em `subscribed_apps` porém não recebe NENHUM evento. O `GET /subscribed_apps` na v21 não retorna `subscribed_fields` para apps comuns, então não é confiável validar via GET. Só confiar em re-postar.

**Sintoma típico:** Outbound (envio de template / sendMessage) funciona normalmente, mas mensagens recebidas dos clientes nunca chegam ao webhook (POST). Frequente após migração de App de teste para App de produção pós-aprovação Meta.

**Como aplicar:**
1. `meta-whatsapp-recover` → ação `subscribe_webhook` SEMPRE envia `subscribed_fields`.
2. `meta-whatsapp-diagnose` → quando inscrição existe mas sem fields visíveis, marca `WEBHOOK_FIELDS_MISSING` e enfileira `subscribe_webhook`.
3. `meta-whatsapp-monitor-all` → manutenção preventiva diária re-posta os campos mesmo quando status é "healthy" (POST é idempotente, custo zero).

**Anti-regressão:** É proibido fazer POST em `subscribed_apps` sem body com `subscribed_fields`. Qualquer nova função/onboarding/recover que toque inscrição deve seguir essa regra.
