/**
 * driveService.ts — Hub central de operações de arquivos do Meu Drive.
 *
 * Todas as funções de upload, registro, resolução de URL, bucket e
 * criação de pastas passam por aqui. Nenhum módulo deve acessar
 * buckets ou lógica de storage diretamente.
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ─── Query keys (para cache invalidation unificada) ────────────────────────
export const DRIVE_QUERY_KEYS = {
  files: (tenantId: string, folderId?: string | null) =>
    ['files', tenantId, folderId ?? null] as const,
  allFolders: (tenantId: string) =>
    ['files-all-folders', tenantId] as const,
  driveFiles: (tenantId: string, folderId?: string | null) =>
    ['drive-files', tenantId, folderId ?? null] as const,
  driveAllFolders: (tenantId: string) =>
    ['drive-all-folders', tenantId] as const,
};

/** Invalida todas as queries do Drive de uma vez */
export function invalidateDriveQueries(
  queryClient: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => void },
  tenantId: string,
) {
  queryClient.invalidateQueries({ queryKey: ['files', tenantId] });
  queryClient.invalidateQueries({ queryKey: ['files-all-folders', tenantId] });
  queryClient.invalidateQueries({ queryKey: ['drive-files', tenantId] });
  queryClient.invalidateQueries({ queryKey: ['drive-all-folders', tenantId] });
}

// ─── Tipos ──────────────────────────────────────────────────────────────────
export interface DriveFileItem {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  filename: string;
  original_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_folder: boolean;
  is_system_folder?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
}

export interface UploadToDriveOptions {
  tenantId: string;
  userId: string;
  file: File;
  source: string;
  subPath?: string;
  customFilename?: string;
  folderId?: string;         // pasta destino (default: pasta do sistema)
  bucket?: string;           // default: 'store-assets'
  upsert?: boolean;          // default: false
}

export interface UploadToDriveResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  fileId: string | null;
}

export interface ReplaceDriveAssetOptions {
  tenantId: string;
  userId: string;
  file: File;
  assetType: string;
  oldUrl?: string | null;
}

export interface ReplaceDriveAssetResult {
  publicUrl: string;
  storagePath: string;
  bucket: string;
  fileId: string | null;
  version: number;
}

export interface RegisterExternalFileOptions {
  tenantId: string;
  userId: string;
  url: string;
  storagePath: string;
  originalName: string;
  mimeType?: string;
  size?: number;
  source: string;
  bucket?: string;
  folderId?: string;        // pasta destino (default: pasta do sistema)
  extraMetadata?: Record<string, unknown>;
}

// ─── Bucket resolution ─────────────────────────────────────────────────────

/** Determina o bucket correto para um arquivo com base em metadata/path. */
export function getBucketForFile(file: DriveFileItem): string {
  const metadata = file.metadata as Record<string, unknown> | null;
  const bucket = metadata?.bucket as string | undefined;
  if (bucket) return bucket;

  const source = metadata?.source as string | undefined;
  if (source?.startsWith('storefront_') || file.storage_path.includes('tenants/')) {
    return 'store-assets';
  }
  return 'tenant-files';
}

// ─── URL resolution ─────────────────────────────────────────────────────────

/** Retorna a URL de acesso a um arquivo, respeitando buckets públicos vs privados. */
export async function getFileUrl(file: DriveFileItem): Promise<string | null> {
  try {
    const metadata = file.metadata as Record<string, unknown> | null;
    const metadataUrl = metadata?.url as string | undefined;
    if (metadataUrl) return metadataUrl;

    const bucket = getBucketForFile(file);
    const isPrivate = bucket === 'tenant-files';

    if (isPrivate) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.storage_path, 3600);
      if (error) {
        console.error('[driveService] Signed URL error:', error);
        return null;
      }
      return data?.signedUrl || null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(file.storage_path);
    return data?.publicUrl || null;
  } catch (err) {
    console.error('[driveService] getFileUrl error:', err);
    return null;
  }
}

// ─── Folder helpers (idempotente, race-condition safe) ──────────────────────

const SYSTEM_FOLDER_NAME = 'Uploads do sistema';

