// =============================================
// KIT UNBUNDLER (FISCAL ITEMS)
// Desmembra itens de NF (formato fiscal_invoice_items) em seus componentes.
//
// Esta função roda no momento da transição Pedido de Venda → Nota Fiscal
// (fiscal-prepare-invoice), depois que os itens do PV já foram clonados.
//
// Diferente do kit-unbundler.ts (que opera sobre order_items "crus"),
// este motor opera sobre o shape persistido em fiscal_invoice_items:
//   { codigo_produto, descricao, ncm, cfop, unidade, quantidade,
//     valor_unitario, valor_total, valor_desconto, origem, csosn, cst,
//     icms_*, pis_*, cofins_*, gtin, gtin_tributavel, cest, order_item_id,
//     numero_item, _weight_grams? }
//
// Regras:
// - Itens não-kit passam intactos (apenas re-numerados).
// - Kit sem componentes cadastrados → mantém como kit + warning.
// - Componentes herdam dados fiscais (NCM, CFOP override, GTIN, CEST,
//   origem, unidade, CSOSN/CST etc.) do cadastro do componente
//   (fiscal_products prioritário, products como fallback).
// - Tributos são RECALCULADOS por componente proporcionalmente ao novo
//   valor_total de cada componente (mesma lógica do calculateItemTaxes).
// - Distribuição proporcional de valor_total entre componentes preserva
//   o total original do kit (ajuste de centavos no último componente).
// - Peso bruto opcional: se _weight_grams vier nos itens originais,
//   componentes recebem peso do cadastro do componente; soma resultante
//   é devolvida para o caller recompor peso_bruto da NF.
// =============================================
import { calculateItemTaxes, type FiscalSettingsTax } from "./fiscal-tax-calculator.ts";

type FiscalItem = Record<string, any>;

export interface UnbundleFiscalItemsParams {
  supabase: any;
  items: FiscalItem[];
  taxSettings: FiscalSettingsTax;
  cfopFallback: string;
}

export interface UnbundleFiscalItemsResult {
  items: FiscalItem[];
  unbundled: boolean;
  kitsExpanded: number;
  kitsWithoutComponents: string[]; // descrições dos kits sem componentes
}

const sanitizeGtin = (v: any): string => {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return "SEM GTIN";
  if (s === "SEM GTIN") return "SEM GTIN";
  const digits = s.replace(/\D/g, "");
  if ([8, 12, 13, 14].includes(digits.length)) return digits;
  return "SEM GTIN";
};

const toIntOrigem = (raw: any): number => {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve o product_id (UUID) de cada item da NF:
 *   1) Via order_item_id → order_items.product_id (caminho oficial p/ PVs
 *      criados a partir de orders).
 *   2) Fallback por SKU (codigo_produto) → products.id (cobre PVs manuais).
 */
async function resolveProductIdsForItems(
  supabase: any,
  items: FiscalItem[],
): Promise<Map<number, string>> {
  // map: index do item → product_id
  const result = new Map<number, string>();

  const orderItemIds = items
    .map((it, idx) => ({ idx, oid: it.order_item_id }))
    .filter((x) => !!x.oid);

  if (orderItemIds.length > 0) {
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("id, product_id")
      .in("id", orderItemIds.map((x) => x.oid));
    const oiMap = new Map<string, string>(
      (orderItems || []).map((o: any) => [o.id, o.product_id]),
    );
    for (const x of orderItemIds) {
      const pid = oiMap.get(x.oid);
      if (pid) result.set(x.idx, pid);
    }
  }

  // Fallback por SKU para itens sem order_item_id ou cuja resolução falhou
  const missing = items
    .map((it, idx) => ({ idx, sku: String(it.codigo_produto || "").trim() }))
    .filter((x) => x.sku && !result.has(x.idx));

  if (missing.length > 0) {
    const skus = Array.from(new Set(missing.map((m) => m.sku)));
    const { data: prods } = await supabase
      .from("products")
      .select("id, sku")
      .in("sku", skus);
    const bySku = new Map<string, string>(
      (prods || []).map((p: any) => [String(p.sku), p.id]),
    );
    for (const m of missing) {
      const pid = bySku.get(m.sku);
      if (pid) result.set(m.idx, pid);
    }
  }

  return result;
}

