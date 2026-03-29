import { Upload, Search, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DriveEmptyStateProps {
  isSearching: boolean;
  isRoot: boolean;
  onClearFilters?: () => void;
  onUploadClick?: () => void;
}

export function DriveEmptyState({ isSearching, isRoot, onClearFilters, onUploadClick }: DriveEmptyStateProps) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">Nenhum arquivo encontrado</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-4">
          Tente buscar por outro termo ou ajuste os filtros
        </p>
        {onClearFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        )}
      </div>
    );
  }

  if (isRoot) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">Seu Drive está vazio</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-4">
          Envie arquivos para começar a organizar suas mídias
        </p>
        {onUploadClick && (
          <Button size="sm" onClick={onUploadClick}>
            <Upload className="h-4 w-4 mr-2" />
            Enviar arquivos
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Upload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold mb-1">Pasta vazia</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Arraste arquivos aqui ou clique em "Enviar"
      </p>
    </div>
  );
}