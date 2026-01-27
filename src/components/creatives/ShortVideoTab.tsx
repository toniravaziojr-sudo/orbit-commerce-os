/**
 * Short Video Tab — Vídeos curtos (pessoa falando sobre um assunto)
 * 
 * Pipeline: Kling AI Avatar v2 Pro + Sync LipSync (se necessário)
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Mic, 
  Sparkles,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useCreativeJobs, useCreateCreativeJob } from '@/hooks/useCreatives';
import { CREATIVE_MODELS } from '@/types/creatives';
import { CreativeJobsList } from './CreativeJobsList';

export function ShortVideoTab() {
  const [topic, setTopic] = useState('');
  const [bullets, setBullets] = useState<string[]>(['']);
  const [tone, setTone] = useState<string>('direct');
  const [script, setScript] = useState('');
  const [generateVariations, setGenerateVariations] = useState(false);
  const [hasAuthorization, setHasAuthorization] = useState(false);

  const { data: jobs, isLoading } = useCreativeJobs('short_video');
  const createJob = useCreateCreativeJob();

  const models = CREATIVE_MODELS.short_video;

  const addBullet = () => setBullets([...bullets, '']);
  const removeBullet = (index: number) => setBullets(bullets.filter((_, i) => i !== index));
  const updateBullet = (index: number, value: string) => {
    const newBullets = [...bullets];
    newBullets[index] = value;
    setBullets(newBullets);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Novo Vídeo Curto
          </CardTitle>
          <CardDescription>
            Vídeos de 15-60s com pessoa falando (review, explicativo, conteúdo)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tema */}
          <div className="space-y-2">
            <Label>Tema/Assunto *</Label>
            <Input 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ex: Benefícios do produto para cabelos danificados"
            />
          </div>

          {/* Bullets */}
          <div className="space-y-2">
            <Label>Pontos Principais</Label>
            <div className="space-y-2">
              {bullets.map((bullet, index) => (
                <div key={index} className="flex gap-2">
                  <Input 
                    value={bullet}
                    onChange={(e) => updateBullet(index, e.target.value)}
                    placeholder={`Ponto ${index + 1}`}
                  />
                  {bullets.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeBullet(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addBullet}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Ponto
              </Button>
            </div>
          </div>

          {/* Tom */}
          <div className="space-y-2">
            <Label>Tom do Vídeo</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direto e Objetivo</SelectItem>
                <SelectItem value="seller">Vendedor (Persuasivo)</SelectItem>
                <SelectItem value="educational">Educativo (Explicativo)</SelectItem>
                <SelectItem value="casual">Casual (Conversa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Script */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Roteiro</Label>
              <Button variant="link" size="sm" className="text-xs h-auto p-0">
                <Sparkles className="h-3 w-3 mr-1" />
                Gerar automaticamente
              </Button>
            </div>
            <Textarea 
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Digite ou gere o roteiro automaticamente baseado no tema e pontos..."
              rows={5}
            />
          </div>

          {/* Avatar & Voice */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Avatar</Label>
              <Select defaultValue="female-1">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female-1">Mulher Jovem 1</SelectItem>
                  <SelectItem value="female-2">Mulher Jovem 2</SelectItem>
                  <SelectItem value="male-1">Homem Jovem 1</SelectItem>
                  <SelectItem value="male-2">Homem Jovem 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Voz</Label>
              <Select defaultValue="voice-1">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice-1">Entusiasta</SelectItem>
                  <SelectItem value="voice-2">Profissional</SelectItem>
                  <SelectItem value="voice-3">Amigável</SelectItem>
                  <SelectItem value="voice-4">Confiante</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variações */}
          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <Checkbox 
              id="variations" 
              checked={generateVariations} 
              onCheckedChange={(c) => setGenerateVariations(c === true)} 
            />
            <div>
              <Label htmlFor="variations" className="cursor-pointer">
                Gerar 3 variações (A/B/C)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Mesmo conteúdo com hooks e CTAs diferentes para testes
              </p>
            </div>
          </div>

          {/* Authorization */}
          <Alert className="bg-muted/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-start gap-2">
                <Checkbox 
                  id="auth-short"
                  checked={hasAuthorization}
                  onCheckedChange={(c) => setHasAuthorization(c === true)}
                />
                <Label htmlFor="auth-short" className="text-sm font-normal cursor-pointer">
                  Confirmo que tenho direitos para usar este conteúdo comercialmente.
                </Label>
              </div>
            </AlertDescription>
          </Alert>

          {/* Modelos */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Modelo utilizado:</Label>
            <div className="flex flex-wrap gap-1">
              {models.filter(m => m.isDefault).map(m => (
                <Badge key={m.id} variant="outline" className="text-xs">
                  {m.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button className="w-full" disabled={!topic.trim() || !hasAuthorization}>
            <Sparkles className="h-4 w-4 mr-2" />
            {generateVariations ? 'Gerar 3 Variações' : 'Gerar Vídeo Curto'}
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
          <CreativeJobsList jobs={jobs || []} isLoading={isLoading} type="short_video" />
        </CardContent>
      </Card>
    </div>
  );
}