/**
 * Garante que uma pasta existe e retorna seu ID.
 * Usa .limit(1) para evitar race conditions com duplicatas.
 */
export async function ensureFolder(opts: {
  tenantId: string;
  userId: string;
  folderName: string;
  parentFolderId: string | null;
  storagePath: string;
  isSystemFolder?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const { tenantId, userId, folderName, parentFolderId, storagePath, isSystemFolder, metadata } = opts;

  // Busca existente com .limit(1) — seguro contra duplicatas
  let query = supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('filename', folderName)
    .eq('is_folder', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (parentFolderId) {
    query = query.eq('folder_id', parentFolderId);
  } else {
    query = query.is('folder_id', null);
  }

  if (isSystemFolder) {
    query = query.eq('is_system_folder', true);
  }

  const { data: existingArr } = await query;
  const existing = existingArr?.[0];
  if (existing) return existing.id;

  // Criar pasta
  const { data: created, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: parentFolderId,
      filename: folderName,
      original_name: folderName,
      storage_path: storagePath,
      is_folder: true,
      is_system_folder: isSystemFolder || false,
      created_by: userId,
      metadata: (metadata || null) as Json,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[driveService] ensureFolder error:', error);
    // Re-check — pode ter sido criada por outro request concorrente
    const { data: retryArr } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('filename', folderName)
      .eq('is_folder', true)
      .order('created_at', { ascending: true })
      .limit(1);

    return retryArr?.[0]?.id || null;
  }

  return created?.id || null;
}

/** Garante que a pasta "Uploads do sistema" existe e retorna seu ID. */
export async function ensureSystemFolder(tenantId: string, userId: string): Promise<string | null> {
  return ensureFolder({
    tenantId,
    userId,
    folderName: SYSTEM_FOLDER_NAME,
    parentFolderId: null,
    storagePath: `${tenantId}/system/`,
    isSystemFolder: true,
  });
}

// ─── Verificação de existência ──────────────────────────────────────────────

/** Checa se um arquivo com o storage_path já existe na tabela files. */
export async function fileExistsInDrive(tenantId: string, storagePath: string): Promise<boolean> {
  const { data } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('storage_path', storagePath)
    .limit(1);

  return !!data && data.length > 0;
}

// ─── Upload + registro ─────────────────────────────────────────────────────

/**
 * Upload de arquivo para storage + registro na tabela files.
 * Ponto central de entrada para qualquer upload do sistema.
 */
export async function uploadToDrive(options: UploadToDriveOptions): Promise<UploadToDriveResult | null> {
  const {
    tenantId, userId, file, source, subPath,
    customFilename, folderId, bucket: bucketOverride, upsert = false,
  } = options;

  // Resolver pasta destino
  let targetFolderId = folderId || null;
  if (!targetFolderId) {
    targetFolderId = await ensureSystemFolder(tenantId, userId);
    if (!targetFolderId) {
      console.error('[driveService] Could not get/create system folder');
      return null;
    }
  }

  // Gerar path único
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const timestamp = Date.now();
  const uuid = crypto.randomUUID().slice(0, 8);
  const filename = customFilename || `${timestamp}-${uuid}.${fileExt}`;
  const basePath = subPath
    ? `tenants/${tenantId}/${subPath}`
    : `tenants/${tenantId}/assets`;
  const storagePath = `${basePath}/${filename}`;
  const bucket = bucketOverride || 'store-assets';

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert, cacheControl: '3600' });

  if (uploadError) {
    console.error('[driveService] Upload error:', uploadError);
    return null;
  }

  // URL pública
  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    console.error('[driveService] Could not get public URL');
    return null;
  }

  // Evitar duplicata no registro
  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    return { publicUrl, storagePath, bucket, fileId: null };
  }

  // Registrar na tabela files
  const { data: fileRecord, error: insertError } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: targetFolderId,
      filename,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size || null,
      is_folder: false,
      is_system_folder: false,
      created_by: userId,
      metadata: { source, url: publicUrl, bucket, system_managed: true },
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[driveService] Register error:', insertError);
    return { publicUrl, storagePath, bucket, fileId: null };
  }

  return { publicUrl, storagePath, bucket, fileId: fileRecord?.id || null };
}

