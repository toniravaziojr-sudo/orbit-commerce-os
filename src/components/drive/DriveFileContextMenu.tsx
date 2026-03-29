import { useState, useCallback } from "react";
import { isProtectedFolder } from "./driveHelpers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Download,
  Trash2,
  Link2,
  Edit2,
  Upload,
  FolderPlus,
  FolderInput,
  Eye,
} from "lucide-react";
import type { FileItem } from "@/hooks/useFiles";

export interface FileActions {
  onDownload: (file: FileItem) => void;
  onCopyLink: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onUploadToFolder: (folder: FileItem) => void;
  onCreateSubfolder: (folder: FileItem) => void;
  onPreview: (file: FileItem) => void;
}

interface DriveFileContextMenuProps {
  file: FileItem;
  isSystemFolder: boolean;
  actions: FileActions;
  trigger?: React.ReactNode;
}

export function DriveFileContextMenu({
  file,
  isSystemFolder,
  actions,
  trigger,
}: DriveFileContextMenuProps) {
  if (isSystemFolder) return trigger ? <>{trigger}</> : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {!file.is_folder && (
          <>
            <DropdownMenuItem onClick={() => actions.onPreview(file)}>
              <Eye className="h-4 w-4 mr-2" />
              Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onDownload(file)}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onCopyLink(file)}>
              <Link2 className="h-4 w-4 mr-2" />
              Copiar link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onMove(file)}>
              <FolderInput className="h-4 w-4 mr-2" />
              Mover para...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {file.is_folder && (
          <>
            <DropdownMenuItem onClick={() => actions.onUploadToFolder(file)}>
              <Upload className="h-4 w-4 mr-2" />
              Enviar aqui
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onCreateSubfolder(file)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Nova subpasta
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => actions.onRename(file)}>
          <Edit2 className="h-4 w-4 mr-2" />
          Renomear
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => actions.onDelete(file)}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hook for right-click context menu state.
 */
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    file: FileItem;
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileItem) => {
    if (isProtectedFolder(file)) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ file, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return { contextMenu, handleContextMenu, closeContextMenu };
}