import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ExternalLink, Info, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { CredentialEditor } from "../CredentialEditor";

export function FalAIPlatformSettings() {
  const { data: secretsStatus, isLoading } = useQuery({
    queryKey: ['platform-secrets-status', 'fal_ai'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('platform-secrets-check', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      const falAi = response.data.integrations?.find((i: any) => i.key === 'fal_ai');
      
      return { falAi };
    },
  });

  const falAiConfigured = secretsStatus?.falAi?.status === 'configured';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Wand2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">Fal.AI</CardTitle>
              <CardDescription>
                Geração de imagens e vídeos com IA avançada
              </CardDescription>
            </div>
          </div>
          {falAiConfigured ? (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <AlertCircle className="h-3 w-3 mr-1" />
              Pendente
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O Fal.AI é usado para gerar imagens e vídeos de alta qualidade no módulo de Gestão de Mídias.
            Todos os tenants usam esta chave automaticamente.
          </AlertDescription>
        </Alert>

        <CredentialEditor
          credentialKey="FAL_API_KEY"
          label="API Key"
          description="Chave de API do Fal.AI (escopo padrão, não precisa ser admin)"
          isConfigured={falAiConfigured}
          preview={secretsStatus?.falAi?.previews?.FAL_API_KEY}
          source={secretsStatus?.falAi?.sources?.FAL_API_KEY as 'db' | 'env' | null}
          placeholder="Cole a API Key do Fal.AI aqui..."
        />

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Modelos Disponíveis</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Flux Pro/Dev (Imagens)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Kling 1.6 (Vídeos)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Runway Gen-3 (Vídeos)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>SDXL / Stable Diffusion</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Funcionalidades</h4>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Geração de criativos para redes sociais</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Vídeos promocionais</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Composição com produtos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Animação de imagens (image-to-video)</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Gerenciar API Keys
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://fal.ai/models" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Modelos
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
