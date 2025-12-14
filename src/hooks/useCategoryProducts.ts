import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CategoryProduct {
  id: string;
  product_id: string;
  category_id: string;
  position: number;
  created_at: string;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    price: number;
    status: string;
    stock_quantity: number;
    product_images: { url: string; is_primary: boolean }[];
  };
}

export interface AvailableProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  status: string;
  stock_quantity: number;
  product_images: { url: string; is_primary: boolean }[];
  isLinked?: boolean;
}

interface UseCategoryProductsOptions {
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useCategoryProducts(categoryId: string, options: UseCategoryProductsOptions = {}) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { search = '', page = 1, pageSize = 50 } = options;

  // Fetch products linked to this category
  const linkedProductsQuery = useQuery({
    queryKey: ['category-products', categoryId, search],
    queryFn: async () => {
      if (!categoryId) return [];

      let query = supabase
        .from('product_categories')
        .select(`
          id,
          product_id,
          category_id,
          position,
          created_at,
          product:products (
            id,
            name,
            slug,
            sku,
            price,
            status,
            stock_quantity,
            product_images (url, is_primary)
          )
        `)
        .eq('category_id', categoryId)
        .order('position', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search if provided
      let filtered = (data || []).filter(item => item.product) as CategoryProduct[];
      
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(item => 
          item.product.name.toLowerCase().includes(searchLower) ||
          item.product.sku?.toLowerCase().includes(searchLower)
        );
      }

      return filtered;
    },
    enabled: !!categoryId,
  });

  // Fetch all products for adding (with pagination)
  const availableProductsQuery = useQuery({
    queryKey: ['available-products', currentTenant?.id, search, page, pageSize],
    queryFn: async () => {
      if (!currentTenant?.id) return { products: [], total: 0 };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          sku,
          price,
          status,
          stock_quantity,
          product_images (url, is_primary)
        `, { count: 'exact' })
        .eq('tenant_id', currentTenant.id)
        .order('name', { ascending: true })
        .range(from, to);

      if (search) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // Mark products that are already linked
      const linkedIds = new Set(linkedProductsQuery.data?.map(p => p.product_id) || []);
      const products = (data || []).map(p => ({
        ...p,
        isLinked: linkedIds.has(p.id),
      })) as AvailableProduct[];

      return { products, total: count || 0 };
    },
    enabled: !!currentTenant?.id,
  });

  // Add products to category
  const addProducts = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!categoryId || productIds.length === 0) return;

      // Get current max position
      const { data: existing } = await supabase
        .from('product_categories')
        .select('position')
        .eq('category_id', categoryId)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? -1;

      // Prepare inserts (filter out already linked)
      const linkedIds = new Set(linkedProductsQuery.data?.map(p => p.product_id) || []);
      const newProductIds = productIds.filter(id => !linkedIds.has(id));

      if (newProductIds.length === 0) {
        toast.info('Todos os produtos selecionados já estão na categoria');
        return;
      }

      const inserts = newProductIds.map((productId, index) => ({
        product_id: productId,
        category_id: categoryId,
        position: maxPosition + 1 + index,
      }));

      const { error } = await supabase
        .from('product_categories')
        .insert(inserts);

      if (error) throw error;

      return newProductIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['category-products', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['available-products'] });
      if (count) {
        toast.success(`${count} produto(s) adicionado(s) à categoria`);
      }
    },
    onError: (error: Error) => {
      console.error('Error adding products:', error);
      toast.error('Erro ao adicionar produtos');
    },
  });

  // Remove products from category
  const removeProducts = useMutation({
    mutationFn: async (productIds: string[]) => {
      if (!categoryId || productIds.length === 0) return;

      const { error } = await supabase
        .from('product_categories')
        .delete()
        .eq('category_id', categoryId)
        .in('product_id', productIds);

      if (error) throw error;

      return productIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['category-products', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['available-products'] });
      if (count) {
        toast.success(`${count} produto(s) removido(s) da categoria`);
      }
    },
    onError: (error: Error) => {
      console.error('Error removing products:', error);
      toast.error('Erro ao remover produtos');
    },
  });

  // Reorder products within category
  const reorderProducts = useMutation({
    mutationFn: async (orderedProductIds: string[]) => {
      if (!categoryId) return;

      // Update positions in batch
      const updates = orderedProductIds.map((productId, index) =>
        supabase
          .from('product_categories')
          .update({ position: index })
          .eq('category_id', categoryId)
          .eq('product_id', productId)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-products', categoryId] });
    },
    onError: (error: Error) => {
      console.error('Error reordering products:', error);
      toast.error('Erro ao reordenar produtos');
    },
  });

  return {
    linkedProducts: linkedProductsQuery.data ?? [],
    isLoadingLinked: linkedProductsQuery.isLoading,
    availableProducts: availableProductsQuery.data?.products ?? [],
    availableTotal: availableProductsQuery.data?.total ?? 0,
    isLoadingAvailable: availableProductsQuery.isLoading,
    addProducts,
    removeProducts,
    reorderProducts,
    refetch: () => {
      linkedProductsQuery.refetch();
      availableProductsQuery.refetch();
    },
  };
}
