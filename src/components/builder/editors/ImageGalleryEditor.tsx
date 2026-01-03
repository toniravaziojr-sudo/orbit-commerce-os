// =============================================
// IMAGE GALLERY EDITOR - Visual editor for gallery images
// =============================================

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import { ImageUploaderWithLibrary } from '../ImageUploaderWithLibrary';

export interface GalleryImageItem {
  id?: string;
  src: string;
  alt?: string;
  caption?: string;
}

interface ImageGalleryEditorProps {
  items: GalleryImageItem[];
  onChange: (items: GalleryImageItem[]) => void;
}

export function ImageGalleryEditor({ items = [], onChange }: ImageGalleryEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { 
      id: crypto.randomUUID(),
      src: '',
      alt: '',
      caption: '',
    }]);
  };

  const updateItem = (index: number, field: keyof GalleryImageItem, value: string) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {safeItems.map((item, index) => (
          <Card key={item.id || index} className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            
            {/* Image preview or uploader */}
            <div className="aspect-square relative rounded overflow-hidden bg-muted">
              {item.src ? (
                <img src={item.src} alt={item.alt || ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
            </div>

            <ImageUploaderWithLibrary
              value={item.src || ''}
              onChange={(url) => updateItem(index, 'src', url)}
              placeholder="Selecionar imagem"
              variant="desktop"
            />

            <div className="space-y-1">
              <Input
                value={item.alt || ''}
                onChange={(e) => updateItem(index, 'alt', e.target.value)}
                placeholder="Texto alt"
                className="h-7 text-xs"
              />
              <Input
                value={item.caption || ''}
                onChange={(e) => updateItem(index, 'caption', e.target.value)}
                placeholder="Legenda (opcional)"
                className="h-7 text-xs"
              />
            </div>
          </Card>
        ))}
      </div>
      
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar imagem
      </Button>
    </div>
  );
}
