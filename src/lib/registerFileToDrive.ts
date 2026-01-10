import { supabase } from '@/integrations/supabase/client';

export interface RegisterFileOptions {
  tenantId: string;
  userId: string;
  url: string;
  storagePath: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  source: string; // e.g., 'storefront_logo', 'storefront_favicon', 'category_banner'
}

const SYSTEM_FOLDER_NAME = 'Uploads do sistema';

/**
 * Ensures the system folder exists and returns its ID
 */
export async function ensureSystemFolderAndGetId(tenantId: string, userId: string): Promise<string | null> {
  // Check if system folder already exists
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_system_folder', true)
    .is('folder_id', null)
    .single();

  if (existing) return existing.id;

  // Create system folder
  const { data: created, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: null,
      filename: SYSTEM_FOLDER_NAME,
      original_name: SYSTEM_FOLDER_NAME,
      storage_path: `${tenantId}/system/`,
      is_folder: true,
      is_system_folder: true,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating system folder:', error);
    return null;
  }

  return created?.id || null;
}

/**
 * Checks if a file with the given storage_path already exists in the files table
 */
export async function fileExistsInDrive(tenantId: string, storagePath: string): Promise<boolean> {
  const { data } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('storage_path', storagePath)
    .single();

  return !!data;
}

/**
 * Registers an uploaded file to the Drive (files table) in the system folder.
 * Returns the file record ID or null if failed.
 */
export async function registerFileToDrive(options: RegisterFileOptions): Promise<string | null> {
  const { tenantId, userId, url, storagePath, originalName, mimeType, size, source } = options;

  // Get or create system folder
  const systemFolderId = await ensureSystemFolderAndGetId(tenantId, userId);
  if (!systemFolderId) {
    console.error('Could not get/create system folder');
    return null;
  }

  // Check if file already exists (avoid duplicates)
  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    console.log('File already registered in Drive:', storagePath);
    return null; // Already exists, no need to register again
  }

  // Create file record
  const { data, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: systemFolderId,
      filename: originalName,
      original_name: originalName,
      storage_path: storagePath,
      mime_type: mimeType || null,
      size_bytes: size || null,
      is_folder: false,
      is_system_folder: false,
      created_by: userId,
      metadata: { source, url },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error registering file to Drive:', error);
    return null;
  }

  return data?.id || null;
}

/**
 * Extracts storage path from a Supabase Storage public URL
 */
export function extractStoragePathFromUrl(url: string, bucketName: string): string | null {
  if (!url) return null;
  
  // Pattern: .../storage/v1/object/public/{bucketName}/{path}
  const regex = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
  const match = url.match(regex);
  
  return match ? match[1] : null;
}

/**
 * Backfills existing storefront assets (logo, favicon) to the Drive
 */
export async function backfillStorefrontAssets(
  tenantId: string, 
  userId: string, 
  logoUrl: string | null, 
  faviconUrl: string | null
): Promise<void> {
  const bucketName = 'store-assets';

  const assets = [
    { url: logoUrl, source: 'storefront_logo', name: 'logo' },
    { url: faviconUrl, source: 'storefront_favicon', name: 'favicon' },
  ];

  for (const asset of assets) {
    if (!asset.url) continue;

    const storagePath = extractStoragePathFromUrl(asset.url, bucketName);
    if (!storagePath) continue;

    // Check if already registered
    const exists = await fileExistsInDrive(tenantId, storagePath);
    if (exists) continue;

    // Extract filename from path
    const pathParts = storagePath.split('/');
    const filename = pathParts[pathParts.length - 1] || `${asset.name}.png`;

    await registerFileToDrive({
      tenantId,
      userId,
      url: asset.url,
      storagePath,
      originalName: filename,
      mimeType: 'image/png', // Assume PNG, could be improved
      source: asset.source,
    });
  }
}
