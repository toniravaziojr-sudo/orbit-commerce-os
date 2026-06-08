---
name: Cancelar NF devolve o PV para "Pedido em aberto" sem observação
description: Após cancelar uma NF, o PV pai volta para pedido_status='em_aberto', com pendencia_motivos zerada e sem observação herdada ("NF cancelada"/"Pedido sem itens"/etc.). Shipments vinculados são marcados como cancelled, com invoice_id desligado para liberar exclusão futura da NF.
type: constraint
---

# Pós-cancelamento de NF: PV volta limpo

## Regra inegociável (2026-06-08)

Quando uma NF de venda autorizada é cancelada com sucesso, a edge
`fiscal-cancel` executa, na mesma transação lógica:

1. **Atualiza a NF** para `status='cancelled'` (já existia).
2. **Cancela os objetos logísticos vinculados** (`invoice_id` OU
   `source_pedido_venda_id`):
   - `delivery_status = 'cancelled'`
   - `action_reason = 'invoice_cancelled'`
   - `requires_action = false`
   - `invoice_id = NULL` ← **desliga o vínculo** para liberar exclusão
     futura da NF (a FK `shipments.invoice_id` é `ON DELETE SET NULL`,
     mas zerar aqui é defesa adicional + evita objeto fantasma apontando
     para nota cancelada).
3. **Limpa o PV pai** (`source_order_invoice_id`):
   - `pendencia_motivos = NULL`
   - `recompute_pv_pedido_status(pv_id)` é chamado em seguida.

Resultado: o PV volta para `pedido_status='em_aberto'`, sem nenhuma
observação herdada. Pode emitir uma nova NF normalmente.

## O que NUNCA pode acontecer

- PV ficar com observação "NF cancelada", "Pedido sem itens" ou qualquer
  outro motivo herdado após o cancelamento.
- `requires_action=true` ficar pendurado em shipments depois do
  cancelamento (foi a UI antiga; descontinuada).
- `invoice_id` continuar apontando para a NF cancelada — impede exclusão
  futura.
- Excluir o passo `recompute_pv_pedido_status` da edge — sem ele o PV
  pode ficar com status visual obsoleto.

## Caso de origem

PV 403 / NF 404 / objeto AP053729025BR (Respeite o Homem, 2026-06-08).
O ciclo anterior deixou `pendencia_motivos = ['Pedido sem itens.']` no
PV mesmo após o cancelamento, levando a UI a renderizar "Pendente" com
motivo fantasma. A revisão remove a observação na hora do cancelamento.

## Arquivos

- Edge: `supabase/functions/fiscal-cancel/index.ts` (bloco "PÓS-CANCELAMENTO").
- Função: `public.recompute_pv_pedido_status(uuid)`.
- Doc: `docs/especificacoes/erp/erp-fiscal.md` §"Cancelamento de NF × Objeto Logístico".
- Memória relacionada: `mem://constraints/nf-cancel-blocked-by-shipment-state`.
