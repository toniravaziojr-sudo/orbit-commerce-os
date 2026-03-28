import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Link2, Edit2, Trash2, FolderInput, X, FileText, FileVideo, FileAudio, File, Image as ImageIcon } from "lucide-react";
import { FileUsageBadge } from "./FileUsageBadge";
import type { FileItem } from "@/hooks/useFiles";
import type { FileUsage } from "@/hooks/useFileUsageDetection";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DrivePreviewPanelProps {
  file: FileItem | null;
  onClose: () => void;
  getFileUrl: (file: FileItem) => Promise<string | null>;
  usages: FileUsage[];
  onDownload: (file: FileItem) => void;
  onCopyLink: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  parentFolderName?: string;
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

function getMimeLabel(mime: string | null): string {
  if (!mime) return 'Arquivo';
  if (mime.startsWith('image/')) return 'Imagem';
  if (mime.startsWith('video/')) return 'Vídeo';
  if (mime.startsWith('audio/')) return 'Áudio';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('document') || mime.includes('text')) return 'Documento';
  return 'Arquivo';
}

export function DrivePreviewPanel({
  file,
  onClose,
  getFileUrl,
  usages,
  onDownload,
  onCopyLink,
  onRename,
  onDelete,
  onMove,
  parentFolderName,
}: DrivePreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);

  const isImage = file?.mime_type?.startsWith('image/') && !file?.is_folder;
  const isVideo = file?.mime_type?.startsWith('video/');

  useEffect(() => {
    if (!file || file.is_folder) {
      setPreviewUrl(null);
      return;
    }
    if (isImage || isVideo) {
      setLoadingUrl(true);
      getFileUrl(file).then((url) => {
        setPreviewUrl(url);
        setLoadingUrl(false);
      });
    } else {
      setPreviewUrl(null);
    }
  }, [file?.id]);

  const isSystemItem = file ? isProtectedFolder(file) : false;

  return (
    <Sheet open={!!file} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="text-base truncate pr-8">{file?.original_name}</SheetTitle>
        </SheetHeader>

        {file && (
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {/* Preview area */}
            {isImage && previewUrl && (
              <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt={file.original_name}
                  className="max-h-[300px] w-full object-contain"
                />
              </div>
            )}
            {isVideo && previewUrl && (
              <div className="rounded-lg overflow-hidden bg-muted">
                <video
                  src={previewUrl}
                  controls
                  className="max-h-[300px] w-full"
                />
              </div>
            )}
            {loadingUrl && (isImage || isVideo) && (
              <div className="h-40 rounded-lg bg-muted flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Quick actions */}
            {!isSystemItem && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onDownload(file)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Baixar
                </Button>
                <Button size="sm" variant="outline" onClick={() => onCopyLink(file)}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" />
                  Link
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRename(file)}>
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                  Renomear
                </Button>
                <Button size="sm" variant="outline" onClick={() => onMove(file)}>
                  <FolderInput className="h-3.5 w-3.5 mr-1.5" />
                  Mover
                </Button>
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(file)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Excluir
                </Button>
              </div>
            )}

            <Separator />

            {/* File details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-medium">{getMimeLabel(file.mime_type)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tamanho</span>
                <span className="font-medium">{formatBytes(file.size_bytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Criado</span>
                <span className="font-medium">
                  {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              {parentFolderName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pasta</span>
                  <span className="font-medium truncate ml-4">{parentFolderName}</span>
                </div>
              )}
              {file.mime_type && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MIME</span>
                  <span className="font-medium text-xs text-muted-foreground truncate ml-4">{file.mime_type}</span>
                </div>
              )}
            </div>

            {/* Usage info */}
            {usages.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <span className="text-sm font-medium">Em uso</span>
                  <FileUsageBadge usages={usages} className="text-xs" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    {usages.map((u, i) => (
                      <div key={i}>• {u.label}</div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
