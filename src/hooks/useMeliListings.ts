import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

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
    onError: (error) => {
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

  // Delete: closes on ML (definitive) for published/paused, then removes local. Local-only otherwise.
  const deleteListing = useMutation({
    mutationFn: async (id: string) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');
      const listing = (listingsQuery.data || []).find(l => l.id === id);
      const needsMeliClose = listing?.meli_item_id && ['published', 'paused', 'publishing'].includes(listing.status);

      if (needsMeliClose) {
        const { data, error } = await supabase.functions.invoke('meli-publish-listing', {
          body: { tenantId: currentTenant.id, listingId: id, action: 'delete' },
        });
        if (error) throw new Error(error.message || 'Erro ao encerrar no Mercado Livre');
        if (!data?.success) throw new Error(data?.error || 'Erro ao encerrar no Mercado Livre');
        return;
      }

      const { error } = await supabase.from('meli_listings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success('Anúncio removido');
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      showErrorToast(err, { module: 'mercado livre', action: 'excluir' });
    },
  });

  const bulkDeleteListings = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');
      const all = listingsQuery.data || [];
      const items = ids.map(id => all.find(l => l.id === id)).filter(Boolean) as MeliListing[];

      const needsMeliClose = items.filter(l => l.meli_item_id && ['published', 'paused', 'publishing'].includes(l.status));
      const localOnly = items.filter(l => !needsMeliClose.includes(l)).map(l => l.id);

      let successCount = 0;
      const errors: string[] = [];

      for (const l of needsMeliClose) {
        try {
          const { data, error } = await supabase.functions.invoke('meli-publish-listing', {
            body: { tenantId: currentTenant.id, listingId: l.id, action: 'delete' },
          });
          if (error || !data?.success) {
            errors.push(`${l.title}: ${data?.error || error?.message || 'erro ao encerrar'}`);
          } else {
            successCount++;
          }
        } catch (e: any) {
          errors.push(`${l.title}: ${e?.message || 'erro'}`);
        }
      }

      if (localOnly.length > 0) {
        const { error } = await supabase.from('meli_listings').delete().in('id', localOnly);
        if (error) errors.push(`Erro ao remover ${localOnly.length} rascunho(s) localmente`);
        else successCount += localOnly.length;
      }

      return { successCount, errors };
    },
    onSuccess: ({ successCount, errors }) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      if (successCount > 0) toast.success(`${successCount} anúncio${successCount > 1 ? 's' : ''} removido${successCount > 1 ? 's' : ''}`);
      if (errors.length > 0) toast.error(`${errors.length} falha(s) ao remover: ${errors.slice(0, 3).join(' | ')}`);
    },
    onError: () => {
      toast.error('Erro ao remover anúncios');
    },
  });

  const bulkApproveListings = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('meli_listings')
        .update({ status: 'approved' as const })
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success(`${count} anúncio${count > 1 ? 's' : ''} aprovado${count > 1 ? 's' : ''}`);
    },
    onError: () => {
      toast.error('Erro ao aprovar anúncios');
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
      showErrorToast(error, { module: 'mercado livre', action: 'publicar' });
    },
  });

  const syncListings = useMutation({
    mutationFn: async (listingIds?: string[]) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('meli-sync-listings', {
        body: {
          tenantId: currentTenant.id,
          listingIds: listingIds || undefined,
        },
      });

      if (error) throw new Error(error.message || 'Erro ao sincronizar');
      if (!data?.success) throw new Error(data?.error || 'Erro ao sincronizar com o Mercado Livre');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meli-listings'] });
      toast.success(data.message || 'Sincronização concluída');
    },
    onError: (err) => showErrorToast(err, { module: 'mercado livre', action: 'sincronizar' }),
  });

  return {
    listings: listingsQuery.data ?? [],
    isLoading: listingsQuery.isLoading,
    createListing,
    createBulkListings,
    updateListing,
    updateBulkListings,
    deleteListing,
    bulkDeleteListings,
    bulkApproveListings,
    approveListing,
    publishListing,
    syncListings,
    refetch: listingsQuery.refetch,
  };
}