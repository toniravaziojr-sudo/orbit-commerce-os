# Fluxo de Recepção WhatsApp Meta (Layer 3)

**Versão:** v1.0 — 2026-04-20
**Status:** Estabilizado com defesas anti-regressão
**Módulos:** WhatsApp (recepção), IA Suporte, IA Agenda, Central de Comando

## Fluxo principal

```
Cliente envia msg
   ↓
Meta Cloud API (v25.0)
   ↓
Webhook → meta-whatsapp-webhook  ← assinatura ativa do campo "messages" é OBRIGATÓRIA
   ↓
Auditoria: insert em whatsapp_inbound_messages (processed_at = NULL)
   ↓
Roteamento por tenant (phone_number_id) + tipo (admin → Agenda, cliente → Suporte)
   ↓
Cria conversa + dispara IA (ai-support-chat OU agenda-process-command)
   ↓
IA responde via meta-whatsapp-send
   ↓
processed_at = now() na linha de auditoria
```

## Fonte de verdade
1. Assinatura do **app Meta** para `whatsapp_business_account` apontando para o callback oficial `.../functions/v1/meta-whatsapp-webhook`.
2. Vínculo da WABA com o app em `subscribed_apps`.
3. Tabela `whatsapp_inbound_messages` (auditoria de tudo que entra).
4. `whatsapp_configs.connection_status` + `last_error`.

## Mecanismos de defesa (anti-regressão)

| Defesa | Onde | Frequência | O que faz |
|---|---|---|---|
| Healthcheck token Meta | `whatsapp-token-healthcheck` | diário | Detecta token invalidado (erro 190) |
| Diagnóstico completo | `meta-whatsapp-diagnose` | sob demanda + monitor | Valida token, número, callback real do app Meta e vínculo da WABA |
| Monitor + auto-reparo | `meta-whatsapp-monitor-all` | diário (03:17 UTC) | Re-posta `subscribed_fields=[messages,...]` quando necessário; auto-registra número se PIN salvo |
| Vigia de órfãs | `whatsapp-orphan-watcher` | a cada 15 min | Detecta `whatsapp_inbound_messages` com `processed_at IS NULL` há ≥5 min e abre incidente em `whatsapp_health_incidents` |
| Card de saúde | `WhatsAppHealthCard` na Central | tempo real (60s polling) | Mostra última msg recebida, última resposta IA, status assinatura, órfãs 24h, incidentes abertos |

## Regras invioláveis
- Mensagem na auditoria sem processamento por mais de 5 min = **incidente crítico**, sempre.
- Não basta checar `subscribed_apps`: o **callback do app Meta** precisa apontar para o receptor oficial.
- Sem reprocessamento automático de órfãs — só visibilidade. Reprocessamento exige decisão humana.
- Versão Meta: **v25.0** (validada). Não trocar sem testar recepção end-to-end.

## Tabelas-chave
- `whatsapp_inbound_messages` — auditoria bruta de tudo que entra
- `whatsapp_configs` — credenciais + estado de assinatura por tenant
- `whatsapp_health_incidents` — incidentes abertos/resolvidos do pipeline

## Crons ativos
- `whatsapp-orphan-watcher-15min` — `*/15 * * * *`
- `meta-whatsapp-monitor-all-daily` — `17 3 * * *`
