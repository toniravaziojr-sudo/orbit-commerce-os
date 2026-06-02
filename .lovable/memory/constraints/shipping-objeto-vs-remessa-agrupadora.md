---
name: Objeto de Postagem vs Remessa agrupadora (modelo Bling)
description: Camada Remessa (shipping_remessas) agrega N objetos (shipments) no fluxo local Correios. Todo objeto emitido pertence a uma remessa mesmo de 1. Numeração Remessa_DDMMAAAA.HHMMSS por tenant. Pedidos gateway (Frenet) ficam fora. Objetos antigos sem remessa permanecem operáveis.
type: constraint
---

# Objeto de Postagem × Remessa agrupadora

## Regra inegociável

1. **Objeto de postagem** (`public.shipments`) é a unidade individual — 1 pedido = 1 objeto, com rastreio próprio, etiqueta, NF/DC e status. Nada do código atual muda; permanece a fonte de verdade da unidade.
2. **Remessa** (`public.shipping_remessas`) é o agrupador. Tem número único por loja (`Remessa_DDMMAAAA.HHMMSS` em BRT, sufixo `-N` em colisão), transportadora, descrição, status (`rascunho|emitida|parcial|despachada|finalizada|cancelada`), protocolo PLP e contadores (`total_objetos`, `total_emitidos`, `total_falhas`).
3. **Vínculo:** `shipments.remessa_id` é nullable com `ON DELETE SET NULL`. Todo objeto emitido pelo fluxo local (Correios) deve pertencer a uma remessa, mesmo de 1 objeto.
4. **Escopo:** apenas fluxo local (`shipping_providers.provider_kind='local'`). Pedidos via gateway (Frenet) **não entram** em remessa; continuam no fluxo `gateway-sync-order` + `gateway-attach-fiscal-doc`.
5. **Numeração:** sempre via `public.allocate_remessa_numero(p_tenant_id)` (SECURITY DEFINER, search_path=public, revogada de anon). Nunca compor o número no client.
6. **Contadores:** trigger `shipments_sync_remessa_counters` + função `public.recalc_remessa_counters(p_remessa_id)` recalculam automaticamente em INSERT/UPDATE/DELETE de `shipments`. Não atualizar contadores manualmente.
7. **Status da remessa não é status do pedido.** Status do pedido continua sendo escrito pelos fluxos atuais (`shipping-create-shipment` → `dispatched`; `tracking-poll` → `shipped`). Status da remessa é puramente operacional do agrupador.

## O que NUNCA pode acontecer

- Apagar uma remessa apagar o objeto postado. FK é `ON DELETE SET NULL`.
- Emissão individual exigir remessa pré-existente — o serviço de emissão deve criar uma remessa de 1 automaticamente quando o operador clica "Emitir" em um objeto único (compatibilidade total com o fluxo atual).
- Objeto antigo (sem `remessa_id`) deixar de ser imprimível, rastreável ou ter NF/DC reimpressas.
- Pedido gateway (`resolved_shipping_provider_kind='gateway'`) ser vinculado a uma remessa.
- Pratika, notificações de despacho/postagem ou o espelho PV ↔ objeto serem tocados por essa camada — Pratika continua disparando por objeto, idempotente.
- RLS permitir leitura/escrita por outro tenant. Todas as policies passam por `user_belongs_to_tenant(auth.uid(), tenant_id)`.
- DELETE de remessa em status diferente de `rascunho`.
- Aba Remessas aplicar filtro padrão que esconda remessas — decisão de UX (entrega 2026-06-02): **sem filtro padrão**, transparência total.

## Arquivos

- Migração: `supabase/migrations/*shipping_remessas_*.sql` (2026-06-02).
- Tabela: `public.shipping_remessas`.
- Coluna: `public.shipments.remessa_id`.
- Funções: `public.allocate_remessa_numero(uuid)`, `public.recalc_remessa_counters(uuid)`.
- Triggers: `shipping_remessas_touch`, `shipments_sync_remessa_counters`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Objeto de Postagem × Remessa agrupadora".
- Memórias relacionadas:
  - `mem://constraints/shipping-emit-equals-dispatched-tracking-equals-shipped`
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://constraints/shipping-draft-mirrors-pedido-venda`
  - `mem://features/logistics/gateway-vs-local-shipping-routing`
  - `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`
