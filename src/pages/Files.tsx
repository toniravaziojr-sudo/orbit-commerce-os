import { useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FolderPlus,
  Search,
  Grid,
  List,
  MoreVertical,
  Download,
  Trash2,
  Link2,
  Edit2,
  Folder,
  FileText,
  Image,
  FileVideo,
  FileAudio,
  File,
  ChevronRight,
  Home,
  ArrowLeft,
  Lock,
  FolderInput,
  FolderUp,
} from "lucide-react";
import { useFiles, FileItem } from "@/hooks/useFiles";
import { useFileUsageDetection } from "@/hooks/useFileUsageDetection";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DeleteFileDialog } from "@/components/drive/DeleteFileDialog";
import { MoveFileDialog } from "@/components/drive/MoveFileDialog";
import { FileUsageBadge } from "@/components/drive/FileUsageBadge";
import { CurrentLocationHint } from "@/components/drive/CurrentLocationHint";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

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

function getFileIcon(file: FileItem) {
  if (file.is_folder) return Folder;
  const mime = file.mime_type || '';
  if (mime.startsWith('image/')) return Image;
  if (mime.startsWith('video/')) return FileVideo;
  if (mime.startsWith('audio/')) return FileAudio;
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')) return FileText;
  return File;
}

export default function Files() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Raiz' },
  ]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Move dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItem | null>(null);
  
  // New folder in specific location
  const [newSubfolderDialogOpen, setNewSubfolderDialogOpen] = useState(false);
  const [targetFolderForSubfolder, setTargetFolderForSubfolder] = useState<FileItem | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');
  
  // Upload to specific folder
  const specificFolderInputRef = useRef<HTMLInputElement>(null);
  const [targetFolderForUpload, setTargetFolderForUpload] = useState<FileItem | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    allFolders,
    systemFolderId,
    isLoading,
    uploadFile,
    createFolder,
    deleteFile,
    renameFile,
    moveFile,
    getFileUrl,
    downloadFile,
    isSystemItem,
    canMoveItem,
  } = useFiles(currentFolderId);

  // Drag state for drag & drop file moving
  const [draggedItem, setDraggedItem] = useState<FileItem | null>(null);

  const { getFileUsage, isFileInUse, storeSettings } = useFileUsageDetection();
  const { upsertSettings } = useStoreSettings();

  const filteredFiles = files.filter((file) =>
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, targetFolderId?: string | null) => {
      const uploadedFiles = e.target.files;
      if (!uploadedFiles) return;

      const folderId = targetFolderId !== undefined ? targetFolderId : currentFolderId;

      for (const file of Array.from(uploadedFiles)) {
        await uploadFile.mutateAsync({ file, folderId });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (specificFolderInputRef.current) {
        specificFolderInputRef.current.value = '';
      }
      setTargetFolderForUpload(null);
    },
    [currentFolderId, uploadFile]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles) return;

      for (const file of Array.from(droppedFiles)) {
        await uploadFile.mutateAsync({ file, folderId: currentFolderId });
      }
    },
    [currentFolderId, uploadFile]
  );

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder.mutateAsync({ name: newFolderName, parentFolderId: currentFolderId });
    setNewFolderName('');
    setNewFolderDialogOpen(false);
  };

  const handleCreateSubfolder = async () => {
    if (!newSubfolderName.trim() || !targetFolderForSubfolder) return;
    await createFolder.mutateAsync({ name: newSubfolderName, parentFolderId: targetFolderForSubfolder.id });
    setNewSubfolderName('');
    setNewSubfolderDialogOpen(false);
    setTargetFolderForSubfolder(null);
  };

  const handleRename = async () => {
    if (!selectedFile || !newFileName.trim()) return;
    await renameFile.mutateAsync({ id: selectedFile.id, newName: newFileName });
    setRenameDialogOpen(false);
    setSelectedFile(null);
    setNewFileName('');
  };

  const handleOpenFolder = (folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.original_name }]);
  };

  const handleNavigateToPath = (pathIndex: number) => {
    const path = folderPath[pathIndex];
    setCurrentFolderId(path.id);
    setFolderPath(folderPath.slice(0, pathIndex + 1));
  };

  const handleCopyLink = async (file: FileItem) => {
    try {
      const url = await getFileUrl(file);
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado para a área de transferência!');
      } else {
        toast.error('Não foi possível gerar o link');
      }
    } catch (err) {
      toast.error('Erro ao copiar link');
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      await downloadFile(file);
      toast.success('Download iniciado!');
    } catch (err) {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handlePreview = async (file: FileItem) => {
    if (file.is_folder) {
      handleOpenFolder(file);
      return;
    }

    if (file.mime_type?.startsWith('image/')) {
      const url = await getFileUrl(file);
      setPreviewUrl(url);
      setPreviewFile(file);
    } else {
      handleDownload(file);
    }
  };

  const openRenameDialog = (file: FileItem) => {
    setSelectedFile(file);
    setNewFileName(file.original_name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (file: FileItem) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const openMoveDialog = (file: FileItem) => {
    setFileToMove(file);
    setMoveDialogOpen(true);
  };

  const openSubfolderDialog = (folder: FileItem) => {
    setTargetFolderForSubfolder(folder);
    setNewSubfolderName('');
    setNewSubfolderDialogOpen(true);
  };

  const handleUploadToFolder = (folder: FileItem) => {
    setTargetFolderForUpload(folder);
    specificFolderInputRef.current?.click();
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;

    setIsDeleting(true);
    try {
      const usages = getFileUsage(fileToDelete);

      // If file is in use, unlink from store_settings first
      if (usages.length > 0) {
        const updates: Record<string, null> = {};
        for (const usage of usages) {
          if (usage.type === 'logo') {
            updates.logo_url = null;
          }
          if (usage.type === 'favicon') {
            updates.favicon_url = null;
          }
        }
        await upsertSettings.mutateAsync(updates);
      }

      // Now delete the file
      await deleteFile.mutateAsync(fileToDelete);
      
      // Invalidate store settings to reflect changes
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings-urls'] });
      
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (err) {
      toast.error('Erro ao excluir arquivo');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmMove = async (targetFolderId: string | null) => {
    if (!fileToMove) return;

    try {
      await moveFile.mutateAsync({ fileId: fileToMove.id, targetFolderId });
      setMoveDialogOpen(false);
      setFileToMove(null);
    } catch (err) {
      toast.error('Erro ao mover arquivo');
    }
  };

  // Drag & Drop handlers for moving files
  const handleDragStartItem = (e: React.DragEvent, item: FileItem) => {
    if (item.is_system_folder) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/json', JSON.stringify({ id: item.id, isFolder: item.is_folder }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(item);
  };

  const handleDragEndItem = () => {
    setDraggedItem(null);
  };

  const handleDragOverFolder = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolder: FileItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemBeingDragged = draggedItem;
    setDraggedItem(null);
    
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      const { id: itemId, isFolder } = JSON.parse(data);
      
      // Prevent dropping folder into itself
      if (isFolder && itemId === targetFolder.id) {
        toast.error('Não é possível mover uma pasta para dentro dela mesma');
        return;
      }
      
      // Validate move for system items
      if (itemBeingDragged) {
        const validation = canMoveItem(itemBeingDragged, targetFolder.id);
        if (!validation.allowed) {
          toast.error(validation.reason || 'Movimento não permitido');
          return;
        }
      }
      
      await moveFile.mutateAsync({ fileId: itemId, targetFolderId: targetFolder.id });
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleDropOnBreadcrumb = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemBeingDragged = draggedItem;
    setDraggedItem(null);
    
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      const { id: itemId } = JSON.parse(data);
      
      // Validate move for system items (dropping on breadcrumb/root)
      if (itemBeingDragged) {
        const validation = canMoveItem(itemBeingDragged, targetFolderId);
        if (!validation.allowed) {
          toast.error(validation.reason || 'Movimento não permitido');
          return;
        }
      }
      
      await moveFile.mutateAsync({ fileId: itemId, targetFolderId });
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const renderFileActions = (file: FileItem, isSystemFolder: boolean) => {
    if (isSystemFolder) return null;

    const usages = getFileUsage(file);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {!file.is_folder && (
            <>
              <DropdownMenuItem onClick={() => handleDownload(file)}>
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyLink(file)}>
                <Link2 className="h-4 w-4 mr-2" />
                Copiar link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openMoveDialog(file)}>
                <FolderInput className="h-4 w-4 mr-2" />
                Mover para...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {file.is_folder && (
            <>
              <DropdownMenuItem onClick={() => handleUploadToFolder(file)}>
                <Upload className="h-4 w-4 mr-2" />
                Enviar aqui
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openSubfolderDialog(file)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Nova subpasta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => openRenameDialog(file)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Renomear
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openDeleteDialog(file)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Meu Drive"
        description="Gerencie seus arquivos e imagens"
      />

      {/* Hidden input for specific folder uploads */}
      <input
        ref={specificFolderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, targetFolderForUpload?.id || null)}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e)}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Enviar
            </Button>
            <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Nova pasta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar nova pasta</DialogTitle>
                </DialogHeader>
                <Input
                  placeholder="Nome da pasta"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateFolder} disabled={createFolder.isPending}>
                    Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {/* Location hint */}
          <CurrentLocationHint breadcrumb={folderPath} />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar arquivos..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Breadcrumb with drop targets */}
      <div className="flex items-center gap-1 text-sm">
        {folderPath.map((path, index) => (
          <div key={path.id || 'root'} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <button
              onClick={() => handleNavigateToPath(index)}
              onDragOver={handleDragOverFolder}
              onDrop={(e) => handleDropOnBreadcrumb(e, path.id)}
              className={cn(
                "px-2 py-1 rounded hover:bg-muted transition-colors",
                index === folderPath.length - 1 && "font-medium",
                draggedItem && "ring-2 ring-primary/50 ring-dashed"
              )}
            >
              {index === 0 ? <Home className="h-4 w-4" /> : path.name}
            </button>
          </div>
        ))}
      </div>

      {/* Back button */}
      {currentFolderId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNavigateToPath(folderPath.length - 2)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      )}

      {/* Drop zone & Files */}
      <Card
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={cn(
          "min-h-[400px] transition-colors",
          uploadFile.isPending && "border-primary bg-primary/5"
        )}
      >
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Upload className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'Nenhum arquivo encontrado' : 'Nenhum arquivo'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {searchQuery
                  ? 'Tente buscar por outro termo'
                  : 'Arraste arquivos aqui ou clique em "Enviar" para começar'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredFiles.map((file) => {
                const Icon = getFileIcon(file);
                const isSystemFolder = file.is_system_folder === true;
                const usages = getFileUsage(file);
                const isDragging = draggedItem?.id === file.id;
                const canBeDropTarget = file.is_folder && !isDragging && draggedItem?.id !== file.id;
                
                return (
                  <div
                    key={file.id}
                    draggable={!isSystemFolder}
                    onDragStart={(e) => handleDragStartItem(e, file)}
                    onDragEnd={handleDragEndItem}
                    onDragOver={canBeDropTarget ? handleDragOverFolder : undefined}
                    onDrop={canBeDropTarget ? (e) => handleDropOnFolder(e, file) : undefined}
                    className={cn(
                      "group relative flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all",
                      isDragging && "opacity-50 scale-95",
                      canBeDropTarget && draggedItem && "ring-2 ring-primary ring-dashed bg-primary/5"
                    )}
                    onDoubleClick={() => handlePreview(file)}
                  >
                    {/* Badges row */}
                    <div className="absolute top-1 left-1 flex flex-col gap-1">
                      {isSystemFolder && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Sistema
                        </Badge>
                      )}
                      {!file.is_folder && <FileUsageBadge usages={usages} className="text-xs" />}
                    </div>
                    
                    {/* Actions */}
                    <div className="absolute top-1 right-1">
                      {renderFileActions(file, isSystemFolder)}
                    </div>
                    
                    <Icon className={cn(
                      "h-12 w-12 mb-2 mt-4",
                      file.is_folder ? "text-amber-500" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium text-center truncate w-full">
                      {file.original_name}
                    </span>
                    {!file.is_folder && (
                      <span className="text-xs text-muted-foreground">
                        {formatBytes(file.size_bytes)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredFiles.map((file) => {
                const Icon = getFileIcon(file);
                const isSystemFolder = file.is_system_folder === true;
                const usages = getFileUsage(file);
                return (
                  <div
                    key={file.id}
                    className="group flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onDoubleClick={() => handlePreview(file)}
                  >
                    <Icon className={cn(
                      "h-8 w-8 flex-shrink-0",
                      file.is_folder ? "text-amber-500" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{file.original_name}</p>
                        {isSystemFolder && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="h-3 w-3 mr-1" />
                            Sistema
                          </Badge>
                        )}
                        {!file.is_folder && <FileUsageBadge usages={usages} className="text-xs" />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {file.is_folder ? 'Pasta' : formatBytes(file.size_bytes)} •{' '}
                        {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {renderFileActions(file, isSystemFolder)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Novo nome"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={renameFile.isPending}>
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subfolder Dialog */}
      <Dialog open={newSubfolderDialogOpen} onOpenChange={setNewSubfolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova subpasta em "{targetFolderForSubfolder?.original_name}"</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Nome da subpasta"
            value={newSubfolderName}
            onChange={(e) => setNewSubfolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateSubfolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSubfolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateSubfolder} disabled={createFolder.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => { setPreviewFile(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.original_name}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex items-center justify-center">
              <img
                src={previewUrl}
                alt={previewFile?.original_name}
                className="max-h-[70vh] rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteFileDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        fileName={fileToDelete?.original_name || ''}
        usages={fileToDelete ? getFileUsage(fileToDelete) : []}
        onConfirm={handleConfirmDelete}
        isPending={isDeleting}
      />

      {/* Move File Dialog */}
      <MoveFileDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        fileName={fileToMove?.original_name || ''}
        currentFolderId={fileToMove?.folder_id || null}
        excludeFolderId={fileToMove?.is_folder ? fileToMove.id : undefined}
        isSystemItem={fileToMove ? isSystemItem(fileToMove) : false}
        systemFolderId={systemFolderId}
        folders={allFolders}
        onConfirm={handleConfirmMove}
        isPending={moveFile.isPending}
      />
    </div>
  );
}
