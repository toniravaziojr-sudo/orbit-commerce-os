// =============================================
// USE PRODUCT VARIANT TYPES - Hook to manage variant types (Cor, Tamanho, etc.)
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface VariantTypeOption {
  id: string;
  variant_type_id: string;
  tenant_id: string;
  value: string;
  sort_order: number;
  created_at: string;
}

export interface VariantType {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  options?: VariantTypeOption[];
}

export function useProductVariantTypes() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all variant types with their options
  const { data: variantTypes = [], isLoading, error } = useQuery({
    queryKey: ['product-variant-types', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      // Fetch variant types
      const { data: types, error: typesError } = await supabase
        .from('product_variant_types')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (typesError) throw typesError;

      // Fetch all options for these types
      const typeIds = types?.map(t => t.id) || [];
      if (typeIds.length === 0) return [];

      const { data: options, error: optionsError } = await supabase
        .from('product_variant_type_options')
        .select('*')
        .in('variant_type_id', typeIds)
        .order('sort_order', { ascending: true });

      if (optionsError) throw optionsError;

      // Combine types with their options
      return types?.map(type => ({
        ...type,
        options: options?.filter(o => o.variant_type_id === type.id) || []
      })) as VariantType[];
    },
    enabled: !!currentTenant?.id,
    staleTime: 30000,
  });

  // Create a new variant type
  const createVariantType = useMutation({
    mutationFn: async (name: string) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const maxSortOrder = variantTypes.reduce((max, t) => Math.max(max, t.sort_order), -1);

      const { data, error } = await supabase
        .from('product_variant_types')
        .insert({
          tenant_id: currentTenant.id,
          name,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-types'] });
      toast.success('Variação criada com sucesso');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe uma variação com esse nome');
      } else {
        toast.error('Erro ao criar variação');
      }
    },
  });

  // Update a variant type name
  const updateVariantType = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('product_variant_types')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-types'] });
      toast.success('Variação atualizada');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe uma variação com esse nome');
      } else {
        toast.error('Erro ao atualizar variação');
      }
    },
  });

  // Delete a variant type
  const deleteVariantType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variant_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-types'] });
      toast.success('Variação removida');
    },
    onError: () => {
      toast.error('Erro ao remover variação');
    },
  });

  // Add an option to a variant type
  const addOption = useMutation({
    mutationFn: async ({ variantTypeId, value }: { variantTypeId: string; value: string }) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      const type = variantTypes.find(t => t.id === variantTypeId);
      const maxSortOrder = type?.options?.reduce((max, o) => Math.max(max, o.sort_order), -1) ?? -1;

      const { data, error } = await supabase
        .from('product_variant_type_options')
        .insert({
          variant_type_id: variantTypeId,
          tenant_id: currentTenant.id,
          value,
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-types'] });
      toast.success('Opção adicionada');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Essa opção já existe');
      } else {
        toast.error('Erro ao adicionar opção');
      }
    },
  });

  // Update an option value
  const updateOption = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { data, error } = await supabase
        .from('product_variant_type_options')
        .update({ value })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-types'] });
      toast.success('Opção atualizada');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Essa opção já existe');
      } else {
        toast.error('Erro ao atualizar opção');
      }
    },
  });

  // Delete an option
  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variant_type_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variant-types'] });
      toast.success('Opção removida');
    },
    onError: () => {
      toast.error('Erro ao remover opção');
    },
  });

  return {
    variantTypes,
    isLoading,
    error,
    createVariantType,
    updateVariantType,
    deleteVariantType,
    addOption,
    updateOption,
    deleteOption,
  };
}
