// =============================================
// PROPS EDITOR - Edit block properties
// =============================================

import { BlockDefinition, BlockPropsSchema } from '@/lib/builder/types';
import { getRequiredBlockInfo } from '@/lib/builder/pageContracts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, Copy, Settings2, ChevronDown, Lock } from 'lucide-react';
import { ProductSelector, CategorySelector, MenuSelector, EmailListSelector } from './DynamicSelectors';
import { ProductMultiSelect } from './ProductMultiSelect';
import { CategoryMultiSelect, CategoryItemConfig } from './CategoryMultiSelect';
import { FAQEditor, TestimonialsEditor, InfoHighlightsEditor, FeaturesEditor, StepsEditor, StatsEditor, AccordionItemsEditor, LogosEditor } from './ArrayEditor';
import { BannerSlidesEditor, BannerSlide } from './BannerSlidesEditor';
import { RichTextEditor } from './RichTextEditor';
import { ImageUploader } from './ImageUploader';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
import { VideoUploaderWithLibrary } from './VideoUploaderWithLibrary';
import { VideoCarouselEditor, ImageCarouselEditor, ImageGalleryEditor, ReviewsEditor } from './editors';
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
  pageType?: string;
  blockType?: string;
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
  pageType,
  blockType,
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

  // SYSTEM BLOCKS - Configured via Theme Settings, not via PropsEditor
  // These blocks have configurations in Theme Settings (Páginas section)
  const SYSTEM_BLOCKS = [
    'Header', 
    'Footer', 
    'Cart', 
    'Checkout', 
    'ThankYou',
    'TrackingLookup',
    'BlogListing',
    'AccountHub',
    'OrdersList',
    'OrderDetail',
  ];
  
  const isSystemBlock = SYSTEM_BLOCKS.includes(definition.type);
  
  // Get the redirect message based on block type
  const getSystemBlockRedirect = (type: string): { section: string; description: string } => {
    switch (type) {
      case 'Header':
        return { section: 'Cabeçalho', description: 'Configure menus, busca, atendimento e mais' };
      case 'Footer':
        return { section: 'Rodapé', description: 'Configure colunas, menus e informações' };
      case 'Cart':
        return { section: 'Páginas > Carrinho', description: 'Configure frete, cupom, cross-sell e mais' };
      case 'Checkout':
        return { section: 'Páginas > Checkout', description: 'Configure timeline, order bump, depoimentos' };
      case 'ThankYou':
        return { section: 'Páginas > Obrigado', description: 'Configure upsell e WhatsApp' };
      case 'TrackingLookup':
        return { section: 'Páginas > Rastreio', description: 'Configure formulário de rastreio' };
      case 'BlogListing':
        return { section: 'Páginas > Blog', description: 'Configure listagem de posts' };
      case 'AccountHub':
      case 'OrdersList':
      case 'OrderDetail':
        return { section: 'Páginas > Minha Conta', description: 'Estrutura padrão da área do cliente' };
      default:
        return { section: 'Configurações do tema', description: 'Configure em Configurações do tema' };
    }
  };

  // Special message for system blocks
  if (isSystemBlock) {
    const redirect = getSystemBlockRedirect(definition.type);
    return (
      <div className="h-full flex flex-col border-l">
        {/* Header */}
        <div className="p-2 border-b bg-muted/30">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{definition.icon}</span>
            <div>
              <h3 className="font-semibold text-xs">{definition.label}</h3>
              <p className="text-[10px] text-muted-foreground">Estrutura padrão</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="p-4 bg-muted/30 rounded-lg space-y-3">
            <Settings2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <h4 className="font-medium text-sm">{redirect.section}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {redirect.description}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Clique em <strong className="text-primary">Configurações do tema</strong> no menu esquerdo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-l">
      {/* Header */}
      <div className="p-2 border-b bg-muted/30">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{definition.icon}</span>
          <div>
            <h3 className="font-semibold text-xs">{definition.label}</h3>
            <p className="text-[10px] text-muted-foreground">Propriedades</p>
          </div>
        </div>
      </div>

      {/* Props */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2.5">
          {/* Header Notice Accordion - FIRST, collapsed by default */}
          {isHeaderBlock && noticePropsEntries.length > 0 && (
            <>
              <Collapsible open={noticeOpen} onOpenChange={setNoticeOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📢</span>
                    <span className="font-medium text-xs">Aviso Geral</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    noticeOpen && "rotate-180"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2 pl-2 pr-1 space-y-2 border-l-2 border-muted ml-2 mt-1.5">
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
              <Separator className="my-2" />
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
      <div className="p-2 border-t bg-muted/30">
        {/* Badge de estrutura obrigatória - conforme docs/REGRAS.md 16.7 */}
        {pageType && blockType && !canDelete && (
          <div className="mb-2">
            <Badge variant="secondary" className="w-full justify-center gap-1 py-1">
              <Lock className="h-3 w-3" />
              Estrutura obrigatória
            </Badge>
          </div>
        )}
        
        <div className="flex gap-1">
          {onDuplicate && canDelete && (
            <Button variant="outline" size="sm" className="flex-1 gap-1 h-7 text-xs" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </Button>
          )}
          {onDelete && canDelete && definition.isRemovable !== false && (
            <Button variant="destructive" size="sm" className="flex-1 gap-1 h-7 text-xs" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </Button>
          )}
        </div>
        {(definition.isRemovable === false || !canDelete) && (
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {!canDelete 
              ? `Este bloco faz parte da estrutura da página` 
              : 'Este bloco não pode ser removido'
            }
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
      // InfoHighlights items
      if (blockType === 'InfoHighlights' && name === 'items') {
        return (
          <InfoHighlightsEditor
            items={(value as { id?: string; icon: string; title: string; description?: string }[]) || []}
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
      // FeatureList items
      if (blockType === 'FeatureList' && name === 'items') {
        return (
          <FeaturesEditor
            items={(value as { id?: string; icon: string; text: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // ContentColumns features
      if (blockType === 'ContentColumns' && name === 'features') {
        return (
          <FeaturesEditor
            items={(value as { id?: string; icon: string; text: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // StepsTimeline steps
      if (blockType === 'StepsTimeline' && name === 'steps') {
        return (
          <StepsEditor
            items={(value as { number: number; title: string; description: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // StatsNumbers items
      if (blockType === 'StatsNumbers' && name === 'items') {
        return (
          <StatsEditor
            items={(value as { number: string; label: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // AccordionBlock items
      if (blockType === 'AccordionBlock' && name === 'items') {
        return (
          <AccordionItemsEditor
            items={(value as { title: string; content: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // LogosCarousel logos
      if (blockType === 'LogosCarousel' && name === 'logos') {
        return (
          <LogosEditor
            items={(value as { id?: string; imageUrl: string; alt: string; linkUrl?: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // VideoCarousel videos
      if (blockType === 'VideoCarousel' && name === 'videos') {
        return (
          <VideoCarouselEditor
            items={(value as { id?: string; url?: string; videoDesktop?: string; videoMobile?: string; title?: string; thumbnail?: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // ImageCarousel images
      if (blockType === 'ImageCarousel' && name === 'images') {
        return (
          <ImageCarouselEditor
            items={(value as { id?: string; srcDesktop?: string; srcMobile?: string; alt?: string; caption?: string; linkUrl?: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // ImageGallery images
      if (blockType === 'ImageGallery' && name === 'images') {
        return (
          <ImageGalleryEditor
            items={(value as { id?: string; src: string; alt?: string; caption?: string }[]) || []}
            onChange={onChange}
          />
        );
      }
      // Reviews reviews
      if (blockType === 'Reviews' && name === 'reviews') {
        return (
          <ReviewsEditor
            items={(value as { id?: string; name: string; rating: number; text: string; productName?: string; productUrl?: string; productImage?: string }[]) || []}
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
            className="h-7 text-xs"
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
              className="w-14 h-7 text-xs"
            />
          </div>
        );

      case 'boolean':
        return (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{schema.label}</span>
            <Switch
              checked={Boolean(value)}
              onCheckedChange={onChange}
              className="scale-90"
            />
          </div>
        );

      case 'select':
        return (
          <Select value={value as string} onValueChange={onChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {schema.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'color':
        return (
          <div className="flex items-center gap-1.5">
            <input
              type="color"
              value={(value as string) || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-7 rounded border cursor-pointer"
            />
            <Input
              value={(value as string) || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="flex-1 h-7 font-mono text-xs"
            />
          </div>
        );

      case 'datetime': {
        // Convert ISO string to datetime-local format (YYYY-MM-DDTHH:mm)
        const toDatetimeLocal = (isoString: string) => {
          if (!isoString) return '';
          try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return '';
            // Format: YYYY-MM-DDTHH:mm
            return date.toISOString().slice(0, 16);
          } catch {
            return '';
          }
        };

        // Convert datetime-local value back to ISO string
        const fromDatetimeLocal = (localValue: string) => {
          if (!localValue) return '';
          try {
            const date = new Date(localValue);
            return date.toISOString();
          } catch {
            return '';
          }
        };

        return (
          <div className="space-y-1.5">
            <Input
              type="datetime-local"
              value={toDatetimeLocal((value as string) || '')}
              onChange={(e) => onChange(fromDatetimeLocal(e.target.value))}
              className="h-8 text-xs"
            />
            {schema.helpText && (
              <p className="text-xs text-muted-foreground">{schema.helpText}</p>
            )}
          </div>
        );
      }

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
        // Video upload support - use dedicated video uploader
        const isDesktopField = name.toLowerCase().includes('desktop');
        const isMobileField = name.toLowerCase().includes('mobile');
        const variant = isMobileField ? 'mobile' : 'desktop';
        
        return (
          <div className="space-y-1.5">
            <VideoUploaderWithLibrary
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

      case 'emailList':
        return (
          <EmailListSelector
            value={(value as string) || ''}
            onChange={onChange}
            placeholder={schema.placeholder || 'Selecione uma lista'}
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
            imageDimensions={schema.imageDimensions}
          />
        );

      default:
        return (
          <Input
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 text-xs"
          />
        );
    }
  };

  // Boolean has its own layout with label inside
  if (schema.type === 'boolean') {
    return (
      <div className="py-1.5 border-b border-border/50">
        {renderField()}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium flex items-center gap-1">
        {schema.label}
        {schema.required && <span className="text-destructive">*</span>}
      </Label>
      {renderField()}
    </div>
  );
}
