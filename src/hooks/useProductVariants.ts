// =============================================
// USE PRODUCT VARIANTS - Hook to fetch and manage product variants for storefront
// =============================================

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  options: Record<string, string>; // e.g., { "Cor": "Azul", "Tamanho": "M" }
  image_url?: string;
  is_active: boolean;
}

export interface VariantOptionGroup {
  name: string; // e.g., "Cor", "Tamanho"
  values: string[]; // e.g., ["Azul", "Vermelho", "Verde"]
}

interface UseProductVariantsResult {
  variants: ProductVariant[];
  optionGroups: VariantOptionGroup[];
  selectedOptions: Record<string, string>;
  selectedVariant: ProductVariant | null;
  selectOption: (optionName: string, value: string) => void;
  hasVariants: boolean;
  isLoading: boolean;
  error: Error | null;
  // Safety flag: true if product has variants but none selected yet
  requiresSelection: boolean;
}

/**
 * Hook to fetch product variants and manage selection state
 * Used in storefront product page for variant selection
 */
export function useProductVariants(productId: string | undefined): UseProductVariantsResult {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Fetch variants from database
  const { data: variants = [], isLoading, error } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;

      // Convert option1/2/3 format to options object
      return (data || []).map(v => {
        const options: Record<string, string> = {};
        if (v.option1_name && v.option1_value) {
          options[v.option1_name] = v.option1_value;
        }
        if (v.option2_name && v.option2_value) {
          options[v.option2_name] = v.option2_value;
        }
        if (v.option3_name && v.option3_value) {
          options[v.option3_name] = v.option3_value;
        }

        return {
          id: v.id,
          product_id: v.product_id,
          sku: v.sku || '',
          price: v.price,
          compare_at_price: v.compare_at_price ?? undefined,
          stock_quantity: v.stock_quantity ?? 0,
          options,
          image_url: v.image_url ?? undefined,
          is_active: v.is_active ?? true,
        } as ProductVariant;
      });
    },
    enabled: !!productId,
    staleTime: 30000,
  });

  // Extract unique option groups from all variants
  const optionGroups = useMemo(() => {
    const groups: Map<string, Set<string>> = new Map();

    variants.forEach(variant => {
      Object.entries(variant.options).forEach(([key, value]) => {
        if (!groups.has(key)) {
          groups.set(key, new Set());
        }
        groups.get(key)!.add(value);
      });
    });

    return Array.from(groups.entries()).map(([name, valuesSet]) => ({
      name,
      values: Array.from(valuesSet),
    }));
  }, [variants]);

  // Find the variant that matches all selected options
  const selectedVariant = useMemo(() => {
    if (optionGroups.length === 0) return null;
    if (Object.keys(selectedOptions).length !== optionGroups.length) return null;

    return variants.find(variant => {
      return Object.entries(selectedOptions).every(
        ([key, value]) => variant.options[key] === value
      );
    }) || null;
  }, [variants, selectedOptions, optionGroups.length]);

  // Select an option value
  const selectOption = useCallback((optionName: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionName]: value,
    }));
  }, []);

  const hasVariants = variants.length > 0;
  
  // Safety: requires selection if has variants but no variant selected yet
  const requiresSelection = hasVariants && selectedVariant === null;

  return {
    variants,
    optionGroups,
    selectedOptions,
    selectedVariant,
    selectOption,
    hasVariants,
    isLoading,
    error: error as Error | null,
    requiresSelection,
  };
}
