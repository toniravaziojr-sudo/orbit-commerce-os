// =============================================
// BANNER SLIDES EDITOR - UI for editing HeroBanner slides
// =============================================

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, ImageIcon } from 'lucide-react';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
export interface BannerSlide {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  linkUrl?: string;
  altText?: string;
}

interface BannerSlidesEditorProps {
  slides: BannerSlide[];
  onChange: (slides: BannerSlide[]) => void;
}

export function BannerSlidesEditor({ slides = [], onChange }: BannerSlidesEditorProps) {
  const safeSlides = Array.isArray(slides) ? slides : [];

  const generateId = () => `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addSlide = () => {
    onChange([...safeSlides, { 
      id: generateId(),
      imageDesktop: '',
      imageMobile: '',
      linkUrl: '',
      altText: `Banner ${safeSlides.length + 1}`,
    }]);
  };

  const updateSlide = (index: number, field: keyof BannerSlide, value: string) => {
    const newSlides = [...safeSlides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    onChange(newSlides);
  };

  const removeSlide = (index: number) => {
    onChange(safeSlides.filter((_, i) => i !== index));
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeSlides.length - 1) return;
    
    const newSlides = [...safeSlides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    onChange(newSlides);
  };

  return (
    <div className="space-y-3">
      {safeSlides.length === 0 && (
        <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum slide adicionado</p>
          <p className="text-xs">Adicione slides para criar um carrossel</p>
        </div>
      )}
      
      {safeSlides.map((slide, index) => (
        <Card key={slide.id || index} className="p-3 space-y-3">
          {/* Header with controls */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span className="text-xs font-medium">Slide {index + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveSlide(index, 'up')}
                disabled={index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveSlide(index, 'down')}
                disabled={index === safeSlides.length - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeSlide(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Desktop Image */}
          <div className="space-y-1.5">
            <Label className="text-xs">Imagem Desktop</Label>
            <ImageUploaderWithLibrary
              value={slide.imageDesktop || ''}
              onChange={(url) => updateSlide(index, 'imageDesktop', url)}
              placeholder="Imagem principal do banner"
              variant="desktop"
            />
            <p className="text-xs text-muted-foreground">Recomendado: 1920×700px (proporção 21:7)</p>
          </div>

          {/* Mobile Image */}
          <div className="space-y-1.5">
            <Label className="text-xs">Imagem Mobile</Label>
            <ImageUploaderWithLibrary
              value={slide.imageMobile || ''}
              onChange={(url) => updateSlide(index, 'imageMobile', url)}
              placeholder="Opcional - usa Desktop se vazio"
              variant="mobile"
            />
            <p className="text-xs text-muted-foreground">Recomendado: 750×420px (proporção 16:9)</p>
          </div>

          {/* Link URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Link (opcional)</Label>
            <Input
              value={slide.linkUrl || ''}
              onChange={(e) => updateSlide(index, 'linkUrl', e.target.value)}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>

          {/* Alt Text */}
          <div className="space-y-1.5">
            <Label className="text-xs">Texto Alternativo</Label>
            <Input
              value={slide.altText || ''}
              onChange={(e) => updateSlide(index, 'altText', e.target.value)}
              placeholder="Descrição da imagem para acessibilidade"
              className="h-8 text-sm"
            />
          </div>
        </Card>
      ))}
      
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addSlide}>
        <Plus className="h-3 w-3" />
        Adicionar slide
      </Button>
    </div>
  );
}
