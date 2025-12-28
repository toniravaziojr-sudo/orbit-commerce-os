import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PendingAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  uploadProgress: number;
  storagePath?: string;
  isUploading: boolean;
  error?: string;
}

export function useEmailAttachmentUpload(tenantId: string | undefined) {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    if (!tenantId) {
      toast.error('Tenant não identificado');
      return;
    }

    const fileArray = Array.from(files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    for (const file of fileArray) {
      if (file.size > maxSize) {
        toast.error(`Arquivo ${file.name} excede o limite de 10MB`);
        continue;
      }

      const id = crypto.randomUUID();
      const pending: PendingAttachment = {
        id,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadProgress: 0,
        isUploading: true,
      };

      setAttachments(prev => [...prev, pending]);

      try {
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${tenantId}/${id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('email-attachments')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        setAttachments(prev => 
          prev.map(a => 
            a.id === id 
              ? { ...a, storagePath, uploadProgress: 100, isUploading: false }
              : a
          )
        );
      } catch (error) {
        console.error('Upload error:', error);
        setAttachments(prev => 
          prev.map(a => 
            a.id === id 
              ? { ...a, error: 'Falha no upload', isUploading: false }
              : a
          )
        );
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }
  }, [tenantId]);

  const removeAttachment = useCallback(async (id: string) => {
    const attachment = attachments.find(a => a.id === id);
    
    if (attachment?.storagePath) {
      await supabase.storage
        .from('email-attachments')
        .remove([attachment.storagePath]);
    }

    setAttachments(prev => prev.filter(a => a.id !== id));
  }, [attachments]);

  const clearAll = useCallback(async () => {
    // Remove all uploaded files from storage
    const paths = attachments
      .filter(a => a.storagePath)
      .map(a => a.storagePath!);

    if (paths.length > 0) {
      await supabase.storage
        .from('email-attachments')
        .remove(paths);
    }

    setAttachments([]);
  }, [attachments]);

  const getUploadedAttachments = useCallback(() => {
    return attachments
      .filter(a => a.storagePath && !a.error)
      .map(a => ({
        filename: a.name,
        content_type: a.type,
        size_bytes: a.size,
        storage_path: a.storagePath!,
      }));
  }, [attachments]);

  const hasUploading = attachments.some(a => a.isUploading);
  const hasErrors = attachments.some(a => a.error);

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAll,
    getUploadedAttachments,
    hasUploading,
    hasErrors,
  };
}
