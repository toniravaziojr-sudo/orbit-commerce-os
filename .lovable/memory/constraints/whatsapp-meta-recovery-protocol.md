---
name: WhatsApp Meta Recovery Protocol
description: Protocolo de diagnóstico e auto-reparo do WhatsApp Meta. 4 verificações obrigatórias (token, número, WABA health, webhook). Sem isso, número fica preso em PENDING após problema de billing/desconexão.
type: constraint
---
Toda integração WhatsApp Meta (Cloud API) deve ser monitorada pelos 4 pontos críticos onde o número trava em "Pendente":

1. **Token Meta** (`/me`): código 190 = sessão revogada → exige reconexão manual.
2. **Status do número** (`/{phone_id}?fields=status,health_status`): `PENDING` + erro 141000 = número não registrado na Cloud → precisa `/register` com PIN.
3. **Saúde da WABA** (`health_status.entities[WABA]`): `BLOCKED` com erro 141006 = falta forma de pagamento ativa no Business Manager.
4. **Webhook** (`/{waba_id}/subscribed_apps`): array vazio = não recebe mensagens (inbound silenciosamente quebrado).

**Infra obrigatória:**
- Edge `meta-whatsapp-diagnose`: roda os 4 checks, retorna `issues[]` com `action_type: auto|user|support`.
- Edge `meta-whatsapp-recover`: executa `subscribe_webhook` (seguro, sem efeito colateral) e `register_phone` (exige PIN salvo em `whatsapp_configs.register_pin`).
- Edge `meta-whatsapp-monitor-all` + cron diário (9h): roda diagnose em todos os tenants ativos e auto-repara apenas webhook.
- Coluna `register_pin` em `whatsapp_configs` para recovery sem nova interação.
- Componente `WhatsAppDiagnosticCard` na tela de WhatsApp do tenant com botão "Diagnosticar agora" e "Reparar automaticamente".

**Proibido:**
- Tratar `PENDING` como erro de configuração nossa antes de rodar `health_status`.
- Mostrar mensagem genérica "desconectado" quando há causa identificável (billing/token/webhook).
- Executar `register_phone` automaticamente sem PIN explícito do usuário (auditoria).

**Causas comuns observadas:**
- Cartão removido/recusado no Business Manager → WABA bloqueada → número desativado.
- Reconexão Meta sem re-assinatura de webhook → recebimento quebra silenciosamente.
- Troca de senha/logout do Facebook → token código 190 → register falha em silêncio e número fica PENDING.
