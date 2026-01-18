// =============================================
// CHECKOUT TESTIMONIALS HOOK - CRUD for checkout testimonials
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CheckoutTestimonial {
  id: string;
  tenant_id: string;
  name: string;
  content: string;
  rating: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  product_ids?: string[];
}

export interface TestimonialFormData {
  name: string;
  content: string;
  rating: number;
  image_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
  product_ids?: string[];
}

export function useCheckoutTestimonials() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const testimonialsQuery = useQuery({
    queryKey: ['checkout-testimonials', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      // Get testimonials
      const { data: testimonials, error } = await supabase
        .from('checkout_testimonials')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Get product associations
      const testimonialIds = testimonials.map(t => t.id);
      if (testimonialIds.length === 0) return testimonials as CheckoutTestimonial[];

      const { data: productAssociations, error: assocError } = await supabase
        .from('checkout_testimonial_products')
        .select('testimonial_id, product_id')
        .in('testimonial_id', testimonialIds);

      if (assocError) throw assocError;

      // Map product IDs to testimonials
      const productMap = new Map<string, string[]>();
      productAssociations?.forEach(assoc => {
        const existing = productMap.get(assoc.testimonial_id) || [];
        productMap.set(assoc.testimonial_id, [...existing, assoc.product_id]);
      });

      return testimonials.map(t => ({
        ...t,
        product_ids: productMap.get(t.id) || [],
      })) as CheckoutTestimonial[];
    },
    enabled: !!currentTenant?.id,
  });

  const createTestimonial = useMutation({
    mutationFn: async (data: TestimonialFormData) => {
      if (!currentTenant?.id) throw new Error('Nenhuma loja selecionada');

      // Get max sort_order
      const existingTestimonials = testimonialsQuery.data || [];
      const maxOrder = existingTestimonials.reduce((max, t) => Math.max(max, t.sort_order || 0), -1);

      // Insert testimonial
      const { data: testimonial, error } = await supabase
        .from('checkout_testimonials')
        .insert({
          tenant_id: currentTenant.id,
          name: data.name,
          content: data.content,
          rating: data.rating,
          image_url: data.image_url || null,
          is_active: data.is_active ?? true,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert product associations if any
      if (data.product_ids && data.product_ids.length > 0) {
        const { error: assocError } = await supabase
          .from('checkout_testimonial_products')
          .insert(
            data.product_ids.map(productId => ({
              testimonial_id: testimonial.id,
              product_id: productId,
            }))
          );

        if (assocError) throw assocError;
      }

      return testimonial;
    },
    onSuccess: () => {
      // Invalidate both admin and storefront queries so changes reflect everywhere
      queryClient.invalidateQueries({ queryKey: ['checkout-testimonials', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', currentTenant?.id] });
      toast.success('Depoimento criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating testimonial:', error);
      toast.error('Erro ao criar depoimento');
    },
  });

  const updateTestimonial = useMutation({
    mutationFn: async ({ id, ...data }: TestimonialFormData & { id: string }) => {
      // Update testimonial
      const { error } = await supabase
        .from('checkout_testimonials')
        .update({
          name: data.name,
          content: data.content,
          rating: data.rating,
          image_url: data.image_url || null,
          is_active: data.is_active,
        })
        .eq('id', id);

      if (error) throw error;

      // Update product associations
      // First, delete all existing associations
      const { error: deleteError } = await supabase
        .from('checkout_testimonial_products')
        .delete()
        .eq('testimonial_id', id);

      if (deleteError) throw deleteError;

      // Then insert new associations
      if (data.product_ids && data.product_ids.length > 0) {
        const { error: assocError } = await supabase
          .from('checkout_testimonial_products')
          .insert(
            data.product_ids.map(productId => ({
              testimonial_id: id,
              product_id: productId,
            }))
          );

        if (assocError) throw assocError;
      }
    },
    onSuccess: () => {
      // Invalidate both admin and storefront queries so changes reflect everywhere
      queryClient.invalidateQueries({ queryKey: ['checkout-testimonials', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', currentTenant?.id] });
      toast.success('Depoimento atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error updating testimonial:', error);
      toast.error('Erro ao atualizar depoimento');
    },
  });

  const deleteTestimonial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checkout_testimonials')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate both admin and storefront queries so changes reflect everywhere
      queryClient.invalidateQueries({ queryKey: ['checkout-testimonials', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', currentTenant?.id] });
      toast.success('Depoimento excluído com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error deleting testimonial:', error);
      toast.error('Erro ao excluir depoimento');
    },
  });

  const reorderTestimonials = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('checkout_testimonials')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      // Invalidate both admin and storefront queries so changes reflect everywhere
      queryClient.invalidateQueries({ queryKey: ['checkout-testimonials', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', currentTenant?.id] });
    },
    onError: (error: Error) => {
      console.error('Error reordering testimonials:', error);
      toast.error('Erro ao reordenar depoimentos');
    },
  });

  return {
    testimonials: testimonialsQuery.data ?? [],
    isLoading: testimonialsQuery.isLoading,
    error: testimonialsQuery.error,
    createTestimonial,
    updateTestimonial,
    deleteTestimonial,
    reorderTestimonials,
  };
}

// Hook to get testimonials for storefront (filtered by product if applicable)
// isEditing: true = builder mode (show all active), false = public (only published)
export function useStorefrontTestimonials(tenantId: string | undefined, productId?: string, isEditing?: boolean) {
  return useQuery({
    queryKey: ['storefront-testimonials', tenantId, productId, isEditing],
    queryFn: async () => {
      if (!tenantId) return [];

      // Build query - active testimonials only
      let query = supabase
        .from('checkout_testimonials')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);
      
      // CRITICAL: In public mode (not editing), only show published testimonials
      if (!isEditing) {
        query = query.not('published_at', 'is', null);
      }
      
      const { data: testimonials, error } = await query.order('sort_order', { ascending: true });

      if (error) throw error;
      if (!testimonials || testimonials.length === 0) return [];

      // Get product associations
      const testimonialIds = testimonials.map(t => t.id);
      const { data: productAssociations, error: assocError } = await supabase
        .from('checkout_testimonial_products')
        .select('testimonial_id, product_id')
        .in('testimonial_id', testimonialIds);

      if (assocError) throw assocError;

      // Build a map of testimonial_id -> product_ids
      const productMap = new Map<string, string[]>();
      productAssociations?.forEach(assoc => {
        const existing = productMap.get(assoc.testimonial_id) || [];
        productMap.set(assoc.testimonial_id, [...existing, assoc.product_id]);
      });

      // Filter testimonials logic:
      // - Testimonial sem produto vinculado = mostra para TODOS (global)
      // - Testimonial com produto vinculado = mostra APENAS para aquele produto
      return testimonials.filter(t => {
        const associatedProducts = productMap.get(t.id) || [];
        // Sem produtos vinculados = global, mostra sempre
        if (associatedProducts.length === 0) return true;
        // Com produtos vinculados = só mostra se o productId do checkout estiver na lista
        if (productId) return associatedProducts.includes(productId);
        // No checkout geral (sem productId específico), mostra os globais + todos vinculados
        // porque o checkout pode ter múltiplos produtos
        return true;
      }).map(t => ({
        ...t,
        product_ids: productMap.get(t.id) || [],
      })) as CheckoutTestimonial[];
    },
    enabled: !!tenantId,
  });
}

// Hook to publish all active testimonials (called when template is published)
export function usePublishTestimonials() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error('Nenhuma loja selecionada');

      // Update all active testimonials to published
      const { error } = await supabase
        .from('checkout_testimonials')
        .update({ published_at: new Date().toISOString() })
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate storefront query so public sees new published testimonials
      queryClient.invalidateQueries({ queryKey: ['storefront-testimonials', currentTenant?.id] });
    },
    onError: (error: Error) => {
      console.error('Error publishing testimonials:', error);
    },
  });
}
