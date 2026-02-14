import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDriveFiles, DriveFileType } from '@/hooks/useDriveFiles';
import type { FileItem } from '@/hooks/useFiles';
import { supabase } from '@/integrations/supabase/client';
import { 
  Folder, 
  Image, 
  FileVideo, 
  FileText, 
  File, 
  Search, 
  ChevronRight, 
  Home,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (url: string, fileId?: string) => void;
  accept?: DriveFileType;
  title?: string;
}

function getFileIcon(file: FileItem, size: 'sm' | 'md' = 'md') {
  const sizeClass = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  
  if (file.is_folder) return <Folder className={cn(sizeClass, "text-amber-500")} />;
  
  const mime = file.mime_type || '';
  if (mime.startsWith('image/')) return <Image className={cn(sizeClass, "text-blue-500")} />;
  if (mime.startsWith('video/')) return <FileVideo className={cn(sizeClass, "text-purple-500")} />;
  if (mime.includes('pdf') || mime.includes('word') || mime.includes('text')) {
    return <FileText className={cn(sizeClass, "text-red-500")} />;
  }
  return <File className={cn(sizeClass, "text-muted-foreground")} />;
}

// Get thumbnail URL for a file (sync, for grid display)
function getFileThumbnailUrl(file: FileItem): string | null {
  if (file.is_folder) return null;
  
  const mime = file.mime_type || '';
  if (!mime.startsWith('image/')) return null;
  
  // Check metadata for direct URL
  const metadata = file.metadata as Record<string, unknown> | null;
  const metadataUrl = metadata?.url as string | undefined;
  if (metadataUrl) return metadataUrl;
  
  // Determine bucket
  const source = metadata?.source as string | undefined;
  const bucket = metadata?.bucket as string | undefined;
  const targetBucket = bucket || (source?.startsWith('storefront_') || file.storage_path?.includes('tenants/') ? 'store-assets' : 'tenant-files');
  
  // Get public URL
  if (file.storage_path) {
    const { data } = supabase.storage.from(targetBucket).getPublicUrl(file.storage_path);
    return data?.publicUrl || null;
  }
  
  return null;
}

// Thumbnail component with loading state
function FileThumbnail({ file, isSelected }: { file: FileItem; isSelected: boolean }) {
  const thumbnailUrl = useMemo(() => getFileThumbnailUrl(file), [file]);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const isImage = file.mime_type?.startsWith('image/');
  
  // Reset states when file changes
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [file.id]);
  
  if (!isImage || !thumbnailUrl || hasError) {
    return (
      <div className="w-full aspect-square flex items-center justify-center bg-muted/30 rounded-md">
        {getFileIcon(file, 'md')}
      </div>
    );
  }
  
  return (
    <div className="w-full aspect-square relative bg-muted/30 rounded-md overflow-hidden">
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={thumbnailUrl}
        alt={file.original_name}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-200",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function DriveFilePicker({
  open,
  onOpenChange,
  onSelect,
  accept = 'image',
  title = 'Selecionar do Meu Drive',
}: DriveFilePickerProps) {
  const {
    files,
    folders,
    currentPath,
    currentFolderId,
    isLoading,
    searchQuery,
    navigateTo,
    setSearchQuery,
    getFileUrl,
    formatFileSize,
  } = useDriveFiles({ fileType: accept });

  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Reset selection when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setSearchQuery('');
    }
  }, [open, setSearchQuery]);

  // Load preview when file is selected
  useEffect(() => {
    if (!selectedFile || selectedFile.is_folder) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    setIsLoadingPreview(true);

    getFileUrl(selectedFile).then((url) => {
      if (!cancelled) {
        setPreviewUrl(url);
        setIsLoadingPreview(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, getFileUrl]);

  const handleSelectFile = async (file: FileItem) => {
    if (!file || file.is_folder) return;

    const url = previewUrl || (await getFileUrl(file));
    if (url) {
      onSelect(url, file.id);
      onOpenChange(false);
    }
  };

  const handleSelect = async () => {
    if (!selectedFile) return;
    await handleSelectFile(selectedFile);
  };

  const handleItemClick = (item: FileItem) => {
    if (item.is_folder) {
      navigateTo(item.id);
      setSelectedFile(null);
    } else {
      setSelectedFile(prev => prev?.id === item.id ? null : item);
    }
  };

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.is_folder) {
      navigateTo(item.id);
    } else {
      // Double-click on file = select it immediately, resolving URL directly
      handleSelectFile(item);
    }
  };

  const isImage = selectedFile?.mime_type?.startsWith('image/');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="px-6 py-2 border-b bg-muted/30 shrink-0">
          <nav className="flex items-center gap-1 text-sm overflow-x-auto">
            {currentPath.map((item, index) => (
              <div key={item.id ?? 'root'} className="flex items-center">
                {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground shrink-0" />}
                <button
                  onClick={() => navigateTo(item.id)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded hover:bg-muted transition-colors whitespace-nowrap',
                    index === currentPath.length - 1 && 'font-medium text-foreground',
                    index < currentPath.length - 1 && 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {index === 0 && <Home className="h-4 w-4" />}
                  {item.name}
                </button>
              </div>
            ))}
          </nav>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar arquivos..."
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 min-h-0">
          {/* File grid */}
          <ScrollArea className="flex-1 border-r">
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : folders.length === 0 && files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Folder className="h-12 w-12 mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? 'Nenhum resultado encontrado' : 'Esta pasta está vazia'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {/* Folders first */}
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleItemClick(folder)}
                      onDoubleClick={() => handleItemDoubleClick(folder)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:bg-muted/50',
                        'focus:outline-none focus:ring-2 focus:ring-primary'
                      )}
                    >
                      <Folder className="h-10 w-10 text-amber-500" />
                      <span className="text-xs text-center truncate w-full" title={folder.original_name}>
                        {folder.original_name}
                      </span>
                    </button>
                  ))}
                  
                  {/* Files with thumbnails */}
                  {files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleItemClick(file)}
                      onDoubleClick={() => handleItemDoubleClick(file)}
                      className={cn(
                        'relative flex flex-col items-center gap-2 p-2 rounded-lg border transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-primary',
                        selectedFile?.id === file.id
                          ? 'border-primary bg-primary/5 ring-2 ring-primary'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      {selectedFile?.id === file.id && (
                        <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-10">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <FileThumbnail file={file} isSelected={selectedFile?.id === file.id} />
                      <span className="text-xs text-center truncate w-full px-1" title={file.original_name}>
                        {file.original_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Preview panel */}
          <div className="w-72 shrink-0 flex flex-col min-h-0">
            {selectedFile ? (
              <>
                <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 min-h-0 overflow-hidden">
                  {isLoadingPreview ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={selectedFile.original_name}
                      className="max-w-full max-h-[300px] object-contain rounded-md"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {getFileIcon(selectedFile)}
                      <span className="text-sm">Sem preview</span>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t space-y-2">
                  <p className="text-sm font-medium truncate" title={selectedFile.original_name}>
                    {selectedFile.original_name}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Tamanho: {formatFileSize(selectedFile.size_bytes)}</p>
                    <p>Tipo: {selectedFile.mime_type || 'Desconhecido'}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground">
                <div className="text-center">
                  <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Selecione um arquivo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSelect} disabled={!selectedFile || selectedFile.is_folder}>
            Selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
