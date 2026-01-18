// =============================================
// REVIEW MEDIA UPLOADER - Image/Video upload for reviews
// =============================================

import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Video, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReviewMediaUploaderProps {
  mediaUrls: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ACCEPTED_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

export function ReviewMediaUploader({
  mediaUrls,
  onChange,
  maxFiles = 5,
  disabled = false,
}: ReviewMediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed limit
    if (mediaUrls.length + files.length > maxFiles) {
      toast.error(`Máximo de ${maxFiles} arquivos permitidos`);
      return;
    }

    // Validate files
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Tipo de arquivo não suportado: ${file.name}`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo muito grande (máx 10MB): ${file.name}`);
        return;
      }
    }

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const filePath = `reviews/${timestamp}-${randomId}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('review-media')
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('review-media')
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      onChange([...mediaUrls, ...uploadedUrls]);
      toast.success(`${files.length} arquivo(s) enviado(s)`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeMedia = (index: number) => {
    const newUrls = [...mediaUrls];
    newUrls.splice(index, 1);
    onChange(newUrls);
  };

  const isVideo = (url: string) => {
    return url.match(/\.(mp4|webm|mov)$/i);
  };

  return (
    <div className="space-y-3">
      {/* Media Preview Grid */}
      {mediaUrls.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {mediaUrls.map((url, index) => (
            <div key={url} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
              {isVideo(url) ? (
                <video
                  src={url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={url}
                  alt={`Mídia ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeMedia(index)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {isVideo(url) && (
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                  <Video className="h-3 w-3 inline mr-1" />
                  Vídeo
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {!disabled && mediaUrls.length < maxFiles && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <ImagePlus className="h-4 w-4 mr-2" />
                Adicionar fotos ou vídeos
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            JPG, PNG, GIF, MP4, WebM • Máx {maxFiles} arquivos • 10MB cada
          </p>
        </div>
      )}
    </div>
  );
}
