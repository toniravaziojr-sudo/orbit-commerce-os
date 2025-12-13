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
import { Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react';
import { ProductSelector, CategorySelector, MenuSelector } from './DynamicSelectors';

interface PropsEditorProps {
  definition: BlockDefinition;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canDelete?: boolean;
}

export function PropsEditor({
  definition,
  props,
  onChange,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canDelete = true,
}: PropsEditorProps) {
  const handleChange = (key: string, value: unknown) => {
    onChange({ ...props, [key]: value });
  };

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span>{definition.icon}</span>
              {definition.label}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{definition.type}</p>
          </div>
          <div className="flex gap-1">
            {onMoveUp && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            )}
            {onMoveDown && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {Object.entries(definition.propsSchema).map(([key, schema]) => (
            <PropField
              key={key}
              name={key}
              schema={schema}
              value={props[key] ?? schema.defaultValue}
              onChange={(value) => handleChange(key, value)}
            />
          ))}

          {Object.keys(definition.propsSchema).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Este bloco não possui propriedades editáveis.
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        {onDuplicate && (
          <Button variant="outline" size="sm" className="flex-1" onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-1" />
            Duplicar
          </Button>
        )}
        {onDelete && canDelete && definition.isRemovable !== false && (
          <Button variant="destructive" size="sm" className="flex-1" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Remover
          </Button>
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
}

function PropField({ name, schema, value, onChange }: PropFieldProps) {
  const renderField = () => {
    switch (schema.type) {
      case 'string':
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
          />
        );

      case 'number':
        return (
          <div className="flex items-center gap-2">
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
              className="w-16"
            />
          </div>
        );

      case 'boolean':
        return (
          <Switch
            checked={Boolean(value)}
            onCheckedChange={onChange}
          />
        );

      case 'select':
        return (
          <Select value={value as string} onValueChange={onChange}>
            <SelectTrigger>
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
              className="w-10 h-8 rounded border cursor-pointer"
            />
            <Input
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        );

      case 'image':
        return (
          <div className="space-y-2">
            <Input
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="URL da imagem"
            />
            {value && (
              <div className="relative aspect-video bg-muted rounded overflow-hidden">
                <img
                  src={value as string}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'richtext':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            rows={4}
          />
        );

      case 'array':
        // Simplified array handling - just show as JSON for now
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
            className="font-mono text-xs"
          />
        );

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
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {schema.label}
        {schema.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderField()}
    </div>
  );
}
