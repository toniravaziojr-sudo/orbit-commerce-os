import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MEDIA_ROOT_FOLDER = 'Mídias Sociais';

/**
 * Ensures the root "Mídias Sociais" folder exists in Drive and returns its ID.
 */
async function ensureMediaRootFolder(tenantId: string, userId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('filename', MEDIA_ROOT_FOLDER)
    .eq('is_folder', true)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: null,
      filename: MEDIA_ROOT_FOLDER,
      original_name: MEDIA_ROOT_FOLDER,
      storage_path: `${tenantId}/midias-sociais/`,
      is_folder: true,
      is_system_folder: false,
      created_by: userId,
      metadata: { source: 'media_module', system_managed: true },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating media root folder:', error);
    return null;
  }

  return created?.id || null;
}

/**
 * Gets a capitalized month name in Portuguese from a date string.
 * E.g., "2026-02-14" → "Fevereiro 2026"
 */
function getMonthFolderName(dateStr: string): string {
  const date = parseISO(dateStr);
  const monthName = format(date, 'MMMM yyyy', { locale: ptBR });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

/**
 * Ensures a month folder exists inside "Mídias Sociais" folder.
 * Structure: Meu Drive → Mídias Sociais → Fevereiro 2026
 * 
 * @param tenantId Tenant ID
 * @param userId User ID (for created_by)
 * @param campaignStartDate Campaign start_date string (YYYY-MM-DD)
 * @returns folder ID or null
 */
export async function ensureMediaMonthFolder(
  tenantId: string,
  userId: string,
  campaignStartDate: string
): Promise<string | null> {
  const rootFolderId = await ensureMediaRootFolder(tenantId, userId);
  if (!rootFolderId) return null;

  const monthName = getMonthFolderName(campaignStartDate);

  // Check if month folder already exists
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('folder_id', rootFolderId)
    .eq('filename', monthName)
    .eq('is_folder', true)
    .maybeSingle();

  if (existing) return existing.id;

  // Create month folder
  const monthSlug = format(parseISO(campaignStartDate), 'yyyy-MM');
  const { data: created, error } = await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: rootFolderId,
      filename: monthName,
      original_name: monthName,
      storage_path: `${tenantId}/midias-sociais/${monthSlug}/`,
      is_folder: true,
      is_system_folder: false,
      created_by: userId,
      metadata: { source: 'media_campaign', system_managed: true, month: monthSlug },
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating month folder:', error);
    return null;
  }

  return created?.id || null;
}
