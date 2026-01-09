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
} from "lucide-react";
import { useFiles, FileItem } from "@/hooks/useFiles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    isLoading,
    uploadFile,
    createFolder,
    deleteFile,
    renameFile,
    getFileUrl,
    downloadFile,
  } = useFiles(currentFolderId);

  const filteredFiles = files.filter((file) =>
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const uploadedFiles = e.target.files;
      if (!uploadedFiles) return;

      for (const file of Array.from(uploadedFiles)) {
        await uploadFile.mutateAsync({ file, folderId: currentFolderId });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    const url = await getFileUrl(file);
    if (url) {
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado para a área de transferência!');
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
      downloadFile(file);
    }
  };

  const openRenameDialog = (file: FileItem) => {
    setSelectedFile(file);
    setNewFileName(file.original_name);
    setRenameDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Arquivos"
        description="Gerencie seus arquivos e imagens"
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
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

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        {folderPath.map((path, index) => (
          <div key={path.id || 'root'} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <button
              onClick={() => handleNavigateToPath(index)}
              className={cn(
                "px-2 py-1 rounded hover:bg-muted transition-colors",
                index === folderPath.length - 1 && "font-medium"
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
                return (
                  <div
                    key={file.id}
                    className="group relative flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    onDoubleClick={() => handlePreview(file)}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!file.is_folder && (
                          <>
                            <DropdownMenuItem onClick={() => downloadFile(file)}>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyLink(file)}>
                              <Link2 className="h-4 w-4 mr-2" />
                              Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => openRenameDialog(file)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteFile.mutate(file)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Icon className={cn(
                      "h-12 w-12 mb-2",
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
                      <p className="font-medium truncate">{file.original_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.is_folder ? 'Pasta' : formatBytes(file.size_bytes)} •{' '}
                        {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!file.is_folder && (
                          <>
                            <DropdownMenuItem onClick={() => downloadFile(file)}>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyLink(file)}>
                              <Link2 className="h-4 w-4 mr-2" />
                              Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => openRenameDialog(file)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteFile.mutate(file)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
    </div>
  );
}
