/**
 * registerProductImageToDrive.ts
 *
 * Fire-and-forget helper to register product images in the Meu Drive
 * after they've been uploaded to the product-images bucket.
 * This ensures product images appear in the Drive's "Produtos" folder.
 */

import { registerExternalFile, ensureFolderPath } from './driveService';

/**
 * Registers a product image URL in the Drive.
 * Called after upload to product-images bucket.
 * Fails silently — product upload must not be blocked by Drive registration.
 */
export async function registerProductImageToDrive(opts: {
  tenantId: string;
  userId: string;
  publicUrl: string;
  storagePath: string;
  originalName?: string;
  productName?: string;
}): Promise<void> {
  try {
    const { tenantId, userId, publicUrl, storagePath, originalName, productName } = opts;

    // Ensure "Produtos" folder exists
    const folderId = await ensureFolderPath({
      tenantId,
      userId,
      path: 'Produtos',
    });

    if (!folderId) return;

    await registerExternalFile({
      tenantId,
      userId,
      url: publicUrl,
      storagePath,
      originalName: originalName || storagePath.split('/').pop() || 'product-image',
      mimeType: guessMimeFromPath(storagePath),
      source: 'product_image',
      bucket: 'product-images',
      folderId,
      extraMetadata: productName ? { product_name: productName } : undefined,
    });
  } catch (err) {
    // Silent fail — Drive registration is best-effort
    console.error('[registerProductImageToDrive] Error:', err);
  }
}

function guessMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };
  return map[ext] || 'image/jpeg';
}
