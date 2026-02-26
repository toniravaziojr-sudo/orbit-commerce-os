import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { coreProductsApi } from '@/lib/coreApi';

export interface Product {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  cost_price: number | null;
  price: number;
  compare_at_price: number | null;
  promotion_start_date: string | null;
  promotion_end_date: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  manage_stock: boolean;
  allow_backorder: boolean;
  weight: number | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  barcode: string | null;
  gtin: string | null;
  ncm: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  is_featured: boolean;
  has_variants: boolean;
  product_format: 'simple' | 'with_variants' | 'with_composition';
  stock_type: 'physical' | 'virtual';
  created_at: string;
  updated_at: string;
  // New canonical fields
  brand: string | null;
  vendor: string | null;
  product_type: string | null;
  tags: string[] | null;
  requires_shipping: boolean | null;
  taxable: boolean | null;
  tax_code: string | null;
  cest: string | null;
  origin_code: string | null;
  uom: string | null;
  regulatory_info: Record<string, any> | null;
  warranty_type: string | null;
  warranty_duration: string | null;
  published_at: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
  option3_name: string | null;
  option3_value: string | null;
  cost_price: number | null;
  price: number | null;
  compare_at_price: number | null;
  promotion_start_date: string | null;
  promotion_end_date: string | null;
  stock_quantity: number;
  weight: number | null;
  barcode: string | null;
  gtin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // New canonical fields
  width: number | null;
  height: number | null;
  depth: number | null;
  taxable: boolean | null;
  requires_shipping: boolean | null;
  position: number | null;
  image_url: string | null;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  banner_desktop_url: string | null;
  banner_mobile_url: string | null;
  created_at: string;
  updated_at: string;
}

// ProductFormData: base fields required, new canonical fields optional for backwards compatibility
export type ProductFormData = Omit<Product, 
  'id' | 'tenant_id' | 'created_at' | 'updated_at' | 
  'brand' | 'vendor' | 'product_type' | 'tags' | 'requires_shipping' | 'taxable' | 
  'tax_code' | 'cest' | 'origin_code' | 'uom' | 'published_at' |
  'regulatory_info' | 'warranty_type' | 'warranty_duration'
> & {
  brand?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[] | null;
  requires_shipping?: boolean | null;
  taxable?: boolean | null;
  tax_code?: string | null;
  cest?: string | null;
  origin_code?: string | null;
  uom?: string | null;
  published_at?: string | null;
  regulatory_info?: Record<string, any> | null;
  warranty_type?: string | null;
  warranty_duration?: string | null;
};
export type CategoryFormData = Omit<Category, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>;

export function useProducts() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ['products', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Product[];
    },
    enabled: !!currentTenant?.id,
  });

  const createProduct = useMutation({
    mutationFn: async (product: ProductFormData) => {
      if (!currentTenant?.id) throw new Error('Nenhuma loja selecionada');
      
      const result = await coreProductsApi.create(product);
      
      if (!result.success) {
        if (result.code === 'DUPLICATE_SKU' || result.code === 'DUPLICATE_SLUG') {
          throw new Error('duplicate key');
        }
        throw new Error(result.error || 'Erro ao criar produto');
      }
      
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast.success('Produto criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating product:', error);
      if (error.message.includes('duplicate key')) {
        toast.error('SKU ou slug já existe. Use valores únicos.');
      } else {
        toast.error('Erro ao criar produto');
      }
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...product }: Partial<Product> & { id: string }) => {
      const result = await coreProductsApi.update(id, product);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar produto');
      }
      
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast.success('Produto atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error updating product:', error);
      toast.error('Erro ao atualizar produto');
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const result = await coreProductsApi.delete(id);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao excluir produto');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', currentTenant?.id] });
      toast.success('Produto excluído com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting product:', error);
      toast.error('Erro ao excluir produto');
    },
  });

  return {
    products: productsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}

export function useCategories() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['categories', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!currentTenant?.id,
  });

  const createCategory = useMutation({
    mutationFn: async (category: CategoryFormData) => {
      if (!currentTenant?.id) throw new Error('Nenhuma loja selecionada');
      
      // Get max sort_order for siblings
      const siblings = categoriesQuery.data?.filter(c => c.parent_id === category.parent_id) || [];
      const maxOrder = siblings.reduce((max, c) => Math.max(max, c.sort_order || 0), -1);
      
      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          tenant_id: currentTenant.id,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast.success('Categoria criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating category:', error);
      if (error.message.includes('duplicate key')) {
        toast.error('Slug já existe. Use um valor único.');
      } else {
        toast.error('Erro ao criar categoria');
      }
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...category }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(category)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast.success('Categoria atualizada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error updating category:', error);
      toast.error('Erro ao atualizar categoria');
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
      toast.success('Categoria excluída com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting category:', error);
      toast.error('Erro ao excluir categoria');
    },
  });

  // Reorder categories with parent change support
  const reorderCategories = useMutation({
    mutationFn: async ({ 
      categoryId, 
      newParentId, 
      orderedSiblingIds 
    }: { 
      categoryId: string; 
      newParentId: string | null; 
      orderedSiblingIds: string[];
    }) => {
      // Update parent_id if changed
      const category = categoriesQuery.data?.find(c => c.id === categoryId);
      if (category && category.parent_id !== newParentId) {
        const { error: parentError } = await supabase
          .from('categories')
          .update({ parent_id: newParentId })
          .eq('id', categoryId);

        if (parentError) throw parentError;
      }

      // Update sort_order for all siblings
      const updates = orderedSiblingIds.map((id, index) => 
        supabase
          .from('categories')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', currentTenant?.id] });
    },
    onError: (error: Error) => {
      console.error('Error reordering categories:', error);
      toast.error('Erro ao reordenar categorias');
    },
  });

  return {
    categories: categoriesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  };
}

// Hook to get products with their primary image
export interface ProductWithImage extends Product {
  primary_image_url: string | null;
}

export function useProductsWithImages() {
  const { currentTenant } = useAuth();

  const productsQuery = useQuery({
    queryKey: ['products-with-images', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      // Get products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (productsError) throw productsError;

      // Get primary images for all products
      const productIds = products.map(p => p.id);
      const { data: images, error: imagesError } = await supabase
        .from('product_images')
        .select('product_id, url')
        .in('product_id', productIds)
        .eq('is_primary', true);

      if (imagesError) throw imagesError;

      // Map images to products
      const imageMap = new Map(images?.map(img => [img.product_id, img.url]) ?? []);
      
      return products.map(product => ({
        ...product,
        primary_image_url: imageMap.get(product.id) || null,
      })) as ProductWithImage[];
    },
    enabled: !!currentTenant?.id,
  });

  return {
    products: productsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
  };
}
