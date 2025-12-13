// =============================================
// ARRAY EDITOR - UI for editing array props (FAQ, Testimonials, etc.)
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// FAQ Item Editor
interface FAQItem {
  question: string;
  answer: string;
}

interface FAQEditorProps {
  items: FAQItem[];
  onChange: (items: FAQItem[]) => void;
}

export function FAQEditor({ items = [], onChange }: FAQEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { question: 'Nova pergunta', answer: 'Resposta aqui...' }]);
  };

  const updateItem = (index: number, field: keyof FAQItem, value: string) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeItems.length - 1) return;
    
    const newItems = [...safeItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => (
        <Card key={index} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span className="text-xs font-medium">#{index + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveItem(index, 'down')}
                disabled={index === safeItems.length - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Pergunta</Label>
              <Input
                value={item.question}
                onChange={(e) => updateItem(index, 'question', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Resposta</Label>
              <Textarea
                value={item.answer}
                onChange={(e) => updateItem(index, 'answer', e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar pergunta
      </Button>
    </div>
  );
}

// Testimonial Item Editor
interface TestimonialItem {
  name: string;
  role?: string;
  content: string;
  avatar?: string;
  rating?: number;
}

interface TestimonialsEditorProps {
  items: TestimonialItem[];
  onChange: (items: TestimonialItem[]) => void;
}

export function TestimonialsEditor({ items = [], onChange }: TestimonialsEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { name: 'Nome', role: 'Cliente', content: 'Depoimento aqui...', rating: 5 }]);
  };

  const updateItem = (index: number, field: keyof TestimonialItem, value: string | number) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeItems.length - 1) return;
    
    const newItems = [...safeItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => (
        <Card key={index} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span className="text-xs font-medium">#{index + 1}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveItem(index, 'up')}
                disabled={index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveItem(index, 'down')}
                disabled={index === safeItems.length - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Cargo/Função</Label>
              <Input
                value={item.role || ''}
                onChange={(e) => updateItem(index, 'role', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Depoimento</Label>
            <Textarea
              value={item.content}
              onChange={(e) => updateItem(index, 'content', e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Avatar (URL)</Label>
              <Input
                value={item.avatar || ''}
                onChange={(e) => updateItem(index, 'avatar', e.target.value)}
                placeholder="URL da imagem"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Avaliação (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={item.rating || 5}
                onChange={(e) => updateItem(index, 'rating', Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar depoimento
      </Button>
    </div>
  );
}
