import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileItem } from '@/hooks/useFiles';
import { useEffect, useCallback, useMemo } from 'react';

export type FileUsageType =
  | 'logo'
  | 'favicon'
  | 'category_image'
  | 'category_banner'
  | 'product_image'
  | 'social_post'
  | 'landing_page';

export interface FileUsage {
  type: FileUsageType;
  label: string;
  detail?: string; // e.g. "Categoria: Roupas"
}

export interface FileUsageMap {
  [fileId: string]: FileUsage[];
}

/**
 * Normalizes a URL by removing query params
 */
function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.split('?')[0].trim();
}

/**
 * Extracts bucket and storage path from a Supabase Storage URL
 */
function extractStorageInfo(url: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return null;
  const match = cleanUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  return match ? { bucket: match[1], path: match[2] } : null;
}

/**
 * Hook to detect which files are currently in use across the system.
 * Batch-loads reference data and matches against visible files.
 *
 * Covers: store_settings, categories, product_images, social_posts, ai_landing_pages
 */
export function useFileUsageDetection() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // ─── 1. Store Settings ──────────────────────────────────────
  const { data: storeSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['store-settings-urls', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('logo_url, favicon_url, logo_file_id, favicon_file_id, updated_at')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
    staleTime: 5_000,
  });

  // ─── 2. Categories (image_url, banner_desktop_url, banner_mobile_url) ──
  const { data: categories } = useQuery({
    queryKey: ['usage-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, image_url, banner_desktop_url, banner_mobile_url')
        .eq('tenant_id', tenantId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // ─── 3. Product Images (url, file_id) ──────────────────────
  const { data: productImages } = useQuery({
    queryKey: ['usage-product-images', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_images')
        .select('id, url, file_id, product_id')
        .eq('tenant_id', tenantId!)
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // ─── 4. Social Posts (media_urls) ──────────────────────────
  const { data: socialPosts } = useQuery({
    queryKey: ['usage-social-posts', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_posts')
        .select('id, media_urls, platform, status')
        .eq('tenant_id', tenantId!)
        .in('status', ['scheduled', 'published', 'processing'])
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // ─── 5. Landing Pages (generated_html has embedded URLs — match seo_image_url for now) ─
  const { data: landingPages } = useQuery({
    queryKey: ['usage-landing-pages', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_landing_pages')
        .select('id, name, seo_image_url')
        .eq('tenant_id', tenantId!)
        .not('seo_image_url', 'is', null)
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 60_000,
  });

  // ─── Realtime for store_settings ───────────────────────────
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`store-settings-usage-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_settings', filter: `tenant_id=eq.${tenantId}` },
        () => {
          refetchSettings();
          queryClient.invalidateQueries({ queryKey: ['store-settings-urls', tenantId] });
          queryClient.invalidateQueries({ queryKey: ['store-settings', tenantId] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId, queryClient, refetchSettings]);

  // ─── Pre-built lookup indexes ──────────────────────────────
  const urlIndex = useMemo(() => {
    const map = new Map<string, FileUsage[]>();

    const addUrl = (url: string | null, usage: FileUsage) => {
      if (!url) return;
      const norm = normalizeUrl(url);
      if (!norm) return;
      const existing = map.get(norm) || [];
      existing.push(usage);
      map.set(norm, existing);
      // Also index by storage path portion
      const info = extractStorageInfo(url);
      if (info) {
        const pathKey = `${info.bucket}::${info.path}`;
        const ex2 = map.get(pathKey) || [];
        ex2.push(usage);
        map.set(pathKey, ex2);
        // Also bare path
        const ex3 = map.get(info.path) || [];
        ex3.push(usage);
        map.set(info.path, ex3);
      }
    };

    // Categories
    for (const cat of categories || []) {
      addUrl(cat.image_url, { type: 'category_image', label: 'Categoria', detail: cat.name });
      addUrl(cat.banner_desktop_url, { type: 'category_banner', label: 'Banner categoria', detail: cat.name });
      addUrl(cat.banner_mobile_url, { type: 'category_banner', label: 'Banner categoria (mobile)', detail: cat.name });
    }

    // Social posts
    for (const post of socialPosts || []) {
      if (post.media_urls && Array.isArray(post.media_urls)) {
        for (const url of post.media_urls) {
          if (typeof url === 'string') {
            addUrl(url, { type: 'social_post', label: 'Publicação', detail: `${post.platform} • ${post.status}` });
          }
        }
      }
    }

    // Landing pages
    for (const lp of landingPages || []) {
      addUrl(lp.seo_image_url, { type: 'landing_page', label: 'Landing page', detail: lp.name });
    }

    return map;
  }, [categories, socialPosts, landingPages]);

  // File ID index for product_images
  const fileIdIndex = useMemo(() => {
    const map = new Map<string, FileUsage[]>();
    for (const pi of productImages || []) {
      if (pi.file_id) {
        const existing = map.get(pi.file_id) || [];
        existing.push({ type: 'product_image', label: 'Produto', detail: `Imagem de produto` });
        map.set(pi.file_id, existing);
      }
    }
    return map;
  }, [productImages]);

  // Product images URL index
  const productUrlIndex = useMemo(() => {
    const map = new Map<string, FileUsage[]>();
    for (const pi of productImages || []) {
      if (pi.url) {
        const norm = normalizeUrl(pi.url);
        if (norm) {
          const ex = map.get(norm) || [];
          ex.push({ type: 'product_image', label: 'Produto', detail: 'Imagem de produto' });
          map.set(norm, ex);
        }
        const info = extractStorageInfo(pi.url);
        if (info) {
          const pathKey = `${info.bucket}::${info.path}`;
          const ex2 = map.get(pathKey) || [];
          ex2.push({ type: 'product_image', label: 'Produto', detail: 'Imagem de produto' });
          map.set(pathKey, ex2);
          const ex3 = map.get(info.path) || [];
          ex3.push({ type: 'product_image', label: 'Produto', detail: 'Imagem de produto' });
          map.set(info.path, ex3);
        }
      }
    }
    return map;
  }, [productImages]);

  /**
   * STRICT matching for store_settings (only ONE file per usage type)
   */
  const matchesReference = useCallback((
    file: FileItem,
    settingUrl: string | null,
    settingFileId: string | null
  ): boolean => {
    if (!settingUrl && !settingFileId) return false;
    if (file.is_folder) return false;

    // Priority 1: file_id exact match
    if (settingFileId && file.id === settingFileId) return true;
    if (settingFileId && file.id !== settingFileId) return false;

    // Priority 2 & 3: URL/path matching (only if no file_id set)
    if (!settingFileId && settingUrl) {
      const metadata = file.metadata as Record<string, unknown> | null;
      const fileUrl = metadata?.url as string | undefined;
      const fileBucket = metadata?.bucket as string | undefined;
      const filePath = file.storage_path;

      const settingStorageInfo = extractStorageInfo(settingUrl);
      if (settingStorageInfo) {
        if (fileBucket === settingStorageInfo.bucket && filePath === settingStorageInfo.path) return true;
        if (filePath === settingStorageInfo.path) return true;
      }

      const normalizedFileUrl = normalizeUrl(fileUrl || null);
      const normalizedSettingUrl = normalizeUrl(settingUrl);
      if (normalizedFileUrl && normalizedSettingUrl && normalizedFileUrl === normalizedSettingUrl) return true;
    }

    return false;
  }, []);

  /**
   * Get all usages for a file — uses indexed lookups for performance
   */
  const getFileUsage = useCallback((file: FileItem): FileUsage[] => {
    if (file.is_folder) return [];

    const usages: FileUsage[] = [];
    const seenTypes = new Set<string>();

    const addUnique = (items: FileUsage[]) => {
      for (const u of items) {
        const key = `${u.type}:${u.detail || ''}`;
        if (!seenTypes.has(key)) {
          seenTypes.add(key);
          usages.push(u);
        }
      }
    };

    // Store settings (strict single-match)
    if (storeSettings) {
      if (matchesReference(file, storeSettings.logo_url, storeSettings.logo_file_id)) {
        usages.push({ type: 'logo', label: 'Logo' });
      }
      if (matchesReference(file, storeSettings.favicon_url, storeSettings.favicon_file_id)) {
        usages.push({ type: 'favicon', label: 'Favicon' });
      }
    }

    // file_id index (product_images)
    const byFileId = fileIdIndex.get(file.id);
    if (byFileId) addUnique(byFileId);

    // URL-based lookups
    const metadata = file.metadata as Record<string, unknown> | null;
    const fileUrl = metadata?.url as string | undefined;
    const fileBucket = metadata?.bucket as string | undefined;
    const filePath = file.storage_path;

    // Try normalized URL
    if (fileUrl) {
      const norm = normalizeUrl(fileUrl);
      if (norm) {
        const fromUrl = urlIndex.get(norm);
        if (fromUrl) addUnique(fromUrl);
        const fromProd = productUrlIndex.get(norm);
        if (fromProd) addUnique(fromProd);
      }
    }

    // Try bucket::path
    if (fileBucket && filePath) {
      const pathKey = `${fileBucket}::${filePath}`;
      const fromPath = urlIndex.get(pathKey);
      if (fromPath) addUnique(fromPath);
      const fromProd = productUrlIndex.get(pathKey);
      if (fromProd) addUnique(fromProd);
    }

    // Try bare path
    if (filePath) {
      const fromBare = urlIndex.get(filePath);
      if (fromBare) addUnique(fromBare);
      const fromProd = productUrlIndex.get(filePath);
      if (fromProd) addUnique(fromProd);
    }

    return usages;
  }, [storeSettings, matchesReference, fileIdIndex, urlIndex, productUrlIndex]);

  const isFileInUse = useCallback((file: FileItem): boolean => {
    return getFileUsage(file).length > 0;
  }, [getFileUsage]);

  return {
    storeSettings,
    getFileUsage,
    isFileInUse,
    refetchUsage: refetchSettings,
  };
}
