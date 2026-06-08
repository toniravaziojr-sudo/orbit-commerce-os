---
name: Shipping delivery_status enum spelling — canonical "canceled" (1 L)
description: O enum delivery_status de shipments usa 'canceled' (um L). Grafia 'cancelled' (dois L) NÃO existe e quebra triggers/edge functions/UI com erro de cast. NF (fiscal_invoices.status) continua usando 'cancelled' (dois L) — não confundir.
type: constraint
---
Em 2026-06-08, uma entrega anterior introduziu `'cancelled'` (dois L,
padrão britânico) em triggers de cascata de exclusão de Pedido de Venda,
na edge function `fiscal-cancel` e em validações da UI. Resultado:
qualquer comparação ou UPDATE com `delivery_status = 'cancelled'`
disparava `invalid input value for enum delivery_status: "cancelled"` e
travava:

- Exclusão de PV em cascata (objeto + remessa individual).
- Cancelamento de NF (pós-cancelamento marca o objeto vinculado).
- Guarda de exclusão de remessa (`guard_remessa_deletion`).

**Regra:**
- `shipments.delivery_status` (enum `public.delivery_status`) — valor
  canônico é **`canceled`** (um L, padrão americano). Único valor aceito
  pelo enum. Toda comparação/UPDATE/INSERT deve usar essa grafia.
- `fiscal_invoices.status` — continua usando **`cancelled`** (dois L).
  São tabelas e enums diferentes; não confundir.

**Como aplicar:**
- Em novos triggers/edge functions/componentes que toquem em
  `shipments.delivery_status`, usar sempre `'canceled'`. Nunca casar com
  `COALESCE(delivery_status, '')` — o cast de string vazia para o enum
  também falha; use `delivery_status::text` quando precisar comparar com
  texto livre.
- Em mensagens da UI sobre exclusão de registro fiscal, sempre
  diferenciar **Pedido de Venda** de **Nota Fiscal** (proibido o texto
  genérico "Erro ao excluir nota" quando o registro pode ser um PV).
- Bloqueio de exclusão de PV com objeto em andamento/entregue é
  obrigatório **no banco** (trigger `cascade_delete_shipments_on_pv_delete`
  com guarda `PV_SHIPMENT_IN_PROGRESS`), não só na tela.

**Caso de origem:** PV 403 / NF 404 / objeto AP053729025BR (Respeite o
Homem, 2026-06-08). Migration de correção:
`20260608202652_*` + `20260608202804_*`.

**Anti-regressão:** antes de qualquer entrega que toque cancelamento de
objeto logístico, conferir que o valor usado é `canceled` (1 L) e rodar
um INSERT/UPDATE real contra o enum para validar.
