import { supabase } from '@/integrations/supabase/client';
import { ensureSystemFolderAndGetId, fileExistsInDrive } from './registerFileToDrive';

/**
 * Generates a unique storage path with UUID to avoid cache issues
 */
function generateUniqueStoragePath(tenantId: string, assetType: string, fileExt: string): string {
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  return `tenants/${tenantId}/branding/${assetType}-${timestamp}-${uuid}.${fileExt}`;
}

export interface ReplaceAssetOptions {
  tenantId: string;
  userId: string;
  file: File;
  assetType: string; // e.g., 'logo', 'favicon', 'category_banner'
  oldUrl?: string | null; // Previous URL to help with cleanup
}

export interface ReplaceAssetResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  fileId: string | null;
  version: number; // Timestamp for cache-busting
}

/**
 * Canonical utility for REPLACING media assets in the system.
 * 
 * Key features:
 * 1. ALWAYS generates a UNIQUE path (no overwrites, no cache issues)
 * 2. Registers the new file to the Drive (files table)
 * 3. Returns a cache-busting version parameter
 * 4. Does NOT delete the old file (that's handled separately when needed)
 */
export async function replaceSystemAsset(
  options: ReplaceAssetOptions
): Promise<ReplaceAssetResult | null> {
  const { tenantId, userId, file, assetType, oldUrl } = options;
  const bucket = 'store-assets';

  // Get or create the system folder
  const systemFolderId = await ensureSystemFolderAndGetId(tenantId, userId);
  if (!systemFolderId) {
    console.error('[replaceSystemAsset] Could not get/create system folder');
    return null;
  }

  // Generate UNIQUE storage path (never overwrite)
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const storagePath = generateUniqueStoragePath(tenantId, assetType, fileExt);
  const version = Date.now();

  // Upload to storage with unique path
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { 
      upsert: false, // Never upsert - always unique path
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('[replaceSystemAsset] Upload error:', uploadError);
    return null;
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    console.error('[replaceSystemAsset] Could not get public URL');
    return null;
  }

  // Check if already registered (avoid duplicates by path)
  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    console.log('[replaceSystemAsset] File already registered:', storagePath);
    return { publicUrl, storagePath, bucket, fileId: null, version };
  }

  // Register in files table (Drive)
  const { data: fileRecord, error: insertError } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: systemFolderId,
      filename: `${assetType}.${fileExt}`,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      is_folder: false,
      is_system_folder: false,
      created_by: userId,
      metadata: {
        source: `storefront_${assetType}`,
        url: publicUrl,
        bucket,
        system_managed: true,
        replaced_at: new Date().toISOString(),
        old_url: oldUrl || null,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[replaceSystemAsset] Error registering file to Drive:', insertError);
    // Still return success since file was uploaded
    return { publicUrl, storagePath, bucket, fileId: null, version };
  }

  console.log('[replaceSystemAsset] Success:', { 
    publicUrl, 
    storagePath, 
    fileId: fileRecord?.id,
    version 
  });

  return {
    publicUrl,
    storagePath,
    bucket,
    fileId: fileRecord?.id || null,
    version,
  };
}

/**
 * Adds a cache-busting version parameter to a URL
 */
export function addVersionToUrl(url: string | null, version?: number): string | null {
  if (!url) return null;
  const v = version || Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${v}`;
}

/**
 * Removes version parameter from URL (for storage/comparison)
 */
export function removeVersionFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/[?&]v=\d+/g, '').replace(/\?$/, '');
}
