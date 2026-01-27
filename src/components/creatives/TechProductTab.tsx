/**
 * Tech Product Tab — Vídeos tecnológicos de produtos (sem pessoas)
 * 
 * Pipeline: Veo 3.1 First/Last Frame / Image-to-Video + Sora 2
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, 
  Sparkles,
  Upload,
  Package,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

export function TechProductTab() {
  const [style, setStyle] = useState<string>('dark-premium');
  const [duration, setDuration] = useState<string>('10');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');

  const { data: jobs, isLoading } = useCreativeJobs('tech_product_video');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.tech_product_video;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Novo Vídeo Tech
          </CardTitle>
          <CardDescription>
            Vídeos cinematográficos de produtos — close-ups, fluid shots, fundos premium
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Produto */}
          <div className="space-y-2">
            <Label>Produto *</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto do catálogo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prod-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Shampoo Premium 300ml
                  </div>
                </SelectItem>
                <SelectItem value="prod-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Condicionador Premium 300ml
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Product Images */}
          <div className="space-y-2">
            <Label>Imagens do Produto *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload de fotos do produto em alta qualidade
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Recomendado: fundo branco, várias ângulos
              </p>
            </div>
          </div>

          {/* Style */}
          <div className="space-y-2">
            <Label>Estilo Visual</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark-premium">Tech Premium Black (Fundo escuro, reflexos)</SelectItem>
                <SelectItem value="clean-studio">Clean Studio (Branco minimalista)</SelectItem>
                <SelectItem value="futuristic">Futurista (Efeitos tech, partículas)</SelectItem>
                <SelectItem value="minimalist">Minimalista (Cores suaves, movimento sutil)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* First/Last Frame (Optional) */}
          <div className="space-y-2">
            <Label>Frames de Controle (opcional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Defina como o vídeo começa e termina para maior controle criativo
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                <p className="text-xs font-medium">Primeiro Frame</p>
                <p className="text-xs text-muted-foreground">Upload (opcional)</p>
              </div>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer">
                <p className="text-xs font-medium">Último Frame</p>
                <p className="text-xs text-muted-foreground">Upload (opcional)</p>
              </div>
            </div>
          </div>

          {/* Duration & Aspect Ratio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                  <SelectItem value="15">15 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Proporção</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Horizontal)</SelectItem>
                  <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                  <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional Prompt */}
          <div className="space-y-2">
            <Label>Instruções Adicionais (opcional)</Label>
            <Textarea 
              placeholder="Ex: 'Movimento de rotação lenta, foco em rótulo, partículas de luz ao fundo...'"
              rows={3}
            />
          </div>

          {/* Modelos */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Modelos disponíveis:</Label>
            <div className="flex flex-wrap gap-1">
              {models.map(m => (
                <Badge key={m.id} variant={m.isDefault ? "default" : "outline"} className="text-xs">
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar Vídeo Tech
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Gerações</CardTitle>
          <CardDescription>Acompanhe o status dos seus criativos</CardDescription>
        </CardHeader>
        <CardContent>
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="tech_product_video" />
        </CardContent>
      </Card>
    </div>
  );
}
