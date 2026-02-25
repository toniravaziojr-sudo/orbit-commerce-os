import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MeliListing {
  id: string;
  tenant_id: string;
  product_id: string;
  status: 'draft' | 'ready' | 'approved' | 'publishing' | 'published' | 'paused' | 'error';
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
      category_id?: string;
      images?: any[];
      attributes?: any[];
      shipping?: Record<string, any>;
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
      toast.error('Erro ao criar anúncio');
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

  const createBulkListings = useMutation({
    mutationFn: async (data: {
      products: Array<{
        product_id: string;
        title: string;
        price: number;
        available_quantity: number;
        images?: any[];
      }>;
      listing_type: string;
      condition: string;
      shipping: Record<string, any>;
    }) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const rows = data.products.map(p => ({
        tenant_id: currentTenant.id,
        product_id: p.product_id,
        title: p.title,
        price: p.price,
        available_quantity: p.available_quantity,
        listing_type: data.listing_type,
        condition: data.condition,
        shipping: data.shipping,
        images: p.images || [],
        status: 'draft' as const,
      }));

      const { data: result, error } = await supabase
        .from('meli_listings')
        .insert(rows)
        .select();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success(`${data.length} rascunho${data.length > 1 ? 's' : ''} criado${data.length > 1 ? 's' : ''} com sucesso!`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar anúncios em massa');
    },
  });

  const updateBulkListings = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Record<string, any> }) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { error } = await supabase
        .from('meli_listings')
        .update(data)
        .in('id', ids)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success('Anúncios atualizados');
    },
    onError: () => {
      toast.error('Erro ao atualizar anúncios');
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

  const publishListing = useMutation({
    mutationFn: async ({ id, action }: { id: string; action?: 'publish' | 'pause' | 'activate' | 'update' }) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('meli-publish-listing', {
        body: {
          tenantId: currentTenant.id,
          listingId: id,
          action: action || undefined,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao publicar');
      if (!data?.success) throw new Error(data?.error || 'Erro ao publicar no Mercado Livre');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success(data.message || 'Operação realizada com sucesso!');
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.error(error.message || 'Erro ao publicar anúncio');
    },
  });

  return {
    listings: listingsQuery.data ?? [],
    isLoading: listingsQuery.isLoading,
    createListing,
    createBulkListings,
    updateListing,
    updateBulkListings,
    deleteListing,
    approveListing,
    publishListing,
    refetch: listingsQuery.refetch,
  };
}
