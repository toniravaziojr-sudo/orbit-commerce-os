// =============================================
// BANNER PROPS PANEL — Custom accordion-based editor for Banner block
// Phase 1: Reorganized UI with sections, conditional visibility, per-slide config
// =============================================

import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ChevronDown } from 'lucide-react';
import { ImageUploaderWithLibrary } from './ImageUploaderWithLibrary';
import { BannerSlidesEditor, BannerSlide } from './BannerSlidesEditor';
import { cn } from '@/lib/utils';

interface BannerPropsPanelProps {
  props: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

// ===== Helper components =====

function SectionCollapsible({
  icon,
  label,
  open,
  onOpenChange,
  children,
}: {
  icon: string;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{icon}</span>
          <span className="font-medium text-xs">{label}</span>
        </div>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pl-2 pr-1 space-y-2 border-l-2 border-muted ml-2 mt-1.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <FieldWrapper label={label}>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-7 rounded border cursor-pointer"
        />
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 h-7 font-mono text-xs"
        />
      </div>
    </FieldWrapper>
  );
}

function SliderField({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <FieldWrapper label={label}>
      <div className="flex items-center gap-2">
        <Slider
          value={[value]}
          onValueChange={([v]) => onChange(v)}
          min={min} max={max} step={1}
          className="flex-1"
        />
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min} max={max}
          className="w-14 h-7 text-xs"
        />
      </div>
    </FieldWrapper>
  );
}

// ===== Main Panel =====

