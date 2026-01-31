import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DriveFilePicker } from '@/components/ui/DriveFilePicker';

interface ImageUploadProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onUpload: (file: File) => Promise<string | null>;
  accept?: string;
  className?: string;
  description?: string;
  disabled?: boolean;
}

export function ImageUpload({
  label,
  value,
  onChange,
  onUpload,
  accept = 'image/png,image/jpeg,image/webp',
  className,
  description,
  disabled = false,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    
    // Validar tipo
    const validTypes = accept.split(',').map(t => t.trim());
    if (!validTypes.some(t => file.type === t || file.type.startsWith(t.replace('*', '')))) {
      return;
    }
    
    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }
    
    setIsUploading(true);
    try {
      const url = await onUpload(file);
      // IMPORTANT: Call onChange with the new URL to update UI immediately
      // The upload handler saves to DB, but we need to update local state too
      if (url) {
        onChange(url);
      }
    } finally {
      setIsUploading(false);
      // Reset input to allow re-uploading same file
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDriveSelect = (url: string) => {
    onChange(url);
    setDrivePickerOpen(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          isUploading && 'opacity-50 pointer-events-none',
          disabled && 'opacity-60 pointer-events-none bg-muted/30'
        )}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
      >
        {value ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                <img
                  src={`${value}${value.includes('?') ? '&' : '?'}v=${Date.now()}`}
                  alt={label}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">Imagem carregada</p>
              </div>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemove}
                  className="shrink-0"
                  title="Remover imagem"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {/* Botões de substituição quando há imagem */}
            {!disabled && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Substituir
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDrivePickerOpen(true)}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Meu Drive
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4">
            {isUploading ? (
              <div className="animate-pulse">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {disabled ? 'Clique em "Editar configurações" para alterar' : 'Arraste uma imagem ou clique para selecionar'}
                </p>
                {!disabled && (
                  <div className="flex gap-2 flex-wrap justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDrivePickerOpen(true)}
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Meu Drive
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      
      <Input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Drive File Picker */}
      <DriveFilePicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onSelect={handleDriveSelect}
        accept="image"
        title="Selecionar Imagem do Meu Drive"
      />
    </div>
  );
}
