import type { FileItem } from "@/hooks/useFiles";

/**
 * Returns true if a file/folder is "protected" and should not be deleted or renamed.
 * Protected items are:
 * - The system folder itself (is_system_folder === true)
 * - Any folder with metadata.system_managed === true (default route folders like "Produtos", "Categorias", etc.)
 */
export function isProtectedFolder(item: FileItem): boolean {
  if (item.is_system_folder) return true;
  if (!item.is_folder) return false;
  const metadata = item.metadata as Record<string, unknown> | null;
  return metadata?.system_managed === true;
}
