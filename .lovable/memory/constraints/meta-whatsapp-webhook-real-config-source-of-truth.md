---
name: Meta WhatsApp Webhook — Fonte de Verdade da Configuração
description: Antes de pedir ao usuário para reconfigurar webhook do WhatsApp Cloud, SEMPRE consultar a fonte de verdade real (token, URL, campos). Token verify fica em platform_credentials.META_WEBHOOK_VERIFY_TOKEN. URL fica configurada em developers.facebook.com (não em business.facebook.com). Campo crítico = "messages". Erros recorrentes diagnosticados em 2026-04-20.
type: constraint
---

## Regra
Antes de pedir ao usuário para mexer em qualquer configuração de webhook do WhatsApp Cloud no painel da Meta, é **OBRIGATÓRIO** consultar primeiro:

1. **URL real esperada:** `https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/meta-whatsapp-webhook`
2. **Token de verificação real:** consultar `SELECT credential_value FROM platform_credentials WHERE credential_key = 'META_WEBHOOK_VERIFY_TOKEN' AND is_active = true`
3. **Campo de assinatura obrigatório:** `messages` (não confundir com `account_update`, `account_alerts`, etc — esses são inúteis para inbound)

## Por quê
Já cometi 3 erros nessa volta (2026-04-20):
- **Erro 1:** Inventei o token `comando-central-whatsapp-webhook-2025` na resposta — token real é `comando_central_whatsapp_verify_2026`. Token inventado faz a Meta retornar erro de verificação e o usuário acha que é problema dele.
- **Erro 2:** Mandei o usuário verificar `business.facebook.com/wa/manage/...` (Business Manager) achando que era lá a config de webhook — a config real fica em `developers.facebook.com/apps/{APP_ID}/whatsapp-business/wa-settings/`.
- **Erro 3:** Confundi "subscribed_apps" (vínculo App↔WABA) com "Webhook Configuration" (URL + token + campos). São 2 níveis distintos. Sem o segundo, a Meta não entrega eventos mesmo com o primeiro 100% ok.

## Onde fica cada coisa na Meta

| Configuração | Local | Para que serve |
|---|---|---|
| Display Name (nome aprovado) | `business.facebook.com/wa/manage/phone-numbers` → Perfil | Aumentar limite de envio. **NÃO afeta recebimento.** |
| Vínculo App ↔ WABA (`subscribed_apps`) | API only (`POST /{WABA_ID}/subscribed_apps`) | Liga o App à WhatsApp Business Account |
| **URL + Token de Verificação do Webhook** | `developers.facebook.com/apps/{APP_ID}/whatsapp-business/wa-settings/` → card "Webhook" | Onde a Meta vai enviar os POSTs |
| **Inscrição do campo `messages`** | Mesma tela acima → lista "Campos do webhook" → toggle "Assinar" na linha do `messages` | Sem isso, NENHUMA mensagem inbound chega — só os POSTs administrativos |

## Sintomas que indicam falha de Webhook Configuration (não de Display Name)
- `connection_status: connected` ✅
- Display Name aparece como aprovado (sem botão "Solicitar análise") ✅
- Mensagens recebidas contadas no Insights da Meta (≥1) ✅
- Mas: **ZERO logs em `meta-whatsapp-webhook`** mesmo após o usuário enviar mensagem
- E: `name_status` retorna `NON_EXISTS` na Graph API mesmo com nome aprovado no UI (campo legado, ignorar)

→ Nesse cenário, **NÃO** mandar o usuário pedir aprovação de nome. **NÃO** ficar repostando `subscribed_apps`. **A correção é configurar URL + Token + campo `messages` em developers.facebook.com.**

## Anti-regressão
Sempre que o usuário relatar "WhatsApp não recebe / IA não responde / template chega mas resposta não volta", o primeiro diagnóstico é:
```
SELECT id, timestamp FROM function_edge_logs WHERE event_message ILIKE '%meta-whatsapp-webhook%' ORDER BY timestamp DESC LIMIT 5
```
Se zero logs nas últimas horas e o usuário enviou mensagem → **Webhook Configuration na Meta está incompleta**, não é problema de código nosso.
