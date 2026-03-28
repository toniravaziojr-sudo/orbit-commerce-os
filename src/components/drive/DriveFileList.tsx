import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { FileThumbnail } from "./FileThumbnail";
import { FileUsageBadge } from "./FileUsageBadge";
import { FileParentPath } from "./FileParentPath";
import { DriveFileContextMenu, type FileActions } from "./DriveFileContextMenu";
import type { FileItem } from "@/hooks/useFiles";
import type { FileUsage } from "@/hooks/useFileUsageDetection";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DriveFileListProps {
  files: FileItem[];
  allFolders: any[];
  isGlobalSearch: boolean;
  getFileUsage: (file: FileItem) => FileUsage[];
  getFileUrl: (file: FileItem) => Promise<string | null>;
  actions: FileActions;
  onOpenFolder: (folder: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void;
  onPreviewClick: (file: FileItem) => void;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function DriveFileList({
  files,
  allFolders,
  isGlobalSearch,
  getFileUsage,
  getFileUrl,
  actions,
  onOpenFolder,
  onContextMenu,
  onPreviewClick,
}: DriveFileListProps) {
  return (
    <div className="space-y-0.5">
      {files.map((file) => {
        const isSystemFolder = isProtectedFolder(file);
        const usages = getFileUsage(file);
        const isImage = file.mime_type?.startsWith('image/') && !file.is_folder;

        return (
          <div
            key={file.id}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
            onContextMenu={(e) => onContextMenu(e, file)}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('[role="menuitem"]')) return;
              if (file.is_folder) {
                onOpenFolder(file);
              } else {
                onPreviewClick(file);
              }
            }}
          >
            {/* Inline thumbnail */}
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
              {isImage ? (
                <FileThumbnail
                  file={file}
                  getFileUrl={getFileUrl}
                  className="w-8 h-8 rounded"
                  iconClassName="h-6 w-6"
                />
              ) : (
                <FileThumbnail
                  file={file}
                  getFileUrl={getFileUrl}
                  iconClassName="h-6 w-6"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">{file.original_name}</p>
                {isSystemFolder && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    <Lock className="h-2.5 w-2.5 mr-0.5" />
                    Sistema
                  </Badge>
                )}
                {!file.is_folder && <FileUsageBadge usages={usages} className="text-[10px]" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {file.is_folder ? 'Pasta' : formatBytes(file.size_bytes)} •{' '}
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ptBR })}
                {isGlobalSearch && (
                  <> • <FileParentPath file={file} allFolders={allFolders} /></>
                )}
              </p>
            </div>

            <DriveFileContextMenu
              file={file}
              isSystemFolder={isSystemFolder}
              actions={actions}
            />
          </div>
        );
      })}
    </div>
  );
}
