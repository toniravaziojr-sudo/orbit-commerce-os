import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MeliListing {
  id: string;
  tenant_id: string;
  product_id: string;
  status: 'draft' | 'ready' | 'approved' | 'publishing' | 'published' | 'error';
  meli_item_id: string | null;
  title: string;
  description: string | null;
  price: number;
  available_quantity: number;
  category_id: string | null;
  listing_type: string;
  condition: string;
  currency_id: string;
  images: any[];
  attributes: any[];
  shipping: Record<string, any>;
  meli_response: any;
  error_message: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: {
    name: string;
    sku: string;
    price: number;
    stock_quantity: number;
    status: string;
  };
  primary_image_url?: string | null;
}

export function useMeliListings() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const listingsQuery = useQuery({
    queryKey: ['meli-listings', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('meli_listings')
        .select(`
          *,
          product:products(name, sku, price, stock_quantity, status)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get primary images for listed products
      const productIds = (data || []).map(l => l.product_id);
      if (productIds.length > 0) {
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, url')
          .in('product_id', productIds)
          .eq('is_primary', true);

        const imageMap = new Map(images?.map(img => [img.product_id, img.url]) ?? []);
        return (data || []).map(l => ({
          ...l,
          primary_image_url: imageMap.get(l.product_id) || null,
        })) as MeliListing[];
      }

      return (data || []) as MeliListing[];
    },
    enabled: !!currentTenant?.id,
  });

  const createListing = useMutation({
    mutationFn: async (data: {
      product_id: string;
      title: string;
      description?: string;
      price: number;
      available_quantity: number;
      listing_type?: string;
      condition?: string;
      images?: any[];
    }) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data: result, error } = await supabase
        .from('meli_listings')
        .insert({
          tenant_id: currentTenant.id,
          ...data,
          status: 'draft' as const,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success('Anúncio preparado com sucesso!');
    },
    onError: (error: Error) => {
      if (error.message.includes('idx_meli_listings_tenant_product')) {
        toast.error('Este produto já possui um anúncio.');
      } else {
        toast.error('Erro ao criar anúncio');
      }
    },
  });

  const updateListing = useMutation({
    mutationFn: async ({ id, ...data }: Partial<MeliListing> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('meli_listings')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success('Anúncio atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar anúncio');
    },
  });

  const deleteListing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meli_listings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success('Anúncio removido');
    },
    onError: () => {
      toast.error('Erro ao remover anúncio');
    },
  });

  const approveListing = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('meli_listings')
        .update({ status: 'approved' as const })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success('Anúncio aprovado! Pronto para publicar.');
    },
    onError: () => {
      toast.error('Erro ao aprovar anúncio');
    },
  });

  return {
    listings: listingsQuery.data ?? [],
    isLoading: listingsQuery.isLoading,
    createListing,
    updateListing,
    deleteListing,
    approveListing,
    refetch: listingsQuery.refetch,
  };
}
