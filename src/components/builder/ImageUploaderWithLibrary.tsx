// =============================================
// IMAGE UPLOADER WITH LIBRARY - Upload or select from Meu Drive
// Refactored to use DriveFilePicker instead of MediaLibraryPicker
// =============================================

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Loader2, X, Check, FolderOpen } from 'lucide-react';
import { useSystemUpload } from '@/hooks/useSystemUpload';
import { DriveFilePicker } from '@/components/ui/DriveFilePicker';
import { cn } from '@/lib/utils';
import type { MediaVariant } from '@/hooks/useMediaLibrary';

interface ImageUploaderWithLibraryProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  variant: MediaVariant;
}

export function ImageUploaderWithLibrary({ 
  value, 
  onChange, 
  placeholder = 'Selecione ou arraste uma imagem',
  aspectRatio = 'video',
  variant,
}: ImageUploaderWithLibraryProps) {
  const { upload, isUploading } = useSystemUpload({ 
    source: `builder_${variant}`,
    subPath: `builder/${variant}`,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value || '');
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[21/9]',
  }[aspectRatio];

  const variantLabel = variant === 'desktop' ? 'Desktop' : 'Mobile';

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5MB');
      return;
    }

    setError(null);

    try {
      const result = await upload(file);
      if (result) {
        onChange(result.publicUrl);
        setUrlInput(result.publicUrl);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro ao fazer upload da imagem');
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

  const handleDriveSelect = (url: string) => {
    onChange(url);
    setUrlInput(url);
    setShowDrivePicker(false);
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="upload" className="text-xs gap-1">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="drive" className="text-xs gap-1">
            <FolderOpen className="h-3 w-3" />
            Meu Drive
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1">
            <Link className="h-3 w-3" />
            URL
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
              accept="image/*"
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
                  PNG, JPG, WEBP até 5MB • {variantLabel}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="drive" className="mt-2">
          <Button
            variant="outline"
            className="w-full h-20 flex-col gap-2"
            onClick={() => setShowDrivePicker(true)}
          >
            <FolderOpen className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm">
              Escolher do Meu Drive ({variantLabel})
            </span>
          </Button>
        </TabsContent>

        <TabsContent value="url" className="mt-2 space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
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
        <div className={cn('relative rounded-md overflow-hidden border bg-muted', aspectRatioClass)}>
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Drive File Picker Modal */}
      <DriveFilePicker
        open={showDrivePicker}
        onOpenChange={setShowDrivePicker}
        accept="image"
        onSelect={handleDriveSelect}
        title={`Selecionar Imagem (${variantLabel})`}
      />
    </div>
  );
}
