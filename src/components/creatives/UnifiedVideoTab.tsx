/**
 * Unified Video Tab — Aba unificada para todos os tipos de vídeo
 * 
 * Tipos de vídeo:
 * - ugc_real: Transformar vídeo do cliente (Akool + ElevenLabs + Sync Labs)
 * - ugc_ai: Pessoa 100% IA segurando produto (Runway + ElevenLabs + Sync Labs)
 * - product_video: Vídeos promocionais de produto (Runway + ElevenLabs)
 * - avatar_mascot: Avatar/Mascote falante (HeyGen)
 * 
 * Stack v2.0: Runway ML | ElevenLabs | Sync Labs | Akool | HeyGen
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Video, 
  Bot, 
  User,
  Wand2,
  Package,
  Info,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

// Sub-forms para cada tipo
import { UGCRealForm } from './video-forms/UGCRealForm';
import { UGCAIForm } from './video-forms/UGCAIForm';
import { ProductVideoForm } from './video-forms/ProductVideoForm';
import { AvatarMascotForm } from './video-forms/AvatarMascotForm';

// Tipos de vídeo disponíveis
export type VideoType = 'ugc_real' | 'ugc_ai' | 'product_video' | 'avatar_mascot';

interface VideoTypeOption {
  id: VideoType;
  label: string;
  icon: React.ElementType;
  description: string;
  pipeline: string[];
  badge?: string;
}

const VIDEO_TYPES: VideoTypeOption[] = [
  {
    id: 'ugc_ai',
    label: 'UGC 100% IA',
    icon: Bot,
    description: 'Pessoa gerada por IA segurando/usando o produto do catálogo',
    pipeline: ['Runway ML', 'ElevenLabs', 'Sync Labs'],
    badge: 'Recomendado',
  },
  {
    id: 'ugc_real',
    label: 'UGC Transformado',
    icon: User,
    description: 'Transformar vídeo existente: trocar rosto, voz ou fundo',
    pipeline: ['Akool', 'ElevenLabs', 'Sync Labs'],
  },
  {
    id: 'product_video',
    label: 'Vídeo de Produto',
    icon: Package,
    description: 'Vídeos promocionais sem pessoas: efeitos visuais, rotação, cenários',
    pipeline: ['Runway ML', 'ElevenLabs'],
  },
  {
    id: 'avatar_mascot',
    label: 'Avatar / Mascote',
    icon: Wand2,
    description: 'Avatar ou mascote animado falando (estilo Lu da Magalu)',
    pipeline: ['HeyGen'],
  },
];

export function UnifiedVideoTab() {
  const [selectedType, setSelectedType] = useState<VideoType>('ugc_ai');
  
  const currentType = VIDEO_TYPES.find(t => t.id === selectedType)!;
  const CurrentIcon = currentType.icon;

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Gerar Vídeo com IA</CardTitle>
                <CardDescription>
                  Escolha o tipo de vídeo e configure os parâmetros
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Dropdown de Tipo */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Vídeo</label>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as VideoType)}>
              <SelectTrigger className="h-auto py-3">
                <SelectValue>
                  <div className="flex items-center gap-3">
                    <CurrentIcon className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currentType.label}</span>
                        {currentType.badge && (
                          <Badge variant="secondary" className="text-[10px]">
                            {currentType.badge}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {currentType.description}
                      </span>
                    </div>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VIDEO_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.id} value={type.id} className="py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{type.label}</span>
                            {type.badge && (
                              <Badge variant="secondary" className="text-[10px]">
                                {type.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline Info */}
          <Alert className="bg-muted/50">
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium">Pipeline:</span>
              {currentType.pipeline.map((tool, index) => (
                <span key={tool} className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                  {index < currentType.pipeline.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </span>
              ))}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Separator />

      {/* Formulário específico do tipo selecionado */}
      {selectedType === 'ugc_ai' && <UGCAIForm />}
      {selectedType === 'ugc_real' && <UGCRealForm />}
      {selectedType === 'product_video' && <ProductVideoForm />}
      {selectedType === 'avatar_mascot' && <AvatarMascotForm />}
    </div>
  );
}
