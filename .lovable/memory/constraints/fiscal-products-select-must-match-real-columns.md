---
name: Fiscal Products Select Must Match Real Columns
description: Motores de Pedido de Venda (fiscal-auto-create-drafts, fiscal-create-draft) só podem selecionar colunas que existam de fato em `products`. Qualquer coluna inexistente faz o PostgREST devolver erro silencioso e a leitura volta vazia — quebrando a precedência fiscal_products → products e gerando "Pendente sem NCM" mesmo com cadastro completo.
type: constraint
---

**Regra:** Em `fiscal-auto-create-drafts/index.ts` e `fiscal-create-draft/index.ts`, o `supabase.from('products').select(...)` que alimenta o fallback de dados fiscais NUNCA pode listar colunas inexistentes em `public.products`.

**Colunas reais permitidas hoje em `products` para esse select:** `id, ncm, cest, origin_code, gtin, barcode, weight`. **Proibido**: `unit_of_measure` (não existe). Unidade vem só de `fiscal_products.unidade_comercial`; quando ausente, default literal `'UN'`.

**Por quê:** PostgREST falha a query inteira ao encontrar coluna inexistente, `productsData` retorna `null/[]`, o mapa `productMap` fica vazio e o fallback `fiscalProduct?.ncm || product?.ncm || ''` resolve para `''`. O trigger `trg_recompute_pedido_venda_pendencias` então marca "Produto X sem NCM válido" — sintoma idêntico a cadastro incompleto, mascarando a regressão.

**Incidente raiz:** v2026-05-17 (Onda 3 auto-herança) incluiu `unit_of_measure` no select dos dois motores. Pedido #467 (loja, automático) ficou "Pendente" mesmo com NCM 33051000 cadastrado.

**Aplicação:**
1. Qualquer alteração nesses dois selects deve cruzar a lista contra `information_schema.columns WHERE table_name='products'` antes do deploy.
2. Mudanças no schema de `products` (adicionar/remover coluna usada por esses motores) exigem revisão coordenada dos dois arquivos.
3. Documentado em `docs/especificacoes/erp/erp-fiscal.md` seção "Auto-herança de dados comerciais".
