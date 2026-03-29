import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { showErrorToast } from '@/lib/error-toast';
import {
  getBucketForFile as _getBucketForFile,
  getFileUrl as _getFileUrl,
  downloadDriveFile,
  ensureSystemFolder as _ensureSystemFolder,
  invalidateDriveQueries,
  type DriveFileItem,
} from '@/lib/driveService';
export type FileItem = DriveFileItem;

const SYSTEM_FOLDER_NAME = 'Uploads do sistema';

export function useFiles(folderId: string | null = null) {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  // Ensure system folder exists when hook is used at root level
  useEffect(() => {
    if (currentTenant?.id && user?.id && folderId === null) {
      _ensureSystemFolder(currentTenant.id, user.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['files', currentTenant.id, null] });
      });
    }
  }, [currentTenant?.id, user?.id, folderId, queryClient]);

  const { data: files, isLoading, error } = useQuery({
    queryKey: ['files', currentTenant?.id, folderId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('files')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('is_system_folder', { ascending: false })
        .order('is_folder', { ascending: false })
        .order('created_at', { ascending: false });

      if (folderId) {
        query = query.eq('folder_id', folderId);
      } else {
        query = query.is('folder_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FileItem[];
    },
    enabled: !!currentTenant?.id,
  });

  // Query all folders for the tenant (used by MoveFileDialog and drag/drop)
  const { data: allFolders } = useQuery({
    queryKey: ['files-all-folders', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('files')
        .select('id, original_name, folder_id, is_system_folder')
        .eq('tenant_id', currentTenant.id)
        .eq('is_folder', true)
        .order('is_system_folder', { ascending: false })
        .order('original_name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Get system folder ID
  const systemFolder = allFolders?.find(f => f.is_system_folder);
  const systemFolderId = systemFolder?.id || null;

  /**
   * Check if a folder is within the system folder tree (is system folder or descendant)
   */
  const isWithinSystemTree = (folderId: string | null): boolean => {
    if (!folderId || !allFolders || !systemFolderId) return false;
    
    // If it IS the system folder
    if (folderId === systemFolderId) return true;
    
    // Build parent chain and check if any ancestor is the system folder
    let currentId: string | null = folderId;
    const visited = new Set<string>();
    
    while (currentId) {
      if (visited.has(currentId)) break; // Prevent infinite loop
      visited.add(currentId);
      
      if (currentId === systemFolderId) return true;
      
      const folder = allFolders.find(f => f.id === currentId);
      currentId = folder?.folder_id || null;
    }
    
    return false;
  };

  /**
   * Check if a file/folder is a "system item" (inside system tree or system_managed)
   */
  const isSystemItem = (item: FileItem): boolean => {
    // Is the system folder itself
    if (item.is_system_folder) return true;
    
    // Check metadata for system_managed flag
    const metadata = item.metadata as Record<string, unknown> | null;
    if (metadata?.system_managed === true) return true;
    
    // Check if it's within the system folder tree
    if (item.folder_id && isWithinSystemTree(item.folder_id)) return true;
    
    return false;
  };

  /**
   * Validate if a move operation is allowed
   */
  const canMoveItem = (item: FileItem, targetFolderId: string | null): { allowed: boolean; reason?: string } => {
    // Cannot move system folder itself
    if (item.is_system_folder) {
      return { allowed: false, reason: 'Não é possível mover a pasta do sistema' };
    }
    
    // If item is a system item, it can only move within system tree
    if (isSystemItem(item)) {
      const targetIsInSystemTree = targetFolderId === null 
        ? false 
        : isWithinSystemTree(targetFolderId) || targetFolderId === systemFolderId;
      
      if (!targetIsInSystemTree) {
        return { 
          allowed: false, 
          reason: 'Arquivos do sistema só podem ser movidos dentro de "Uploads do sistema"' 
        };
      }
    }
    
    // Cannot move folder into itself
    if (item.is_folder && item.id === targetFolderId) {
      return { allowed: false, reason: 'Não é possível mover uma pasta para dentro dela mesma' };
    }
    
    return { allowed: true };
  };

  const uploadFile = useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string | null }) => {
      if (!currentTenant?.id || !user?.id) throw new Error('Tenant ou usuário não encontrado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const storagePath = `${currentTenant.id}/${folderId || 'root'}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('tenant-files')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Create metadata record with bucket info
      const { data, error } = await supabase
        .from('files')
        .insert({
          tenant_id: currentTenant.id,
          folder_id: folderId,
          filename: fileName,
          original_name: file.name,
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
          is_folder: false,
          created_by: user.id,
          metadata: { bucket: 'tenant-files' },
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentTenant?.id] });
      // Toast handled by caller (Files.tsx) to consolidate multiple uploads
    },
    onError: (error) => {
      // Error toast handled by caller for batch upload consolidation
      console.error('Upload error:', error.message);
    },
  });

  const createFolder = useMutation({
    mutationFn: async ({ name, parentFolderId }: { name: string; parentFolderId: string | null }) => {
      if (!currentTenant?.id || !user?.id) throw new Error('Tenant ou usuário não encontrado');

      const { data, error } = await supabase
        .from('files')
        .insert({
          tenant_id: currentTenant.id,
          folder_id: parentFolderId,
          filename: name,
          original_name: name,
          storage_path: `${currentTenant.id}/${parentFolderId || 'root'}/${name}/`,
          is_folder: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['files-all-folders', currentTenant?.id] });
      toast.success('Pasta criada com sucesso!');
    },
    onError: (error) => showErrorToast(error, { module: 'arquivos', action: 'criar' }),
  });

  const deleteFile = useMutation({
    mutationFn: async (file: FileItem) => {
      if (!file.is_folder) {
        const bucket = _getBucketForFile(file);
        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([file.storage_path]);
        if (storageError) console.error('Storage delete error:', storageError);
      }

      // Delete metadata record
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentTenant?.id] });
      toast.success('Arquivo excluído com sucesso!');
    },
    onError: (err) => showErrorToast(err, { module: 'arquivos', action: 'excluir' }),
  });

  const moveFile = useMutation({
    mutationFn: async ({ fileId, targetFolderId, skipValidation }: { fileId: string; targetFolderId: string | null; skipValidation?: boolean }) => {
      // Get the file to validate
      if (!skipValidation) {
        const { data: fileData } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .single();
        
        if (fileData) {
          const validation = canMoveItem(fileData as FileItem, targetFolderId);
          if (!validation.allowed) {
            throw new Error(validation.reason || 'Movimento não permitido');
          }
        }
      }
      
      const { data, error } = await supabase
        .from('files')
        .update({ folder_id: targetFolderId, updated_at: new Date().toISOString() })
        .eq('id', fileId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['files-all-folders', currentTenant?.id] });
      toast.success('Arquivo movido com sucesso!');
    },
    onError: (err) => showErrorToast(err, { module: 'arquivos', action: 'processar' }),
  });

  const renameFile = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const { data, error } = await supabase
        .from('files')
        .update({ filename: newName, original_name: newName, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['files-all-folders', currentTenant?.id] });
      toast.success('Arquivo renomeado com sucesso!');
    },
    onError: (err) => showErrorToast(err, { module: 'arquivos', action: 'processar' }),
  });

  const getFileUrl = async (file: FileItem): Promise<string | null> => {
    try {
      const url = await _getFileUrl(file);
      return url;
    } catch (err) {
      console.error('Error in getFileUrl:', err);
      toast.error('Erro ao obter URL do arquivo. Se persistir, contate o suporte.');
      return null;
    }
  };

  const downloadFile = async (file: FileItem) => {
    try {
      await downloadDriveFile(file);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Erro ao baixar arquivo. Se persistir, contate o suporte.');
      throw err;
    }
  };

  // Get system folder ID for default uploads
  const getSystemFolderId = async (): Promise<string | null> => {
    if (!currentTenant?.id || !user?.id) return null;
    return _ensureSystemFolder(currentTenant.id, user.id);
  };

  return {
    files: files || [],
    allFolders: allFolders || [],
    systemFolderId,
    isLoading,
    error,
    uploadFile,
    createFolder,
    deleteFile,
    renameFile,
    moveFile,
    getFileUrl,
    downloadFile,
    getSystemFolderId,
    isWithinSystemTree,
    isSystemItem,
    canMoveItem,
  };
}