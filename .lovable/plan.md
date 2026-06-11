# Padronizar SKU do Cadastro como Fonte Única do Código do Produto

## Problema confirmado
- NFs 421 e 422 (pedidos #612 e #613, Respeite o Homem) saíram com código `8259065f` em vez do SKU real `0001` do Shampoo Calvície Zero.
- Causa raiz: o item do pedido chega com SKU vazio (carrinho não persiste SKU), e o motor fiscal usa um fallback que pega os 8 primeiros caracteres do ID interno do produto.
- O mesmo padrão de fallback ruim existe em 5 pontos do fluxo fiscal, então qualquer caminho (pedido pago, PV manual, edição de rascunho, desmembramento de kit, duplicação) pode reproduzir o erro.

## Princípio da correção
**Quando o item tem produto cadastrado vinculado, o código que vai para a NF é SEMPRE o SKU do cadastro do produto.** O SKU do item do pedido vira fallback. O "prefixo do ID" some como fallback aceitável — quando não houver SKU nem produto vinculado, usa-se um código genérico explícito (`ITEM-1`, `ITEM-2`).

Isso vale para tudo que nasce com produto cadastrado: pedidos da loja, vendas manuais via seletor de produto, duplicação de PV/NF, componentes de kit desmembrado e edição de rascunho.

## Escopo da mudança (5 pontos)

1. **Pedido de Venda automático** (pedido pago da loja vira PV)
2. **Pedido de Venda gerado a partir de pedido existente** (chamada manual no módulo Fiscal)
3. **Pedido de Venda 100% manual** (venda fora da loja, via seletor de produto)
4. **Edição de rascunho de PV/NF**
5. **Desmembramento de kit** (componentes herdam SKU do cadastro do componente — já faz, mas garantir o mesmo fallback explícito)

Regra unificada em todos: `SKU do cadastro do produto → SKU enviado no item → "ITEM-N"`. Nunca mais prefixo de UUID.

## Validação técnica obrigatória pós-deploy
Sem isso a entrega não fecha:

- **Pedido novo de teste:** entrar um pedido com produto cadastrado, deixar virar PV automático, conferir que o código do item no PV é igual ao SKU do cadastro.
- **PV manual via seletor:** criar um PV manual, conferir que o código gravado é o SKU do cadastro.
- **Edição de rascunho:** abrir um PV em rascunho, salvar sem mudar nada, conferir que o código continua igual ao SKU do cadastro (e não vira o UUID).
- **Kit desmembrado:** emitir NF de um kit com desmembramento ativo, conferir que cada componente sai com o SKU do próprio cadastro do componente.
- **Pratika:** confirmar com você que a próxima NF chegou lá com o SKU correto.

## Backfill controlado (sem desperdício de processamento)
- **NFs já autorizadas (incluindo 421 e 422):** imutáveis na SEFAZ, não há o que fazer no documento fiscal. Permanecem como histórico.
- **Pedidos de Venda e NFs em rascunho (qualquer tenant):** rodar uma única atualização que substitui o código pelo SKU do cadastro APENAS quando o item tem produto vinculado E o código atual é o prefixo de 8 caracteres do ID do produto. Operação idempotente, escopo restrito, sem tocar em documento emitido.

## Anti-regressão (proteção permanente)
- Registrar a regra "SKU do cadastro é fonte única do código do produto na NF" como restrição formal do sistema, indexada na governança, para que nenhuma alteração futura reintroduza o fallback de UUID.
- Atualizar a especificação do módulo Fiscal com essa regra explícita.

## O que muda na sua experiência
- Você não vê nada diferente na tela.
- Próximas notas (manuais ou automáticas) sairão com o SKU correto no XML, no DANFE e na Pratika.
- Rascunhos que tinham o código errado serão corrigidos no mesmo deploy.

## O que NÃO faz parte desta entrega
- Corrigir o motivo do carrinho da loja não persistir o SKU no item do pedido. Isso é um problema separado (afeta relatórios e exportações) e merece tratamento próprio depois. A correção fiscal acima resolve o sintoma no documento fiscal independentemente disso.
- Mexer em NFs já autorizadas.

---

## Detalhes técnicos (referência)

**Arquivos com a mesma regra a ajustar:**
- `supabase/functions/fiscal-auto-create-drafts/index.ts` — linha 388
- `supabase/functions/fiscal-create-draft/index.ts` — linha 276
- `supabase/functions/fiscal-create-manual/index.ts` — linha 368
- `supabase/functions/fiscal-update-draft/index.ts` — linha 176
- `supabase/functions/_shared/kit-unbundler-fiscal-items.ts` — linha 322 (revisão defensiva)

**Lógica nova (mesma nos 5 pontos):**
```
resolveCodigoProduto(item, productMap):
  const cadastro = item.product_id ? productMap.get(item.product_id) : null;
  const skuCadastro = cadastro?.sku?.trim();
  if (skuCadastro) return skuCadastro;
  const skuItem = String(item.sku ?? item.codigo ?? item.codigo_produto ?? '').trim();
  if (skuItem && !isUuidPrefix(skuItem, item.product_id)) return skuItem;
  return `ITEM-${index + 1}`;
```
- `fiscal-update-draft` passa a aceitar `product_id` na linha e fazer o lookup em `products.sku` (hoje não faz lookup nenhum).
- `kit-unbundler-fiscal-items` já usa `prod.sku` (linha 322); ajustar só o fallback pra `COMP-N` em vez de prefixo de UUID.

**Backfill SQL (idempotente, escopo restrito):**
```sql
UPDATE fiscal_invoice_items fii
SET codigo_produto = p.sku
FROM fiscal_invoices fi, products p
WHERE fii.invoice_id = fi.id
  AND fii.product_id = p.id
  AND p.sku IS NOT NULL AND length(trim(p.sku)) > 0
  AND fi.status IN ('draft','rejected')  -- nunca authorized
  AND fii.codigo_produto = substring(fii.product_id::text, 1, 8);
```

**Restrição formal a criar:** `mem://constraints/fiscal-item-codigo-produto-sku-cadastro-source-of-truth` + indexação no índice de memórias e nota em `docs/especificacoes/erp/erp-fiscal.md`.
