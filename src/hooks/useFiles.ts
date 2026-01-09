import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useFiles(folderId: string | null = null) {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: files, isLoading, error } = useQuery({
    queryKey: ['files', currentTenant?.id, folderId],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('files')
        .select('*')
        .eq('tenant_id', currentTenant.id)
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

      // Create metadata record
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
      toast.success('Pasta criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar pasta: ${error.message}`);
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (file: FileItem) => {
      if (!file.is_folder) {
        // Delete from storage first
        const { error: storageError } = await supabase.storage
          .from('tenant-files')
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
      toast.success('Arquivo renomeado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao renomear: ${error.message}`);
    },
  });

  const getFileUrl = async (file: FileItem): Promise<string | null> => {
    const { data } = await supabase.storage
      .from('tenant-files')
      .createSignedUrl(file.storage_path, 3600); // 1 hour expiry

    return data?.signedUrl || null;
  };

  const downloadFile = async (file: FileItem) => {
    const url = await getFileUrl(file);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return {
    files: files || [],
    isLoading,
    error,
    uploadFile,
    createFolder,
    deleteFile,
    renameFile,
    getFileUrl,
    downloadFile,
  };
}
