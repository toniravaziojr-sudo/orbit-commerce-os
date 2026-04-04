

# Plano: Alinhar Implementação com os Docs Atualizados

## Diagnóstico — O que precisa mudar

Após análise do código atual vs. as especificações atualizadas, existem **7 lacunas** entre o que está documentado e o que está implementado.

---

## Lacuna 1 — `checkout-create-order` ainda cria cliente antes do pagamento

**Hoje:** A função cria/atualiza o registro na tabela `customers` imediatamente (linhas 371-417), antes mesmo de saber o status do pagamento.

**Doc exige:** Cliente só é criado após pagamento aprovado (`payment_status = approved`).

**Ajuste:** Remover o bloco de upsert de customer da `checkout-create-order`. O pedido deve ser criado com `customer_id = null` (ou vinculado a customer existente sem criar novo). A criação de cliente novo fica exclusivamente no trigger `trg_auto_tag_cliente_on_payment` + lógica de identificação.

---

## Lacuna 2 — `is_first_sale` definido na criação do pedido, não na aprovação

**Hoje:** `is_first_sale: !existingCustomer` é gravado na criação do pedido (linha 505), antes de saber se o pagamento foi aprovado.

**Doc exige:** `is_first_sale = true` apenas quando pagamento é aprovado E o email é novo no tenant.

**Ajuste:** Gravar `is_first_sale = false` na criação. O trigger de aprovação de pagamento deve verificar se é o primeiro pedido aprovado daquele email e atualizar para `true`.

---

## Lacuna 3 — Colunas ausentes na tabela `checkout_sessions`

**Hoje:** Não existem as colunas `internal_state` e `reverted_at`.

**Doc exige:** `internal_state` (active/inactive) e `reverted_at` (timestamp de reversão).

**Ajuste:** Migration para adicionar `internal_state TEXT DEFAULT 'active'` e `reverted_at TIMESTAMPTZ`.

---

## Lacuna 4 — Colunas ausentes na tabela `orders` para verificação de pagamento

**Hoje:** Não existem `next_payment_check_at`, `payment_check_count`, `payment_max_expiry_at`, `chargeback_detected_at`, `chargeback_deadline_at`.

**Doc exige:** Esses campos para controlar a escala progressiva de verificação e o monitoramento de chargebacks.

**Ajuste:** Migration para adicionar os 5 campos. Ao criar pedido, popular `next_payment_check_at = NOW()` e `payment_check_count = 0`.

---

## Lacuna 5 — Edge Function `verify-payment-status` não existe

**Hoje:** Não existe. O sistema depende exclusivamente de webhooks + `expire-stale-orders` para status de pagamento.

**Doc exige:** Cron de 1 minuto com escala progressiva que consulta ativamente as operadoras (Pagar.me, Mercado Pago).

**Ajuste:** Criar edge function `verify-payment-status` com:
- Busca pedidos com `next_payment_check_at <= NOW()` e `payment_status IN (pending, awaiting_payment)`
- Para cada pedido, consulta a API da operadora correspondente
- Atualiza status e calcula próximo `next_payment_check_at` conforme escala progressiva
- Adicionar ao scheduler-tick ou registrar cron próprio

---

## Lacuna 6 — Edge Function `monitor-chargebacks` não existe

**Hoje:** Nenhum monitoramento pós-venda de chargebacks.

**Doc exige:** Cron diário verificando pedidos aprovados nos últimos 60 dias.

**Ajuste:** Criar edge function `monitor-chargebacks` com:
- Busca pedidos com `payment_status = 'paid'/'approved'` dos últimos 60 dias
- Consulta API da operadora para detectar chargebacks
- Novo status `chargeback_requested` precisa ser suportado
- Adicionar `chargeback_requested` como valor válido no sistema

---

## Lacuna 7 — `scheduler-tick` não implementa estado interno nem lista "Cliente Potencial"

**Hoje:** O abandon-sweep marca `status = abandoned` mas não:
- Define `internal_state = 'inactive'`
- Adiciona contato à lista "Cliente Potencial" no email marketing

**Doc exige:** Ao abandonar, mudar `internal_state` para `inactive` e inserir na lista "Cliente Potencial".

**Ajuste:** 
- No abandon-sweep, incluir `internal_state: 'inactive'` no PATCH
- Após marcar abandono, chamar lógica de upsert_subscriber_only para lista "Cliente Potencial"
- Criar tag "Cliente Potencial" (#f97316) e lista correspondente se não existirem

---

## Lacuna bônus — `checkout-session-complete` não suporta status `reverted`

**Hoje:** Usa `recovered` para todos os casos de checkout abandonado que converte.

**Doc exige:** `reverted` quando o MESMO checkout é concluído. `recovered` quando o cliente converte em OUTRO checkout.

**Ajuste:** Diferenciar pela comparação do `session_id`: se o checkout que converteu é o mesmo que estava abandonado → `reverted`. Se é outro → marcar o anterior como `recovered`.

---

## Sequência de Implementação

| Etapa | Descrição | Tipo |
|-------|-----------|------|
| 1 | Migration: adicionar colunas em `checkout_sessions` e `orders` | DB |
| 2 | Ajustar `checkout-create-order`: remover upsert de customer, `is_first_sale = false` | Edge Function |
| 3 | Ajustar trigger `auto_tag_cliente_on_payment_approved`: criar customer se não existe + definir `is_first_sale` | DB (migration) |
| 4 | Ajustar `scheduler-tick` abandon-sweep: `internal_state`, lista "Cliente Potencial" | Edge Function |
| 5 | Ajustar `checkout-session-complete`: lógica `reverted` vs `recovered` | Edge Function |
| 6 | Criar `verify-payment-status`: polling progressivo multi-gateway | Edge Function (nova) |
| 7 | Criar `monitor-chargebacks`: monitoramento pós-venda | Edge Function (nova) |
| 8 | Ajustar `checkout-create-order`: popular campos de verificação no pedido | Edge Function |
| 9 | Registrar crons para as novas funções | DB (insert) |
| 10 | Ajustar `expire-stale-orders`: remover lógica de ghost orders (legado) | Edge Function |

---

## O que NÃO muda

- Heartbeat do checkout (continua funcionando)
- Webhooks das operadoras (continuam como fonte primária)
- Lógica de retry de pagamento
- Triggers existentes de métricas (apenas expandidos)
- UI do admin (não precisa mudar nesta fase)

