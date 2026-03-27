/**
 * drive-backfill — Registra assets antigos no Meu Drive (tabela files).
 *
 * Idempotente: verifica duplicatas por storage_path antes de inserir.
 * NÃO move, renomeia ou altera URLs/paths existentes.
 *
 * Cobre: store_settings (logo/favicon), product_images, categories.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ensureFolderPathEdge,
  registerFileToDriveEdge,
} from '../_shared/drive-register.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Extract storage path from a Supabase public URL */
function extractPath(url: string | null, bucket: string): string | null {
  if (!url) return null;
  const clean = url.split('?')[0];
  const re = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
  const m = clean.match(re);
  return m ? m[1] : null;
}

/** Guess mime from extension */
function guessMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };
  return map[ext] || 'image/png';
}

function filenameFromPath(p: string): string {
  return p.split('/').pop() || 'asset';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, user_id } = await req.json();
    if (!tenant_id || !user_id) {
      return new Response(JSON.stringify({ error: 'tenant_id and user_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const stats = { store_settings: 0, product_images: 0, categories: 0, skipped: 0, errors: 0 };

    // ─── 1. Store Settings (logo, favicon) ────────────────────────────
    const { data: ss } = await supabase
      .from('store_settings')
      .select('logo_url, favicon_url')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (ss) {
      const brandingFolder = await ensureFolderPathEdge(supabase, tenant_id, user_id, 'Uploads do sistema/Branding');
      if (brandingFolder) {
        const assets = [
          { url: ss.logo_url, source: 'storefront_logo', name: 'logo' },
          { url: ss.favicon_url, source: 'storefront_favicon', name: 'favicon' },
        ];
        for (const a of assets) {
          if (!a.url) continue;
          const bucket = 'store-assets';
          const sp = extractPath(a.url, bucket);
          if (!sp) { stats.skipped++; continue; }

          // Check duplicate
          const { data: dup } = await supabase
            .from('files')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('storage_path', sp)
            .limit(1);
          if (dup && dup.length > 0) { stats.skipped++; continue; }

          await registerFileToDriveEdge(supabase, {
            tenantId: tenant_id,
            userId: user_id,
            folderId: brandingFolder,
            storagePath: sp,
            originalName: filenameFromPath(sp),
            publicUrl: a.url,
            mimeType: guessMime(sp),
            source: a.source,
            bucket,
            extraMetadata: { backfill: true },
          });
          stats.store_settings++;
        }
      }
    }

    // ─── 2. Product Images ────────────────────────────────────────────
    const prodFolder = await ensureFolderPathEdge(supabase, tenant_id, user_id, 'Produtos');
    if (prodFolder) {
      // Paginate — up to 5000 images
      let from = 0;
      const pageSize = 500;
      while (from < 5000) {
        const { data: imgs } = await supabase
          .from('product_images')
          .select('id, url, tenant_id')
          .eq('tenant_id', tenant_id)
          .range(from, from + pageSize - 1);

        if (!imgs || imgs.length === 0) break;

        for (const img of imgs) {
          if (!img.url) continue;
          // Try both buckets
          let sp = extractPath(img.url, 'product-images');
          let bucket = 'product-images';
          if (!sp) {
            sp = extractPath(img.url, 'store-assets');
            bucket = 'store-assets';
          }
          if (!sp) { stats.skipped++; continue; }

          const { data: dup } = await supabase
            .from('files')
            .select('id')
            .eq('tenant_id', tenant_id)
            .eq('storage_path', sp)
            .limit(1);
          if (dup && dup.length > 0) { stats.skipped++; continue; }

          await registerFileToDriveEdge(supabase, {
            tenantId: tenant_id,
            userId: user_id,
            folderId: prodFolder,
            storagePath: sp,
            originalName: filenameFromPath(sp),
            publicUrl: img.url,
            mimeType: guessMime(sp),
            source: 'product_image',
            bucket,
            extraMetadata: { backfill: true, product_image_id: img.id },
          });
          stats.product_images++;
        }

        from += pageSize;
        if (imgs.length < pageSize) break;
      }
    }

    // ─── 3. Categories ────────────────────────────────────────────────
    const catFolder = await ensureFolderPathEdge(supabase, tenant_id, user_id, 'Categorias');
    if (catFolder) {
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, image_url, banner_desktop_url, banner_mobile_url')
        .eq('tenant_id', tenant_id);

      if (cats) {
        for (const cat of cats) {
          const urls = [
            { url: cat.image_url, source: 'category_image' },
            { url: cat.banner_desktop_url, source: 'category_banner' },
            { url: cat.banner_mobile_url, source: 'category_banner' },
          ];
          for (const u of urls) {
            if (!u.url) continue;
            const bucket = 'store-assets';
            const sp = extractPath(u.url, bucket);
            if (!sp) { stats.skipped++; continue; }

            const { data: dup } = await supabase
              .from('files')
              .select('id')
              .eq('tenant_id', tenant_id)
              .eq('storage_path', sp)
              .limit(1);
            if (dup && dup.length > 0) { stats.skipped++; continue; }

            await registerFileToDriveEdge(supabase, {
              tenantId: tenant_id,
              userId: user_id,
              folderId: catFolder,
              storagePath: sp,
              originalName: filenameFromPath(sp),
              publicUrl: u.url,
              mimeType: guessMime(sp),
              source: u.source,
              bucket,
              extraMetadata: { backfill: true, category_id: cat.id },
            });
            stats.categories++;
          }
        }
      }
    }

    console.log(`[drive-backfill] Done for tenant ${tenant_id}:`, stats);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[drive-backfill] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
