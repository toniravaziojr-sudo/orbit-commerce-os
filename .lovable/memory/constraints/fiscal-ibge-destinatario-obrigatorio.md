---
name: Fiscal IBGE do Destinatário Obrigatório
description: O código IBGE do município do destinatário (`fiscal_invoices.dest_endereco_municipio_codigo`) é obrigatório no XML da NFe (campo `cMun`). A busca silenciosa por nome de cidade pode falhar (typo, acento, abreviação). Tanto o trigger de pendências do Pedido de Venda quanto o motor `fiscal-prepare-invoice` devem exigir 7 dígitos nesse campo antes de declarar o pedido apto à emissão.
type: constraint
---

**Regra:** `dest_endereco_municipio_codigo` precisa conter exatamente 7 dígitos para o Pedido de Venda sair de "Pendente" e para a NF entrar em "pronta_emitir". Qualquer valor vazio ou diferente de 7 dígitos gera pendência com a mensagem PT-BR: **"Cidade do cliente não localizada na base oficial de municípios — confirme a grafia da cidade no endereço."**

**Onde está implementado:**
1. `public.compute_pedido_venda_pendencias(uuid)` — trigger SQL que mantém `pendencia_motivos` do Pedido de Venda.
2. `supabase/functions/fiscal-prepare-invoice/index.ts` — bloqueia transição para `pronta_emitir`.

**Por quê:** o lookup de IBGE (`getIbgeCodigo` em `fiscal-auto-create-drafts` e `fiscal-create-draft`) é feito por nome de cidade contra `ibge_municipios`. Quando o cliente digita errado ("São Franciaco do Sul"), o lookup devolve `null` sem erro e o campo é gravado vazio. Sem essa validação dupla, o pedido aparece "Em aberto", a NF é movida para "Pronto para Emitir" e só estoura na SEFAZ na emissão real — gerando rejeição opaca para o lojista.

**Incidente raiz:** 2026-05-18b, Pedido #467 (Pedido de Venda 1-285).

**Aplicação:**
1. Qualquer novo motor que crie/transicione `fiscal_invoices` para estágios pós-`pedido_venda` deve exigir IBGE do destinatário antes de avançar.
2. Mudanças no lookup IBGE (ou na tabela `ibge_municipios`) não dispensam essa validação — defesa em profundidade é regra.
3. Documentado em `docs/especificacoes/erp/erp-fiscal.md` (Hotfix 2026-05-18b).
