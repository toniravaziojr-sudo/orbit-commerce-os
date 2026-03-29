import { Search, SlidersHorizontal, ArrowUpDown, X, Globe, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SearchScope = 'global' | 'folder';
export type FileTypeFilter = 'all' | 'image' | 'video' | 'document' | 'audio';
export type OriginFilter = 'all' | 'manual' | 'system' | 'ai' | 'backfill';
export type UsageFilter = 'all' | 'in_use' | 'not_used';
export type SortField = 'name' | 'date' | 'size';
export type SortDirection = 'asc' | 'desc';

export interface DriveSearchFilters {
  searchQuery: string;
  scope: SearchScope;
  fileType: FileTypeFilter;
  origin: OriginFilter;
  usage: UsageFilter;
  sortField: SortField;
  sortDirection: SortDirection;
}

interface DriveSearchToolbarProps {
  filters: DriveSearchFilters;
  onFiltersChange: (filters: Partial<DriveSearchFilters>) => void;
  isInFolder: boolean;
}

const FILE_TYPE_LABELS: Record<FileTypeFilter, string> = {
  all: 'Todos os tipos',
  image: 'Imagens',
  video: 'Vídeos',
  document: 'Documentos',
  audio: 'Áudio',
};

const ORIGIN_LABELS: Record<OriginFilter, string> = {
  all: 'Todas as origens',
  manual: 'Upload manual',
  system: 'Sistema',
  ai: 'IA',
  backfill: 'Migração',
};

const USAGE_LABELS: Record<UsageFilter, string> = {
  all: 'Qualquer uso',
  in_use: 'Em uso',
  not_used: 'Não usado',
};

const SORT_LABELS: Record<SortField, string> = {
  name: 'Nome',
  date: 'Data',
  size: 'Tamanho',
};

export function DriveSearchToolbar({ filters, onFiltersChange, isInFolder }: DriveSearchToolbarProps) {
  const activeFilterCount = [
    filters.fileType !== 'all',
    filters.origin !== 'all',
    filters.usage !== 'all',
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0 || filters.searchQuery.trim() !== '';

  const clearFilters = () => {
    onFiltersChange({
      searchQuery: '',
      fileType: 'all',
      origin: 'all',
      usage: 'all',
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar arquivos..."
            className="pl-9 pr-9"
            value={filters.searchQuery}
            onChange={(e) => onFiltersChange({ searchQuery: e.target.value })}
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFiltersChange({ searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Scope toggle — only when searching and inside a folder */}
        {filters.searchQuery.trim() && isInFolder && (
          <Button
            variant={filters.scope === 'global' ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              onFiltersChange({ scope: filters.scope === 'global' ? 'folder' : 'global' })
            }
            className="gap-1.5 text-xs whitespace-nowrap"
          >
            {filters.scope === 'global' ? (
              <>
                <Globe className="h-3.5 w-3.5" />
                Tudo
              </>
            ) : (
              <>
                <FolderOpen className="h-3.5 w-3.5" />
                Esta pasta
              </>
            )}
          </Button>
        )}

        {/* Filters dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Tipo de arquivo</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.fileType}
              onValueChange={(v) => onFiltersChange({ fileType: v as FileTypeFilter })}
            >
              {Object.entries(FILE_TYPE_LABELS).map(([key, label]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Origem</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.origin}
              onValueChange={(v) => onFiltersChange({ origin: v as OriginFilter })}
            >
              {Object.entries(ORIGIN_LABELS).map(([key, label]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Uso</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.usage}
              onValueChange={(v) => onFiltersChange({ usage: v as UsageFilter })}
            >
              {Object.entries(USAGE_LABELS).map(([key, label]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5" />
              {SORT_LABELS[filters.sortField]}
              <span className="text-[10px]">{filters.sortDirection === 'asc' ? '↑' : '↓'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.sortField}
              onValueChange={(v) => onFiltersChange({ sortField: v as SortField })}
            >
              {Object.entries(SORT_LABELS).map(([key, label]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={filters.sortDirection}
              onValueChange={(v) => onFiltersChange({ sortDirection: v as SortDirection })}
            >
              <DropdownMenuRadioItem value="asc">Crescente</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">Decrescente</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear all */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground">
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.fileType !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {FILE_TYPE_LABELS[filters.fileType]}
              <button onClick={() => onFiltersChange({ fileType: 'all' })}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.origin !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {ORIGIN_LABELS[filters.origin]}
              <button onClick={() => onFiltersChange({ origin: 'all' })}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.usage !== 'all' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {USAGE_LABELS[filters.usage]}
              <button onClick={() => onFiltersChange({ usage: 'all' })}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}