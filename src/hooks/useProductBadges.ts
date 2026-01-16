import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type BadgeShape = 'square' | 'rectangular' | 'circular' | 'pill';
export type BadgePosition = 'left' | 'center' | 'right';

export interface ProductBadge {
  id: string;
  tenant_id: string;
  name: string;
  background_color: string;
  text_color: string;
  shape: BadgeShape;
  position: BadgePosition;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBadgeInput {
  name: string;
  background_color: string;
  text_color: string;
  shape: BadgeShape;
  position: BadgePosition;
  is_active?: boolean;
}

export interface UpdateBadgeInput extends Partial<CreateBadgeInput> {
  id: string;
}

export function useProductBadges() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;

  const badgesQuery = useQuery({
    queryKey: ['product-badges', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];

      const { data, error } = await supabase
        .from('product_badges')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as ProductBadge[];
    },
    enabled: !!currentTenantId,
  });

  const createBadge = useMutation({
    mutationFn: async (input: CreateBadgeInput) => {
      if (!currentTenantId) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('product_badges')
        .insert({
          tenant_id: currentTenantId,
          name: input.name,
          background_color: input.background_color,
          text_color: input.text_color,
          shape: input.shape,
          position: input.position,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-badges', currentTenantId] });
      toast.success('Selo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar selo');
    },
  });

  const updateBadge = useMutation({
    mutationFn: async ({ id, ...input }: UpdateBadgeInput) => {
      const { data, error } = await supabase
        .from('product_badges')
        .update({
          name: input.name,
          background_color: input.background_color,
          text_color: input.text_color,
          shape: input.shape,
          position: input.position,
          is_active: input.is_active,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-badges', currentTenantId] });
      toast.success('Selo atualizado');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar selo');
    },
  });

  const deleteBadge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_badges')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-badges', currentTenantId] });
      toast.success('Selo removido');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover selo');
    },
  });

  const toggleBadge = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('product_badges')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-badges', currentTenantId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao alterar status');
    },
  });

  return {
    badges: badgesQuery.data ?? [],
    isLoading: badgesQuery.isLoading,
    error: badgesQuery.error,
    createBadge,
    updateBadge,
    deleteBadge,
    toggleBadge,
  };
}

// Hook to fetch badges for a specific product (used in storefront)
export function useProductBadgesForProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-badge-assignments', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_badge_assignments')
        .select(`
          id,
          badge:product_badges(
            id,
            name,
            background_color,
            text_color,
            shape,
            position,
            is_active
          )
        `)
        .eq('product_id', productId);

      if (error) throw error;

      // Filter and flatten to get only active badges
      return (data || [])
        .filter((item: any) => item.badge?.is_active)
        .map((item: any) => item.badge as ProductBadge);
    },
    enabled: !!productId,
  });
}

// Hook to fetch badges for multiple products at once (efficient for grids)
export function useProductBadgesForProducts(productIds: string[]) {
  return useQuery({
    queryKey: ['product-badge-assignments-batch', productIds.sort().join(',')],
    queryFn: async () => {
      if (!productIds.length) return new Map<string, ProductBadge[]>();

      const { data, error } = await supabase
        .from('product_badge_assignments')
        .select(`
          product_id,
          badge:product_badges(
            id,
            name,
            background_color,
            text_color,
            shape,
            position,
            is_active
          )
        `)
        .in('product_id', productIds);

      if (error) throw error;

      // Group badges by product_id
      const badgesMap = new Map<string, ProductBadge[]>();
      (data || []).forEach((item: any) => {
        if (item.badge?.is_active) {
          const existing = badgesMap.get(item.product_id) || [];
          existing.push(item.badge as ProductBadge);
          badgesMap.set(item.product_id, existing);
        }
      });

      return badgesMap;
    },
    enabled: productIds.length > 0,
  });
}

// Hook to manage badge-product assignments
export function useBadgeAssignments(badgeId: string | undefined) {
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;

  const assignmentsQuery = useQuery({
    queryKey: ['badge-assignments', badgeId],
    queryFn: async () => {
      if (!badgeId) return [];

      const { data, error } = await supabase
        .from('product_badge_assignments')
        .select('product_id')
        .eq('badge_id', badgeId);

      if (error) throw error;
      return data.map((item) => item.product_id);
    },
    enabled: !!badgeId,
  });

  const updateAssignments = useMutation({
    mutationFn: async ({ badgeId, productIds }: { badgeId: string; productIds: string[] }) => {
      if (!currentTenantId) throw new Error('Tenant não encontrado');

      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('product_badge_assignments')
        .delete()
        .eq('badge_id', badgeId);

      if (deleteError) throw deleteError;

      // Insert new assignments
      if (productIds.length > 0) {
        const { error: insertError } = await supabase
          .from('product_badge_assignments')
          .insert(
            productIds.map((productId) => ({
              badge_id: badgeId,
              product_id: productId,
              tenant_id: currentTenantId,
            }))
          );

        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, { badgeId }) => {
      queryClient.invalidateQueries({ queryKey: ['badge-assignments', badgeId] });
      queryClient.invalidateQueries({ queryKey: ['product-badge-assignments'] });
      toast.success('Produtos atualizados');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar produtos');
    },
  });

  return {
    assignedProductIds: assignmentsQuery.data ?? [],
    isLoading: assignmentsQuery.isLoading,
    updateAssignments,
  };
}
