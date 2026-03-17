// =============================================
// BANNER SLIDES EDITOR — Expanded with CTA + refinements per slide
// Phase 1: Accordion per slide, internal collapsibles, per-slide style
// Phase 4.2: Per-slide AI generation button
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical, ImageIcon, ChevronRight, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
import { cn } from '@/lib/utils';
import { getSlideWizardContract } from '@/lib/builder/aiWizardRegistry';
import { AIFillWizardDialog } from './ai-wizard/AIFillWizardDialog';

export interface BannerSlide {
  id: string;
  imageDesktop: string;
  imageMobile: string;
  linkUrl?: string;
  altText?: string;
  // CTA per slide
  hasEditableContent?: boolean;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  // Style per slide
  overlayOpacity?: number;
  textColor?: string;
  alignment?: string;
  buttonAlignment?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonHoverBgColor?: string;
  buttonHoverTextColor?: string;
  // AI regeneration config (hidden)
  _lastSlideWizardConfig?: Record<string, unknown>;
}

interface BannerSlidesEditorProps {
  slides: BannerSlide[];
  onChange: (slides: BannerSlide[]) => void;
  tenantId?: string;
  /** Signal regeneration state. When finishing (false), pass finalSlides to batch the update atomically. */
  onRegeneratingChange?: (isRegenerating: boolean, finalSlides?: BannerSlide[]) => void;
}

