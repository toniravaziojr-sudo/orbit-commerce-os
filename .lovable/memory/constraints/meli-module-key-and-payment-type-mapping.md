---
name: Meli Module Key + Payment Type Mapping
description: Chave de módulo do Mercado Livre é 'mercado_livre' (com underscore); payment_type do ML precisa mapear para enum payment_method
type: constraint
---

## Regra 1 — Chave canônica do módulo

Todo cron, trigger, painel ou função que referenciar o Mercado Livre em `system_resource_usage` / `cron_call_edge_if_active` DEVE usar `mercado_livre` (com underscore). Não existe `mercadolivre` na tabela de recursos — usar essa forma faz o gate retornar `dormant` e o cron nunca chama a edge function.

**Por quê:** em 02/07/2026 os 3 crons `meli-token-refresh-30min`, `meli-orders-reconcile-15m` e `meli-sync-listings-auto` foram criados com `ARRAY['mercadolivre']` e ficaram adormecidos silenciosamente. Consequência em cadeia: token expirou → webhooks discardados por 401 → reconcile também dormia → 2 pedidos do tenant Respeite o Homem não entraram até correção manual.

**Como aplicar:** revisar qualquer novo cron/trigger/módulo ML antes de merge. Grep obrigatório por `'mercadolivre'` deve dar zero em `supabase/migrations/`.

## Regra 2 — Mapeamento payment_type ML → enum payment_method

O campo `payments[].payment_type` do Mercado Livre retorna valores **não compatíveis** com o enum `payment_method` (que aceita: `pix, credit_card, debit_card, boleto, mercado_pago, pagarme`). Nunca jogar o valor cru no INSERT — quebra com `22P02 invalid input value for enum`.

Mapa obrigatório em `supabase/functions/meli-sync-orders/index.ts` (`mapMeliPaymentType`):

| ML payment_type      | enum payment_method |
|----------------------|---------------------|
| `credit_card`        | `credit_card`       |
| `debit_card`         | `debit_card`        |
| `ticket`             | `boleto`            |
| `bank_transfer`      | `pix`               |
| `account_money`      | `mercado_pago`      |
| `atm` / demais / null| `mercado_pago`      |

**Por quê:** pedido Pix (`bank_transfer`) do ML foi bloqueado no INSERT em 02/07/2026 pelo mesmo incidente acima.

**Como aplicar:** ao adicionar novo valor ao enum `payment_method` ou receber novo `payment_type` da API do ML, atualizar a função e este mapa antes do deploy.
