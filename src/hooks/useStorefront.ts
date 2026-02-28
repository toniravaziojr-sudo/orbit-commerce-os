import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
import type { Json } from '@/integrations/supabase/types';

export interface StoreSettings {
  id: string;
  tenant_id: string;
  store_name: string | null;
  store_description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  is_published: boolean;
  header_style: string | null;
  footer_style: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_tiktok: string | null;
  social_youtube: string | null;
  social_custom: Array<{ label: string; url: string; icon?: string }> | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  custom_css: string | null;
  custom_scripts: string | null;
  // Business info
  business_legal_name: string | null;
  business_cnpj: string | null;
  // Contact info
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  contact_support_hours: string | null;
  // New config fields (JSONB)
  shipping_config: Json | null;
  benefit_config: Json | null;
  offers_config: Json | null;
  created_at: string;
  updated_at: string;
}

// Helper to parse social_custom from Json
function parseSocialCustom(data: Json | null): Array<{ label: string; url: string; icon?: string }> | null {
  if (!data || !Array.isArray(data)) return null;
  return data.map((item) => {
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      return {
        label: String(obj.label || ''),
        url: String(obj.url || ''),
        icon: obj.icon ? String(obj.icon) : undefined,
      };
    }
    return { label: '', url: '' };
  });
}

export interface Menu {
  id: string;
  tenant_id: string;
  name: string;
  location: 'header' | 'footer';
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  tenant_id: string;
  menu_id: string;
  label: string;
  item_type: 'category' | 'page' | 'external';
  ref_id: string | null;
  url: string | null;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorePage {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  type: string;
  status: 'draft' | 'published';
  content: Record<string, unknown> | null;
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  is_homepage: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorefrontTemplate {
  id: string;
  tenant_id: string;
  page_type: 'home' | 'category' | 'product' | 'cart' | 'checkout';
  template_json: Record<string, unknown>;
  updated_at: string;
}

// Hook for public storefront data (by tenant slug) — OPTIMIZED with bootstrap
export function usePublicStorefront(tenantSlug: string) {
  const { toast } = useToast();

  // Single bootstrap call that fetches everything in parallel on the server
  const { data: bootstrap, isLoading: bootstrapLoading } = useQuery({
    queryKey: ['storefront-bootstrap', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('storefront-bootstrap', {
        body: { tenant_slug: tenantSlug, include_products: true },
      });

      if (error) throw error;
      if (!data?.success) return null;
      return data;
    },
    enabled: !!tenantSlug,
    staleTime: 2 * 60 * 1000, // 2 min — storefront data rarely changes
    gcTime: 5 * 60 * 1000,    // 5 min cache
  });

  // Derive all data from the single bootstrap response
  const tenant = bootstrap?.tenant || null;
  
  const storeSettings = bootstrap?.store_settings
    ? {
        ...bootstrap.store_settings,
        social_custom: parseSocialCustom(bootstrap.store_settings.social_custom),
      } as StoreSettings
    : null;

  const headerMenu = bootstrap?.header_menu || { menu: null, items: [] };
  const footerMenu = bootstrap?.footer_menu || { menu: null, items: [] };
  const categories = bootstrap?.categories || [];
  const products = bootstrap?.products || [];

  const isLoading = bootstrapLoading;
  const isPublished = storeSettings?.is_published ?? false;

  return {
    tenant,
    storeSettings,
    headerMenu,
    footerMenu,
    categories,
    products,
    isLoading,
    isPublished,
  };
}

// Hook for fetching category with products
export function usePublicCategory(tenantSlug: string, categorySlug: string) {
  const { tenant } = usePublicStorefront(tenantSlug);

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ['public-category', tenant?.id, categorySlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('slug', categorySlug)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!categorySlug,
    staleTime: 2 * 60 * 1000,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['public-category-products', category?.id],
    queryFn: async () => {
      const { data: productCategories, error: pcError } = await supabase
        .from('product_categories')
        .select('product_id, position')
        .eq('category_id', category!.id)
        .order('position', { ascending: true });

      if (pcError) throw pcError;
      if (!productCategories?.length) return [];

      const productIds = productCategories.map(pc => pc.product_id);
      const positionMap = new Map(productCategories.map(pc => [pc.product_id, pc.position]));

      const { data: products, error } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .in('id', productIds)
        .eq('status', 'active');

      if (error) throw error;

      const sortedProducts = (products || []).sort((a, b) => {
        const posA = positionMap.get(a.id) ?? 999999;
        const posB = positionMap.get(b.id) ?? 999999;
        return posA - posB;
      });

      return sortedProducts;
    },
    enabled: !!category?.id,
    staleTime: 2 * 60 * 1000,
  });

  return {
    category,
    products,
    isLoading: categoryLoading || productsLoading,
  };
}

// Hook for fetching single product
export function usePublicProduct(tenantSlug: string, productSlug: string) {
  const { tenant } = usePublicStorefront(tenantSlug);

  const { data: product, isLoading } = useQuery({
    queryKey: ['public-product', tenant?.id, productSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_images(*), product_variants(*)')
        .eq('tenant_id', tenant!.id)
        .eq('slug', productSlug)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && !!productSlug,
    staleTime: 60 * 1000, // 1 min for product detail
  });

  // Get first category for breadcrumbs
  const { data: productCategory } = useQuery({
    queryKey: ['public-product-category', product?.id],
    queryFn: async () => {
      const { data: pc, error: pcError } = await supabase
        .from('product_categories')
        .select('category_id')
        .eq('product_id', product!.id)
        .limit(1)
        .maybeSingle();

      if (pcError) throw pcError;
      if (!pc) return null;

      const { data: category, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', pc.category_id)
        .maybeSingle();

      if (error) throw error;
      return category;
    },
    enabled: !!product?.id,
    staleTime: 2 * 60 * 1000,
  });

  return {
    product,
    category: productCategory,
    isLoading,
  };
}

// Hook for institutional pages
export function usePublicPage(tenantSlug: string, pageSlug: string) {
  const { tenant } = usePublicStorefront(tenantSlug);

  const { data: page, isLoading } = useQuery({
    queryKey: ['public-page', tenant?.id, pageSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_pages')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('slug', pageSlug)
        .eq('is_published', true)
        .maybeSingle();

      if (error) throw error;
      return data as StorePage | null;
    },
    enabled: !!tenant?.id && !!pageSlug,
    staleTime: 2 * 60 * 1000,
  });

  return { page, isLoading };
}
