// =============================================
// ARRAY EDITOR - UI for editing array props (FAQ, Testimonials, InfoHighlights, etc.)
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Truck, CreditCard, Shield, Clock, Phone, Gift, Award, ThumbsUp, Star, Heart, Package, Zap, CheckCircle, ShoppingBag, Percent, MapPin, Mail, HelpCircle, Info, AlertCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon options for InfoHighlights
const iconOptions: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'Truck', label: 'Caminhão (Frete)', icon: Truck },
  { value: 'CreditCard', label: 'Cartão (Pagamento)', icon: CreditCard },
  { value: 'Shield', label: 'Escudo (Segurança)', icon: Shield },
  { value: 'Clock', label: 'Relógio (Tempo)', icon: Clock },
  { value: 'Phone', label: 'Telefone', icon: Phone },
  { value: 'Gift', label: 'Presente', icon: Gift },
  { value: 'Award', label: 'Prêmio', icon: Award },
  { value: 'ThumbsUp', label: 'Joinha', icon: ThumbsUp },
  { value: 'Star', label: 'Estrela', icon: Star },
  { value: 'Heart', label: 'Coração', icon: Heart },
  { value: 'Package', label: 'Pacote', icon: Package },
  { value: 'Zap', label: 'Raio', icon: Zap },
  { value: 'CheckCircle', label: 'Check', icon: CheckCircle },
  { value: 'ShoppingBag', label: 'Sacola', icon: ShoppingBag },
  { value: 'Percent', label: 'Porcentagem', icon: Percent },
  { value: 'MapPin', label: 'Localização', icon: MapPin },
  { value: 'Mail', label: 'Email', icon: Mail },
  { value: 'HelpCircle', label: 'Ajuda', icon: HelpCircle },
  { value: 'Info', label: 'Informação', icon: Info },
  { value: 'AlertCircle', label: 'Alerta', icon: AlertCircle },
];

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

// InfoHighlights Item Editor
interface InfoHighlightItem {
  id?: string;
  icon: string;
  title: string;
  description?: string;
}

interface InfoHighlightsEditorProps {
  items: InfoHighlightItem[];
  onChange: (items: InfoHighlightItem[]) => void;
}

export function InfoHighlightsEditor({ items = [], onChange }: InfoHighlightsEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { 
      id: crypto.randomUUID(),
      icon: 'Shield', 
      title: 'Novo destaque', 
      description: 'Descrição aqui...' 
    }]);
  };

  const updateItem = (index: number, field: keyof InfoHighlightItem, value: string) => {
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

  const getIconComponent = (iconName: string) => {
    const found = iconOptions.find(opt => opt.value === iconName);
    return found ? found.icon : Shield;
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => {
        const IconComponent = getIconComponent(item.icon);
        return (
          <Card key={item.id || index} className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <GripVertical className="h-4 w-4" />
                <IconComponent className="h-4 w-4" />
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
                <Label className="text-xs">Ícone</Label>
                <Select
                  value={item.icon}
                  onValueChange={(value) => updateItem(index, 'icon', value)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] z-50 bg-popover">
                    {iconOptions.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{opt.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Título</Label>
                <Input
                  value={item.title}
                  onChange={(e) => updateItem(index, 'title', e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={item.description || ''}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder="Descrição curta (opcional)"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </Card>
        );
      })}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar destaque
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
