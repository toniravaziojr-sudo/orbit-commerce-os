// =============================================
// REVIEWS EDITOR - Visual editor for customer reviews
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Star } from 'lucide-react';
import { ImageUploaderWithLibrary } from '../ImageUploaderWithLibrary';
import { cn } from '@/lib/utils';

export interface ReviewItem {
  id?: string;
  name: string;
  rating: number;
  text: string;
  productName?: string;
  productUrl?: string;
  productImage?: string;
}

interface ReviewsEditorProps {
  items: ReviewItem[];
  onChange: (items: ReviewItem[]) => void;
}

function StarRating({ rating, onChange }: { rating: number; onChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-0.5 focus:outline-none"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(star)}
        >
          <Star
            className={cn(
              'h-5 w-5 transition-colors',
              star <= (hovered ?? rating)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted-foreground/30'
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ReviewsEditor({ items = [], onChange }: ReviewsEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  const addItem = () => {
    const newIndex = safeItems.length;
    onChange([...safeItems, { 
      id: crypto.randomUUID(),
      name: 'Nome do Cliente',
      rating: 5,
      text: 'Escreva a avaliação aqui...',
      productName: '',
      productUrl: '',
      productImage: '',
    }]);
    setExpandedItems(prev => ({ ...prev, [newIndex]: true }));
  };

  const updateItem = (index: number, field: keyof ReviewItem, value: string | number) => {
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

  const renderStarsPreview = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-3 w-3',
            star <= rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => {
        const isExpanded = expandedItems[index];

        return (
          <Card key={item.id || index} className="overflow-hidden">
            {/* Header */}
            <div 
              className="flex items-center justify-between p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleExpanded(index)}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">#{index + 1}</span>
                <span className="text-xs text-muted-foreground truncate max-w-20">{item.name}</span>
                {renderStarsPreview(item.rating)}
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
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Nome do Cliente</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Avaliação</Label>
                    <StarRating 
                      rating={item.rating} 
                      onChange={(rating) => updateItem(index, 'rating', rating)} 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Texto da Avaliação</Label>
                  <Textarea
                    value={item.text}
                    onChange={(e) => updateItem(index, 'text', e.target.value)}
                    rows={3}
                    className="text-sm resize-none"
                  />
                </div>

                <div className="space-y-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground font-medium">Produto (opcional)</p>
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do Produto</Label>
                    <Input
                      value={item.productName || ''}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                      placeholder="Ex: Camiseta Premium"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Link do Produto</Label>
                    <Input
                      value={item.productUrl || ''}
                      onChange={(e) => updateItem(index, 'productUrl', e.target.value)}
                      placeholder="/produto/camiseta-premium"
                      className="h-8 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Imagem do Produto</Label>
                    <ImageUploaderWithLibrary
                      value={item.productImage || ''}
                      onChange={(url) => updateItem(index, 'productImage', url)}
                      placeholder="Imagem do produto"
                      variant="desktop"
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar avaliação
      </Button>
    </div>
  );
}
