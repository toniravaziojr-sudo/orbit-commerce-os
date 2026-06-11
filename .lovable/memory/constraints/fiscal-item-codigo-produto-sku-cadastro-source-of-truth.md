---
name: Fiscal Item codigo_produto = SKU do Cadastro (Fonte Única)
description: codigo_produto em fiscal_invoice_items SEMPRE vem de products.sku quando há product_id. Proibido usar substring(product_id) como fallback. Helper canônico em _shared/fiscal-codigo-produto.ts (resolveCodigoProduto).
type: constraint
---

## Regra

Em **qualquer** caminho que insere/atualiza `fiscal_invoice_items`:

1. Se `product_id` existe e `products.sku` está preenchido → `codigo_produto = products.sku`.
2. Senão, usar SKU/código enviado no item, desde que **não** seja prefixo de 8 hex do UUID do produto.
3. Fallback final: `ITEM-N` (ou `COMP-N` em componente de kit). **Jamais** `product_id.substring(0,8)`.

Helper canônico: `supabase/functions/_shared/fiscal-codigo-produto.ts::resolveCodigoProduto(item, productMap, index)`.

## Pontos cobertos (obrigatório usar o helper)

- `supabase/functions/fiscal-auto-create-drafts/index.ts` (PV automático do pedido pago)
- `supabase/functions/fiscal-create-draft/index.ts` (PV manual a partir de pedido)
- `supabase/functions/fiscal-create-manual/index.ts` (PV 100% manual via seletor)
- `supabase/functions/fiscal-update-draft/index.ts` (edição de rascunho de PV/NF)
- `supabase/functions/_shared/kit-unbundler-fiscal-items.ts` (componentes de kit desmembrado — usa SKU do cadastro do componente; fallback `COMP-N`)

Qualquer **novo** edge function que toque `fiscal_invoice_items.codigo_produto` deve consumir o helper. Code review deve rejeitar `product_id?.substring(0, 8)`.

## Por quê

NFs 421/422 do Respeite o Homem (jun/2026) saíram com `8259065f` no lugar do SKU `0001`. O carrinho da loja não persistia SKU no item do pedido e o motor fiscal caía no fallback `product_id.substring(0, 8)`. Quebrava XML, DANFE e SOAP da Pratika (WMS). NFs já autorizadas viraram histórico imutável; rascunhos foram corrigidos via UPDATE idempotente.

## Backfill seguro (idempotente)

```sql
UPDATE fiscal_invoice_items fii
SET codigo_produto = p.sku
FROM fiscal_invoices fi, products p
WHERE fii.invoice_id = fi.id
  AND fii.product_id = p.id
  AND p.sku IS NOT NULL AND length(btrim(p.sku)) > 0
  AND fi.status IN ('draft','rejected')
  AND fii.codigo_produto = substring(fii.product_id::text, 1, 8);
```

Nunca tocar em `status='authorized'`. NF autorizada é imutável.

## Validação obrigatória após qualquer mudança nesse fluxo

- PV automático de novo pedido com produto cadastrado → `codigo_produto = products.sku`.
- PV manual via seletor → idem.
- Edição de rascunho → idem (lookup do SKU é refeito no save).
- Kit desmembrado → cada componente sai com o SKU do próprio cadastro.
- Conferir no WMS (Pratika): SKU no XML SOAP bate com cadastro.
