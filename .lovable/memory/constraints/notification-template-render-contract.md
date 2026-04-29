---
name: Notification template render contract
description: Pipeline notification templates must enrich missing vars at process-events, render strict, never persist raw [Template:]/{{vars}} in messages.content
type: constraint
---

# Contrato de render de templates de notificação

Aplica-se ao pipeline `events_inbox → process-events → notifications → run-notifications → canal/timeline`.

## Regras invioláveis

1. **Origem garantida (process-events).** É proibido construir `templateVars` lendo apenas o `payload` cru do evento para variáveis que dependem do banco. Toda regra com `order_id` resolvido DEVE chamar `enrichOrderContext(supabase, tenant_id, order_id)` (em `supabase/functions/_shared/enrich-order-context.ts`) e mesclar com **enriched WIN sobre payload**. Aplica-se mandatoriamente a `store_name`, `product_names`, `customer_first_name`, `order_number`, `order_total`.

2. **Render strict universal (run-notifications + template-renderer).** Nenhum render de notificação pode rodar fora de `mode: "strict"` no `_shared/template-renderer.ts`. Variáveis verdadeiramente opcionais devem ser declaradas via `optionalVars` — nunca tratadas como vazio aceitável. Falha de render NÃO conta como retentativa de envio.

3. **Timeline limpa (messages.content).** É proibido persistir `messages.content` contendo `[Template: ...]` ou `{{var}}`. O `run-notifications` v1.5.0+ já bloqueia novos casos via `assertNoPlaceholders`. Para histórico legado, o frontend SEMPRE passa `messages.content` por `sanitizeMessageContent` (`src/lib/sanitizeNotificationContent.ts`) antes de exibir — nada cru chega à tela do atendente.

4. **Erros de provedor não silenciam falhas.** SendGrid 401 "Maximum credits exceeded" e templates WhatsApp não-aprovados NÃO devem consumir tentativas nem ficar como `failed` genérico. Devem virar alerta operacional explícito (insight Central de Comando + status distinto na fila).

## Por que existe (incidente que originou)

Tenant `respeiteohomem` (29/04/2026): 28 notificações de `pagamento_aprovado` falhando há 7 dias por (a) `payload.product_names` e `payload.store_name` vazios na origem, (b) saldo SendGrid esgotado tratado como falha permanente silenciosa, (c) histórico legado com `[Template: ...] {{customer_first_name}}` exibido cru no /support.

## Onde validar antes de declarar fechado

- `notifications.status='sent'`, `last_error=null`, `attempt_count=1` para evento `order.paid` simulado.
- `notification_logs.content_preview` com `Produto: X (2x)` e `A {store_name} agradece`.
- `messages.content` sem `[Template:]` e sem `{{ }}`.
- Frontend não exibe placeholder mesmo quando `messages.content` é legado.
