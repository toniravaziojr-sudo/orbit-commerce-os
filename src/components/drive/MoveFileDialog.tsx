import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, Home, Check, FolderOpen, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  isSystemFolder?: boolean;
  children?: FolderNode[];
  depth?: number;
}

interface MoveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  currentFolderId: string | null;
  excludeFolderId?: string | null; // To prevent moving folder into itself
  isSystemItem?: boolean; // Whether the item being moved is a system item
  systemFolderId?: string | null; // The ID of the system folder
  folders: Array<{
    id: string;
    original_name: string;
    folder_id: string | null;
    is_system_folder?: boolean | null;
  }>;
  onConfirm: (targetFolderId: string | null) => void;
  isPending?: boolean;
}

// Build a tree structure from flat folder list
function buildFolderTree(
  folders: MoveFileDialogProps['folders'],
  excludeFolderId?: string | null
): FolderNode[] {
  const folderMap = new Map<string | null, FolderNode[]>();
  
  // Initialize root level
  folderMap.set(null, []);
  
  // Group folders by parent
  for (const folder of folders) {
    if (folder.id === excludeFolderId) continue;
    
    const node: FolderNode = {
      id: folder.id,
      name: folder.original_name,
      parentId: folder.folder_id,
      isSystemFolder: folder.is_system_folder ?? false,
    };
    
    const siblings = folderMap.get(folder.folder_id) || [];
    siblings.push(node);
    folderMap.set(folder.folder_id, siblings);
  }
  
  // Recursively build tree with depth
  function addChildren(parentId: string | null, depth: number): FolderNode[] {
    const children = folderMap.get(parentId) || [];
    return children.map(node => ({
      ...node,
      depth,
      children: addChildren(node.id, depth + 1),
    }));
  }
  
  return addChildren(null, 0);
}

// Flatten tree for display with depth info
function flattenTree(nodes: FolderNode[]): FolderNode[] {
  const result: FolderNode[] = [];
  
  function traverse(nodeList: FolderNode[]) {
    for (const node of nodeList) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }
  
  traverse(nodes);
  return result;
}

// Check if a folder is within the system tree
function isWithinSystemTree(
  folderId: string | null, 
  systemFolderId: string | null,
  folders: MoveFileDialogProps['folders']
): boolean {
  if (!folderId || !systemFolderId) return false;
  if (folderId === systemFolderId) return true;
  
  let currentId: string | null = folderId;
  const visited = new Set<string>();
  
  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    
    if (currentId === systemFolderId) return true;
    
    const folder = folders.find(f => f.id === currentId);
    currentId = folder?.folder_id || null;
  }
  
  return false;
}

export function MoveFileDialog({
  open,
  onOpenChange,
  fileName,
  currentFolderId,
  excludeFolderId,
  isSystemItem = false,
  systemFolderId,
  folders,
  onConfirm,
  isPending,
}: MoveFileDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Build and flatten folder tree
  const flatFolders = useMemo(() => {
    const tree = buildFolderTree(folders, excludeFolderId);
    let flattened = flattenTree(tree);
    
    // If moving a system item, filter to only show folders within system tree
    if (isSystemItem && systemFolderId) {
      flattened = flattened.filter(folder => 
        folder.id === systemFolderId || 
        isWithinSystemTree(folder.id, systemFolderId, folders)
      );
    }
    
    return flattened;
  }, [folders, excludeFolderId, isSystemItem, systemFolderId]);

  // Check if root is a valid destination
  const canMoveToRoot = !isSystemItem;

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      // If system item, default to system folder
      if (isSystemItem && systemFolderId) {
        setSelectedFolderId(systemFolderId);
      } else {
        setSelectedFolderId(null);
      }
    }
  }, [open, isSystemItem, systemFolderId]);

  const handleConfirm = () => {
    onConfirm(selectedFolderId);
  };

  const isCurrentLocation = selectedFolderId === currentFolderId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover arquivo</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Selecione a pasta de destino para <strong>{fileName}</strong>
          </p>
        </DialogHeader>

        {/* Warning for system items */}
        {isSystemItem && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 rounded-md text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              Este arquivo é do sistema e só pode ser movido dentro de "Uploads do sistema".
            </span>
          </div>
        )}

        {/* Folder list */}
        <ScrollArea className="h-[300px] border rounded-md p-2">
          <div className="space-y-1">
            {/* Root option - only show if not a system item */}
            {canMoveToRoot && (
              <button
                onClick={() => setSelectedFolderId(null)}
                className={cn(
                  "w-full flex items-center gap-2 p-2 rounded-md text-left hover:bg-muted transition-colors",
                  selectedFolderId === null && "bg-primary/10 ring-1 ring-primary"
                )}
              >
                {selectedFolderId === null && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                {selectedFolderId !== null && <div className="w-4" />}
                <Home className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium">Raiz</span>
                {currentFolderId === null && (
                  <span className="text-xs text-muted-foreground ml-auto">(atual)</span>
                )}
              </button>
            )}

            {/* All folders with indentation */}
            {flatFolders.map((folder) => {
              const isCurrentFolder = folder.id === currentFolderId;
              const isSelected = selectedFolderId === folder.id;
              const paddingLeft = (folder.depth || 0) * 16 + 8;
              
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  style={{ paddingLeft }}
                  className={cn(
                    "w-full flex items-center gap-2 py-2 pr-2 rounded-md text-left hover:bg-muted transition-colors",
                    isSelected && "bg-primary/10 ring-1 ring-primary"
                  )}
                >
                  {isSelected ? (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <div className="w-4" />
                  )}
                  {folder.isSystemFolder ? (
                    <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-sm truncate">{folder.name}</span>
                  {isCurrentFolder && (
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">(atual)</span>
                  )}
                </button>
              );
            })}

            {flatFolders.length === 0 && !canMoveToRoot && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma pasta de destino disponível
              </p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isPending || isCurrentLocation}
          >
            {isPending ? 'Movendo...' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
