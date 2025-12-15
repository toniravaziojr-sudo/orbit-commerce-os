import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
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
  created_at: string;
  updated_at: string;
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

// Hook for public storefront data (by tenant slug)
export function usePublicStorefront(tenantSlug: string) {
  const { toast } = useToast();

  // Fetch tenant by slug
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['public-tenant', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, logo_url')
        .eq('slug', tenantSlug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantSlug,
  });

  // Fetch store settings
  const { data: storeSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['public-store-settings', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .maybeSingle();

      if (error) throw error;
      return data as StoreSettings | null;
    },
    enabled: !!tenant?.id,
  });

  // Fetch header menu
  const { data: headerMenu } = useQuery({
    queryKey: ['public-header-menu', tenant?.id],
    queryFn: async () => {
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('location', 'header')
        .maybeSingle();

      if (menuError) throw menuError;
      if (!menu) return { menu: null, items: [] };

      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menu.id)
        .order('sort_order');

      if (itemsError) throw itemsError;

      return { menu: menu as Menu, items: (items || []) as MenuItem[] };
    },
    enabled: !!tenant?.id,
  });

  // Fetch footer menu
  const { data: footerMenu } = useQuery({
    queryKey: ['public-footer-menu', tenant?.id],
    queryFn: async () => {
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('location', 'footer')
        .maybeSingle();

      if (menuError) throw menuError;
      if (!menu) return { menu: null, items: [] };

      const { data: items, error: itemsError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menu.id)
        .order('sort_order');

      if (itemsError) throw itemsError;

      return { menu: menu as Menu, items: (items || []) as MenuItem[] };
    },
    enabled: !!tenant?.id,
  });

  // Fetch active categories
  const { data: categories } = useQuery({
    queryKey: ['public-categories', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  // Fetch active products
  const { data: products } = useQuery({
    queryKey: ['public-products', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('tenant_id', tenant!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const isLoading = tenantLoading || settingsLoading;
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
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['public-category-products', category?.id],
    queryFn: async () => {
      // Get product IDs with position from product_categories, ordered by position
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

      // Sort products by position from product_categories
      const sortedProducts = (products || []).sort((a, b) => {
        const posA = positionMap.get(a.id) ?? 999999;
        const posB = positionMap.get(b.id) ?? 999999;
        return posA - posB;
      });

      return sortedProducts;
    },
    enabled: !!category?.id,
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
  });

  return { page, isLoading };
}
