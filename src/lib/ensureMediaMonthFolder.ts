/**
 * ensureMediaMonthFolder.ts — WRAPPER DE COMPATIBILIDADE
 *
 * Delega para driveService.ensureFolder. Mantido para preservar importações existentes.
 * Será removido em fase posterior de limpeza.
 */

import { formatMonthYearBR } from "@/lib/date-format";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ensureFolder } from './driveService';

const MEDIA_ROOT_FOLDER = 'Mídias Sociais';

function getMonthFolderName(dateStr: string): string {
  const date = parseISO(dateStr);
  const monthName = formatMonthYearBR(date);
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

/** @deprecated Use driveService.ensureFolder */
export async function ensureMediaMonthFolder(
  tenantId: string,
  userId: string,
  campaignStartDate: string
): Promise<string | null> {
  // Garantir pasta raiz "Mídias Sociais"
  const rootFolderId = await ensureFolder({
    tenantId,
    userId,
    folderName: MEDIA_ROOT_FOLDER,
    parentFolderId: null,
    storagePath: `${tenantId}/midias-sociais/`,
    metadata: { source: 'media_module', system_managed: true },
  });
  if (!rootFolderId) return null;

  // Garantir subpasta do mês
  const monthName = getMonthFolderName(campaignStartDate);
  const monthSlug = format(parseISO(campaignStartDate), 'yyyy-MM');

  return ensureFolder({
    tenantId,
    userId,
    folderName: monthName,
    parentFolderId: rootFolderId,
    storagePath: `${tenantId}/midias-sociais/${monthSlug}/`,
    metadata: { source: 'media_campaign', system_managed: true, month: monthSlug },
  });
}