export function BannerSlidesEditor({ slides = [], onChange, tenantId, onRegeneratingChange }: BannerSlidesEditorProps) {
  const safeSlides = Array.isArray(slides) ? slides : [];
  // Only 1 slide expanded at a time
  const [expandedSlide, setExpandedSlide] = useState<number | null>(null);
  // Per-slide AI wizard
  const [aiWizardSlideIndex, setAiWizardSlideIndex] = useState<number | null>(null);
  // Per-slide regeneration loading
  const [regeneratingSlide, setRegeneratingSlide] = useState<number | null>(null);

  const singleSlideContract = getSlideWizardContract();

  const generateId = () => `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addSlide = () => {
    const newIndex = safeSlides.length;
    onChange([...safeSlides, {
      id: generateId(),
      imageDesktop: '',
      imageMobile: '',
      linkUrl: '',
      altText: `Banner ${safeSlides.length + 1}`,
      hasEditableContent: false,
    }]);
    setExpandedSlide(newIndex);
  };

  const updateSlide = (index: number, field: keyof BannerSlide, value: unknown) => {
    const newSlides = [...safeSlides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    onChange(newSlides);
  };

  const removeSlide = (index: number) => {
    onChange(safeSlides.filter((_, i) => i !== index));
    if (expandedSlide === index) setExpandedSlide(null);
    else if (expandedSlide !== null && expandedSlide > index) setExpandedSlide(expandedSlide - 1);
  };

  const moveSlide = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === safeSlides.length - 1) return;

    const newSlides = [...safeSlides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    onChange(newSlides);

    // Follow the expanded slide
    if (expandedSlide === index) setExpandedSlide(targetIndex);
    else if (expandedSlide === targetIndex) setExpandedSlide(index);
  };

  const toggleSlide = (index: number) => {
    setExpandedSlide(expandedSlide === index ? null : index);
  };

  // Handle per-slide AI generation result — also saves wizard config for regeneration
  const handleSlideAIGenerated = (mergedProps: Record<string, unknown>) => {
    if (aiWizardSlideIndex === null) return;
    const idx = aiWizardSlideIndex;
    const newSlides = [...safeSlides];
    const current: BannerSlide = newSlides[idx] || { id: '', imageDesktop: '', imageMobile: '' };
    
    newSlides[idx] = {
      ...current,
      imageDesktop: (mergedProps.imageDesktop as string) || current.imageDesktop,
      imageMobile: (mergedProps.imageMobile as string) || current.imageMobile,
      title: mergedProps.title !== undefined ? (mergedProps.title as string) : current.title,
      subtitle: mergedProps.subtitle !== undefined ? (mergedProps.subtitle as string) : current.subtitle,
      buttonText: mergedProps.buttonText !== undefined ? (mergedProps.buttonText as string) : current.buttonText,
      altText: mergedProps.altText !== undefined ? (mergedProps.altText as string) : current.altText,
      linkUrl: mergedProps.linkUrl !== undefined ? (mergedProps.linkUrl as string) : current.linkUrl,
      // Save wizard config for regeneration
      _lastSlideWizardConfig: mergedProps._lastWizardConfig as Record<string, unknown> || undefined,
    };
    
    // If AI set hasEditableContent via content presence
    if (mergedProps.title || mergedProps.buttonText) {
      newSlides[idx].hasEditableContent = true;
    }
    
    onChange(newSlides);
    setAiWizardSlideIndex(null);
  };

  // Regenerate a single slide using saved wizard config
  const handleSlideRegenerate = async (index: number) => {
    const slide = safeSlides[index];
    const config = slide?._lastSlideWizardConfig as any;
    if (!config || !tenantId || regeneratingSlide !== null) return;

    setRegeneratingSlide(index);
    onRegeneratingChange?.(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { toast } = await import('sonner');

      const backendData = { ...config.collectedData };
      const mode = config.mode;
      const scope = config.scope || 'all';

      // Same remapping as useAIWizardGenerate
      const creativeStyleData = backendData.creativeStyle as any;
      if (creativeStyleData && backendData.bannerMode) {
        const modeDataForStyle = backendData.bannerMode as Record<string, unknown>;
        modeDataForStyle.creativeStyle = creativeStyleData.creativeStyle || 'product_natural';
        modeDataForStyle.styleConfig = creativeStyleData.styleConfig || {};
      }

      const { data, error } = await supabase.functions.invoke('ai-block-fill-visual', {
        body: { tenantId, blockType: config.blockType || 'Banner', mode, scope, collectedData: backendData },
      });

      if (error || !data?.success || !data?.generatedProps) {
        toast.error('Erro ao regenerar slide', { description: data?.error || 'Tente novamente' });
        return;
      }

      const gen = data.generatedProps;
      const newSlides = [...safeSlides];
      const current = newSlides[index];

      newSlides[index] = {
        ...current,
        imageDesktop: gen.imageDesktop || current.imageDesktop,
        imageMobile: gen.imageMobile || current.imageMobile,
        title: gen.title !== undefined ? gen.title : '',
        subtitle: gen.subtitle !== undefined ? gen.subtitle : '',
        buttonText: gen.buttonText !== undefined ? gen.buttonText : '',
        altText: gen.altText !== undefined ? gen.altText : current.altText,
        // Update wizard config timestamp
        _lastSlideWizardConfig: { ...config, timestamp: Date.now() },
      };

      if (gen.title || gen.buttonText) {
        newSlides[index].hasEditableContent = true;
      }

      onChange(newSlides);
      toast.success('Slide regenerado ✨');
    } catch (err) {
      console.error('[SlideRegenerate] Error:', err);
      const { toast } = await import('sonner');
      toast.error('Erro ao regenerar slide');
    } finally {
      setRegeneratingSlide(null);
      onRegeneratingChange?.(false);
    }
  };

  return (
    <div className="space-y-2 pr-5">
      {safeSlides.length === 0 && (
        <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg">
          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum slide adicionado</p>
          <p className="text-xs">Adicione slides para criar um carrossel</p>
        </div>
      )}

      {safeSlides.map((slide, index) => {
        const isExpanded = expandedSlide === index;
        const previewImage = slide.imageDesktop || slide.imageMobile;
        // Infer hasEditableContent for old slides
        const hasEditable = slide.hasEditableContent !== undefined
          ? Boolean(slide.hasEditableContent)
          : !!(slide.title || slide.buttonText);

        return (
          <Card key={slide.id || index} className="overflow-hidden">
            {/* Slide header — click to expand/collapse */}
            <div
              className={cn(
                "flex items-center justify-between pl-2.5 pr-4 py-2.5 cursor-pointer transition-colors",
                isExpanded ? "bg-muted/50" : "hover:bg-muted/30"
              )}
              onClick={() => toggleSlide(index)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                {previewImage ? (
                  <img src={previewImage} alt="" className="w-10 h-6 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-10 h-6 bg-muted rounded flex items-center justify-center shrink-0">
                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs font-medium shrink-0">Slide {index + 1}</span>
                {slide.altText && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-20">• {slide.altText}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {/* Per-slide AI generation button */}
                {tenantId && singleSlideContract && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-primary hover:text-primary"
                    title="Gerar com IA"
                    disabled={regeneratingSlide !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAiWizardSlideIndex(index);
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                  </Button>
                )}
                {/* Per-slide regenerate button — only after first AI generation */}
                {tenantId && slide._lastSlideWizardConfig && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-primary hover:text-primary"
                    title="Regenerar com mesmas configurações"
                    disabled={regeneratingSlide !== null}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSlideRegenerate(index);
                    }}
                  >
                    {regeneratingSlide === index ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveSlide(index, 'up'); }}
                  disabled={index === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); moveSlide(index, 'down'); }}
                  disabled={index === safeSlides.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeSlide(index); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-90"
                )} />
              </div>
            </div>

            {/* Slide content — internal sections */}
            {isExpanded && (
              <div className="border-t p-2.5 pr-5 space-y-2">
                <SlideConfigSection slide={slide} index={index} hasEditable={hasEditable} onUpdate={updateSlide} />
                <SlideImagesSection slide={slide} index={index} onUpdate={updateSlide} defaultOpen={true} />
                <SlideRefinementsSection slide={slide} index={index} hasEditable={hasEditable} onUpdate={updateSlide} />
              </div>
            )}
          </Card>
        );
      })}

      <Button variant="outline" size="sm" className="w-full gap-1" onClick={addSlide}>
        <Plus className="h-3 w-3" />
        Adicionar slide
      </Button>

      {/* Per-slide AI Wizard Dialog — dedicated slide contract (no mode select) */}
      {tenantId && aiWizardSlideIndex !== null && (
        <AIFillWizardDialog
          open={true}
          onOpenChange={(open) => { if (!open) setAiWizardSlideIndex(null); }}
          contract={singleSlideContract}
          blockType="Banner"
          blockLabel={`Slide ${aiWizardSlideIndex + 1}`}
          currentProps={safeSlides[aiWizardSlideIndex] ? {
            imageDesktop: safeSlides[aiWizardSlideIndex].imageDesktop,
            imageMobile: safeSlides[aiWizardSlideIndex].imageMobile,
            title: safeSlides[aiWizardSlideIndex].title,
            subtitle: safeSlides[aiWizardSlideIndex].subtitle,
            buttonText: safeSlides[aiWizardSlideIndex].buttonText,
            linkUrl: safeSlides[aiWizardSlideIndex].linkUrl,
            altText: safeSlides[aiWizardSlideIndex].altText,
          } : {}}
          tenantId={tenantId}
          onGenerated={handleSlideAIGenerated}
        />
      )}
    </div>
  );
}

// ===== Internal section components =====

function SubSection({
  icon, label, defaultOpen = false, children,
}: { icon: string; label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-1.5 rounded bg-muted/40 hover:bg-muted/60 transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{icon}</span>
          <span className="font-medium text-[11px]">{label}</span>
        </div>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-2 pr-2 space-y-2 border-l border-muted ml-1.5 mt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SlideConfigSection({ slide, index, hasEditable, onUpdate }: {
  slide: BannerSlide; index: number; hasEditable: boolean;
  onUpdate: (i: number, field: keyof BannerSlide, value: unknown) => void;
}) {
  return (
    <SubSection icon="⚙️" label="Configurações" defaultOpen={true}>
      <div className="flex items-center justify-between py-1 pr-0">
        <span className="text-xs text-muted-foreground">Conteúdo editável</span>
        <Switch checked={hasEditable} onCheckedChange={v => onUpdate(index, 'hasEditableContent', v)} className="scale-90" />
      </div>

      {hasEditable && (
        <div className="space-y-2 pt-1">
          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Título</Label>
            <Input value={slide.title || ''} onChange={e => onUpdate(index, 'title', e.target.value)} placeholder="Texto principal" className="h-7 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Subtítulo</Label>
            <Input value={slide.subtitle || ''} onChange={e => onUpdate(index, 'subtitle', e.target.value)} placeholder="Texto secundário" className="h-7 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Texto do Botão</Label>
            <Input value={slide.buttonText || ''} onChange={e => onUpdate(index, 'buttonText', e.target.value)} placeholder="Ex: Ver Produtos" className="h-7 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-medium">Link do Botão</Label>
            <Input value={slide.buttonUrl || ''} onChange={e => onUpdate(index, 'buttonUrl', e.target.value)} placeholder="/produtos" className="h-7 text-xs" />
          </div>
        </div>
      )}
    </SubSection>
  );
}

function SlideImagesSection({ slide, index, onUpdate, defaultOpen = false }: {
  slide: BannerSlide; index: number;
  onUpdate: (i: number, field: keyof BannerSlide, value: unknown) => void;
  defaultOpen?: boolean;
}) {
  return (
    <SubSection icon="🖼️" label="Imagens" defaultOpen={defaultOpen}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Desktop</Label>
          <ImageUploaderWithLibrary
            value={slide.imageDesktop || ''}
            onChange={url => onUpdate(index, 'imageDesktop', url)}
            placeholder="Imagem principal"
            variant="desktop"
          />
          <p className="text-[10px] text-muted-foreground">Rec: 1920×800px (12:5)</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mobile</Label>
          <ImageUploaderWithLibrary
            value={slide.imageMobile || ''}
            onChange={url => onUpdate(index, 'imageMobile', url)}
            placeholder="Opcional — usa Desktop se vazio"
            variant="mobile"
          />
          <p className="text-[10px] text-muted-foreground">Rec: 750×940px (4:5)</p>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-medium">Texto Alternativo</Label>
          <Input value={slide.altText || ''} onChange={e => onUpdate(index, 'altText', e.target.value)} placeholder="Descrição para acessibilidade" className="h-7 text-xs" />
        </div>
      </div>
    </SubSection>
  );
}

function SlideRefinementsSection({ slide, index, hasEditable, onUpdate }: {
  slide: BannerSlide; index: number; hasEditable: boolean;
  onUpdate: (i: number, field: keyof BannerSlide, value: unknown) => void;
}) {
  return (
    <SubSection icon="🎨" label="Refinamentos">
      {hasEditable && (
        <div className="space-y-1">
          <Label className="text-[10px] font-medium">Cor do Texto</Label>
          <div className="flex items-center gap-1.5">
            <input type="color" value={slide.textColor || '#ffffff'} onChange={e => onUpdate(index, 'textColor', e.target.value)} className="w-8 h-7 rounded border cursor-pointer" />
            <Input value={slide.textColor || ''} onChange={e => onUpdate(index, 'textColor', e.target.value)} placeholder="#ffffff" className="flex-1 h-7 font-mono text-xs" />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10px] font-medium">Escurecimento (%)</Label>
        <div className="flex items-center gap-2">
          <Slider value={[Number(slide.overlayOpacity) || 0]} onValueChange={([v]) => onUpdate(index, 'overlayOpacity', v)} min={0} max={100} step={1} className="flex-1" />
          <Input type="number" value={Number(slide.overlayOpacity) || 0} onChange={e => onUpdate(index, 'overlayOpacity', Number(e.target.value))} min={0} max={100} className="w-14 h-7 text-xs" />
        </div>
      </div>

      {hasEditable && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Botão</p>
          <ColorInline label="Cor de Fundo" value={slide.buttonColor || '#ffffff'} onChange={v => onUpdate(index, 'buttonColor', v)} />
          <ColorInline label="Cor do Texto" value={slide.buttonTextColor || ''} onChange={v => onUpdate(index, 'buttonTextColor', v)} />
          
        </div>
      )}

      {!hasEditable && (
        <div className="space-y-1">
          <Label className="text-[10px] font-medium">Link do Slide</Label>
          <Input value={slide.linkUrl || ''} onChange={e => onUpdate(index, 'linkUrl', e.target.value)} placeholder="URL ao clicar" className="h-7 text-xs" />
        </div>
      )}
    </SubSection>
  );
}

function ColorInline({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="w-8 h-7 rounded border cursor-pointer" />
        <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" className="flex-1 h-7 font-mono text-xs" />
      </div>
    </div>
  );
}
