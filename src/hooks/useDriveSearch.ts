import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { FileItem } from '@/hooks/useFiles';
import type {
  DriveSearchFilters,
  FileTypeFilter,
  OriginFilter,
  SortField,
  SortDirection,
} from '@/components/drive/DriveSearchToolbar';

const MIME_PREFIXES: Record<Exclude<FileTypeFilter, 'all'>, string[]> = {
  image: ['image/'],
  video: ['video/'],
  document: ['application/pdf', 'application/msword', 'application/vnd.', 'text/'],
  audio: ['audio/'],
};

function getOriginFromMetadata(file: FileItem): string {
  const meta = file.metadata as Record<string, unknown> | null;
  if (!meta) return 'manual';
  const source = (meta.source as string) || '';
  if (meta.backfill) return 'backfill';
  if (source.startsWith('ai_') || source.includes('chatgpt') || source.includes('command_assistant')) return 'ai';
  if (source && source !== 'manual') return 'system';
  return 'manual';
}

export const DEFAULT_FILTERS: DriveSearchFilters = {
  searchQuery: '',
  scope: 'global',
  fileType: 'all',
  origin: 'all',
  usage: 'all',
  sortField: 'date',
  sortDirection: 'desc',
};

/**
 * Hook for global Drive search with filters.
 * Uses a separate query that searches ALL files of the tenant when search is active.
 */
export function useDriveSearch(
  currentFolderId: string | null,
  isFileInUse: (file: FileItem) => boolean,
) {
  const { currentTenant } = useAuth();
  const [filters, setFiltersState] = useState<DriveSearchFilters>(DEFAULT_FILTERS);

  const updateFilters = useCallback((partial: Partial<DriveSearchFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const isSearching = filters.searchQuery.trim().length > 0;
  const isGlobalSearch = isSearching && (filters.scope === 'global' || currentFolderId === null);

  // Global search query — fetches ALL tenant files when searching globally
  const { data: globalFiles, isLoading: isGlobalLoading } = useQuery({
    queryKey: ['drive-global-search', currentTenant?.id, filters.searchQuery],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .ilike('original_name', `%${filters.searchQuery.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as FileItem[];
    },
    enabled: !!currentTenant?.id && isGlobalSearch && filters.searchQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  /**
   * Apply client-side filters + sorting to a file list.
   */
  const applyFilters = useCallback(
    (files: FileItem[]): FileItem[] => {
      let result = files;

      // Text filter for local (non-global) searches
      if (isSearching && !isGlobalSearch) {
        const q = filters.searchQuery.toLowerCase().trim();
        result = result.filter((f) => f.original_name.toLowerCase().includes(q));
      }

      // Type filter
      if (filters.fileType !== 'all') {
        const prefixes = MIME_PREFIXES[filters.fileType];
        result = result.filter((f) => {
          if (f.is_folder) return true; // always show folders
          return prefixes.some((p) => f.mime_type?.startsWith(p));
        });
      }

      // Origin filter
      if (filters.origin !== 'all') {
        result = result.filter((f) => {
          if (f.is_folder) return true;
          return getOriginFromMetadata(f) === filters.origin;
        });
      }

      // Usage filter
      if (filters.usage !== 'all') {
        result = result.filter((f) => {
          if (f.is_folder) return true;
          const inUse = isFileInUse(f);
          return filters.usage === 'in_use' ? inUse : !inUse;
        });
      }

      // Sorting — folders always first
      result = [...result].sort((a, b) => {
        // System folders first
        if (a.is_system_folder && !b.is_system_folder) return -1;
        if (!a.is_system_folder && b.is_system_folder) return 1;
        // Folders before files
        if (a.is_folder && !b.is_folder) return -1;
        if (!a.is_folder && b.is_folder) return 1;

        const dir = filters.sortDirection === 'asc' ? 1 : -1;
        switch (filters.sortField) {
          case 'name':
            return dir * a.original_name.localeCompare(b.original_name, 'pt-BR');
          case 'date':
            return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          case 'size':
            return dir * ((a.size_bytes || 0) - (b.size_bytes || 0));
          default:
            return 0;
        }
      });

      return result;
    },
    [filters, isSearching, isGlobalSearch, isFileInUse],
  );

  return {
    filters,
    updateFilters,
    isSearching,
    isGlobalSearch,
    isGlobalLoading,
    globalFiles: globalFiles || [],
    applyFilters,
  };
}