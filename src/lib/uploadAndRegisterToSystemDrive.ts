import { supabase } from '@/integrations/supabase/client';
import { ensureSystemFolderAndGetId, fileExistsInDrive } from './registerFileToDrive';

export interface SystemUploadOptions {
  tenantId: string;
  userId: string;
  file: File;
  source: string; // e.g., 'storefront_logo', 'category_banner', 'product_image'
  subPath?: string; // Optional subfolder within system folder path, e.g., 'branding', 'products'
  customFilename?: string; // If you want to override the generated filename
}

export interface SystemUploadResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  fileId: string | null; // ID in files table
}

/**
 * Canonical utility for uploading files to storage and registering them
 * in the Drive (files table) under "Uploads do sistema".
 * 
 * This should be used by ALL modules that upload assets.
 */
export async function uploadAndRegisterToSystemDrive(
  options: SystemUploadOptions
): Promise<SystemUploadResult | null> {
  const { tenantId, userId, file, source, subPath, customFilename } = options;

  // Get or create the system folder
  const systemFolderId = await ensureSystemFolderAndGetId(tenantId, userId);
  if (!systemFolderId) {
    console.error('Could not get/create system folder');
    return null;
  }

  // Generate storage path
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).slice(2, 8);
  const filename = customFilename || `${timestamp}-${randomId}.${fileExt}`;
  
  const basePath = subPath 
    ? `tenants/${tenantId}/${subPath}` 
    : `tenants/${tenantId}/assets`;
  const storagePath = `${basePath}/${filename}`;
  const bucket = 'store-assets';

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: true });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    return null;
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    console.error('Could not get public URL');
    return null;
  }

  // Check if already registered (avoid duplicates)
  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    console.log('File already registered in Drive:', storagePath);
    return { publicUrl, storagePath, bucket, fileId: null };
  }

  // Register in files table (Drive)
  const { data: fileRecord, error: insertError } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: systemFolderId,
      filename,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      is_folder: false,
      is_system_folder: false,
      created_by: userId,
      metadata: {
        source,
        url: publicUrl,
        bucket,
        system_managed: true,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error registering file to Drive:', insertError);
    // Still return success since file was uploaded
    return { publicUrl, storagePath, bucket, fileId: null };
  }

  return {
    publicUrl,
    storagePath,
    bucket,
    fileId: fileRecord?.id || null,
  };
}

/**
 * Helper to register an already-uploaded file to the system drive.
 * Useful for backfilling or reconciling existing assets.
 */
export async function registerExistingToSystemDrive(options: {
  tenantId: string;
  userId: string;
  publicUrl: string;
  storagePath: string;
  bucket: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  source: string;
}): Promise<string | null> {
  const { tenantId, userId, publicUrl, storagePath, bucket, originalName, mimeType, size, source } = options;

  // Get or create the system folder
  const systemFolderId = await ensureSystemFolderAndGetId(tenantId, userId);
  if (!systemFolderId) {
    console.error('Could not get/create system folder');
    return null;
  }

  // Check if already registered
  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    console.log('File already registered in Drive:', storagePath);
    return null;
  }

  // Register in files table
  const { data: fileRecord, error: insertError } = await supabase
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
      metadata: {
        source,
        url: publicUrl,
        bucket,
        system_managed: true,
      },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error registering file to Drive:', insertError);
    return null;
  }

  return fileRecord?.id || null;
}
