import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useEffect } from 'react';

export interface FileItem {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  filename: string;
  original_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_folder: boolean;
  is_system_folder?: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown> | null;
}

const SYSTEM_FOLDER_NAME = 'Uploads do sistema';

// Determine which bucket a file belongs to based on metadata or path
function getBucketForFile(file: FileItem): string {
  const metadata = file.metadata as Record<string, unknown> | null;
  const source = metadata?.source as string | undefined;
  const bucket = metadata?.bucket as string | undefined;
  
  // Explicit bucket in metadata takes precedence
  if (bucket) return bucket;
  
  // If it's a store asset (logo, favicon, etc.)
  if (source?.startsWith('storefront_') || file.storage_path.includes('tenants/')) {
    return 'store-assets';
  }
  
  // Default: tenant-files
  return 'tenant-files';
}

// Ensure system folder exists for a tenant
async function ensureSystemFolder(tenantId: string, userId: string): Promise<void> {
  // Check if system folder already exists
  const { data: existing } = await supabase
    .from('files')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_system_folder', true)
    .is('folder_id', null)
    .single();

  if (existing) return; // Already exists

  // Create system folder
  await supabase
    .from('files')
    .insert({
      tenant_id: tenantId,
      folder_id: null,
      filename: SYSTEM_FOLDER_NAME,
      original_name: SYSTEM_FOLDER_NAME,
      storage_path: `${tenantId}/system/`,
      is_folder: true,
      is_system_folder: true,
      created_by: userId,
    });
}

export function useFiles(folderId: string | null = null) {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  // Ensure system folder exists when hook is used at root level
  useEffect(() => {
    if (currentTenant?.id && user?.id && folderId === null) {
      ensureSystemFolder(currentTenant.id, user.id).then(() => {
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
        .order('filename', { ascending: true });

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
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar arquivo: ${error.message}`);
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
    onError: (error: Error) => {
      toast.error(`Erro ao criar pasta: ${error.message}`);
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (file: FileItem) => {
      if (!file.is_folder) {
        const bucket = getBucketForFile(file);
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
    onError: (error: Error) => {
      toast.error(`Erro ao excluir arquivo: ${error.message}`);
    },
  });

  const moveFile = useMutation({
    mutationFn: async ({ fileId, targetFolderId }: { fileId: string; targetFolderId: string | null }) => {
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
    onError: (error: Error) => {
      toast.error(`Erro ao mover arquivo: ${error.message}`);
    },
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
    onError: (error: Error) => {
      toast.error(`Erro ao renomear: ${error.message}`);
    },
  });

  const getFileUrl = async (file: FileItem): Promise<string | null> => {
    try {
      const metadata = file.metadata as Record<string, unknown> | null;
      
      // 1. Check if there's a direct URL in metadata
      const metadataUrl = metadata?.url as string | undefined;
      if (metadataUrl) {
        return metadataUrl;
      }
      
      // 2. Use bucket + storage_path to get public URL
      const bucket = getBucketForFile(file);
      
      // Try public URL first
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(file.storage_path);
      
      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }
      
      // Fallback to signed URL
      const { data: signedData, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.storage_path, 3600); // 1 hour expiry

      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }
      
      return signedData?.signedUrl || null;
    } catch (err) {
      console.error('Error in getFileUrl:', err);
      return null;
    }
  };

  const downloadFile = async (file: FileItem) => {
    try {
      const bucket = getBucketForFile(file);
      
      // Try to download directly from storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(file.storage_path);
      
      if (error) {
        console.error('Storage download error:', error);
        
        // Fallback: try to fetch from URL
        const url = await getFileUrl(file);
        if (url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error('Failed to fetch file');
          const blob = await response.blob();
          triggerDownload(blob, file.original_name);
          return;
        }
        
        throw new Error('Não foi possível baixar o arquivo');
      }
      
      triggerDownload(data, file.original_name);
    } catch (err) {
      console.error('Download error:', err);
      throw err;
    }
  };

  // Helper to trigger file download
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get system folder ID for default uploads
  const getSystemFolderId = async (): Promise<string | null> => {
    if (!currentTenant?.id) return null;
    
    const { data } = await supabase
      .from('files')
      .select('id')
      .eq('tenant_id', currentTenant.id)
      .eq('is_system_folder', true)
      .is('folder_id', null)
      .single();
    
    return data?.id || null;
  };

  return {
    files: files || [],
    allFolders: allFolders || [],
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
  };
}
