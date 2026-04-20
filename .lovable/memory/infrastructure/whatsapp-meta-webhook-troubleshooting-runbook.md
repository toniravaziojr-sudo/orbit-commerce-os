---
name: WhatsApp Meta Webhook Troubleshooting Runbook
description: Runbook definitivo para diagnóstico de "envio funciona / recebimento não chega" no WhatsApp Meta Cloud API. Lista as 6 camadas a verificar em ordem, com queries/curls prontos, e elimina hipóteses já descartadas para não dar voltas.
type: reference
---

# Runbook: WhatsApp inbound não chega (envio funciona)

## Arquitetura mental obrigatória (NUNCA esquecer)

A integração tem **3 entidades**:
- **WABA + número + token** = do **TENANT** (paga Meta direto, embedded signup gera token)
- **App da Meta** (`META_APP_ID` em `platform_credentials`) = **NOSSO** (passaporte técnico de software)
- **Webhook callback URL** = configurada **UMA VEZ por App**, no painel `developers.facebook.com` → nosso App → Webhooks → whatsapp_business_account. **NÃO é por tenant.**

A Meta entrega TODOS os eventos de TODOS os tenants para essa URL única. Nosso webhook decide o tenant pelo `phone_number_id` no payload.

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
**Esperado:** `webhook.subscribed: true`. Se `has_fields: false`, rodar `meta-whatsapp-recover` action `subscribe_webhook` (já envia subscribed_fields explícitos — ver constraint `whatsapp-meta-webhook-fields-mandatory`).

### Camada 5 — Conferir logs do edge function
```
supabase--edge_function_logs(meta-whatsapp-webhook)
```
**Se "No logs found" e camadas 1-4 OK → problema NÃO é nosso código.** A Meta não está enviando POST. Pular para camada 6.

### Camada 6 — RECIPIENT ALLOWLIST do número (causa raiz mais comum pós-migração teste→produção)
**Painel manual obrigatório:** https://developers.facebook.com/apps/{APP_ID}/whatsapp-business/wa-dev-console/

Aba **API Setup** → seção **"To"** (recipient phone numbers).

**Comportamento:**
- Se a lista contém números específicos → APENAS esses números conseguem enviar mensagens que serão entregues ao webhook. Outros números são descartados silenciosamente pela Meta (sem erro, sem log no nosso lado).
- Para produção real (qualquer cliente final pode enviar), a lista deve estar **vazia** OU o número de teste do cliente final precisa ser adicionado como recipient temporariamente.

**Sintoma exato:** envio outbound funciona normal, GET handshake responde, App está Live, subscription está ativa, mas POST nunca chega ao webhook.

## Hipóteses JÁ DESCARTADAS (não reinvestigar)

- ❌ Callback URL não configurada — está OK (camada 1 confirma)
- ❌ Verify token errado — handshake passa (camada 2)
- ❌ App em modo Development — está Live (camada 3)
- ❌ Subscribed fields vazios — corrigido com `meta-whatsapp-recover` que sempre envia `subscribed_fields` explícitos (ver constraint dedicada)
- ❌ Edge function com bug — sem logs significa que não foi invocada

## Causa raiz histórica do tenant `d1a4d0ed-8842-495e-b741-540a9a345b25`

Investigação 20/04/2026: todas as 5 primeiras camadas validadas tecnicamente OK. Conclusão: bloqueio na camada 6 (recipient allowlist do painel WhatsApp do App), provável resíduo da migração de App de teste para App de produção pós-aprovação Meta.
