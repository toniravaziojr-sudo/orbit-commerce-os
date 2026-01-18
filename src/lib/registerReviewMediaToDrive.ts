/**
 * Registers review media files to the "Review clientes" folder in Drive
 * when a review is approved.
 */

import { supabase } from '@/integrations/supabase/client';
import { ensureSystemFolderAndGetId, fileExistsInDrive } from './registerFileToDrive';

const REVIEW_FOLDER_NAME = 'Review clientes';

/**
 * Ensures the "Review clientes" folder exists inside the system folder
 * and returns its ID.
 */
export async function ensureReviewFolderAndGetId(
  tenantId: string,
  userId: string
): Promise<string | null> {
  // First ensure system folder exists
  const systemFolderId = await ensureSystemFolderAndGetId(tenantId, userId);
  if (!systemFolderId) {
    console.error('Could not get/create system folder');
    return null;
  }

  // Check if review folder already exists inside system folder
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('folder_id', systemFolderId)
    .eq('filename', REVIEW_FOLDER_NAME)
    .eq('is_folder', true)
    .single();

  if (existing) return existing.id;

  // Create review folder inside system folder
  const { data: created, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: systemFolderId,
      filename: REVIEW_FOLDER_NAME,
      original_name: REVIEW_FOLDER_NAME,
      storage_path: `${tenantId}/system/review-clientes/`,
      is_folder: true,
      is_system_folder: false,
      created_by: userId,
      metadata: {
        source: 'review_media',
        system_managed: true,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating review folder:', error);
    return null;
  }

  return created?.id || null;
}

/**
 * Extracts storage path from a Supabase Storage public URL
 */
function extractStoragePathFromUrl(url: string, bucketName: string): string | null {
  if (!url) return null;

  // Pattern: .../storage/v1/object/public/{bucketName}/{path}
  const regex = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
  const match = url.match(regex);

  return match ? match[1] : null;
}

/**
 * Registers review media files to the "Review clientes" folder
 * Called when a review is approved.
 */
export async function registerReviewMediaToDrive(
  tenantId: string,
  userId: string,
  mediaUrls: string[],
  reviewId: string,
  customerName: string
): Promise<void> {
  if (!mediaUrls || mediaUrls.length === 0) return;

  // Ensure review folder exists
  const reviewFolderId = await ensureReviewFolderAndGetId(tenantId, userId);
  if (!reviewFolderId) {
    console.error('Could not get/create review folder');
    return;
  }

  const bucketName = 'review-media';

  for (const url of mediaUrls) {
    const storagePath = extractStoragePathFromUrl(url, bucketName);
    if (!storagePath) {
      console.warn('Could not extract storage path from URL:', url);
      continue;
    }

    // Check if already registered
    const exists = await fileExistsInDrive(tenantId, storagePath);
    if (exists) {
      console.log('File already registered in Drive:', storagePath);
      continue;
    }

    // Extract filename from path
    const pathParts = storagePath.split('/');
    const filename = pathParts[pathParts.length - 1] || 'review-media';

    // Determine mime type from extension
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    let mimeType = 'application/octet-stream';
    if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
    else if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'mp4') mimeType = 'video/mp4';
    else if (ext === 'webm') mimeType = 'video/webm';
    else if (ext === 'mov') mimeType = 'video/quicktime';

    // Register file in Drive under review folder
    const { error } = await supabase
      .from('files')
      .insert({
        tenant_id: tenantId,
        folder_id: reviewFolderId,
        filename,
        original_name: filename,
        storage_path: storagePath,
        mime_type: mimeType,
        is_folder: false,
        is_system_folder: false,
        created_by: userId,
        metadata: {
          source: 'review_media',
          url,
          bucket: bucketName,
          review_id: reviewId,
          customer_name: customerName,
          system_managed: true,
        },
      });

    if (error) {
      console.error('Error registering review media to Drive:', error);
    }
  }
}
