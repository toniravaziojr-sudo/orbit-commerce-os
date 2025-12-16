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
import { Trash2, Copy, Settings2, ChevronDown } from 'lucide-react';
import { ProductSelector, CategorySelector, MenuSelector } from './DynamicSelectors';
import { ProductMultiSelect } from './ProductMultiSelect';
import { CategoryMultiSelect, CategoryItemConfig } from './CategoryMultiSelect';
import { FAQEditor, TestimonialsEditor } from './ArrayEditor';
import { BannerSlidesEditor, BannerSlide } from './BannerSlidesEditor';
import { RichTextEditor } from './RichTextEditor';
import { ImageUploader } from './ImageUploader';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PropsEditorProps {
  definition: BlockDefinition;
  props: Record<string, unknown>;
  onChange: (props: Record<string, unknown>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  canDelete?: boolean;
}

// Define which props belong to the Header notice group
const HEADER_NOTICE_PROPS = [
  'noticeEnabled',
  'noticeText',
  'noticeBgColor',
  'noticeTextColor',
  'noticeAnimation',
  'noticeActionEnabled',
  'noticeActionType',
  'noticeActionLabel',
  'noticeActionUrl',
  'noticeActionTarget',
  'noticeActionTextColor',
];

export function PropsEditor({
  definition,
  props,
  onChange,
  onDelete,
  onDuplicate,
  canDelete = true,
}: PropsEditorProps) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  
  const handleChange = (key: string, value: unknown) => {
    onChange({ ...props, [key]: value });
  };

  const propsEntries = Object.entries(definition.propsSchema);
  
  // For Header block, separate notice props from other props
  const isHeaderBlock = definition.type === 'Header';
  const noticePropsEntries = isHeaderBlock 
    ? propsEntries.filter(([key]) => HEADER_NOTICE_PROPS.includes(key))
    : [];
  const otherPropsEntries = isHeaderBlock
    ? propsEntries.filter(([key]) => !HEADER_NOTICE_PROPS.includes(key))
    : propsEntries;

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
          {/* Header Notice Accordion - FIRST, collapsed by default */}
          {isHeaderBlock && noticePropsEntries.length > 0 && (
            <>
              <Collapsible open={noticeOpen} onOpenChange={setNoticeOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📢</span>
                    <span className="font-medium text-sm">Aviso Geral</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    noticeOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 pl-3 pr-1 space-y-4 border-l-2 border-muted ml-2 mt-2">
                  {noticePropsEntries.map(([key, schema]) => (
                    <PropField
                      key={key}
                      name={key}
                      schema={schema}
                      value={props[key] ?? schema.defaultValue}
                      onChange={(value) => handleChange(key, value)}
                      blockType={definition.type}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
              <Separator className="my-4" />
            </>
          )}
          
          {/* Header main props - AFTER the accordion */}
          {otherPropsEntries.length > 0 ? (
            otherPropsEntries.map(([key, schema]) => {
              // Check showWhen condition
              if (schema.showWhen) {
                const shouldShow = Object.entries(schema.showWhen).every(
                  ([propKey, expectedValue]) => props[propKey] === expectedValue
                );
                if (!shouldShow) return null;
              }
              return (
                <PropField
                  key={key}
                  name={key}
                  schema={schema}
                  value={props[key] ?? schema.defaultValue}
                  onChange={(value) => handleChange(key, value)}
                  blockType={definition.type}
                  allProps={props}
                />
              );
            })
          ) : !isHeaderBlock && (
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
  allProps?: Record<string, unknown>;
}

function PropField({ name, schema, value, onChange, blockType, allProps }: PropFieldProps) {
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
      // HeroBanner slides
      if (blockType === 'HeroBanner' && name === 'slides') {
        return (
          <BannerSlidesEditor
            slides={(value as BannerSlide[]) || []}
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

      case 'image': {
        // Check if field name indicates desktop or mobile variant
        const isDesktopField = name.toLowerCase().includes('desktop');
        const isMobileField = name.toLowerCase().includes('mobile');
        const variant = isMobileField ? 'mobile' : 'desktop';
        
        // Use ImageUploaderWithLibrary for desktop/mobile image fields
        if (isDesktopField || isMobileField) {
          return (
            <div className="space-y-1.5">
              <ImageUploaderWithLibrary
                value={(value as string) || ''}
                onChange={(url) => onChange(url)}
                placeholder={`Imagem ${variant === 'desktop' ? 'Desktop' : 'Mobile'}`}
                variant={variant}
              />
              {schema.helpText && (
                <p className="text-xs text-muted-foreground">{schema.helpText}</p>
              )}
            </div>
          );
        }
        
        // Default image uploader for other image fields
        return (
          <div className="space-y-1.5">
            <ImageUploader
              value={(value as string) || ''}
              onChange={(url) => onChange(url)}
              placeholder="Arraste uma imagem ou clique para selecionar"
            />
            {schema.helpText && (
              <p className="text-xs text-muted-foreground">{schema.helpText}</p>
            )}
          </div>
        );
      }

      case 'video': {
        // Video upload support - reuse image uploader with library
        const isDesktopField = name.toLowerCase().includes('desktop');
        const isMobileField = name.toLowerCase().includes('mobile');
        const variant = isMobileField ? 'mobile' : 'desktop';
        
        return (
          <div className="space-y-1.5">
            <ImageUploaderWithLibrary
              value={(value as string) || ''}
              onChange={(url) => onChange(url)}
              placeholder={`Vídeo ${variant === 'desktop' ? 'Desktop' : 'Mobile'}`}
              variant={variant}
            />
            {schema.helpText && (
              <p className="text-xs text-muted-foreground">{schema.helpText}</p>
            )}
          </div>
        );
      }

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

      case 'textarea':
        return (
          <Textarea
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            rows={4}
            className="resize-none"
          />
        );

      case 'productMultiSelect':
        return (
          <ProductMultiSelect
            value={Array.isArray(value) ? value : []}
            onChange={(ids) => onChange(ids)}
            maxItems={schema.max || 12}
          />
        );

      case 'categoryMultiSelect':
        return (
          <CategoryMultiSelect
            value={Array.isArray(value) ? value : []}
            onChange={(items) => onChange(items)}
            maxItems={schema.max || 12}
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
