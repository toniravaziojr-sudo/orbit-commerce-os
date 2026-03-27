/**
 * uploadAndRegisterToSystemDrive.ts — WRAPPER DE COMPATIBILIDADE
 *
 * Delega para driveService.ts. Mantido para preservar importações existentes.
 * Será removido em fase posterior de limpeza.
 */

import {
  uploadToDrive,
  registerExternalFile,
  ensureSystemFolder,
  fileExistsInDrive,
  type UploadToDriveResult,
} from './driveService';

export interface SystemUploadOptions {
  tenantId: string;
  userId: string;
  file: File;
  source: string;
  subPath?: string;
  customFilename?: string;
  folderId?: string;
}

export interface SystemUploadResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  fileId: string | null;
}

/** @deprecated Use driveService.uploadToDrive */
export async function uploadAndRegisterToSystemDrive(
  options: SystemUploadOptions
): Promise<SystemUploadResult | null> {
  return uploadToDrive({
    tenantId: options.tenantId,
    userId: options.userId,
    file: options.file,
    source: options.source,
    subPath: options.subPath,
    customFilename: options.customFilename,
    folderId: options.folderId,
  });
}

/** @deprecated Use driveService.registerExternalFile */
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
  return registerExternalFile({
    tenantId: options.tenantId,
    userId: options.userId,
    url: options.publicUrl,
    storagePath: options.storagePath,
    originalName: options.originalName,
    mimeType: options.mimeType,
    size: options.size,
    source: options.source,
    bucket: options.bucket,
  });
}
