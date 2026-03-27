/**
 * replaceSystemAsset.ts — WRAPPER DE COMPATIBILIDADE
 *
 * Delega para driveService.ts. Mantido para preservar importações existentes.
 * Será removido em fase posterior de limpeza.
 */

import {
  replaceDriveAsset,
  addVersionToUrl as _addVersionToUrl,
  removeVersionFromUrl as _removeVersionFromUrl,
  type ReplaceDriveAssetResult,
} from './driveService';

export interface ReplaceAssetOptions {
  tenantId: string;
  userId: string;
  file: File;
  assetType: string;
  oldUrl?: string | null;
}

export interface ReplaceAssetResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  fileId: string | null;
  version: number;
}

/** @deprecated Use driveService.replaceDriveAsset */
export async function replaceSystemAsset(
  options: ReplaceAssetOptions
): Promise<ReplaceAssetResult | null> {
  return replaceDriveAsset(options);
}

/** @deprecated Use driveService.addVersionToUrl */
export function addVersionToUrl(url: string | null, version?: number): string | null {
  return _addVersionToUrl(url, version);
}

/** @deprecated Use driveService.removeVersionFromUrl */
export function removeVersionFromUrl(url: string | null): string | null {
  return _removeVersionFromUrl(url);
}
