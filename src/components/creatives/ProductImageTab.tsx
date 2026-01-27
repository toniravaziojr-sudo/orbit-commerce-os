/**
 * Product Image Tab — Imagens de pessoas segurando o produto
 * 
 * Pipeline: OpenAI GPT Image 1.5 Edit
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  Image as ImageIcon, 
  Sparkles,
  Package,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

export function ProductImageTab() {
  const [scene, setScene] = useState<string>('bathroom');
  const [gender, setGender] = useState<string>('any');
  const [ageRange, setAgeRange] = useState<string>('middle');
  const [pose, setPose] = useState<string>('holding');
  const [variations, setVariations] = useState<number[]>([2]);

  const { data: jobs, isLoading } = useCreativeJobs('product_image');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.product_image;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Nova Imagem de Produto
          </CardTitle>
          <CardDescription>
            Pessoas reais segurando o produto — ultra realismo com fidelidade de rótulo
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
            <p className="text-xs text-muted-foreground">
              A imagem principal do produto será usada como referência para preservar rótulo e cores
            </p>
          </div>

          {/* Cenário */}
          <div className="space-y-2">
            <Label>Cenário</Label>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bathroom">Banheiro (luz natural)</SelectItem>
                <SelectItem value="bedroom">Quarto (ambiente relaxante)</SelectItem>
                <SelectItem value="gym">Academia (energia/fitness)</SelectItem>
                <SelectItem value="outdoor">Ar Livre (luz natural intensa)</SelectItem>
                <SelectItem value="office">Escritório (profissional)</SelectItem>
                <SelectItem value="kitchen">Cozinha (lifestyle)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Perfil da Pessoa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Feminino</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="any">Qualquer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Faixa Etária</Label>
              <Select value={ageRange} onValueChange={setAgeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="young">Jovem (20-35)</SelectItem>
                  <SelectItem value="middle">Meia Idade (35-50)</SelectItem>
                  <SelectItem value="mature">Maduro (50+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pose */}
          <div className="space-y-2">
            <Label>Pose/Interação</Label>
            <Select value={pose} onValueChange={setPose}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="holding">Segurando na mão</SelectItem>
                <SelectItem value="using">Usando o produto</SelectItem>
                <SelectItem value="displaying">Mostrando para câmera</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Número de Variações */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Número de Variações</Label>
              <span className="text-sm font-medium">{variations[0]}</span>
            </div>
            <Slider
              value={variations}
              onValueChange={setVariations}
              min={1}
              max={4}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Custo estimado: ~R$ {(variations[0] * 0.02 * 5).toFixed(2)} (R$ 0,10/imagem)
            </p>
          </div>

          {/* Brief Adicional */}
          <div className="space-y-2">
            <Label>Instruções Adicionais (opcional)</Label>
            <Textarea 
              placeholder="Ex: 'Pessoa sorrindo, luz suave vindo da janela, estilo clean e moderno...'"
              rows={3}
            />
          </div>

          {/* Modelo */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Modelo utilizado:</Label>
            <div className="flex flex-wrap gap-1">
              {models.map(m => (
                <Badge key={m.id} variant="default" className="text-xs">
                  {m.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Mantém fidelidade máxima ao rótulo e cores do produto original
            </p>
          </div>

          {/* Submit */}
          <Button className="w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Gerar {variations[0]} {variations[0] === 1 ? 'Imagem' : 'Imagens'}
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
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="product_image" />
        </CardContent>
      </Card>
    </div>
  );
}
