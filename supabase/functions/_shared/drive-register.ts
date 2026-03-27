/**
 * drive-register.ts — Shared Drive registration helper for edge functions.
 *
 * Provides folder creation and file registration in the `files` table
 * matching the folder routing from the frontend driveService.ts.
 *
 * Edge functions cannot import from src/, so this duplicates the
 * minimal folder-ensure + register logic for server-side use.
 */

/**
 * Ensures a folder hierarchy exists and returns the leaf folder ID.
 * Path uses '/' separator (e.g. "Criativos IA/Loja Virtual").
 * Idempotent and race-condition safe (.limit(1) + retry).
 */
export async function ensureFolderPathEdge(
  supabase: any,
  tenantId: string,
  userId: string,
  path: string,
): Promise<string | null> {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return null;

  let parentId: string | null = null;
  let storagePath = `${tenantId}/`;

  for (const part of parts) {
    storagePath += `${part}/`;
    const isSystem = part === 'Uploads do sistema';

    // Check existing
    let query = supabase
      .from('files')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('filename', part)
      .eq('is_folder', true)
      .order('created_at', { ascending: true })
      .limit(1);

    if (parentId) {
      query = query.eq('folder_id', parentId);
    } else {
      query = query.is('folder_id', null);
    }

    const { data: existingArr } = await query;
    if (existingArr?.[0]?.id) {
      parentId = existingArr[0].id;
      continue;
    }

    // Create
    const { data: created, error } = await supabase
      .from('files')
      .insert({
        tenant_id: tenantId,
        folder_id: parentId,
        filename: part,
        original_name: part,
        storage_path: storagePath,
        is_folder: true,
        is_system_folder: isSystem,
        created_by: userId,
        metadata: { system_managed: true },
      })
      .select('id')
      .single();

    if (error) {
      // Race condition — retry read
      const { data: retryArr } = await supabase
        .from('files')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('filename', part)
        .eq('is_folder', true)
        .order('created_at', { ascending: true })
        .limit(1);

      if (retryArr?.[0]?.id) {
        parentId = retryArr[0].id;
        continue;
      }
      console.error(`[drive-register] Failed to create folder "${part}":`, error);
      return null;
    }

    parentId = created?.id || null;
  }

  return parentId;
}

/**
 * Registers a file in the Drive `files` table.
 * Skips if already registered (by storage_path).
 * Fails silently — never blocks the main flow.
 */
export async function registerFileToDriveEdge(
  supabase: any,
  opts: {
    tenantId: string;
    userId: string;
    folderId: string;
    storagePath: string;
    originalName: string;
    publicUrl: string;
    mimeType?: string;
    sizeBytes?: number;
    source: string;
    bucket: string;
    extraMetadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    // Check for duplicate
    const { data: existing } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', opts.tenantId)
      .eq('storage_path', opts.storagePath)
      .limit(1);

    if (existing && existing.length > 0) return;

    await supabase.from('files').insert({
      tenant_id: opts.tenantId,
      folder_id: opts.folderId,
      filename: opts.originalName,
      original_name: opts.originalName,
      storage_path: opts.storagePath,
      mime_type: opts.mimeType || 'image/png',
      size_bytes: opts.sizeBytes || null,
      is_folder: false,
      is_system_folder: false,
      created_by: opts.userId,
      metadata: {
        source: opts.source,
        url: opts.publicUrl,
        bucket: opts.bucket,
        system_managed: true,
        ...opts.extraMetadata,
      },
    });
  } catch (err) {
    console.error('[drive-register] Registration failed (non-blocking):', err);
  }
}

/**
 * Source-to-folder route map (mirrors frontend FOLDER_ROUTES).
 */
const EDGE_FOLDER_ROUTES: Record<string, string> = {
  ai_creative_storefront: 'Criativos IA/Loja Virtual',
  ai_creative_landing: 'Criativos IA/Landing Pages',
  ai_creative_traffic: 'Criativos IA/Tráfego IA',
  ai_creative_calendar: 'Criativos IA/Calendário de Conteúdo',
  ai_creative: 'Criativos IA',
  media_ai_creative: 'Mídias Sociais',
  landing_page_asset: 'Landing Pages',
};

/**
 * Resolves the correct Drive folder for a given source and ensures it exists.
 */
export async function resolveAndEnsureFolderEdge(
  supabase: any,
  tenantId: string,
  userId: string,
  source: string,
): Promise<string | null> {
  const route = EDGE_FOLDER_ROUTES[source];
  if (!route) {
    // Fallback: "Uploads do sistema"
    return ensureFolderPathEdge(supabase, tenantId, userId, 'Uploads do sistema');
  }
  return ensureFolderPathEdge(supabase, tenantId, userId, route);
}
