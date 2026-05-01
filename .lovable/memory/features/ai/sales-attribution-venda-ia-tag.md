---
name: Atribuição "Venda IA" para pedidos fechados via IA de Atendimento
description: Pedidos originados de link gerado pela IA de Atendimento (WhatsApp) são marcados automaticamente com sales_channel='ai_attendant' e atribuídos a 'ai_atendimento/whatsapp', exibindo badge "Venda IA" em Pedidos/Fiscal e categoria "IA de Atendimento" em Atribuição.
type: feature
---

## Pipeline (fonte de verdade)

1. IA chama `generate_checkout_link` → cria `checkout_links` com `source_conversation_id = conversa atual`.
2. Cliente fecha o pedido → `orders` é inserido.
3. Trigger `trg_link_whatsapp_cart_to_order` (orders AFTER INSERT) vincula `whatsapp_carts.order_id`.
4. Trigger `trg_mark_order_as_ai_sale` (whatsapp_carts AFTER UPDATE OF order_id) executa:
   - `UPDATE orders SET sales_channel='ai_attendant', ai_conversation_id=conversa WHERE sales_channel IN ('storefront')` — **NÃO** sobrescreve marketplace/manual.
   - `INSERT INTO order_attribution (..., attribution_source='ai_atendimento', attribution_medium='whatsapp') ON CONFLICT (order_id) DO UPDATE` — sobrepõe UTM genérica porque a fonte real é a IA.

## UI

- `OrderSourceBadge` (`src/components/orders/OrderSourceBadge.tsx`) aceita `salesChannel`. Quando `salesChannel='ai_attendant'` e sem `marketplaceSource`, exibe ícone `Bot` + tooltip "Venda IA — fechada pela IA de Atendimento". Marketplace tem prioridade visual sobre Venda IA (raro mas possível).
- Página `/attribution`: `SOURCE_LABELS['ai_atendimento']='IA de Atendimento'`, `SOURCE_ICONS['ai_atendimento']='🤖'`.
- Filtro `MARKETPLACE_OPTIONS` expõe `venda_ia` (consumidor da opção precisa traduzir para `sales_channel='ai_attendant'`).

## Anti-regressão

- **Nunca** marcar `sales_channel='ai_attendant'` direto no checkout/edge — sempre via trigger pós-vínculo carrinho↔pedido. Isso garante que só pedidos REAIS pagos via link da IA sejam contados.
- **Nunca** sobrescrever `sales_channel` se já for `marketplace`, `link_checkout` ou `manual`.
- O `ON CONFLICT (order_id) DO UPDATE` em `order_attribution` é intencional: a IA é a última fonte determinística e deve ganhar de qualquer UTM coletada na landing page.

## Lacuna conhecida

`useReports.ts` (relatório "Vendas por Canal") ainda agrupa só por `marketplace_source`. Quando o lojista pedir "vendas por canal incluindo IA", incluir `sales_channel` na agregação.

## Doc formal

`docs/especificacoes/whatsapp/ia-atendimento-changelog.md` Registro #4.
