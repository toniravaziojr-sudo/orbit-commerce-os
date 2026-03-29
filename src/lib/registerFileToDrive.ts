/**
 * registerFileToDrive.ts — WRAPPER DE COMPATIBILIDADE
 *
 * Todas as funções delegam para driveService.ts.
 * Mantido apenas para não quebrar importações existentes.
 * Será removido em fase posterior de limpeza.
 */

import {
  ensureFolder as _ensureFolder,
  ensureSystemFolder as _ensureSystemFolder,
  fileExistsInDrive as _fileExistsInDrive,
  registerExternalFile,
  extractStoragePathFromUrl as _extractStoragePathFromUrl,
} from './driveService';

export interface RegisterFileOptions {
  tenantId: string;
  userId: string;
  url: string;
  storagePath: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  source: string;
  bucket?: string;
}

/** @deprecated Use driveService.ensureSystemFolder */
export async function ensureSystemFolderAndGetId(tenantId: string, userId: string): Promise<string | null> {
  return _ensureSystemFolder(tenantId, userId);
}

/** @deprecated Use driveService.fileExistsInDrive */
export async function fileExistsInDrive(tenantId: string, storagePath: string): Promise<boolean> {
  return _fileExistsInDrive(tenantId, storagePath);
}

/** @deprecated Use driveService.registerExternalFile */
export async function registerFileToDrive(options: RegisterFileOptions): Promise<string | null> {
  return registerExternalFile({
    tenantId: options.tenantId,
    userId: options.userId,
    url: options.url,
    storagePath: options.storagePath,
    originalName: options.originalName,
    mimeType: options.mimeType,
    size: options.size,
    source: options.source,
    bucket: options.bucket,
  });
}

/** @deprecated Use driveService.extractStoragePathFromUrl */
export function extractStoragePathFromUrl(url: string, bucketName: string): string | null {
  return _extractStoragePathFromUrl(url, bucketName);
}

/** @deprecated Use driveService.registerExternalFile + ensureSystemFolder */
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
    const storagePath = _extractStoragePathFromUrl(asset.url, bucketName);
    if (!storagePath) continue;

    const exists = await _fileExistsInDrive(tenantId, storagePath);
    if (exists) continue;

    const pathParts = storagePath.split('/');
    const filename = pathParts[pathParts.length - 1] || `${asset.name}.png`;

    await registerExternalFile({
      tenantId,
      userId,
      url: asset.url,
      storagePath,
      originalName: filename,
      mimeType: 'image/png',
      source: asset.source,
    });
  }
}