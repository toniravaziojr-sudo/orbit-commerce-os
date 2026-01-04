import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductComponent {
  id: string;
  parent_product_id: string;
  component_product_id: string;
  quantity: number;
  cost_price: number | null;
  sale_price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined component product data
  component?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    cost_price: number | null;
    stock_quantity: number;
  };
}

export interface ProductComponentFormData {
  component_product_id: string;
  quantity: number;
  cost_price?: number | null;
  sale_price?: number | null;
  sort_order?: number;
}

export function useProductComponents(productId: string | undefined) {
  const queryClient = useQueryClient();

  const componentsQuery = useQuery({
    queryKey: ['product-components', productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from('product_components')
        .select(`
          id,
          parent_product_id,
          component_product_id,
          quantity,
          cost_price,
          sale_price,
          sort_order,
          created_at,
          updated_at,
          component:products!component_product_id(
            id,
            name,
            sku,
            price,
            cost_price,
            stock_quantity
          )
        `)
        .eq('parent_product_id', productId)
        .order('sort_order');

      if (error) throw error;
      
      // Transform the data to flatten component data
      return (data || []).map((item: any) => ({
        ...item,
        component: item.component ? {
          id: item.component.id,
          name: item.component.name,
          sku: item.component.sku,
          price: item.component.price,
          cost_price: item.component.cost_price,
          stock_quantity: item.component.stock_quantity,
        } : undefined,
      })) as ProductComponent[];
    },
    enabled: !!productId,
  });

  const addComponent = useMutation({
    mutationFn: async (data: ProductComponentFormData & { parent_product_id: string }) => {
      // Check for self-referencing
      if (data.parent_product_id === data.component_product_id) {
        throw new Error('Um produto não pode ser componente dele mesmo');
      }

      // Check if component is also a kit (prevent cycles)
      const { data: componentProduct } = await supabase
        .from('products')
        .select('product_format')
        .eq('id', data.component_product_id)
        .single();

      if (componentProduct?.product_format === 'with_composition') {
        throw new Error('Não é permitido adicionar um kit como componente de outro kit');
      }

      const { data: component, error } = await supabase
        .from('product_components')
        .insert({
          parent_product_id: data.parent_product_id,
          component_product_id: data.component_product_id,
          quantity: data.quantity,
          cost_price: data.cost_price ?? null,
          sale_price: data.sale_price ?? null,
          sort_order: data.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este componente já foi adicionado ao kit');
        }
        throw error;
      }
      return component;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components', productId] });
      toast.success('Componente adicionado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao adicionar componente');
    },
  });

  const updateComponent = useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProductComponentFormData> & { id: string }) => {
      const { data: component, error } = await supabase
        .from('product_components')
        .update({
          quantity: data.quantity,
          cost_price: data.cost_price,
          sale_price: data.sale_price,
          sort_order: data.sort_order,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return component;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components', productId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar componente');
    },
  });

  const deleteComponent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_components')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components', productId] });
      toast.success('Componente removido');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover componente');
    },
  });

  const reorderComponents = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('product_components')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-components', productId] });
    },
  });

  // Calculate totals
  const totalCost = componentsQuery.data?.reduce((sum, comp) => {
    const price = comp.cost_price ?? comp.component?.cost_price ?? 0;
    return sum + (price * comp.quantity);
  }, 0) ?? 0;

  const totalSale = componentsQuery.data?.reduce((sum, comp) => {
    const price = comp.sale_price ?? comp.component?.price ?? 0;
    return sum + (price * comp.quantity);
  }, 0) ?? 0;

  // Calculate virtual stock (minimum of component stocks considering quantities)
  const virtualStock = componentsQuery.data?.length 
    ? Math.min(
        ...componentsQuery.data.map(comp => {
          const stock = comp.component?.stock_quantity ?? 0;
          return Math.floor(stock / comp.quantity);
        })
      )
    : 0;

  return {
    components: componentsQuery.data ?? [],
    isLoading: componentsQuery.isLoading,
    error: componentsQuery.error,
    addComponent,
    updateComponent,
    deleteComponent,
    reorderComponents,
    totalCost,
    totalSale,
    virtualStock,
    refetch: componentsQuery.refetch,
  };
}
