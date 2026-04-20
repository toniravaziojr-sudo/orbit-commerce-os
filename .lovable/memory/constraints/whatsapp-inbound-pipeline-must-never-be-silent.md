---
name: WhatsApp Inbound Pipeline must never be silent
description: Mensagem em whatsapp_inbound_messages sem processamento em 5 min = incidente crítico. Assinatura do webhook precisa ser verificada diariamente.
type: constraint
---
Cenário-pai: jan/fev 2026 — 1.980 mensagens caíram em `whatsapp_inbound_messages` e nenhuma foi processada (processed_at NULL); depois 2 meses de silêncio absoluto porque a Meta perdeu a assinatura do campo `messages`.

**Regras invioláveis:**
1. Toda mensagem em `whatsapp_inbound_messages` deve ter `processed_at` preenchido em até 5 minutos. Se não tiver, é incidente crítico — abrir em `whatsapp_health_incidents` (já automatizado por `whatsapp-orphan-watcher`, cron 15 min).
2. A assinatura do webhook (`subscribed_apps` com `subscribed_fields=[messages,...]`) precisa ser **re-postada diariamente** em todos os tenants Meta ativos, mesmo quando o diagnóstico diz "healthy" (já automatizado por `meta-whatsapp-monitor-all`, cron diário).
3. Healthcheck do token (`/me`) NÃO substitui verificação da assinatura. Token vivo + assinatura morta = pipeline silencioso.
4. **Proibido reprocessamento automático** de órfãs — só visibilidade. Reprocessar é decisão humana caso a caso.
5. Versão Meta v25.0 é a validada. Trocar exige novo teste E2E de recepção, não só de envio.

**Card visual:** `WhatsAppHealthCard` na Central de Comando expõe estado em tempo real (última msg, última resposta IA, status assinatura, órfãs 24h, incidentes abertos).

**Doc formal:** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` (v1.0).
