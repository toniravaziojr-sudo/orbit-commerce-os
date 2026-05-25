---
name: CFOP Source of Truth — Natureza de Operação
description: CFOP é exclusivamente derivado da Natureza de Operação vinculada à nota + UF emitente vs destinatário. Proibido voltar a colocar CFOP no produto ou em CFOP global do emitente.
type: constraint
---

# CFOP — Fonte única: Natureza de Operação (rev 2026-05-25)

## Regra permanente

O CFOP de qualquer nota fiscal vem **exclusivamente** da Natureza de Operação vinculada à nota, decidindo automaticamente entre **CFOP intra (5xxx)** e **CFOP inter (6xxx)** pela comparação entre a UF do emitente (Configurações Fiscais) e a UF do destinatário da nota.

## O que é proibido

- **Proibido** adicionar campo de CFOP no cadastro de Produto (tabela `fiscal_products`).
- **Proibido** adicionar campos de CFOP global nas Configurações Fiscais do emitente (tabela `fiscal_settings`).
- **Proibido** o motor de emissão (`fiscal-auto-create-drafts`, `fiscal-create-draft`, `fiscal-create-manual`) ler CFOP a partir do produto ou de um CFOP global.
- **Proibido** o ProductSelector exibir/derivar CFOP do produto.

## O que é obrigatório

- Cada tenant recebe automaticamente o catálogo padrão de 16 Naturezas-sistema via `seed_system_operation_natures` (trigger `AFTER INSERT` em `tenants` + backfill já executado).
- Toda nota fiscal tem natureza obrigatoriamente vinculada (`fiscal_invoices.natureza_operacao_id`).
- Configurações Fiscais expõe seletor **"Natureza padrão para vendas automáticas"** (`fiscal_settings.default_sales_nature_id`) usado em notas geradas automaticamente.
- Hierarquia de resolução no motor (helper `_shared/fiscal-nature-resolver.ts`): ID/nome explícito → padrão do tenant → "Venda de Mercadoria" do sistema → fallback 5102/6102.
- No editor de NF, trocar Natureza ou UF do destinatário recalcula CFOP de **todos os itens** automaticamente via `pickCfopForUf`.
- Override manual por item é permitido, mas exige indicação visual ("manual") e botão "Restaurar" para voltar ao padrão da natureza.

## Campos legados removidos (Fase 5)

- `fiscal_products.cfop_override` — removido em 2026-05-25
- `fiscal_settings.cfop_intrastadual` — removido em 2026-05-25
- `fiscal_settings.cfop_interestadual` — removido em 2026-05-25

Os campos `fiscal_invoices.cfop` e `fiscal_invoice_items.cfop` permanecem — são o **resultado** da resolução (não a fonte) e suportam override manual.

## Quando alguém propuser violar isto

Pare. Releia esta memória. Esta regra existe porque CFOP por produto causou inconsistência crônica (NF de transferência saindo com 5102 de venda) — a Natureza é o único contexto que carrega a semântica fiscal correta da operação.