export async function unbundleFiscalItems(
  params: UnbundleFiscalItemsParams,
): Promise<UnbundleFiscalItemsResult> {
  const { supabase, items, taxSettings, cfopFallback } = params;

  if (!items || items.length === 0) {
    return { items: [], unbundled: false, kitsExpanded: 0, kitsWithoutComponents: [] };
  }

  // 1) Resolver product_id de cada item
  const idxToProductId = await resolveProductIdsForItems(supabase, items);
  const productIds = Array.from(new Set(Array.from(idxToProductId.values())));

  if (productIds.length === 0) {
    // Nada para inspecionar → devolve original
    return { items, unbundled: false, kitsExpanded: 0, kitsWithoutComponents: [] };
  }

  // 2) Identificar quais product_ids são kits
  const { data: productsMeta } = await supabase
    .from("products")
    .select("id, product_format")
    .in("id", productIds);

  const kitIds = new Set<string>(
    (productsMeta || [])
      .filter((p: any) => p.product_format === "with_composition")
      .map((p: any) => p.id),
  );

  if (kitIds.size === 0) {
    return { items, unbundled: false, kitsExpanded: 0, kitsWithoutComponents: [] };
  }

  // 3) Buscar componentes de todos os kits de uma vez (cache local na requisição)
  const { data: allComponents } = await supabase
    .from("product_components")
    .select(`
      parent_product_id,
      quantity,
      sale_price,
      component:products!component_product_id(
        id,
        name,
        sku,
        price,
        ncm,
        cest,
        origin_code,
        gtin,
        barcode,
        weight
      )
    `)
    .in("parent_product_id", Array.from(kitIds))
    .order("sort_order");

  const componentsByKit = new Map<string, any[]>();
  for (const comp of (allComponents || [])) {
    const list = componentsByKit.get(comp.parent_product_id) || [];
    list.push(comp);
    componentsByKit.set(comp.parent_product_id, list);
  }

  // 4) Buscar dados fiscais de TODOS os componentes (e dos próprios kits, fallback)
  const componentProductIds = Array.from(
    new Set(
      (allComponents || [])
        .map((c: any) => c.component?.id)
        .filter(Boolean),
    ),
  );

  const { data: fiscalProds } = componentProductIds.length > 0
    ? await supabase
        .from("fiscal_products")
        .select("*")
        .in("product_id", componentProductIds)
    : { data: [] as any[] };
  const fiscalByProductId = new Map<string, any>(
    (fiscalProds || []).map((fp: any) => [fp.product_id, fp]),
  );

  // 5) Montar nova lista de itens (com expansão de kits)
  const output: FiscalItem[] = [];
  const kitsWithoutComponents: string[] = [];
  let kitsExpanded = 0;
  let anyChange = false;

  for (let idx = 0; idx < items.length; idx++) {
    const orig = items[idx];
    const pid = idxToProductId.get(idx);
    const isKit = pid && kitIds.has(pid);
    const components = isKit ? componentsByKit.get(pid!) : undefined;

    if (!isKit || !components || components.length === 0) {
      if (isKit && (!components || components.length === 0)) {
        kitsWithoutComponents.push(String(orig.descricao || orig.codigo_produto || "Kit"));
      }
      output.push({ ...orig });
      continue;
    }

    // Kit válido para desmembrar
    anyChange = true;
    kitsExpanded += 1;

    const kitQty = Number(orig.quantidade || 1);
    const kitValorTotal = Number(orig.valor_total || 0);
    const kitValorDesconto = Number(orig.valor_desconto || 0);

    // Valor de referência por componente (preço de venda do componente
    // dentro do kit, fallback para preço do produto)
    const refValues = components.map((c: any) => {
      const compPrice = (c.sale_price ?? c.component?.price ?? 0) as number;
      return compPrice * Number(c.quantity || 0);
    });
    const refTotal = refValues.reduce((s, v) => s + v, 0);

    // Acumuladores para ajuste de centavos no último componente
    let valorDistribuido = 0;
    let descontoDistribuido = 0;

    for (let ci = 0; ci < components.length; ci++) {
      const c = components[ci];
      if (!c.component) continue;

      const proportion = refTotal > 0
        ? refValues[ci] / refTotal
        : 1 / components.length;

      const componentQuantity = Number(c.quantity || 0) * kitQty;

      let componentValorTotal: number;
      let componentValorDesconto: number;
      const isLast = ci === components.length - 1;

      if (isLast) {
        // Ajusta para casar exatamente o total do kit (evita drift de centavos)
        componentValorTotal = round2(kitValorTotal - valorDistribuido);
        componentValorDesconto = round2(kitValorDesconto - descontoDistribuido);
      } else {
        componentValorTotal = round2(kitValorTotal * proportion);
        componentValorDesconto = round2(kitValorDesconto * proportion);
        valorDistribuido += componentValorTotal;
        descontoDistribuido += componentValorDesconto;
      }

      const componentUnitPrice = componentQuantity > 0
        ? round2(componentValorTotal / componentQuantity)
        : 0;

      const fp: any = fiscalByProductId.get(c.component.id) || {};
      const prod: any = c.component;
      const gtin = sanitizeGtin(prod.gtin || prod.barcode);
      const cestRaw = fp.cest || prod.cest;
      const taxes = calculateItemTaxes(componentValorTotal, taxSettings, fp);

      output.push({
        // numero_item será reatribuído no final
        order_item_id: orig.order_item_id || null,
        codigo_produto: prod.sku || prod.id?.substring(0, 8) || `COMP${ci + 1}`,
        descricao: prod.name || "Componente",
        ncm: fp.ncm || prod.ncm || "",
        cfop: fp.cfop_override || orig.cfop || cfopFallback,
        unidade: fp.unidade_comercial || "UN",
        quantidade: componentQuantity,
        valor_unitario: componentUnitPrice,
        valor_total: componentValorTotal,
        valor_desconto: componentValorDesconto,
        origem: toIntOrigem(fp.origem ?? prod.origin_code ?? 0),
        csosn: taxes.csosn,
        cst: taxes.cst,
        icms_base: taxes.icms_base,
        icms_aliquota: taxes.icms_aliquota,
        icms_valor: taxes.icms_valor,
        pis_cst: taxes.pis_cst,
        pis_base: taxes.pis_base,
        pis_aliquota: taxes.pis_aliquota,
        pis_valor: taxes.pis_valor,
        cofins_cst: taxes.cofins_cst,
        cofins_base: taxes.cofins_base,
        cofins_aliquota: taxes.cofins_aliquota,
        cofins_valor: taxes.cofins_valor,
        gtin,
        gtin_tributavel: gtin,
        cest: cestRaw
          ? String(cestRaw).replace(/\D/g, "").substring(0, 7) || null
          : null,
        // Marca rastreabilidade interna (não vai p/ SEFAZ; apenas auditoria)
        _from_kit_product_id: pid,
        _from_kit_description: orig.descricao || null,
        _component_weight_grams: Number(prod.weight || 0),
      });
    }
  }

  // Reatribui numero_item sequencial após expansão
  const renumbered = output.map((it, i) => ({ ...it, numero_item: i + 1 }));

  return {
    items: renumbered,
    unbundled: anyChange,
    kitsExpanded,
    kitsWithoutComponents,
  };
}
