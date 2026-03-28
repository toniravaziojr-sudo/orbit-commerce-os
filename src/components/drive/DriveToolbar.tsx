import { RefObject } from "react";
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
import { Upload, FolderPlus, Grid, List } from "lucide-react";
import { DriveSearchToolbar } from "./DriveSearchToolbar";
import type { DriveSearchFilters } from "./DriveSearchToolbar";

interface DriveToolbarProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  viewMode: 'grid' | 'list';
  onViewModeToggle: () => void;
  // New folder
  newFolderDialogOpen: boolean;
  onNewFolderDialogChange: (open: boolean) => void;
  newFolderName: string;
  onNewFolderNameChange: (name: string) => void;
  onCreateFolder: () => void;
  isCreatingFolder: boolean;
  // Search
  filters: DriveSearchFilters;
  onFiltersChange: (filters: Partial<DriveSearchFilters>) => void;
  isInFolder: boolean;
}

export function DriveToolbar({
  fileInputRef,
  onUploadClick,
  viewMode,
  onViewModeToggle,
  newFolderDialogOpen,
  onNewFolderDialogChange,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  isCreatingFolder,
  filters,
  onFiltersChange,
  isInFolder,
}: DriveToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-center gap-2">
        <Button onClick={onUploadClick} size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Enviar
        </Button>
        <Dialog open={newFolderDialogOpen} onOpenChange={onNewFolderDialogChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
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
              onChange={(e) => onNewFolderNameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCreateFolder()}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onNewFolderDialogChange(false)}>
                Cancelar
              </Button>
              <Button onClick={onCreateFolder} disabled={isCreatingFolder}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onViewModeToggle}
        >
          {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
        </Button>
      </div>

      <DriveSearchToolbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        isInFolder={isInFolder}
      />
    </div>
  );
}
