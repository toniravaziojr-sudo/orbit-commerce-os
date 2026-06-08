---
name: Objeto de Postagem tem numeração própria e nunca pode ser criado manualmente
description: shipments.numero é sequencial por tenant, alocado por trigger BEFORE INSERT via allocate_shipment_numero(). Listas de Logística (Objetos, Rastreios, objetos dentro de Remessa) ordenam por shipments.numero DESC. Criação manual de objeto pela UI de Logística está proibida — todo objeto nasce de um Pedido de Venda.
type: constraint
---

# Objeto de Postagem: numeração própria + sem criação manual

## Regra inegociável (2026-06-08)

1. Todo Objeto de Postagem (`public.shipments`) tem `numero bigint NOT NULL`,
   sequencial por `tenant_id`, começando em 1.
2. O `numero` é **sempre** alocado por trigger `BEFORE INSERT`
   (`trg_shipments_set_numero` → `public.shipments_set_numero` →
   `public.allocate_shipment_numero(p_tenant_id)`), com advisory lock por
   tenant. Nenhum chamador (PHASE 1.6 do `scheduler-tick`,
   `shipping-create-shipment`, reconciliação de PV órfão, edição manual)
   precisa passar `numero` — fica sempre nulo no INSERT e o trigger preenche.
3. Unicidade `(tenant_id, numero)` garantida por
   `shipments_tenant_numero_key`. Índice `idx_shipments_tenant_numero_desc`
   acelera a listagem.
4. **Ordenação universal** nas listas de Logística passa a usar `shipments.numero`:
   - Aba "Objetos de postagem" (Prontos / Emitidos / Pendentes) em
     `ShipmentGenerator.tsx` (`shipmentOrderKey = s.numero`).
   - Aba "Rastreios" em `TrackingTab.tsx`.
   - Tabela interna de objetos dentro de uma Remessa em `RemessasManager.tsx`.
   - Todas via `sortByNumberDesc(items, s => s.numero, s => s.created_at)`.
5. **Criação manual de Objeto de Postagem foi removida da UI**. O botão
   "Criar novo objeto" da aba "Prontos para emitir" não existe mais.
   O `DraftShipmentDialog` continua existindo, mas **só é aberto via
   `openEditDraft(id)`** — nunca com `id=null`. Todo objeto nasce a partir
   de um Pedido de Venda (manual, duplicado ou criado automaticamente
   por pedido pago).
6. A coluna "Pedido" das listas de Objetos virou "Objeto": a linha mostra
   `#{numero}` em destaque, com o Pedido vinculado (`Pedido #X`) ou PV
   (`PV X`) como texto secundário.

## Por que existe esta regra

- Antes, a coluna "Pedido" misturava número de Pedido e número de PV como
  chave de ordenação. Objetos recriados por auto-cura/reconciliação ou
  duplicação caíam em posições aleatórias, dando impressão de que o
  objeto "não foi criado".
- A criação manual permitia objetos órfãos sem produto, sem peso e sem
  rastreabilidade fiscal — fere o vínculo canônico
  (`mem://constraints/shipping-canonical-link-is-pv-not-order`).

## O que NUNCA pode acontecer

- Inserir em `public.shipments` passando `numero` explícito a partir de
  código de aplicação (deixar sempre `NULL` para o trigger alocar).
- Reaproveitar o `numero` de um objeto cancelado/descartado — a sequência
  é monotonicamente crescente por tenant.
- Voltar a ordenar listas de objetos por `created_at DESC` ou pelo número
  do Pedido/PV.
- Reintroduzir botão/diálogo/edge function de "criar novo objeto" sem
  origem em Pedido de Venda. Edição de objeto existente continua liberada.
- Remover ou afrouxar o trigger `trg_shipments_set_numero` ou o índice
  único `shipments_tenant_numero_key`.

## Arquivos

- Migração: `supabase/migrations/*shipments_own_numero*.sql` (2026-06-08).
- Função: `public.allocate_shipment_numero(uuid)` (SECURITY DEFINER,
  search_path=public, EXECUTE só para authenticated/service_role).
- Trigger: `trg_shipments_set_numero` em `public.shipments`.
- UI: `src/components/shipping/ShipmentGenerator.tsx`,
  `src/components/shipping/TrackingTab.tsx`,
  `src/components/shipping/RemessasManager.tsx`.
- Utilitário de sort: `src/lib/sort-numeric.ts` (`sortByNumberDesc`).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Numeração própria
  do Objeto de Postagem".
- Memórias relacionadas:
  - `mem://constraints/operational-lists-numeric-desc-sort`
  - `mem://constraints/shipping-objeto-vs-remessa-agrupadora`
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://constraints/shipping-draft-mirrors-pedido-venda`
