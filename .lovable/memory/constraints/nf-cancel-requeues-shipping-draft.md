---
name: Cancelamento de NF reenfileira novo rascunho logístico vinculado ao PV
description: Após cancelamento bem-sucedido de NF, fiscal-cancel chama RPC requeue_shipping_draft_for_pv para regenerar automaticamente o objeto logístico. Idempotente, respeita roteamento gateway/marketplace e PV em estado terminal.
type: constraint
---

# Reset em 1 clique — cancelar NF regenera o objeto logístico

## Regra (rev 2026-06-11)

Quando uma NF de venda autorizada é cancelada com sucesso e o PV pai
volta para "Pedido em aberto", a edge `supabase/functions/fiscal-cancel`
deve, na mesma execução, chamar:

```sql
SELECT public.requeue_shipping_draft_for_pv(p_pv_id => :pv_id);
```

A RPC insere uma nova linha em `shipping_draft_queue` vinculada ao PV
(`source_pedido_venda_id`), respeitando:

1. **Idempotência:** não duplica se já existir rascunho `pending` ou
   `processing` para o mesmo PV (unique parcial
   `shipping_draft_queue_pv_open_unique`).
2. **Roteamento:** PVs cujo pedido roteia para `gateway` (Frenet) ou
   `marketplace` são pulados. Esses fluxos não usam rascunho local.
   Ver `mem://features/logistics/gateway-vs-local-shipping-routing`.
3. **Estado terminal:** PVs em `cancelado / expirado / estornado /
   devolvido / chargeback_*` são pulados.
4. **PV manual sem `order_id`:** aceita, usa transportadora do próprio PV
   (`transportadora_nome`) com fallback `correios`.

O resultado da chamada é registrado em `fiscal_invoice_events` com
`event_type = 'shipping_requeue_after_cancel'` para auditoria. Quando o
requeue retorna `success=true` ou `reason='already_queued'`, a mesma edge
deve disparar imediatamente `shipping-draft-process` filtrado pelo PV,
para transformar o rascunho pendente em objeto `draft` visível na aba
"Prontos para emitir" sem esperar o cron. Erro na RPC ou no disparo NÃO
falha o cancelamento — apenas registra auditoria/aviso.

## Por que existe a RPC separada do trigger

O trigger `trg_enqueue_shipping_draft_from_pv` só dispara em `AFTER
INSERT` de `fiscal_invoices`. No cancelamento de NF, o PV pai já existe;
não há INSERT novo. Sem a RPC, o lojista ficaria com PV em aberto e
**sem** rascunho de remessa — quebrando o ciclo de "reset em 1 clique".

## O que NUNCA pode acontecer

- Cancelar NF de pedido com despacho local e PV ficar sem rascunho
  logístico enfileirado.
- Cancelar NF, ter linha nova em `shipping_draft_queue`, mas deixar o
  operador esperando o cron para o objeto reaparecer na tela.
- Reusar a RPC para criar rascunho em PV de pedido roteado a gateway
  (criaria duplicidade de despacho — gateway tem fluxo próprio via
  `gateway_sync_queue`).
- Permitir que erro no requeue derrube o cancelamento da NF (que já foi
  aceito pela SEFAZ).
- Remover o passo `recompute_pv_pedido_status` antes do requeue — a RPC
  consulta `pedido_status` para decidir se enfileira.

## Caso de origem

Pedidos #612 e #613 (Respeite o Homem, 2026-06-11). NFs 421/422 emitidas
com SKU `8259065f` em vez do SKU `0001` do Shampoo Calvície Zero. O
ciclo anterior exigia cancelar a NF e depois recriar manualmente o
objeto logístico — retrabalho e risco de esquecimento.

## Arquivos

- Edge: `supabase/functions/fiscal-cancel/index.ts` (bloco
  "PÓS-CANCELAMENTO" + chamada `requeue_shipping_draft_for_pv`).
- Função: `public.requeue_shipping_draft_for_pv(uuid)` (SECURITY
  DEFINER, EXECUTE só para `service_role`).
- Doc: `docs/especificacoes/erp/erp-fiscal.md` §"Cancelamento de NF ×
  Objeto Logístico" item 3.
- Memórias irmãs: `mem://constraints/nf-cancel-blocked-by-shipment-state`,
  `mem://constraints/nf-cancel-reopens-pv-clean`,
  `mem://constraints/shipping-draft-mirrors-pedido-venda`.
