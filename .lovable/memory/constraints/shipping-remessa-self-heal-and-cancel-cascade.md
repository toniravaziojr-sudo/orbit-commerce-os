---
name: Shipping Remessa Self-Heal and NF Cancel Cascade
description: Agrupador de remessa nunca pode ficar órfão; cancelamento de NF deve apagar etiquetas rascunho e bloquear emitidas.
type: constraint
---

# Logística × Fiscal — Integridade entre etiquetas, agrupadores e NF

## Regras estruturais obrigatórias

1. **Toda etiqueta com `tracking_code` SEMPRE tem `remessa_id` válido.**
   - Garantido pelo gatilho `trg_ensure_shipment_has_remessa` (BEFORE INSERT/UPDATE em `shipments`).
   - Se a etiqueta for criada/atualizada sem agrupador (ou apontando para um agrupador inexistente), o gatilho cria um novo `shipping_remessas` automaticamente, com status `despachada` e descrição `Agrupador recuperado automaticamente para objeto <tracking>`.
   - Aba "Objetos" e aba "Remessas" passam a ser 1:1 sempre.

2. **Agrupador (`shipping_remessas`) não pode ser apagado se tiver etiquetas ativas.**
   - Garantido pelo gatilho `trg_guard_remessa_deletion` (BEFORE DELETE em `shipping_remessas`).
   - Bloqueia exclusão se houver `shipments` com `tracking_code IS NOT NULL` e `delivery_status NOT IN ('cancelled','cancelado')` vinculados.
   - Mensagem PT-BR exposta ao usuário: "Não é possível excluir esta remessa: existem N objeto(s) de postagem ativo(s) vinculado(s)."

3. **Cancelar a NF cascata para as etiqueteas vinculadas.**
   - Implementado em `supabase/functions/fiscal-cancel/index.ts`.
   - Etiquetas RASCUNHO vinculadas à NF (sem `tracking_code`) são DELETADAS automaticamente.
   - Etiquetas EMITIDAS (com `tracking_code`) são marcadas com `requires_action=true` e `action_reason='invoice_cancelled'` — operação física segue, mas UI bloqueia novos despachos e expõe banner exigindo decisão.
   - Filtro `manually_adjusted=false` protege ajustes feitos à mão pelo lojista.

## O que NÃO fazer

- Não apagar `shipping_remessas` direto via UI/SQL sem antes desvincular ou cancelar todas as etiquetas — o gatilho irá bloquear.
- Não criar etiqueta com `tracking_code` populado e `remessa_id=NULL` na esperança de "linkar depois" — o gatilho de self-heal cria um agrupador novo na mesma transação, gerando ruído operacional.
- Não modificar `fiscal-cancel` removendo a etapa de cascata de drafts — isso reintroduz o bug Maria #583 (PV ficou com etiqueta órfã despachada após cancelamento da NF).

## Anti-regressão

- Caso recorrência: **objeto de postagem visível em "Objetos" mas ausente em "Remessas"** → executar `SELECT id, tracking_code, remessa_id FROM shipments WHERE tracking_code IS NOT NULL AND remessa_id IS NULL` para mapear órfãos; um simples `UPDATE shipments SET updated_at=now() WHERE id IN (...)` aciona o self-heal e religa.
- Caso recorrência: **NF cancelada deixa etiqueta válida nos Correios** → verificar logs de `fiscal-cancel`; se a cascata não rodou, conferir se `invoice_id` está populado no `shipments` no momento do cancelamento.

## Caso de origem
Bug Maria pedido #583 (2026-06-05): teste E2E sobre pedido real produziu NF cancelada + etiqueta despachada órfã sem agrupador. Limpeza pontual feita (PV voltou a "Em aberto"); proteções estruturais aplicadas.
