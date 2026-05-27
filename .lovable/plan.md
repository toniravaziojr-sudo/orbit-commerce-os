## 📋 Checklist de Conformidade
- Doc de Regras lido (governança documental, espelho PV↔Remessa)
- Memórias `shipping-draft-mirrors-pedido-venda` e `shipment-mirrors-pedido-venda-em-aberto` consultadas
- Fluxo afetado: criação manual/duplicada de Pedido de Venda → Rascunho Logístico (Remessas)
- Fonte de verdade: `fiscal_invoices` (PV raiz) → `shipping_draft_queue` → `shipments`
- Módulos impactados: Fiscal (criação/duplicação/exclusão de PV) e Logística (fila e remessas)
- UI: nenhuma mudança visual

## Como funciona hoje
Quando um PV nasce de um pedido real da loja, tudo flui: o gatilho enfileira o rascunho e o processador cria a remessa lendo dados do pedido. Mas quando o PV é criado **manualmente ou por duplicação** (sem pedido real), a fila até recebe o item, porém o processador tenta buscar um pedido inexistente, falha e o rascunho nunca vira remessa visível na aba "Prontos para emitir remessa". Na duplicação ainda se perde a informação do serviço (ex.: PAC).

Hoje também não há regra que limpe automaticamente um rascunho de remessa quando o PV correspondente é excluído sem ter virado pedido real.

## O problema (caso Lesinete)
- PV 346 (original, com pedido real) → tem remessa rascunho ✅
- PV 347 (duplicado, sem pedido real) → fila tentou processar, falhou com erro de pedido inexistente, **rascunho de remessa nunca apareceu** ❌
- Se você excluir um PV duplicado/manual, hoje nada acontece na fila de Remessas ❌

## O que eu faria
1. **Independência total do pedido real**: o processador da fila passa a aceitar PV sem pedido vinculado. Ele lê endereço, peso, dimensões e transportadora direto do próprio Pedido de Venda (cabeçalho + itens + cadastro de produtos). Resultado: o rascunho aparece automaticamente em "Prontos para emitir remessa", igual a qualquer outro.

2. **Inferência correta da transportadora**: na duplicação, copiar também o serviço (PAC/SEDEX/etc.) do PV de origem, não só o nome da transportadora. No enfileiramento, usar a transportadora do próprio PV quando não houver pedido (em vez de cair em "manual").

3. **Exclusão reflete na fila**: ao excluir um PV em aberto (manual ou duplicado), o rascunho de remessa correspondente é removido automaticamente — desde que ainda não tenha código de rastreio postado. Remessas já despachadas permanecem intocadas.

4. **Regularização do PV 347 (Lesinete)**: criar o rascunho de remessa que ficou faltando, para que você consiga emitir a etiqueta dele normalmente. Os 2 rascunhos órfãos do PV 346 e 347 ficarão corretos lado a lado.

## Resultado final
- Toda forma de criar Pedido de Venda — automática (pedido real), manual ou duplicação — gera rascunho logístico se o transporte for local (Correios/transportadora própria).
- Pedidos via gateway (Frenet etc.) continuam com fluxo próprio, sem rascunho local (regra atual preservada).
- Excluir um PV em aberto remove o rascunho da fila de Remessas, sem nunca tocar em pedido real ou remessa já despachada.
- Caso Lesinete fica regularizado.

## Bloco técnico (referência)
1. `enqueue_shipping_draft_from_pv`: usar `NEW.transportadora_nome` como provider quando `order_id IS NULL`.
2. `scheduler-tick` PHASE 1.6: fallback para `fiscal_invoices` + `fiscal_invoice_items`+`products` quando `order_id` é nulo; inserir shipment com `source_pedido_venda_id` e `order_id=NULL`.
3. `sync_shipment_with_pv_status`: ramo paralelo para `order_id IS NULL` usando `source_pedido_venda_id` na limpeza ao sair de `em_aberto`.
4. Novo trigger `AFTER DELETE` em `fiscal_invoices` para remover shipment rascunho (sem tracking) vinculado ao PV excluído.
5. `fiscal-create-manual` (duplicação): propagar `transportadora_servico` do PV de origem.
6. Backfill: criar shipment rascunho para o PV 347 (Lesinete) — uma inserção manual via tool de Insert.

## 📝 Documentação a atualizar (no fechamento)
- `docs/especificacoes/erp/logistica.md` — seção "Origem do rascunho logístico": deixar explícito que PV manual/duplicado também gera rascunho.
- `docs/especificacoes/erp/rascunhos-logisticos.md` — fluxo do processador da fila com fallback para PV sem pedido.
- Memória `mem://constraints/shipping-draft-mirrors-pedido-venda` — ajustar nota sobre processador.

📌 Status: Aguardando aprovação do plano revisado.
