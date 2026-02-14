import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link, Loader2, X, Check, FolderOpen } from 'lucide-react';
import { useSystemUpload } from '@/hooks/useSystemUpload';
import { DriveFilePicker } from '@/components/ui/DriveFilePicker';
import { cn } from '@/lib/utils';
import type { DriveFileType } from '@/hooks/useDriveFiles';

export interface UniversalImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  source: string;
  subPath?: string;
  placeholder?: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  showUrlTab?: boolean;
  accept?: DriveFileType;
  maxSize?: number; // in MB
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function UniversalImageUploader({
  value,
  onChange,
  source,
  subPath,
  placeholder = 'Selecione ou arraste uma imagem',
  aspectRatio = 'video',
  showUrlTab = true,
  accept = 'image',
  maxSize = 5,
  disabled = false,
}: UniversalImageUploaderProps) {
  const { upload, isUploading } = useSystemUpload({
    source,
    subPath,
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

  const acceptMime = {
    image: 'image/*',
    video: 'video/*',
    document: '.pdf,.doc,.docx,.xls,.xlsx,.txt',
    all: '*/*',
  }[accept];

  const handleFileSelect = async (file: File) => {
    // Validate file type
    if (accept === 'image' && !file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida');
      return;
    }
    if (accept === 'video' && !file.type.startsWith('video/')) {
      setError('Por favor, selecione um vídeo válido');
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`O arquivo deve ter no máximo ${maxSize}MB`);
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
      setError(err.message || 'Erro ao fazer upload do arquivo');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUrlApply = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
  };

  const handleDriveSelect = (url: string) => {
    onChange(url);
    setUrlInput(url);
  };

  const tabCount = showUrlTab ? 3 : 2;

  return (
    <div className="space-y-3">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className={cn('grid w-full h-9', tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          <TabsTrigger value="upload" className="text-xs gap-1.5" disabled={disabled}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="drive" className="text-xs gap-1.5" disabled={disabled}>
            <FolderOpen className="h-3.5 w-3.5" />
            Meu Drive
          </TabsTrigger>
          {showUrlTab && (
            <TabsTrigger value="url" className="text-xs gap-1.5" disabled={disabled}>
              <Link className="h-3.5 w-3.5" />
              URL
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !disabled && fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              isDragging && 'border-primary bg-primary/5',
              !isDragging && !disabled && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 cursor-pointer',
              (isUploading || disabled) && 'pointer-events-none opacity-50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptMime}
              className="hidden"
              disabled={disabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {isUploading ? (
              <div className="py-2">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                <p className="text-sm text-muted-foreground mt-2">Enviando...</p>
              </div>
            ) : (
              <div className="py-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{placeholder}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Arraste ou clique para selecionar • Máx {maxSize}MB
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="drive" className="mt-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-24 flex-col gap-2"
            onClick={() => setShowDrivePicker(true)}
            disabled={disabled}
          >
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-normal">Escolher do Meu Drive</span>
          </Button>
        </TabsContent>

        {showUrlTab && (
          <TabsContent value="url" className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
                className="h-10 flex-1"
                disabled={disabled}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleUrlApply}
                disabled={!urlInput || urlInput === value || disabled}
                className="h-10 w-10"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole a URL de uma imagem externa
            </p>
          </TabsContent>
        )}
      </Tabs>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Preview */}
      {value && (
        <div className="relative rounded-lg overflow-hidden border bg-muted max-h-[250px]">
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-contain max-h-[250px]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder.svg';
            }}
          />
          {!disabled && (
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Drive Picker Modal */}
      <DriveFilePicker
        open={showDrivePicker}
        onOpenChange={setShowDrivePicker}
        onSelect={handleDriveSelect}
        accept={accept}
        title="Selecionar do Meu Drive"
      />
    </div>
  );
}
