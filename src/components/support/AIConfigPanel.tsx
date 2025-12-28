import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bot, Brain, Clock, Shield, Sparkles, MessageCircle } from "lucide-react";
import { useAiSupportConfig, type AiSupportConfig } from "@/hooks/useAiSupportConfig";
import { Skeleton } from "@/components/ui/skeleton";

export function AIConfigPanel() {
  const { config, isLoading, upsertConfig } = useAiSupportConfig();
  const [localConfig, setLocalConfig] = useState<Partial<AiSupportConfig>>({});

  const handleSave = () => {
    upsertConfig.mutate(localConfig);
  };

  const updateField = <K extends keyof AiSupportConfig>(key: K, value: AiSupportConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const getValue = <K extends keyof AiSupportConfig>(key: K): AiSupportConfig[K] | undefined => {
    return (localConfig[key] as AiSupportConfig[K]) ?? config?.[key];
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuração da IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Personalize como a IA atende seus clientes
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="ai-enabled"
              checked={getValue('is_enabled') ?? true}
              onCheckedChange={(checked) => updateField('is_enabled', checked)}
            />
            <Label htmlFor="ai-enabled">IA Ativa</Label>
          </div>
          <Button onClick={handleSave} disabled={upsertConfig.isPending}>
            {upsertConfig.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personality">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personality" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Personalidade
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <Brain className="h-4 w-4" />
            Conhecimento
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Comportamento
          </TabsTrigger>
          <TabsTrigger value="safety" className="gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personality" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidade da IA</CardTitle>
              <CardDescription>
                Defina como a IA se apresenta e interage com os clientes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do Assistente</Label>
                  <Input
                    placeholder="Ex: Sofia, Assistente Virtual"
                    value={getValue('personality_name') || ''}
                    onChange={(e) => updateField('personality_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tom de Voz</Label>
                  <Select
                    value={getValue('personality_tone') || 'friendly'}
                    onValueChange={(v) => updateField('personality_tone', v as 'formal' | 'friendly' | 'casual')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="friendly">Amigável</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="use-emojis"
                    checked={getValue('use_emojis') ?? true}
                    onCheckedChange={(checked) => updateField('use_emojis', checked)}
                  />
                  <Label htmlFor="use-emojis">Usar emojis</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prompt do Sistema (Avançado)</Label>
                <Textarea
                  placeholder="Instruções adicionais para a IA..."
                  value={getValue('system_prompt') || ''}
                  onChange={(e) => updateField('system_prompt', e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Adicione instruções específicas sobre como a IA deve se comportar
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fontes de Conhecimento</CardTitle>
              <CardDescription>
                A IA aprende automaticamente sobre seu negócio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Produtos</Label>
                    <p className="text-xs text-muted-foreground">Catálogo, preços, descrições</p>
                  </div>
                  <Switch
                    checked={getValue('auto_import_products') ?? true}
                    onCheckedChange={(checked) => updateField('auto_import_products', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Categorias</Label>
                    <p className="text-xs text-muted-foreground">Organização do catálogo</p>
                  </div>
                  <Switch
                    checked={getValue('auto_import_categories') ?? true}
                    onCheckedChange={(checked) => updateField('auto_import_categories', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>Políticas</Label>
                    <p className="text-xs text-muted-foreground">Trocas, devoluções, frete</p>
                  </div>
                  <Switch
                    checked={getValue('auto_import_policies') ?? true}
                    onCheckedChange={(checked) => updateField('auto_import_policies', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label>FAQs</Label>
                    <p className="text-xs text-muted-foreground">Perguntas frequentes</p>
                  </div>
                  <Switch
                    checked={getValue('auto_import_faqs') ?? true}
                    onCheckedChange={(checked) => updateField('auto_import_faqs', checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conhecimento Personalizado</Label>
                <Textarea
                  placeholder="Adicione informações específicas que a IA deve saber sobre seu negócio, regras especiais, promoções, etc..."
                  value={getValue('custom_knowledge') || ''}
                  onChange={(e) => updateField('custom_knowledge', e.target.value)}
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transferência para Humano</CardTitle>
              <CardDescription>
                Quando a IA deve passar o atendimento para um agente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Máximo de mensagens antes de sugerir humano</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={getValue('max_messages_before_handoff') || 10}
                  onChange={(e) => updateField('max_messages_before_handoff', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Palavras-chave para transferência</Label>
                <Input
                  placeholder="falar com humano, atendente, pessoa"
                  value={(getValue('handoff_keywords') || []).join(', ')}
                  onChange={(e) => updateField('handoff_keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                />
                <p className="text-xs text-muted-foreground">
                  Separe por vírgula. Quando detectadas, a IA transfere para humano.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="approval-mode"
                  checked={getValue('approval_mode') ?? false}
                  onCheckedChange={(checked) => updateField('approval_mode', checked)}
                />
                <Label htmlFor="approval-mode">Modo de aprovação</Label>
                <Badge variant="secondary">Avançado</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativo, respostas da IA precisam ser aprovadas antes de enviar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tratamento de Mídia</CardTitle>
              <CardDescription>
                Como a IA lida com imagens, áudios e arquivos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getValue('handle_images') ?? true}
                    onCheckedChange={(checked) => updateField('handle_images', checked)}
                  />
                  <Label>Analisar imagens</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getValue('handle_audio') ?? true}
                    onCheckedChange={(checked) => updateField('handle_audio', checked)}
                  />
                  <Label>Transcrever áudios</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={getValue('handle_files') ?? true}
                    onCheckedChange={(checked) => updateField('handle_files', checked)}
                  />
                  <Label>Analisar documentos</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Proteções</CardTitle>
              <CardDescription>
                Limites e restrições para manter respostas seguras
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tamanho máximo de resposta (caracteres)</Label>
                <Input
                  type="number"
                  min={100}
                  max={2000}
                  value={getValue('max_response_length') || 500}
                  onChange={(e) => updateField('max_response_length', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label>Tópicos proibidos</Label>
                <Input
                  placeholder="política, religião, concorrentes"
                  value={(getValue('forbidden_topics') || []).join(', ')}
                  onChange={(e) => updateField('forbidden_topics', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                />
                <p className="text-xs text-muted-foreground">
                  A IA não falará sobre esses assuntos
                </p>
              </div>

              <div className="space-y-2">
                <Label>Modelo de IA</Label>
                <Select
                  value={getValue('ai_model') || 'google/gemini-2.5-flash'}
                  onValueChange={(v) => updateField('ai_model', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-2.5-flash">Gemini Flash (Rápido)</SelectItem>
                    <SelectItem value="google/gemini-2.5-pro">Gemini Pro (Avançado)</SelectItem>
                    <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                SLA
              </CardTitle>
              <CardDescription>
                Métricas de tempo de resposta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tempo alvo 1ª resposta (segundos)</Label>
                  <Input
                    type="number"
                    min={10}
                    value={getValue('target_first_response_seconds') || 60}
                    onChange={(e) => updateField('target_first_response_seconds', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tempo alvo resolução (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={getValue('target_resolution_minutes') || 30}
                    onChange={(e) => updateField('target_resolution_minutes', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
