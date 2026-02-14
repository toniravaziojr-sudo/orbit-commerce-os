import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { 
  uploadAndRegisterToSystemDrive, 
  SystemUploadResult 
} from '@/lib/uploadAndRegisterToSystemDrive';

interface UseSystemUploadOptions {
  source: string; // e.g., 'storefront_logo', 'category_banner', 'testimonial_image'
  subPath?: string; // e.g., 'branding', 'testimonials', 'products'
  folderId?: string; // Optional: custom folder ID to register file into
}

interface UseSystemUploadResult {
  upload: (file: File, customFilename?: string) => Promise<SystemUploadResult | null>;
  isUploading: boolean;
  error: string | null;
}

/**
 * Hook for uploading files to the system drive with automatic registration.
 * Use this hook in any module that needs to upload assets.
 */
export function useSystemUpload(options: UseSystemUploadOptions): UseSystemUploadResult {
  const { currentTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, customFilename?: string): Promise<SystemUploadResult | null> => {
    if (!currentTenant?.id || !user?.id) {
      setError('Tenant ou usuário não encontrado');
      return null;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadAndRegisterToSystemDrive({
        tenantId: currentTenant.id,
        userId: user.id,
        file,
        source: options.source,
        subPath: options.subPath,
        customFilename,
        folderId: options.folderId,
      });

      if (!result) {
        setError('Erro ao fazer upload do arquivo');
        return null;
      }

      // Invalidate files query to show new file in Drive
      queryClient.invalidateQueries({ queryKey: ['files', currentTenant.id] });

      return result;
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro ao fazer upload do arquivo');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [currentTenant?.id, user?.id, options.source, options.subPath, queryClient]);

  return {
    upload,
    isUploading,
    error,
  };
}
