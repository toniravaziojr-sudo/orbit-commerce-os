// =============================================
// PROPS EDITOR - Edit block properties
// =============================================

import { BlockDefinition, BlockPropsSchema } from '@/lib/builder/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, Copy, Settings2 } from 'lucide-react';
import { ProductSelector, CategorySelector, MenuSelector } from './DynamicSelectors';
import { FAQEditor, TestimonialsEditor } from './ArrayEditor';
import { RichTextEditor } from './RichTextEditor';
import { ImageUploader } from './ImageUploader';

interface PropsEditorProps {
  definition: BlockDefinition;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canDelete?: boolean;
}

export function PropsEditor({
  definition,
  props,
  onChange,
  onDelete,
  onDuplicate,
  canDelete = true,
}: PropsEditorProps) {
  const handleChange = (key: string, value: unknown) => {
    onChange({ ...props, [key]: value });
  };

  const propsEntries = Object.entries(definition.propsSchema);

  return (
    <div className="h-full flex flex-col border-l">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">{definition.icon}</span>
          <div>
            <h3 className="font-semibold text-sm">{definition.label}</h3>
            <p className="text-xs text-muted-foreground">Propriedades do bloco</p>
          </div>
        </div>
      </div>

      {/* Props */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {propsEntries.length > 0 ? (
            propsEntries.map(([key, schema]) => (
              <PropField
                key={key}
                name={key}
                schema={schema}
                value={props[key] ?? schema.defaultValue}
                onChange={(value) => handleChange(key, value)}
                blockType={definition.type}
              />
            ))
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Este bloco não possui propriedades editáveis.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex gap-2">
          {onDuplicate && (
            <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
          )}
          {onDelete && canDelete && definition.isRemovable !== false && (
            <Button variant="destructive" size="sm" className="flex-1 gap-1" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
        {definition.isRemovable === false && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Este bloco não pode ser removido
          </p>
        )}
      </div>
    </div>
  );
}

interface PropFieldProps {
  name: string;
  schema: BlockPropsSchema[string];
  value: unknown;
  onChange: (value: unknown) => void;
  blockType?: string;
}

function PropField({ name, schema, value, onChange, blockType }: PropFieldProps) {
  const renderField = () => {
    // Special handling for array fields based on block type and field name
    if (schema.type === 'array') {
      // FAQ items
      if (blockType === 'FAQ' && name === 'items') {
        return (
          <FAQEditor
            items={(value as { question: string; answer: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // Testimonials items
      if (blockType === 'Testimonials' && name === 'items') {
        return (
          <TestimonialsEditor
            items={(value as { name: string; content: string; role?: string; avatar?: string; rating?: number }[]) || []}
            onChange={onChange}
          />
        );
      }
      // Default array handling (JSON)
      return (
        <Textarea
          value={JSON.stringify(value || [], null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder="[]"
          rows={4}
          className="font-mono text-xs resize-none"
        />
      );
    }
    
    switch (schema.type) {
      case 'string':
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            className="h-9"
          />
        );

      case 'number':
        return (
          <div className="flex items-center gap-3">
            <Slider
              value={[Number(value) || schema.min || 0]}
              onValueChange={([v]) => onChange(v)}
              min={schema.min || 0}
              max={schema.max || 100}
              step={1}
              className="flex-1"
            />
            <Input
              type="number"
              value={value as number}
              onChange={(e) => onChange(Number(e.target.value))}
              min={schema.min}
              max={schema.max}
              className="w-16 h-9"
            />
          </div>
        );

      case 'boolean':
        return (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{schema.label}</span>
            <Switch
              checked={Boolean(value)}
              onCheckedChange={onChange}
            />
          </div>
        );

      case 'select':
        return (
          <Select value={value as string} onValueChange={onChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {schema.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={(value as string) || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-9 rounded border cursor-pointer"
            />
            <Input
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="flex-1 h-9 font-mono text-sm"
            />
          </div>
        );

      case 'image':
        return (
          <ImageUploader
            value={(value as string) || ''}
            onChange={(url) => onChange(url)}
            placeholder="Arraste uma imagem ou clique para selecionar"
          />
        );

      case 'richtext':
        return (
          <RichTextEditor
            value={(value as string) || ''}
            onChange={(val) => onChange(val)}
            placeholder={schema.placeholder}
          />
        );

      // 'array' is handled above before the switch

      case 'product':
        return (
          <ProductSelector
            value={(value as string) || ''}
            onChange={onChange}
            placeholder={schema.placeholder}
          />
        );

      case 'category':
        return (
          <CategorySelector
            value={(value as string) || ''}
            onChange={onChange}
            placeholder={schema.placeholder}
          />
        );

      case 'menu':
        return (
          <MenuSelector
            value={(value as string) || ''}
            onChange={onChange}
            placeholder={schema.placeholder}
          />
        );

      default:
        return (
          <Input
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="h-9"
          />
        );
    }
  };

  // Boolean has its own layout with label inside
  if (schema.type === 'boolean') {
    return (
      <div className="py-2 border-b border-border/50">
        {renderField()}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium flex items-center gap-1">
        {schema.label}
        {schema.required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
    </div>
  );
}
