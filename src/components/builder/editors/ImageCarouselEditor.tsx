// =============================================
// IMAGE CAROUSEL EDITOR - Visual editor for image carousel items
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Image as ImageIcon } from 'lucide-react';
import { ImageUploaderWithLibrary } from '../ImageUploaderWithLibrary';

export interface ImageCarouselItem {
  id?: string;
  srcDesktop?: string;
  srcMobile?: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
}

interface ImageCarouselEditorProps {
  items: ImageCarouselItem[];
  onChange: (items: ImageCarouselItem[]) => void;
}

export function ImageCarouselEditor({ items = [], onChange }: ImageCarouselEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const addItem = () => {
    const newIndex = safeItems.length;
    onChange([...safeItems, { 
      id: crypto.randomUUID(),
      srcDesktop: '',
      srcMobile: '',
      alt: '',
      caption: '',
      linkUrl: '',
    }]);
    setExpandedItems(prev => ({ ...prev, [newIndex]: true }));
  };

  const updateItem = (index: number, field: keyof ImageCarouselItem, value: string) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
    const newExpanded = { ...expandedItems };
    delete newExpanded[index];
    setExpandedItems(newExpanded);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeItems.length - 1) return;
    
    const newItems = [...safeItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => {
        const isExpanded = expandedItems[index];
        const previewImage = item.srcDesktop || item.srcMobile;

        return (
          <Card key={item.id || index} className="overflow-hidden">
            {/* Header */}
            <div 
              className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(index)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                {previewImage ? (
                  <img src={previewImage} alt="" className="w-10 h-6 object-cover rounded" />
                ) : (
                  <div className="w-10 h-6 bg-muted rounded flex items-center justify-center">
                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium">#{index + 1}</span>
                {item.alt && (
                  <span className="text-xs text-muted-foreground truncate max-w-24">• {item.alt}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'up'); }}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveItem(index, 'down'); }}
                  disabled={index === safeItems.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {isExpanded && (
              <div className="p-3 space-y-4 border-t">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imagem Desktop</Label>
                    <ImageUploaderWithLibrary
                      value={item.srcDesktop || ''}
                      onChange={(url) => updateItem(index, 'srcDesktop', url)}
                      placeholder="Desktop"
                      variant="desktop"
                    />
                    <p className="text-[10px] text-muted-foreground">Rec: 1920×800px</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imagem Mobile</Label>
                    <ImageUploaderWithLibrary
                      value={item.srcMobile || ''}
                      onChange={(url) => updateItem(index, 'srcMobile', url)}
                      placeholder="Mobile"
                      variant="mobile"
                    />
                    <p className="text-[10px] text-muted-foreground">Rec: 768×600px</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Texto alternativo (alt)</Label>
                  <Input
                    value={item.alt || ''}
                    onChange={(e) => updateItem(index, 'alt', e.target.value)}
                    placeholder="Descrição da imagem para acessibilidade"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Legenda (opcional)</Label>
                  <Input
                    value={item.caption || ''}
                    onChange={(e) => updateItem(index, 'caption', e.target.value)}
                    placeholder="Texto exibido sobre a imagem"
                    className="h-8 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Link (opcional)</Label>
                  <Input
                    value={item.linkUrl || ''}
                    onChange={(e) => updateItem(index, 'linkUrl', e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </Card>
        );
      })}
      
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar imagem
      </Button>
    </div>
  );
}
