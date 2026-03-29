/**
 * registerReviewMediaToDrive.ts — WRAPPER DE COMPATIBILIDADE
 *
 * Delega para driveService.ts. Mantido para preservar importações existentes.
 * Será removido em fase posterior de limpeza.
 */

import {
  ensureFolder,
  ensureSystemFolder,
  fileExistsInDrive,
  registerExternalFile,
  extractStoragePathFromUrl,
  guessMimeType,
} from './driveService';

const REVIEW_FOLDER_NAME = 'Review clientes';

/** @deprecated Use driveService.ensureFolder */
export async function ensureReviewFolderAndGetId(
  tenantId: string,
  userId: string
): Promise<string | null> {
  const systemFolderId = await ensureSystemFolder(tenantId, userId);
  if (!systemFolderId) return null;

  return ensureFolder({
    tenantId,
    userId,
    folderName: REVIEW_FOLDER_NAME,
    parentFolderId: systemFolderId,
    storagePath: `${tenantId}/system/review-clientes/`,
    metadata: { source: 'review_media', system_managed: true },
  });
}

/** @deprecated Use driveService.registerExternalFile */
export async function registerReviewMediaToDrive(
  tenantId: string,
  userId: string,
  mediaUrls: string[],
  reviewId: string,
  customerName: string
): Promise<void> {
  if (!mediaUrls || mediaUrls.length === 0) return;

  const reviewFolderId = await ensureReviewFolderAndGetId(tenantId, userId);
  if (!reviewFolderId) {
    console.error('Could not get/create review folder');
    return;
  }

  const bucketName = 'review-media';

  for (const url of mediaUrls) {
    const storagePath = extractStoragePathFromUrl(url, bucketName);
    if (!storagePath) continue;

    const exists = await fileExistsInDrive(tenantId, storagePath);
    if (exists) continue;

    const pathParts = storagePath.split('/');
    const filename = pathParts[pathParts.length - 1] || 'review-media';
    const mimeType = guessMimeType(filename);

    await registerExternalFile({
      tenantId,
      userId,
      url,
      storagePath,
      originalName: filename,
      mimeType,
      source: 'review_media',
      bucket: bucketName,
      folderId: reviewFolderId,
      extraMetadata: { review_id: reviewId, customer_name: customerName },
    });
  }
}