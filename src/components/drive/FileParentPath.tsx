import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileParentPathProps {
  file: { folder_id: string | null };
  allFolders: { id: string; original_name: string; folder_id: string | null }[];
  className?: string;
}

/**
 * Shows the parent folder path for a file (used in global search results).
 */
export function FileParentPath({ file, allFolders, className }: FileParentPathProps) {
  if (!file.folder_id) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Folder className="h-3 w-3" />
        Raiz
      </span>
    );
  }

  const buildPath = (folderId: string | null): string[] => {
    if (!folderId) return [];
    const folder = allFolders.find((f) => f.id === folderId);
    if (!folder) return ['…'];
    const parentPath = folder.folder_id ? buildPath(folder.folder_id) : [];
    return [...parentPath, folder.original_name];
  };

  const parts = buildPath(file.folder_id);

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[200px]", className)}>
      <Folder className="h-3 w-3 flex-shrink-0" />
      {parts.length > 2 ? `${parts[0]} > … > ${parts[parts.length - 1]}` : parts.join(' > ')}
    </span>
  );
}