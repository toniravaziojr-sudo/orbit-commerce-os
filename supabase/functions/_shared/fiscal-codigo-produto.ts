/**
 * Fiscal: resolução universal do código do produto (codigo_produto) para
 * fiscal_invoice_items.
 *
 * REGRA OFICIAL (anti-regressão):
 *   1) Se houver product_id vinculado E o cadastro de produto tiver SKU
 *      preenchido → SKU do cadastro é a FONTE ÚNICA da verdade.
 *   2) Senão, usa o SKU/código enviado no item — desde que não seja apenas
 *      o prefixo do UUID do produto (resíduo do bug histórico).
 *   3) Fallback final: ITEM-N (genérico, explícito, sem UUID).
 *
 * NUNCA usar substring(product_id) como código — esse era o defeito que
 * fazia o XML/DANFE/Pratika gravarem "8259065f" no lugar do SKU real "0001".
 *
 * Doc: docs/especificacoes/erp/erp-fiscal.md
 * Mem: mem://constraints/fiscal-item-codigo-produto-sku-cadastro-source-of-truth
 */

export interface CodigoProdutoItem {
  product_id?: string | null;
  sku?: string | null;
  codigo?: string | null;
  codigo_produto?: string | null;
}

export interface CodigoProdutoCadastro {
  sku?: string | null;
}

export type CodigoProdutoLookup =
  | Map<string, CodigoProdutoCadastro | undefined>
  | ((productId: string) => CodigoProdutoCadastro | undefined);

function isUuidPrefixOf(code: string, productId?: string | null): boolean {
  if (!productId) return false;
  const c = code.trim().toLowerCase();
  if (!c) return false;
  // 8 chars hex iguais aos primeiros do UUID = resíduo do bug histórico
  if (c.length !== 8) return false;
  if (!/^[0-9a-f]{8}$/.test(c)) return false;
  return productId.toLowerCase().startsWith(c);
}

export function resolveCodigoProduto(
  item: CodigoProdutoItem,
  lookup: CodigoProdutoLookup | null | undefined,
  index: number,
): string {
  const productId = item.product_id || null;

  // 1) Cadastro do produto é fonte da verdade
  if (productId && lookup) {
    const cadastro =
      typeof lookup === 'function' ? lookup(productId) : lookup.get(productId);
    const skuCadastro = String(cadastro?.sku ?? '').trim();
    if (skuCadastro) return skuCadastro;
  }

  // 2) SKU/código enviado no item (apenas se não for prefixo de UUID)
  const skuItem = String(
    item.sku ?? item.codigo ?? item.codigo_produto ?? '',
  ).trim();
  if (skuItem && !isUuidPrefixOf(skuItem, productId)) {
    return skuItem;
  }

  // 3) Fallback genérico explícito — JAMAIS o UUID
  return `ITEM-${index + 1}`;
}
