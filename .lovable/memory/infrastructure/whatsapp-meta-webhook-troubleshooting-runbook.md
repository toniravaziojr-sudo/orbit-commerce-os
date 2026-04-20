---
name: WhatsApp Meta Webhook Troubleshooting Runbook
description: Runbook definitivo para diagnóstico de "envio funciona / recebimento não chega" no WhatsApp Meta Cloud API. Lista as 7 camadas a verificar em ordem, com queries/curls prontos, e elimina hipóteses já descartadas para não dar voltas. Inclui causa raiz #1 mais comum (display name não aprovado).
type: reference
---

# Runbook: WhatsApp inbound não chega (envio funciona)

## Arquitetura mental obrigatória (NUNCA esquecer)

A integração tem **3 entidades**:
- **WABA + número + token** = do **TENANT** (paga Meta direto, embedded signup gera token)
- **App da Meta** (`META_APP_ID` em `platform_credentials`) = **NOSSO** (passaporte técnico de software)
- **Webhook callback URL** = configurada **UMA VEZ por App**, no painel `developers.facebook.com` → nosso App → Webhooks → whatsapp_business_account. **NÃO é por tenant.**

A Meta entrega TODOS os eventos de TODOS os tenants para essa URL única. Nosso webhook decide o tenant pelo `phone_number_id` no payload.

## CAUSA RAIZ #1 (mais comum pós-migração teste→produção)

**Display name do número não aprovado** → `name_status: NON_EXISTS` + `can_send_message: LIMITED` + `additional_info: ["Your display name has not been approved yet"]`.

Sintomas:
- Outbound (template aprovado) funciona normal ✅
- Handshake do webhook OK, App Live, subscription ativa, callback URL correta ✅
- Inbound de números espontâneos NUNCA chega — Meta descarta silenciosamente ❌
- Inbound só chega se houver janela de 24h aberta (resposta a template enviado) OU se o número remetente estiver na lista de testers

Solução definitiva: solicitar aprovação do display name em
`https://business.facebook.com/wa/manage/phone-numbers/?waba_id={WABA_ID}` →
clicar no número → Settings → Profile → Display name → Request review (1-3 dias úteis).

Workaround para teste imediato: enviar template do tenant para o número alvo, que abre janela de 24h.

## Ordem CANÔNICA de diagnóstico (não pular passos)

### Camada 1 — Conferir App subscription no Graph API
```bash
APP_ID=$(psql -tAc "SELECT credential_value FROM platform_credentials WHERE credential_key='META_APP_ID'")
APP_SECRET=$(psql -tAc "SELECT credential_value FROM platform_credentials WHERE credential_key='META_APP_SECRET'")
APP_TOKEN="${APP_ID}|${APP_SECRET}"
curl -s "https://graph.facebook.com/v21.0/${APP_ID}/subscriptions?access_token=${APP_TOKEN}" | python3 -m json.tool
```
**Esperado:** `object: whatsapp_business_account`, `active: true`, `callback_url` correta, `fields` contém `messages`.

### Camada 2 — Conferir handshake do nosso endpoint
```bash
VERIFY_TOKEN=$(psql -tAc "SELECT credential_value FROM platform_credentials WHERE credential_key='META_WEBHOOK_VERIFY_TOKEN'")
curl -s "https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/meta-whatsapp-webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=ping123"
```
**Esperado:** retorna `ping123` (HTTP 200).

### Camada 3 — Conferir modo Live do App
```bash
curl -s "https://graph.facebook.com/v21.0/${APP_ID}/permissions?access_token=${APP_TOKEN}" | python3 -m json.tool
```
**Esperado:** `whatsapp_business_messaging` e `whatsapp_business_management` com `status: live`.

### Camada 4 — Conferir inscrição da WABA do tenant no App
```sql
SELECT phone_number_id, waba_id, last_health_payload->'webhook' AS webhook_status
FROM whatsapp_configs WHERE tenant_id = '<TENANT_ID>';
```
**Esperado:** `webhook.subscribed: true`. Se `has_fields: false`, rodar `meta-whatsapp-recover` action `subscribe_webhook`.

### Camada 5 — Conferir logs do edge function
```
supabase--edge_function_logs(meta-whatsapp-webhook)
```
**Se "No logs found" e camadas 1-4 OK → problema NÃO é nosso código.** A Meta não está enviando POST. Pular para camada 6 e 7.

### Camada 6 — STATUS DE SAÚDE DO NÚMERO (a mais importante)
```bash
TENANT_TOKEN=$(psql -tAc "SELECT access_token FROM whatsapp_configs WHERE tenant_id='<TENANT_ID>'")
PHONE_ID=$(psql -tAc "SELECT phone_number_id FROM whatsapp_configs WHERE tenant_id='<TENANT_ID>'")
curl -s "https://graph.facebook.com/v21.0/${PHONE_ID}?fields=verified_name,name_status,status,quality_rating,messaging_limit_tier,account_mode&access_token=${TENANT_TOKEN}" | python3 -m json.tool
curl -s "https://graph.facebook.com/v21.0/${PHONE_ID}?fields=health_status&access_token=${TENANT_TOKEN}" | python3 -m json.tool
```

**Bandeiras vermelhas que bloqueiam inbound:**
- `name_status: "NON_EXISTS"` ou `"NONE"` ou `"DECLINED"` → display name não aprovado → CAUSA RAIZ #1
- `health_status.entities[PHONE_NUMBER].can_send_message: "LIMITED"` → operação degradada
- `additional_info` contendo "display name has not been approved" → confirma causa raiz #1

**Estado saudável:**
- `name_status: "APPROVED"` ou `"AVAILABLE_WITHOUT_REVIEW"`
- `health_status.entities[PHONE_NUMBER].can_send_message: "AVAILABLE"`

### Camada 7 — Recipient allowlist do App (se camada 6 estiver OK e ainda não chegar)
Painel manual: `https://developers.facebook.com/apps/{APP_ID}/whatsapp-business/wa-dev-console/` → API Setup → seção "To".

Se a lista contém números específicos → APENAS esses números enviam mensagens entregues ao webhook.

## Hipóteses JÁ DESCARTADAS (não reinvestigar para tenant `d1a4d0ed-8842-495e-b741-540a9a345b25`)

- ❌ Callback URL não configurada — está OK
- ❌ Verify token errado — handshake passa
- ❌ App em modo Development — está Live
- ❌ Subscribed fields vazios — corrigido com `meta-whatsapp-recover`
- ❌ Edge function com bug — sem logs significa que não foi invocada
- ❌ App não inscrito na WABA — está inscrito

## Causa raiz CONFIRMADA do tenant `d1a4d0ed-8842-495e-b741-540a9a345b25` (20/04/2026)

`name_status: NON_EXISTS` + `can_send_message: LIMITED` + `"Your display name has not been approved yet"`.

Display name "Respeite o Homem" registrado mas não submetido para revisão da Meta. Enquanto não for aprovado:
- Outbound de templates aprovados funciona ✅
- Inbound só dentro de janela de 24h aberta por outbound ❌
- Inbound espontâneo de qualquer número é descartado pela Meta ❌

Ação requerida: solicitar aprovação no painel `business.facebook.com/wa/manage/phone-numbers`.
