---
name: order-creation-after-gateway-only
description: Pedido NUNCA pode ser criado antes da resposta do gateway de pagamento — vale para todos os provedores presentes e futuros (Pagar.me, Mercado Pago, etc.). checkout-create-order rejeita criação sem payment_gateway_id.
type: constraint
---

# Pedido só após resposta do gateway

**Regra absoluta:** nenhum pedido pode ser criado na base antes que o gateway de pagamento responda à requisição de cobrança. A numeração sequencial da loja é um recurso escasso e só pode ser consumida por pedidos reais.

## Por quê
Criar pedido antes da chamada ao gateway gera "ghost orders": registros com número real consumido mas sem `payment_gateway_id`, que aparecem como buracos na sequência (ex: pedido #299 do tenant respeiteohomem em abr/2026). Isso polui métricas, confunde o lojista e quebra a auditoria de numeração.

## Como aplicar
- A edge `checkout-create-order` exige `payment_gateway_id` + `payment_gateway` no payload. Sem isso, retorna erro `GATEWAY_CONFIRMATION_REQUIRED` e não cria nada.
- A edge do gateway (`pagarme-create-charge`, `mercadopago-create-charge`, etc.) é a orquestradora: chama o gateway primeiro, e só depois invoca `checkout-create-order` com `payment_gateway_id` já em mãos.
- Falha técnica antes da resposta do gateway = nenhum pedido criado. A sessão de checkout permanece `active` e o cron padrão (30 min de inatividade) marca como `abandoned`. Caminho único, sem timeout especial.
- Vinculação atômica `checkout_session.order_id ← order.id` acontece dentro de `checkout-create-order`, antes do retorno, para evitar race com o `scheduler-tick` do abandono.

## O que nunca fazer
- Não criar pedido em "step 1" do frontend pra depois chamar o gateway em "step 2" (era o fluxo antigo do Pagar.me, eliminado em v2026-04-19).
- Não usar cron como muleta para "limpar" ghost orders depois — eles não devem nascer.
- Não inserir novo provedor de pagamento sem essa orquestração gateway-first.

## Documentação formal
- `docs/especificacoes/ecommerce/pedidos.md` §1 (REGRA FUNDAMENTAL v2026-04-04 reforçada em v2026-04-19)
- `docs/especificacoes/storefront/checkout.md`
- `docs/especificacoes/crm/checkouts-abandonados.md`
