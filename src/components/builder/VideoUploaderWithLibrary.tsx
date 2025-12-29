// =============================================
// VIDEO UPLOADER WITH LIBRARY - Upload or select videos from media library
// Supports both file upload and YouTube/Vimeo embeds
// =============================================

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Loader2, X, Check, FolderOpen, Video, Youtube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMediaLibrary, MediaVariant } from '@/hooks/useMediaLibrary';
import { cn } from '@/lib/utils';

interface VideoUploaderWithLibraryProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  variant: MediaVariant;
}

const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ACCEPTED_EXTENSIONS = '.mp4,.webm,.mov';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB for videos

// Helper to detect video source type
export function detectVideoType(url: string): 'youtube' | 'vimeo' | 'upload' | 'unknown' {
  if (!url) return 'unknown';
  
  // YouTube patterns
  if (
    url.includes('youtube.com/watch') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/embed/')
  ) {
    return 'youtube';
  }
  
  // Vimeo patterns
  if (url.includes('vimeo.com/') || url.includes('player.vimeo.com/')) {
    return 'vimeo';
  }
  
  // Direct video file
  if (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.mov') ||
    url.includes('/videos/') ||
    url.includes('video/')
  ) {
    return 'upload';
  }
  
  return 'unknown';
}

// Extract YouTube video ID
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Extract Vimeo video ID
export function extractVimeoId(url: string): string | null {
  const patterns = [
    /vimeo\.com\/(?:video\/)?(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

export function VideoUploaderWithLibrary({ 
  value, 
  onChange, 
  placeholder = 'Selecione ou arraste um vídeo',
  variant,
}: VideoUploaderWithLibraryProps) {
  const { currentTenant } = useAuth();
  // Only fetch videos, not images
  const { registerMedia, mediaItems } = useMediaLibrary({ variant, mediaType: 'video' });
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value || '');
  const [showLibrary, setShowLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const variantLabel = variant === 'desktop' ? 'Desktop' : 'Mobile';
  const videoType = detectVideoType(value);

  const handleFileSelect = async (file: File) => {
    if (!currentTenant?.id) {
      setError('Erro: Tenant não encontrado');
      return;
    }

    // Validate file type
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setError('Por favor, selecione um vídeo válido (MP4, WEBM ou MOV)');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError('O vídeo deve ter no máximo 100MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${currentTenant.id}/videos/${variant}/${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Register in media library
      await registerMedia.mutateAsync({
        filePath: fileName,
        fileUrl: publicUrl,
        fileName: file.name,
        variant: variant,
        fileSize: file.size,
        mimeType: file.type,
      });

      onChange(publicUrl);
      setUrlInput(publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro ao fazer upload do vídeo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUrlApply = () => {
    onChange(urlInput);
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
  };

  const handleLibrarySelect = (url: string) => {
    onChange(url);
    setUrlInput(url);
    setShowLibrary(false);
  };

  // Render video preview based on type
  const renderVideoPreview = () => {
    if (!value) return null;

    if (videoType === 'youtube') {
      const videoId = extractYouTubeId(value);
      if (videoId) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
    }

    if (videoType === 'vimeo') {
      const videoId = extractVimeoId(value);
      if (videoId) {
        return (
          <iframe
            src={`https://player.vimeo.com/video/${videoId}`}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        );
      }
    }

    // Direct video file
    return (
      <video
        src={value}
        className="w-full h-full object-cover"
        controls
        muted
        playsInline
        onError={(e) => {
          console.error('Video load error:', e);
        }}
      />
    );
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="upload" className="text-xs gap-1">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="library" className="text-xs gap-1">
            <FolderOpen className="h-3 w-3" />
            Banco
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1">
            <Youtube className="h-3 w-3" />
            Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-2">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
              isDragging && 'border-primary bg-primary/5',
              !isDragging && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
              isUploading && 'pointer-events-none opacity-50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {isUploading ? (
              <div className="py-4">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Enviando...</p>
              </div>
            ) : (
              <div className="py-4">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">{placeholder}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  MP4, WEBM ou MOV até 100MB • {variantLabel}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="library" className="mt-2">
          {!showLibrary ? (
            <Button
              variant="outline"
              className="w-full h-20 flex-col gap-2"
              onClick={() => setShowLibrary(true)}
            >
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm">
                Escolher do banco ({variantLabel})
              </span>
            </Button>
          ) : (
            <div className="border rounded-lg p-3 space-y-3 max-h-[300px] overflow-y-auto">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Vídeos ({variantLabel})</span>
                <Button variant="ghost" size="sm" onClick={() => setShowLibrary(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {mediaItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum vídeo encontrado no banco
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {mediaItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLibrarySelect(item.file_url)}
                      className={cn(
                        'relative aspect-video rounded-md border overflow-hidden hover:ring-2 hover:ring-primary transition-all bg-muted flex items-center justify-center',
                        value === item.file_url && 'ring-2 ring-primary'
                      )}
                    >
                      <Video className="h-8 w-8 text-muted-foreground" />
                      <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate">
                        {item.file_name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="url" className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Cole um link do YouTube, Vimeo ou URL direta de vídeo
          </p>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="h-9 flex-1"
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleUrlApply}
              disabled={!urlInput || urlInput === value}
              className="h-9"
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Preview */}
      {value && (
        <div className="relative rounded-md overflow-hidden border bg-muted aspect-video">
          {renderVideoPreview()}
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 z-10"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
          {videoType !== 'upload' && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
              {videoType === 'youtube' && <Youtube className="h-3 w-3" />}
              {videoType === 'youtube' ? 'YouTube' : videoType === 'vimeo' ? 'Vimeo' : 'Link'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
