import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, ChevronRight, Home, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  isSystemFolder?: boolean;
}

interface MoveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  currentFolderId: string | null;
  onConfirm: (targetFolderId: string | null) => void;
  isPending?: boolean;
}

export function MoveFileDialog({
  open,
  onOpenChange,
  fileName,
  currentFolderId,
  onConfirm,
  isPending,
}: MoveFileDialogProps) {
  const { currentTenant } = useAuth();
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Raiz' },
  ]);
  const [loading, setLoading] = useState(false);

  // Load folders when dialog opens
  useEffect(() => {
    if (open && currentTenant?.id) {
      loadFolders();
    }
  }, [open, currentTenant?.id]);

  const loadFolders = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('files')
      .select('id, original_name, folder_id, is_system_folder')
      .eq('tenant_id', currentTenant.id)
      .eq('is_folder', true)
      .order('is_system_folder', { ascending: false })
      .order('original_name', { ascending: true });

    if (!error && data) {
      setFolders(
        data.map((f) => ({
          id: f.id,
          name: f.original_name,
          parentId: f.folder_id,
          isSystemFolder: f.is_system_folder,
        }))
      );
    }
    setLoading(false);
  };

  // Get folders at current level
  const currentLevelFolders = folders.filter(
    (f) => f.parentId === (breadcrumb[breadcrumb.length - 1]?.id ?? null)
  );

  const handleFolderClick = (folder: FolderNode) => {
    // Navigate into folder
    setBreadcrumb([...breadcrumb, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumb(breadcrumb.slice(0, index + 1));
  };

  const handleSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
  };

  const handleConfirm = () => {
    onConfirm(selectedFolderId);
  };

  const currentBreadcrumbId = breadcrumb[breadcrumb.length - 1]?.id ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover arquivo</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione a pasta de destino para <strong>{fileName}</strong>
          </p>
        </DialogHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm border-b pb-2 flex-wrap">
          {breadcrumb.map((item, index) => (
            <div key={item.id || 'root'} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={cn(
                  "px-1 py-0.5 rounded hover:bg-muted transition-colors text-xs",
                  index === breadcrumb.length - 1 && "font-medium"
                )}
              >
                {index === 0 ? <Home className="h-3 w-3" /> : item.name}
              </button>
            </div>
          ))}
        </div>

        {/* Folder list */}
        <ScrollArea className="h-[250px] border rounded-md p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-1">
              {/* Option to select current level (root or current folder) */}
              <button
                onClick={() => handleSelect(currentBreadcrumbId)}
                className={cn(
                  "w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors",
                  selectedFolderId === currentBreadcrumbId && "bg-primary/10 ring-1 ring-primary"
                )}
              >
                {selectedFolderId === currentBreadcrumbId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">
                  {currentBreadcrumbId === null ? 'Raiz' : breadcrumb[breadcrumb.length - 1]?.name}
                </span>
                <span className="text-xs text-muted-foreground">(mover aqui)</span>
              </button>

              {/* Subfolders */}
              {currentLevelFolders.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma subpasta
                </p>
              )}
              {currentLevelFolders.map((folder) => {
                // Don't show current folder as option
                if (folder.id === currentFolderId) return null;

                return (
                  <div key={folder.id} className="flex items-center gap-1">
                    <button
                      onClick={() => handleSelect(folder.id)}
                      className={cn(
                        "flex-1 flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors",
                        selectedFolderId === folder.id && "bg-primary/10 ring-1 ring-primary"
                      )}
                    >
                      {selectedFolderId === folder.id && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                      <Folder className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">{folder.name}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFolderClick(folder)}
                      className="text-xs"
                    >
                      Abrir
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || selectedFolderId === currentFolderId}>
            {isPending ? 'Movendo...' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