export function BannerPropsPanel({ props, onChange }: BannerPropsPanelProps) {
  const mode = (props.mode as string) || 'single';

  return (
    <div className="space-y-2.5">
      {/* Mode selector — always visible */}
      <FieldWrapper label="Modo">
        <Select value={mode} onValueChange={v => onChange('mode', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single" className="text-xs">Banner Único</SelectItem>
            <SelectItem value="carousel" className="text-xs">Carrossel</SelectItem>
          </SelectContent>
        </Select>
      </FieldWrapper>

      {mode === 'carousel' ? (
        <CarouselPanel props={props} onChange={onChange} />
      ) : (
        <SinglePanel props={props} onChange={onChange} />
      )}
    </div>
  );
}

// ===== Single Mode Panel =====

function SinglePanel({ props, onChange }: BannerPropsPanelProps) {
  const [configOpen, setConfigOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [refinementsOpen, setRefinementsOpen] = useState(false);

  const bannerType = (props.bannerType as string) || 'image';
  // Infer hasEditableContent for backward compatibility
  const hasEditableContent = props.hasEditableContent !== undefined
    ? Boolean(props.hasEditableContent)
    : !!(props.title || props.buttonText);

  return (
    <>
      {/* Section: Configurações */}
      <SectionCollapsible icon="⚙️" label="Configurações do Banner" open={configOpen} onOpenChange={setConfigOpen}>
        <FieldWrapper label="Tipo de Banner">
          <Select value={bannerType} onValueChange={v => onChange('bannerType', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image" className="text-xs">Com Imagem</SelectItem>
              <SelectItem value="solid" className="text-xs">Cor de Fundo</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrapper>

        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Conteúdo editável</span>
          <Switch
            checked={hasEditableContent}
            onCheckedChange={v => onChange('hasEditableContent', v)}
            className="scale-90"
          />
        </div>

        <FieldWrapper label="Dimensão">
          <Select value={(props.height as string) || 'auto'} onValueChange={v => onChange('height', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="text-xs">Proporcional (12:5 / 4:5)</SelectItem>
              <SelectItem value="sm" className="text-xs">Compacto (300px)</SelectItem>
              <SelectItem value="md" className="text-xs">Médio (400px)</SelectItem>
              <SelectItem value="lg" className="text-xs">Grande (500px)</SelectItem>
              <SelectItem value="full" className="text-xs">Tela Cheia (100vh)</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Largura">
          <Select value={(props.bannerWidth as string) || 'full'} onValueChange={v => onChange('bannerWidth', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full" className="text-xs">Largura Total</SelectItem>
              <SelectItem value="contained" className="text-xs">Contido</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrapper>

        {/* CTA fields */}
        {hasEditableContent && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Conteúdo</p>
            <FieldWrapper label="Título">
              <Input value={(props.title as string) || ''} onChange={e => onChange('title', e.target.value)} placeholder="Texto principal" className="h-7 text-xs" />
            </FieldWrapper>
            <FieldWrapper label="Subtítulo">
              <Input value={(props.subtitle as string) || ''} onChange={e => onChange('subtitle', e.target.value)} placeholder="Texto secundário" className="h-7 text-xs" />
            </FieldWrapper>
            <FieldWrapper label="Texto do Botão">
              <Input value={(props.buttonText as string) || ''} onChange={e => onChange('buttonText', e.target.value)} placeholder="Ex: Ver Produtos" className="h-7 text-xs" />
            </FieldWrapper>
            <FieldWrapper label="Link do Botão">
              <Input value={(props.buttonUrl as string) || ''} onChange={e => onChange('buttonUrl', e.target.value)} placeholder="/produtos" className="h-7 text-xs" />
            </FieldWrapper>
            <FieldWrapper label="Alinhamento do Texto">
              <Select value={(props.alignment as string) || 'center'} onValueChange={v => onChange('alignment', v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left" className="text-xs">Esquerda</SelectItem>
                  <SelectItem value="center" className="text-xs">Centro</SelectItem>
                  <SelectItem value="right" className="text-xs">Direita</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrapper>
            <FieldWrapper label="Alinhamento do Botão">
              <Select value={(props.buttonAlignment as string) || 'auto'} onValueChange={v => onChange('buttonAlignment', v)}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">Seguir Texto</SelectItem>
                  <SelectItem value="left" className="text-xs">Esquerda</SelectItem>
                  <SelectItem value="center" className="text-xs">Centro</SelectItem>
                  <SelectItem value="right" className="text-xs">Direita</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrapper>
          </div>
        )}
      </SectionCollapsible>

      {/* Section: Imagens (hidden when solid) */}
      {bannerType !== 'solid' && (
        <SectionCollapsible icon="🖼️" label="Imagens" open={imagesOpen} onOpenChange={setImagesOpen}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Desktop</Label>
              <ImageUploaderWithLibrary
                value={(props.imageDesktop as string) || ''}
                onChange={url => onChange('imageDesktop', url)}
                placeholder="Imagem principal"
                variant="desktop"
              />
              <p className="text-[10px] text-muted-foreground">Rec: 1920×800px (12:5)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mobile</Label>
              <ImageUploaderWithLibrary
                value={(props.imageMobile as string) || ''}
                onChange={url => onChange('imageMobile', url)}
                placeholder="Opcional — usa Desktop se vazio"
                variant="mobile"
              />
              <p className="text-[10px] text-muted-foreground">Rec: 750×940px (4:5)</p>
            </div>
          </div>
        </SectionCollapsible>
      )}

      {/* Section: Refinamentos */}
      <SectionCollapsible icon="🎨" label="Refinamentos" open={refinementsOpen} onOpenChange={setRefinementsOpen}>
        {bannerType === 'solid' && (
          <ColorField label="Cor de Fundo" value={(props.backgroundColor as string) || '#f3f4f6'} onChange={v => onChange('backgroundColor', v)} />
        )}

        {hasEditableContent && (
          <ColorField label="Cor do Texto" value={(props.textColor as string) || '#ffffff'} onChange={v => onChange('textColor', v)} />
        )}

        <SliderField label="Escurecimento (%)" value={Number(props.overlayOpacity) || 0} onChange={v => onChange('overlayOpacity', v)} />

        {hasEditableContent && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Botão</p>
            <ColorField label="Cor de Fundo" value={(props.buttonColor as string) || '#ffffff'} onChange={v => onChange('buttonColor', v)} />
            <ColorField label="Cor do Texto" value={(props.buttonTextColor as string) || ''} onChange={v => onChange('buttonTextColor', v)} />
            <ColorField label="Fundo (Hover)" value={(props.buttonHoverBgColor as string) || ''} onChange={v => onChange('buttonHoverBgColor', v)} />
            <ColorField label="Texto (Hover)" value={(props.buttonHoverTextColor as string) || ''} onChange={v => onChange('buttonHoverTextColor', v)} />
          </div>
        )}

        {!hasEditableContent && (
          <FieldWrapper label="Link do Banner">
            <Input value={(props.linkUrl as string) || ''} onChange={e => onChange('linkUrl', e.target.value)} placeholder="URL ao clicar no banner" className="h-7 text-xs" />
          </FieldWrapper>
        )}
      </SectionCollapsible>
    </>
  );
}

// ===== Carousel Mode Panel =====

function CarouselPanel({ props, onChange }: BannerPropsPanelProps) {
  const [configOpen, setConfigOpen] = useState(true);

  return (
    <>
      {/* Global carousel config */}
      <SectionCollapsible icon="⚙️" label="Configurações do Carrossel" open={configOpen} onOpenChange={setConfigOpen}>
        <FieldWrapper label="Dimensão">
          <Select value={(props.height as string) || 'auto'} onValueChange={v => onChange('height', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="text-xs">Proporcional (12:5 / 4:5)</SelectItem>
              <SelectItem value="sm" className="text-xs">Compacto (300px)</SelectItem>
              <SelectItem value="md" className="text-xs">Médio (400px)</SelectItem>
              <SelectItem value="lg" className="text-xs">Grande (500px)</SelectItem>
              <SelectItem value="full" className="text-xs">Tela Cheia (100vh)</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrapper>

        <FieldWrapper label="Largura">
          <Select value={(props.bannerWidth as string) || 'full'} onValueChange={v => onChange('bannerWidth', v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full" className="text-xs">Largura Total</SelectItem>
              <SelectItem value="contained" className="text-xs">Contido</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrapper>

        <SliderField
          label="Autoplay (segundos)"
          value={Number(props.autoplaySeconds) || 5}
          onChange={v => onChange('autoplaySeconds', v)}
          min={0} max={30}
        />

        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Mostrar Setas</span>
          <Switch checked={Boolean(props.showArrows ?? true)} onCheckedChange={v => onChange('showArrows', v)} className="scale-90" />
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-muted-foreground">Mostrar Indicadores</span>
          <Switch checked={Boolean(props.showDots ?? true)} onCheckedChange={v => onChange('showDots', v)} className="scale-90" />
        </div>
      </SectionCollapsible>

      {/* Slides */}
      <BannerSlidesEditor
        slides={(props.slides as BannerSlide[]) || []}
        onChange={(slides) => onChange('slides', slides)}
      />
    </>
  );
}
