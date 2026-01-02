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

// Feature List Item Editor (for FeatureList and ContentColumns blocks)
interface FeatureItem {
  id?: string;
  icon: string;
  text: string;
}

interface FeaturesEditorProps {
  items: FeatureItem[];
  onChange: (items: FeatureItem[]) => void;
}

export function FeaturesEditor({ items = [], onChange }: FeaturesEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { 
      id: crypto.randomUUID(),
      icon: 'Check', 
      text: 'Nova feature' 
    }]);
  };

  const updateItem = (index: number, field: keyof FeatureItem, value: string) => {
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

  // Feature icons - simpler set
  const featureIconOptions = [
    { value: 'Check', label: 'Check' },
    { value: 'CheckCircle', label: 'Check Círculo' },
    { value: 'Star', label: 'Estrela' },
    { value: 'Zap', label: 'Raio' },
    { value: 'Shield', label: 'Escudo' },
    { value: 'Heart', label: 'Coração' },
    { value: 'Award', label: 'Prêmio' },
    { value: 'ThumbsUp', label: 'Joinha' },
    { value: 'Gift', label: 'Presente' },
    { value: 'Truck', label: 'Entrega' },
  ];

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => (
        <Card key={item.id || index} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
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
              <Label className="text-xs">Ícone</Label>
              <Select
                value={item.icon || 'Check'}
                onValueChange={(value) => updateItem(index, 'icon', value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] z-50 bg-popover">
                  {featureIconOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Texto</Label>
              <Input
                value={item.text}
                onChange={(e) => updateItem(index, 'text', e.target.value)}
                placeholder="Descrição da feature"
                className="h-8 text-sm"
              />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar feature
      </Button>
    </div>
  );
}

// Steps Timeline Editor
interface StepItem {
  number: number;
  title: string;
  description: string;
}

interface StepsEditorProps {
  items: StepItem[];
  onChange: (items: StepItem[]) => void;
}

export function StepsEditor({ items = [], onChange }: StepsEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    const nextNumber = safeItems.length + 1;
    onChange([...safeItems, { 
      number: nextNumber,
      title: `Passo ${nextNumber}`, 
      description: 'Descrição do passo' 
    }]);
  };

  const updateItem = (index: number, field: keyof StepItem, value: string | number) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = safeItems.filter((_, i) => i !== index);
    // Renumerar os passos
    const renumbered = newItems.map((item, i) => ({ ...item, number: i + 1 }));
    onChange(renumbered);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeItems.length - 1) return;
    
    const newItems = [...safeItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    // Renumerar
    const renumbered = newItems.map((item, i) => ({ ...item, number: i + 1 }));
    onChange(renumbered);
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => (
        <Card key={index} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span className="text-xs font-bold bg-primary/10 px-2 py-0.5 rounded">{item.number}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(index, 'up')} disabled={index === 0}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(index, 'down')} disabled={index === safeItems.length - 1}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeItem(index)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={item.title} onChange={(e) => updateItem(index, 'title', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)} rows={2} className="text-sm resize-none" />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar passo
      </Button>
    </div>
  );
}

// Stats Numbers Editor
interface StatItem {
  number: string;
  label: string;
}

interface StatsEditorProps {
  items: StatItem[];
  onChange: (items: StatItem[]) => void;
}

export function StatsEditor({ items = [], onChange }: StatsEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { number: '100+', label: 'Nova estatística' }]);
  };

  const updateItem = (index: number, field: keyof StatItem, value: string) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
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
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeItem(index)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Número/Valor</Label>
              <Input value={item.number} onChange={(e) => updateItem(index, 'number', e.target.value)} placeholder="Ex: 10k+" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={item.label} onChange={(e) => updateItem(index, 'label', e.target.value)} placeholder="Ex: Clientes" className="h-8 text-sm" />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar estatística
      </Button>
    </div>
  );
}

// Accordion Items Editor
interface AccordionItem {
  title: string;
  content: string;
}

interface AccordionEditorProps {
  items: AccordionItem[];
  onChange: (items: AccordionItem[]) => void;
}

export function AccordionItemsEditor({ items = [], onChange }: AccordionEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { title: 'Novo item', content: 'Conteúdo do item' }]);
  };

  const updateItem = (index: number, field: keyof AccordionItem, value: string) => {
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
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(index, 'up')} disabled={index === 0}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveItem(index, 'down')} disabled={index === safeItems.length - 1}>
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeItem(index)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={item.title} onChange={(e) => updateItem(index, 'title', e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Conteúdo</Label>
              <Textarea value={item.content} onChange={(e) => updateItem(index, 'content', e.target.value)} rows={2} className="text-sm resize-none" />
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar item
      </Button>
    </div>
  );
}

// Logos Editor
interface LogoItem {
  id?: string;
  imageUrl: string;
  alt: string;
  linkUrl?: string;
}

interface LogosEditorProps {
  items: LogoItem[];
  onChange: (items: LogoItem[]) => void;
}

export function LogosEditor({ items = [], onChange }: LogosEditorProps) {
  const safeItems = Array.isArray(items) ? items : [];

  const addItem = () => {
    onChange([...safeItems, { id: crypto.randomUUID(), imageUrl: '', alt: 'Logo', linkUrl: '' }]);
  };

  const updateItem = (index: number, field: keyof LogoItem, value: string) => {
    const newItems = [...safeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(safeItems.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => (
        <Card key={item.id || index} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeItem(index)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">URL da Imagem</Label>
              <Input value={item.imageUrl} onChange={(e) => updateItem(index, 'imageUrl', e.target.value)} placeholder="https://..." className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Texto Alt</Label>
                <Input value={item.alt} onChange={(e) => updateItem(index, 'alt', e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Link (opcional)</Label>
                <Input value={item.linkUrl || ''} onChange={(e) => updateItem(index, 'linkUrl', e.target.value)} placeholder="https://..." className="h-8 text-sm" />
              </div>
            </div>
          </div>
        </Card>
      ))}
      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addItem}>
        <Plus className="h-3 w-3" />
        Adicionar logo
      </Button>
    </div>
  );
}
