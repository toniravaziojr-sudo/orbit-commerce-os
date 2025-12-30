// =============================================
// IMAGE UPLOADER - Upload images for builder blocks
// =============================================

import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Link, Loader2, X, Check, Code } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { 
  getSvgPresetsByCategory, 
  svgToDataUri, 
  type SvgPresetCategory 
} from '@/lib/builder/svg-presets';

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  aspectRatio?: 'square' | 'video' | 'banner';
  /** Categoria para mostrar presets de SVG (só mostra dropdown se houver presets) */
  svgPresetCategory?: SvgPresetCategory;
}

export function ImageUploader({ 
  value, 
  onChange, 
  placeholder = 'Selecione ou arraste uma imagem',
  aspectRatio = 'video',
  svgPresetCategory
}: ImageUploaderProps) {
  const { currentTenant } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(value || '');
  const [svgInput, setSvgInput] = useState('');
  const [showCustomSvg, setShowCustomSvg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar presets SVG para a categoria (se fornecida)
  const svgPresets = useMemo(() => {
    if (!svgPresetCategory) return [];
    return getSvgPresetsByCategory(svgPresetCategory);
  }, [svgPresetCategory]);

  const hasSvgPresets = svgPresets.length > 0;

  const aspectRatioClass = {
    square: 'aspect-square',
    video: 'aspect-video',
    banner: 'aspect-[21/9]',
  }[aspectRatio];

  const handleFileSelect = async (file: File) => {
    if (!currentTenant?.id) {
      setError('Erro: Tenant não encontrado');
      return;
    }

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

    setIsUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant.id}/builder/${Date.now()}.${fileExt}`;

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

      onChange(urlData.publicUrl);
      setUrlInput(urlData.publicUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Erro ao fazer upload da imagem');
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
    setError(null);
    onChange(urlInput);
  };

  const handleSvgApply = () => {
    if (!svgInput.trim()) return;
    
    setError(null);
    
    // Se já é data URI, usar diretamente
    if (svgInput.trim().startsWith('data:image/svg+xml')) {
      onChange(svgInput.trim());
      setSvgInput('');
      return;
    }
    
    // Validar se contém <svg
    if (!svgInput.toLowerCase().includes('<svg')) {
      setError('Código SVG inválido. Deve conter <svg>');
      return;
    }
    
    // Converter para data URI
    try {
      const base64 = btoa(unescape(encodeURIComponent(svgInput.trim())));
      onChange(`data:image/svg+xml;base64,${base64}`);
      setSvgInput('');
    } catch (err) {
      setError('Erro ao processar SVG. Verifique o código.');
    }
  };

  const handleClear = () => {
    onChange('');
    setUrlInput('');
    setSvgInput('');
    setError(null);
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="upload" className="w-full" onValueChange={() => setError(null)}>
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="upload" className="text-xs gap-1">
            <Upload className="h-3 w-3" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1">
            <Link className="h-3 w-3" />
            URL
          </TabsTrigger>
          <TabsTrigger value="svg" className="text-xs gap-1">
            <Code className="h-3 w-3" />
            SVG
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
                <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG, WEBP até 5MB</p>
              </div>
            )}
          </div>
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

        <TabsContent value="svg" className="mt-2 space-y-2">
          {/* Dropdown com presets de SVG - só aparece se houver presets para a categoria */}
          {hasSvgPresets && (
            <Select 
              onValueChange={(presetId) => {
                const preset = svgPresets.find(p => p.id === presetId);
                if (preset) {
                  onChange(svgToDataUri(preset.svg));
                }
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um ícone..." />
              </SelectTrigger>
              <SelectContent>
                {svgPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Botão para mostrar textarea customizado */}
          {!showCustomSvg ? (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setShowCustomSvg(true)}
              className="w-full h-9 text-muted-foreground"
            >
              <Code className="h-4 w-4 mr-2" />
              Adicionar SVG personalizado
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={svgInput}
                onChange={(e) => setSvgInput(e.target.value)}
                placeholder="<svg>...</svg> ou data:image/svg+xml;base64,..."
                className="h-24 text-xs font-mono resize-none"
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => {
                    setShowCustomSvg(false);
                    setSvgInput('');
                  }}
                  className="h-9"
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleSvgApply}
                  disabled={!svgInput.trim()}
                  className="flex-1 h-9"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aplicar SVG
                </Button>
              </div>
            </div>
          )}
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
            className="w-full h-full object-contain"
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
    </div>
  );
}