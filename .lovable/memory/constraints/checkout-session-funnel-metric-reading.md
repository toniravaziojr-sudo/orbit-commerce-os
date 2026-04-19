---
name: checkout-session-funnel-metric-reading
description: Regras obrigatórias para leitura da métrica carrinho×checkout e contagem de sessões — exclusão de sessões sem contato, comparação de janela igual e exceção do Link Checkout
type: constraint
---

# Leitura da Métrica de Funil Carrinho × Checkout

## Regra 1 — Sessão sem contato NÃO conta
Sessões `checkout_sessions` com `contact_captured_at IS NULL` representam visitantes que abriram o checkout mas não digitaram email nem telefone. **Nunca** incluir essas sessões:
- na tela de Carrinhos Abandonados;
- no denominador de taxa de recuperação;
- no cálculo de "margem carrinho × checkout".

## Regra 2 — Universo oficial
```
Universo = sessions WHERE contact_captured_at IS NOT NULL
         AND status IN ('abandoned','recovered','reverted','converted')
```

## Regra 3 — Comparação dia × dia exige mesma janela
Comparar "hoje até as 16h" contra "sábado passado o dia inteiro" produz ilusão de queda. Sempre cortar a janela horária na hora atual.

## Regra 4 — Link Checkout não cria sessão por design
Vendas via Link Checkout (Sender/Receiver) não passam pelo wizard. Pedidos órfãos vindos desse fluxo são esperados e não devem ser contados como "bug de sessão não fechada".

## Regra 5 — Verificação rápida antes de declarar bug
Antes de afirmar "completeCheckoutSession está quebrado", rodar:
```sql
SELECT COUNT(*) total, COUNT(cs.id) com_sessao
FROM orders o LEFT JOIN checkout_sessions cs ON cs.order_id = o.id
WHERE o.tenant_id = '<tenant>' AND o.created_at > NOW() - INTERVAL '7 days';
```
Se `com_sessao / total` > 80%, **não há bug** — o restante são casos esperados (Link Checkout, MercadoPago redirect via webhook).

## Doc formal de referência
`docs/especificacoes/storefront/checkout.md` § 19 — Tracking Comercial → Checkout Session — Ciclo de Vida e Métrica de Funil.