// ─── Replace asset (logo, favicon, etc.) ────────────────────────────────────

/**
 * Substitui um asset do sistema gerando path ÚNICO (sem cache stale).
 * Registra no Drive automaticamente.
 */
export async function replaceDriveAsset(
  options: ReplaceDriveAssetOptions
): Promise<ReplaceDriveAssetResult | null> {
  const { tenantId, userId, file, assetType, oldUrl } = options;
  const bucket = 'store-assets';

  const systemFolderId = await ensureSystemFolder(tenantId, userId);
  if (!systemFolderId) {
    console.error('[driveService] Could not get/create system folder');
    return null;
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  const storagePath = `tenants/${tenantId}/branding/${assetType}-${timestamp}-${uuid}.${fileExt}`;
  const version = timestamp;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: false, cacheControl: '3600' });

  if (uploadError) {
    console.error('[driveService] Replace upload error:', uploadError);
    return null;
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    console.error('[driveService] Could not get public URL');
    return null;
  }

  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    return { publicUrl, storagePath, bucket, fileId: null, version };
  }

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
    console.error('[driveService] Replace register error:', insertError);
    return { publicUrl, storagePath, bucket, fileId: null, version };
  }

  return { publicUrl, storagePath, bucket, fileId: fileRecord?.id || null, version };
}

// ─── Registro de arquivo externo (já uploaded) ─────────────────────────────

/**
 * Registra no Drive um arquivo que já existe no storage (backfill, review media, etc.)
 */
export async function registerExternalFile(
  options: RegisterExternalFileOptions
): Promise<string | null> {
  const {
    tenantId, userId, url, storagePath, originalName,
    mimeType, size, source, bucket, folderId, extraMetadata,
  } = options;

  // Resolver pasta destino
  let targetFolderId = folderId || null;
  if (!targetFolderId) {
    targetFolderId = await ensureSystemFolder(tenantId, userId);
    if (!targetFolderId) {
      console.error('[driveService] Could not get/create system folder');
      return null;
    }
  }

  // Evitar duplicata
  const exists = await fileExistsInDrive(tenantId, storagePath);
  if (exists) {
    console.log('[driveService] File already registered:', storagePath);
    return null;
  }

  const { data, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: targetFolderId,
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
        url,
        bucket: bucket || 'store-assets',
        system_managed: true,
        ...extraMetadata,
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[driveService] Register external error:', error);
    return null;
  }

  return data?.id || null;
}

// ─── Extração de path a partir de URL ──────────────────────────────────────

/** Extrai o storage path de uma URL pública do Supabase Storage. */
export function extractStoragePathFromUrl(url: string, bucketName: string): string | null {
  if (!url) return null;
  const regex = new RegExp(`/storage/v1/object/public/${bucketName}/(.+)$`);
  const match = url.match(regex);
  return match ? match[1] : null;
}

// ─── URL helpers ────────────────────────────────────────────────────────────

/** Adiciona parâmetro de cache-busting a uma URL. */
export function addVersionToUrl(url: string | null, version?: number): string | null {
  if (!url) return null;
  const v = version || Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${v}`;
}

/** Remove parâmetro de versão de uma URL. */
export function removeVersionFromUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/[?&]v=\d+/g, '').replace(/\?$/, '');
}

// ─── Download helper ────────────────────────────────────────────────────────

/** Baixa um arquivo do Drive, tentando storage direto e fallback para URL. */
export async function downloadDriveFile(file: DriveFileItem): Promise<void> {
  const bucket = getBucketForFile(file);

  const { data, error } = await supabase.storage.from(bucket).download(file.storage_path);

  if (error) {
    console.error('[driveService] Storage download error:', error);
    const url = await getFileUrl(file);
    if (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      triggerBlobDownload(blob, file.original_name);
      return;
    }
    throw new Error('Não foi possível baixar o arquivo');
  }

  triggerBlobDownload(data, file.original_name);
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── MIME helpers ───────────────────────────────────────────────────────────

/** Adivinha o MIME type a partir da extensão do arquivo. */
export function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    pdf: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}
