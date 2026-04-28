---
name: WhatsApp Inbound Pipeline must never be silent
description: Recepção WhatsApp tem 6 camadas anti-regressão. Toda mensagem deve ter desfecho em <5min. Trigger garante status, webhook tem try/finally universal, dedupe imediato de redelivery por external_message_id, view+watcher detectam órfãs, monitor diário valida assinatura Meta.
type: constraint
---
Cenário-pai: jan/2026 (1.980 órfãs por assinatura `messages` perdida na Meta) + abr/2026 (2.657 órfãs por early returns silenciosos no webhook após o "Pacote 3 não-bloqueante").

**Doc formal (fonte de verdade):** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md`

**Regras invioláveis:**

1. **Toda mensagem em `whatsapp_inbound_messages` deve ter `processed_at` preenchido em até 5 minutos.** Se não tiver, é incidente crítico — aberto automaticamente por `whatsapp-orphan-watcher` (cron 15 min) em `whatsapp_health_incidents`.

2. **Webhook (`meta-whatsapp-webhook`) usa try/catch/finally universal.** Variáveis `outcomeStatus`/`outcomeProcessedBy`/`outcomeError`/`outcomeConversationId` começam pessimistas (`failed`/`silent_exit`) e são gravadas pelo `finally` em TODOS os caminhos: sucesso, early return, exceção, falha de conversa, falha de mensagem. **Proibido** retornar do bloco de processamento sem passar pelo finally.

3. **Trigger BEFORE INSERT (`trg_whatsapp_inbound_default_status`) garante `processing_status='received'`** mesmo se o webhook esquecer de informar. **Proibido** remover esse trigger.

4. **View `whatsapp_inbound_orphans_v`** classifica órfãs em `never_processed`, `silent_partial_update`, `unknown_silent`, `explicit_failure`. Aparição de `processed_by='silent_exit'` em produção = bug novo no webhook (investigar imediatamente).

5. **Assinatura do webhook (`subscribed_apps` com `subscribed_fields=[messages,...]`)** precisa ser re-postada diariamente em todos os tenants Meta ativos pelo `meta-whatsapp-monitor-all`, mesmo quando diagnóstico diz "healthy". Healthcheck de token (`/me`) **NÃO** substitui verificação da assinatura. Token vivo + assinatura morta = pipeline silencioso.

6. **Versão Meta v25.0** é a validada. Trocar exige novo teste E2E de recepção, não só de envio.

7. **Proibido reprocessamento automático** de órfãs — só visibilidade. Reprocessar é decisão humana caso a caso.

**Códigos canônicos de `processed_by`:** `agenda_agent`, `agenda_failed`, `ai_support`, `ai_failed`, `gate:<motivo>`, `debounce_merged(N)`, `conversation_create_failed`, `message_persist_failed`, `no_conversation`, `pipeline_exception`, `silent_exit` (NUNCA em produção).

**Card visual:** `WhatsAppHealthCard` na Central de Comando + aba WhatsApp em `/platform/system-health` (Onda 2 abr/2026).
