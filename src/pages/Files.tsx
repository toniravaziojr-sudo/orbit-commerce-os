import { useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { useFiles, FileItem } from "@/hooks/useFiles";
import { useFileUsageDetection } from "@/hooks/useFileUsageDetection";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { cn } from "@/lib/utils";
import { isProtectedFolder } from "@/components/drive/driveHelpers";
import { toast } from "sonner";
import { DeleteFileDialog } from "@/components/drive/DeleteFileDialog";
import { MoveFileDialog } from "@/components/drive/MoveFileDialog";
import { useDriveSearch } from "@/hooks/useDriveSearch";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

// Decomposed components
import { DriveToolbar } from "@/components/drive/DriveToolbar";
import { DriveBreadcrumbs } from "@/components/drive/DriveBreadcrumbs";
import { DriveFileGrid } from "@/components/drive/DriveFileGrid";
import { DriveFileList } from "@/components/drive/DriveFileList";
import { DrivePreviewPanel } from "@/components/drive/DrivePreviewPanel";
import { DriveEmptyState } from "@/components/drive/DriveEmptyState";
import { RenameDialog, SubfolderDialog } from "@/components/drive/DriveDialogs";
import { useContextMenu, type FileActions } from "@/components/drive/DriveFileContextMenu";
import { Skeleton } from "@/components/ui/skeleton";

export default function Files() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Raiz' },
  ]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // Preview panel
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Move dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItem | null>(null);

  // Subfolder dialog
  const [newSubfolderDialogOpen, setNewSubfolderDialogOpen] = useState(false);
  const [targetFolderForSubfolder, setTargetFolderForSubfolder] = useState<FileItem | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState('');

  // Upload refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const specificFolderInputRef = useRef<HTMLInputElement>(null);
  const [targetFolderForUpload, setTargetFolderForUpload] = useState<FileItem | null>(null);

  // Drag state
  const [draggedItem, setDraggedItem] = useState<FileItem | null>(null);

  // Context menu
  const { contextMenu, handleContextMenu, closeContextMenu } = useContextMenu();

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

  const { getFileUsage, isFileInUse } = useFileUsageDetection();
  const { upsertSettings } = useStoreSettings();

  const {
    filters,
    updateFilters,
    isSearching,
    isGlobalSearch,
    isGlobalLoading,
    globalFiles,
    applyFilters,
  } = useDriveSearch(currentFolderId, isFileInUse);

  const sourceFiles = isGlobalSearch ? globalFiles : files;
  const filteredFiles = applyFilters(sourceFiles);
  const effectiveLoading = isGlobalSearch ? isGlobalLoading : isLoading;

  // ---- Handlers ----

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, targetFolderId?: string | null) => {
      const uploadedFiles = e.target.files;
      if (!uploadedFiles) return;
      const folderId = targetFolderId !== undefined ? targetFolderId : currentFolderId;
      const filesArray = Array.from(uploadedFiles);
      let successCount = 0;
      let errorCount = 0;
      for (const file of filesArray) {
        try {
          await uploadFile.mutateAsync({ file, folderId });
          successCount++;
        } catch {
          errorCount++;
        }
      }
      if (successCount > 0) {
        toast.success(successCount === 1 ? 'Arquivo enviado com sucesso!' : `${successCount} arquivos enviados com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} arquivo(s) falharam no envio.`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (specificFolderInputRef.current) specificFolderInputRef.current.value = '';
      setTargetFolderForUpload(null);
    },
    [currentFolderId, uploadFile]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = e.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;
      const filesArray = Array.from(droppedFiles);
      let successCount = 0;
      let errorCount = 0;
      for (const file of filesArray) {
        try {
          await uploadFile.mutateAsync({ file, folderId: currentFolderId });
          successCount++;
        } catch {
          errorCount++;
        }
      }
      if (successCount > 0) {
        toast.success(successCount === 1 ? 'Arquivo enviado com sucesso!' : `${successCount} arquivos enviados com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} arquivo(s) falharam no envio.`);
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
    setPreviewFile(null);
  };

  const handleNavigateToPath = (pathIndex: number) => {
    const path = folderPath[pathIndex];
    setCurrentFolderId(path.id);
    setFolderPath(folderPath.slice(0, pathIndex + 1));
    setPreviewFile(null);
  };

  const handleCopyLink = async (file: FileItem) => {
    try {
      const url = await getFileUrl(file);
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      } else {
        toast.error('Não foi possível gerar o link');
      }
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      await downloadFile(file);
      toast.success('Download iniciado!');
    } catch {
      toast.error('Erro ao baixar arquivo');
    }
  };

  const handlePreviewClick = (file: FileItem) => {
    if (file.is_folder) {
      handleOpenFolder(file);
      return;
    }
    setPreviewFile(file);
  };

  const openRenameDialog = (file: FileItem) => {
    setSelectedFile(file);
    setNewFileName(file.original_name);
    setRenameDialogOpen(true);
  };

  const openDeleteDialog = (file: FileItem) => {
    if (isProtectedFolder(file)) {
      toast.error('Esta pasta é protegida e não pode ser excluída.');
      return;
    }
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
      if (usages.length > 0) {
        const updates: Record<string, null> = {};
        for (const usage of usages) {
          if (usage.type === 'logo') updates.logo_url = null;
          if (usage.type === 'favicon') updates.favicon_url = null;
        }
        if (Object.keys(updates).length > 0) {
          await upsertSettings.mutateAsync(updates);
        }
      }
      await deleteFile.mutateAsync(fileToDelete);
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      queryClient.invalidateQueries({ queryKey: ['store-settings-urls'] });
      setDeleteDialogOpen(false);
      setFileToDelete(null);
      if (previewFile?.id === fileToDelete.id) setPreviewFile(null);
    } catch {
      toast.error('Erro ao excluir arquivo');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmMove = async (targetFolderId: string | null) => {
    if (!fileToMove) return;
    try {
      await moveFile.mutateAsync({ fileId: fileToMove.id, targetFolderId });
      const targetFolder = allFolders.find(f => f.id === targetFolderId);
      toast.success(`Movido para ${targetFolder?.original_name || 'Raiz'}`);
      setMoveDialogOpen(false);
      setFileToMove(null);
    } catch {
      toast.error('Erro ao mover arquivo');
    }
  };

  // Drag & drop handlers
  const handleDragStartItem = (e: React.DragEvent, item: FileItem) => {
    if (isProtectedFolder(item)) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify({ id: item.id, isFolder: item.is_folder }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(item);
  };

  const handleDragEndItem = () => setDraggedItem(null);

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
      if (isFolder && itemId === targetFolder.id) {
        toast.error('Não é possível mover uma pasta para dentro dela mesma');
        return;
      }
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

  // File actions object for context menu / grid / list
  const fileActions: FileActions = {
    onDownload: handleDownload,
    onCopyLink: handleCopyLink,
    onRename: openRenameDialog,
    onDelete: openDeleteDialog,
    onMove: openMoveDialog,
    onUploadToFolder: handleUploadToFolder,
    onCreateSubfolder: openSubfolderDialog,
    onPreview: handlePreviewClick,
  };

  // Get preview file's parent folder name
  const previewParentName = previewFile?.folder_id
    ? allFolders.find(f => f.id === previewFile.folder_id)?.original_name || 'Raiz'
    : 'Raiz';

  return (
    <div className="space-y-4 animate-fade-in">
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
      <DriveToolbar
        onUploadClick={() => fileInputRef.current?.click()}
        viewMode={viewMode}
        onViewModeToggle={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
        newFolderDialogOpen={newFolderDialogOpen}
        onNewFolderDialogChange={setNewFolderDialogOpen}
        newFolderName={newFolderName}
        onNewFolderNameChange={setNewFolderName}
        onCreateFolder={handleCreateFolder}
        isCreatingFolder={createFolder.isPending}
        filters={filters}
        onFiltersChange={updateFilters}
        isInFolder={currentFolderId !== null}
      />

      {/* Global search indicator */}
      {isGlobalSearch && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <Globe className="h-4 w-4" />
          <span>Buscando em todo o Drive — {filteredFiles.filter(f => !f.is_folder).length} resultado(s)</span>
        </div>
      )}

      {/* Breadcrumbs */}
      {!isGlobalSearch && (
        <DriveBreadcrumbs
          folderPath={folderPath}
          onNavigateToPath={handleNavigateToPath}
          onDropOnBreadcrumb={handleDropOnBreadcrumb}
          onDragOverFolder={handleDragOverFolder}
          draggedItem={draggedItem}
          currentFolderId={currentFolderId}
        />
      )}

      {/* Hidden file input for main uploads - wired via DriveToolbar ref */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e)}
      />

      {/* Drop zone & Files */}
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
        className={cn(
          "min-h-[400px] transition-colors",
          uploadFile.isPending && "border-primary bg-primary/5"
        )}
      >
        <CardContent className="p-4">
          {effectiveLoading ? (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center p-3 rounded-lg border">
                  <Skeleton className="w-full h-20 mb-2 rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-2 w-1/2 mt-1 rounded" />
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 ? (
            <DriveEmptyState
              isSearching={isSearching}
              isRoot={currentFolderId === null}
              onClearFilters={() => updateFilters({ searchQuery: '', fileType: 'all', origin: 'all', usage: 'all' })}
              onUploadClick={() => fileInputRef.current?.click()}
            />
          ) : viewMode === 'grid' ? (
            <DriveFileGrid
              files={filteredFiles}
              allFolders={allFolders}
              draggedItem={draggedItem}
              isGlobalSearch={isGlobalSearch}
              getFileUsage={getFileUsage}
              getFileUrl={getFileUrl}
              actions={fileActions}
              onDragStart={handleDragStartItem}
              onDragEnd={handleDragEndItem}
              onDragOverFolder={handleDragOverFolder}
              onDropOnFolder={handleDropOnFolder}
              onOpenFolder={handleOpenFolder}
              onContextMenu={handleContextMenu}
              onPreviewClick={handlePreviewClick}
            />
          ) : (
            <DriveFileList
              files={filteredFiles}
              allFolders={allFolders}
              isGlobalSearch={isGlobalSearch}
              getFileUsage={getFileUsage}
              getFileUrl={getFileUrl}
              actions={fileActions}
              onOpenFolder={handleOpenFolder}
              onContextMenu={handleContextMenu}
              onPreviewClick={handlePreviewClick}
            />
          )}
        </CardContent>
      </Card>

      {/* Preview Panel (Sheet lateral) */}
      <DrivePreviewPanel
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        getFileUrl={getFileUrl}
        usages={previewFile ? getFileUsage(previewFile) : []}
        onDownload={handleDownload}
        onCopyLink={handleCopyLink}
        onRename={openRenameDialog}
        onDelete={openDeleteDialog}
        onMove={openMoveDialog}
        parentFolderName={previewParentName}
      />

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        name={newFileName}
        onNameChange={setNewFileName}
        onConfirm={handleRename}
        isPending={renameFile.isPending}
      />

      {/* Subfolder Dialog */}
      <SubfolderDialog
        open={newSubfolderDialogOpen}
        onOpenChange={setNewSubfolderDialogOpen}
        parentFolderName={targetFolderForSubfolder?.original_name || ''}
        name={newSubfolderName}
        onNameChange={setNewSubfolderName}
        onConfirm={handleCreateSubfolder}
        isPending={createFolder.isPending}
      />

      {/* Delete Dialog */}
      <DeleteFileDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        fileName={fileToDelete?.original_name || ''}
        usages={fileToDelete ? getFileUsage(fileToDelete) : []}
        onConfirm={handleConfirmDelete}
        isPending={isDeleting}
      />

      {/* Move Dialog */}
      <MoveFileDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        fileName={fileToMove?.original_name || ''}
        currentFolderId={fileToMove?.folder_id || null}
        excludeFolderId={fileToMove?.is_folder ? fileToMove.id : undefined}
        isSystemItem={fileToMove ? isSystemItem(fileToMove) : false}
        isFileInUse={fileToMove ? isFileInUse(fileToMove) : false}
        usageCount={fileToMove ? getFileUsage(fileToMove).length : 0}
        systemFolderId={systemFolderId}
        folders={allFolders}
        onConfirm={handleConfirmMove}
        isPending={moveFile.isPending}
      />
    </div>
  );
}
