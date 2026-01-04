// =============================================
// KIT UNBUNDLER - Desmembra kits em componentes
// =============================================

interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface UnbundledItem extends OrderItem {
  original_kit_id?: string;
  original_kit_name?: string;
  is_from_kit?: boolean;
}

interface ProductComponent {
  quantity: number;
  sale_price: number | null;
  component: {
    id: string;
    name: string;
    sku: string;
    price: number;
    cost_price: number | null;
  } | null;
}

/**
 * Desmembra itens de kit em seus componentes individuais
 * @param supabase - Cliente Supabase
 * @param orderItems - Itens do pedido
 * @returns Itens desmembrados
 */
export async function unbundleKitItems(
  supabase: any,
  orderItems: OrderItem[]
): Promise<UnbundledItem[]> {
  if (!orderItems || orderItems.length === 0) {
    return [];
  }

  const result: UnbundledItem[] = [];
  const productIds = orderItems.map(item => item.product_id).filter(Boolean);
  
  if (productIds.length === 0) {
    return orderItems;
  }

  // Buscar quais produtos são kits
  const { data: products } = await supabase
    .from('products')
    .select('id, product_format')
    .in('id', productIds);

  const kitProductIds = new Set(
    (products || [])
      .filter((p: any) => p.product_format === 'with_composition')
      .map((p: any) => p.id)
  );

  // Se não há kits, retorna items originais
  if (kitProductIds.size === 0) {
    return orderItems;
  }

  // Buscar componentes de todos os kits de uma vez
  const { data: allComponents } = await supabase
    .from('product_components')
    .select(`
      parent_product_id,
      quantity,
      sale_price,
      component:products!component_product_id(
        id,
        name,
        sku,
        price,
        cost_price
      )
    `)
    .in('parent_product_id', Array.from(kitProductIds))
    .order('sort_order');

  // Agrupar componentes por kit
  const componentsByKit = new Map<string, ProductComponent[]>();
  for (const comp of (allComponents || [])) {
    const list = componentsByKit.get(comp.parent_product_id) || [];
    list.push(comp);
    componentsByKit.set(comp.parent_product_id, list);
  }

  // Processar cada item
  for (const item of orderItems) {
    const isKit = kitProductIds.has(item.product_id);
    const components = componentsByKit.get(item.product_id);

    if (isKit && components && components.length > 0) {
      // Calcular valor total dos componentes para distribuição proporcional
      const componentsTotalValue = components.reduce((sum, c) => {
        const compPrice = c.sale_price ?? c.component?.price ?? 0;
        return sum + (compPrice * c.quantity);
      }, 0);

      // Expandir kit em componentes
      for (const comp of components) {
        if (!comp.component) continue;
        
        const compPrice = comp.sale_price ?? comp.component.price ?? 0;
        const proportion = componentsTotalValue > 0
          ? (compPrice * comp.quantity) / componentsTotalValue
          : 1 / components.length;

        const componentQuantity = comp.quantity * item.quantity;
        const componentTotal = item.total_price * proportion;
        const componentUnitPrice = componentQuantity > 0 ? componentTotal / componentQuantity : 0;

        result.push({
          product_id: comp.component.id,
          product_name: comp.component.name,
          sku: comp.component.sku,
          quantity: componentQuantity,
          unit_price: Math.round(componentUnitPrice * 100) / 100, // Arredondar para 2 casas
          total_price: Math.round(componentTotal * 100) / 100,
          original_kit_id: item.product_id,
          original_kit_name: item.product_name,
          is_from_kit: true,
        });
      }
    } else {
      // Produto simples ou kit sem componentes
      result.push({
        ...item,
        is_from_kit: false,
      });
    }
  }

  // Ajustar arredondamento para garantir que a soma seja igual ao total original
  const originalTotal = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  const unbundledTotal = result.reduce((sum, item) => sum + item.total_price, 0);
  const diff = Math.round((originalTotal - unbundledTotal) * 100) / 100;
  
  if (diff !== 0 && result.length > 0) {
    // Aplicar diferença no último item
    result[result.length - 1].total_price += diff;
  }

  console.log(`[kit-unbundler] Unbundled ${orderItems.length} items into ${result.length} items`);
  
  return result;
}
