---
name: observability-over-automation-rule
description: Onda 2 — Em fluxos sensíveis (WhatsApp inbound, pagamentos), exibir falhas para decisão humana é obrigatório; reprocessamento automático é proibido sem aprovação explícita.
type: constraint
---

# Observabilidade prioriza automação (Onda 2)

## Regra
Em fluxos com risco financeiro, jurídico ou de relacionamento (WhatsApp inbound, pagamentos, checkout, fiscal), o sistema NUNCA deve reprocessar/reconciliar automaticamente sem decisão humana ou aprovação explícita do plano.

A correção padrão para falhas silenciosas é **dar visibilidade**, não reprocessar:
1. Persistir o evento (já existe `whatsapp_inbound_messages`, `whatsapp_health_incidents`, `payment_transactions`).
2. Expor via RPC `SECURITY DEFINER` restrita a `is_platform_admin()`.
3. Mostrar no painel `/platform/system-health` com ação manual ("Resolver", "Marcar como reconciliado").

## Por quê
- Reprocessar mensagem WhatsApp pode duplicar atendimento ou enviar resposta fora de contexto.
- Criar pedido automático a partir de pagamento órfão pode gerar entrega/cobrança duplicada.
- Constraint correlata: `mem://constraints/whatsapp-reception-source-of-truth-cross-check`.

## Como aplicar
- Toda nova fila/evento sensível deve ter RPC de leitura no painel antes de qualquer cron de reprocessamento.
- Crons de reconciliação só são permitidos para: (a) verificação ativa em gateways (chargeback), (b) reenvio de jobs idempotentes documentados, (c) jobs pré-aprovados em plano formal.
- Botões de ação manual ("Resolver", "Reenviar", "Reconciliar") são preferidos a automação cega.

## RPCs criadas na Onda 2
- `get_resilience_kpis()` — 3 indicadores no header
- `get_whatsapp_incidents(p_limit)` — incidentes abertos
- `get_whatsapp_orphan_inbound(p_limit)` — mensagens não processadas há > 5min
- `get_payment_divergences(p_window_hours, p_limit)` — pagamentos sem pedido
- `resolve_whatsapp_incident(p_incident_id, p_resolution_note)` — ação manual
