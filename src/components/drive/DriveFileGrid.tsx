import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { FileThumbnail } from "./FileThumbnail";
import { FileUsageBadge } from "./FileUsageBadge";
import { FileParentPath } from "./FileParentPath";
import { DriveFileContextMenu, type FileActions } from "./DriveFileContextMenu";
import type { FileItem } from "@/hooks/useFiles";
import type { FileUsage } from "@/hooks/useFileUsageDetection";

interface DriveFileGridProps {
  files: FileItem[];
  allFolders: any[];
  draggedItem: FileItem | null;
  isGlobalSearch: boolean;
  getFileUsage: (file: FileItem) => FileUsage[];
  getFileUrl: (file: FileItem) => Promise<string | null>;
  actions: FileActions;
  onDragStart: (e: React.DragEvent, item: FileItem) => void;
  onDragEnd: () => void;
  onDragOverFolder: (e: React.DragEvent) => void;
  onDropOnFolder: (e: React.DragEvent, folder: FileItem) => void;
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

export function DriveFileGrid({
  files,
  allFolders,
  draggedItem,
  isGlobalSearch,
  getFileUsage,
  getFileUrl,
  actions,
  onDragStart,
  onDragEnd,
  onDragOverFolder,
  onDropOnFolder,
  onOpenFolder,
  onContextMenu,
  onPreviewClick,
}: DriveFileGridProps) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {files.map((file) => {
        const isSystemFolder = file.is_system_folder === true;
        const usages = getFileUsage(file);
        const isDragging = draggedItem?.id === file.id;
        const canBeDropTarget = file.is_folder && !isDragging && draggedItem?.id !== file.id;
        const isImage = file.mime_type?.startsWith('image/') && !file.is_folder;

        return (
          <div
            key={file.id}
            draggable={!isSystemFolder}
            onDragStart={(e) => onDragStart(e, file)}
            onDragEnd={onDragEnd}
            onDragOver={canBeDropTarget ? onDragOverFolder : undefined}
            onDrop={canBeDropTarget ? (e) => onDropOnFolder(e, file) : undefined}
            onContextMenu={(e) => onContextMenu(e, file)}
            className={cn(
              "group relative flex flex-col items-center p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-all select-none",
              isDragging && "opacity-50 scale-95",
              canBeDropTarget && draggedItem && "ring-2 ring-primary ring-dashed bg-primary/5"
            )}
            onClick={(e) => {
              // Only open preview/folder on body click, not on action buttons
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('[role="menuitem"]')) return;
              if (file.is_folder) {
                onOpenFolder(file);
              } else {
                onPreviewClick(file);
              }
            }}
          >
            {/* Badges row */}
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
              {isSystemFolder && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                  Sistema
                </Badge>
              )}
              {!file.is_folder && <FileUsageBadge usages={usages} className="text-[10px]" />}
            </div>

            {/* Actions */}
            <div className="absolute top-1.5 right-1.5 z-10">
              <DriveFileContextMenu
                file={file}
                isSystemFolder={isSystemFolder}
                actions={actions}
              />
            </div>

            {/* Thumbnail or Icon */}
            <div className="w-full flex items-center justify-center mt-5 mb-2">
              {isImage ? (
                <FileThumbnail
                  file={file}
                  getFileUrl={getFileUrl}
                  className="w-full h-20 rounded"
                  iconClassName="h-10 w-10"
                />
              ) : (
                <FileThumbnail
                  file={file}
                  getFileUrl={getFileUrl}
                  iconClassName="h-10 w-10"
                />
              )}
            </div>

            <span className="text-xs font-medium text-center line-clamp-2 w-full leading-tight">
              {file.original_name}
            </span>
            {!file.is_folder && (
              <span className="text-[10px] text-muted-foreground mt-0.5">
                {formatBytes(file.size_bytes)}
              </span>
            )}
            {isGlobalSearch && (
              <FileParentPath file={file} allFolders={allFolders} />
            )}
          </div>
        );
      })}
    </div>
  );
}
