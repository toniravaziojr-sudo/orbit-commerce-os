/**
 * Campos Dinâmicos por Estilo
 * Renderiza campos específicos baseado no estilo selecionado
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import {
  ImageStyle,
  ProductNaturalSettings,
  PersonInteractingSettings,
  PromotionalSettings,
  ENVIRONMENT_PRESETS,
  VISUAL_ELEMENTS,
} from './types';

interface StyleFieldsProps {
  style: ImageStyle;
  productNatural?: ProductNaturalSettings;
  personInteracting?: PersonInteractingSettings;
  promotional?: PromotionalSettings;
  onProductNaturalChange: (settings: ProductNaturalSettings) => void;
  onPersonInteractingChange: (settings: PersonInteractingSettings) => void;
  onPromotionalChange: (settings: PromotionalSettings) => void;
  disabled?: boolean;
}

export function StyleFields({
  style,
  productNatural,
  personInteracting,
  promotional,
  onProductNaturalChange,
  onPersonInteractingChange,
  onPromotionalChange,
  disabled,
}: StyleFieldsProps) {
  // Estilo 1: Produto + Fundo Natural
  if (style === 'product_natural') {
    const settings = productNatural || { environment: 'studio', lighting: 'natural', mood: 'clean' };
    
    return (
      <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-dashed">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Configurações — Produto + Fundo Natural
        </Label>
        
        <div className="space-y-2">
          <Label className="text-sm">Ambiente</Label>
          <Select
            value={settings.environment}
            onValueChange={(v) => onProductNaturalChange({ ...settings, environment: v })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o ambiente..." />
            </SelectTrigger>
            <SelectContent>
              {ENVIRONMENT_PRESETS.map((env) => (
                <SelectItem key={env.value} value={env.value}>
                  {env.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Iluminação</Label>
            <Select
              value={settings.lighting}
              onValueChange={(v) => onProductNaturalChange({ ...settings, lighting: v as any })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">Natural</SelectItem>
                <SelectItem value="studio">Estúdio</SelectItem>
                <SelectItem value="night">Noturna</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Clima/Mood</Label>
            <Select
              value={settings.mood}
              onValueChange={(v) => onProductNaturalChange({ ...settings, mood: v as any })}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clean">Limpo/Clean</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="organic">Orgânico</SelectItem>
                <SelectItem value="vibrant">Vibrante</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  // Estilo 2: Pessoa Interagindo
  if (style === 'person_interacting') {
    const settings = personInteracting || { action: 'holding', personProfile: '', tone: 'lifestyle' };
    
    return (
      <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-dashed">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Configurações — Pessoa Interagindo
        </Label>
        
        <div className="space-y-2">
          <Label className="text-sm">Ação</Label>
          <Select
            value={settings.action}
            onValueChange={(v) => onPersonInteractingChange({ ...settings, action: v as any })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="holding">Segurando o produto</SelectItem>
              <SelectItem value="using">Aplicando/Usando</SelectItem>
              <SelectItem value="showing">Mostrando para câmera</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Perfil da Pessoa (opcional)</Label>
          <Input
            value={settings.personProfile}
            onChange={(e) => onPersonInteractingChange({ ...settings, personProfile: e.target.value })}
            placeholder="Ex: mulher jovem, cabelos escuros, sorrindo..."
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Descrição livre e sucinta. Deixe em branco para a IA escolher.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Tom</Label>
          <Select
            value={settings.tone}
            onValueChange={(v) => onPersonInteractingChange({ ...settings, tone: v as any })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ugc">UGC (caseiro, autêntico)</SelectItem>
              <SelectItem value="demo">Demonstração</SelectItem>
              <SelectItem value="review">Review/Avaliação</SelectItem>
              <SelectItem value="lifestyle">Lifestyle (editorial)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // Estilo 3: Promocional
  if (style === 'promotional') {
    const settings = promotional || { effectsIntensity: 'medium', visualElements: [], overlayText: '' };
    
    const toggleElement = (element: string) => {
      const elements = settings.visualElements.includes(element)
        ? settings.visualElements.filter(e => e !== element)
        : [...settings.visualElements, element];
      onPromotionalChange({ ...settings, visualElements: elements });
    };
    
    return (
      <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-dashed">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Configurações — Promocional
        </Label>
        
        <div className="space-y-2">
          <Label className="text-sm">Intensidade de Efeitos</Label>
          <Select
            value={settings.effectsIntensity}
            onValueChange={(v) => onPromotionalChange({ ...settings, effectsIntensity: v as any })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa (sutil)</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta (impactante)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Elementos Visuais</Label>
          <div className="flex flex-wrap gap-2">
            {VISUAL_ELEMENTS.map((element) => {
              const isSelected = settings.visualElements.includes(element.value);
              return (
                <Badge
                  key={element.value}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all ${isSelected ? '' : 'hover:bg-muted'}`}
                  onClick={() => !disabled && toggleElement(element.value)}
                >
                  {element.label}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Texto no Criativo (opcional)</Label>
          <Input
            value={settings.overlayText || ''}
            onChange={(e) => onPromotionalChange({ ...settings, overlayText: e.target.value })}
            placeholder="Ex: 50% OFF, LANÇAMENTO, BEST SELLER..."
            disabled={disabled}
          />
          <Alert className="bg-warning/10 border-warning/30">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <AlertDescription className="text-xs text-warning-foreground">
              Texto pode falhar dependendo do gerador. Não garantimos legibilidade.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return null;
}
