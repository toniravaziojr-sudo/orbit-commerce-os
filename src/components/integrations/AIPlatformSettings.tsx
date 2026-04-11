import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, CheckCircle2, AlertCircle, ExternalLink, Info, Shield, Flame, Sparkles, Cpu, Image, Loader2, Wand2, Video } from "lucide-react";
import { usePlatformSecretsStatus } from "@/hooks/usePlatformSecretsStatus";
import { CredentialEditor } from "./CredentialEditor";

export function AIPlatformSettings() {
  const { data: allIntegrations, isLoading } = usePlatformSecretsStatus();

  const secretsStatus = {
    firecrawl: allIntegrations?.find((i) => i.key === 'firecrawl'),
    lovableAi: allIntegrations?.find((i) => i.key === 'lovable_ai'),
    openai: allIntegrations?.find((i) => i.key === 'openai'),
    gemini: allIntegrations?.find((i) => i.key === 'gemini'),
    falAi: allIntegrations?.find((i) => i.key === 'fal_ai'),
  };

  const firecrawlConfigured = secretsStatus?.firecrawl?.status === 'configured';
  const openaiConfigured = secretsStatus?.openai?.status === 'configured';
  const geminiConfigured = secretsStatus?.gemini?.status === 'configured';
  const falAiConfigured = secretsStatus?.falAi?.status === 'configured';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-violet-500/10">
          <Bot className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Inteligência Artificial</h2>
          <p className="text-sm text-muted-foreground">
            Serviços de IA para importação, criativos e automações
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Fal.AI</strong> é o provedor principal de imagens (FLUX 2) e vídeos (Kling v3, Veo 3.1, Wan 2.6). Gemini, OpenAI e Lovable Gateway servem como fallback seguro.
        </AlertDescription>
      </Alert>

      {/* Lovable AI (Primary) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Sparkles className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <CardTitle className="text-base">Lovable AI Gateway</CardTitle>
                <CardDescription>Geração de imagens e criativos (Gemini Image)</CardDescription>
              </div>
            </div>
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
              <Shield className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Gerenciado automaticamente. Usado para toda geração de imagens de criativos.
            </p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <Image className="h-4 w-4 text-green-500" />
              <span>Imagens de produto</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Edição com referência</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fal.AI (Principal — Imagens e Vídeos) */}
      <Card className="border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Wand2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-base">Fal.AI</CardTitle>
                <CardDescription>Provedor principal — Imagens (FLUX 2) e Vídeos (Kling v3, Veo 3.1, Wan 2.6)</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={falAiConfigured ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}>
              {falAiConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {falAiConfigured ? "Configurado" : "Obrigatório"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialEditor
            credentialKey="FAL_API_KEY"
            label="API Key (Escopo: API)"
            description="Obtida em fal.ai/dashboard/keys — Escopo API (não Admin). Usada para FLUX 2 Pro/Turbo, Kling v3, Veo 3.1, Wan 2.6 e Lipsync."
            isConfigured={falAiConfigured}
            preview={secretsStatus?.falAi?.previews?.FAL_API_KEY}
            source={secretsStatus?.falAi?.sources?.FAL_API_KEY as 'db' | 'env' | null}
            placeholder="Insira sua FAL_KEY aqui..."
          />
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <Image className="h-4 w-4 text-purple-500" />
              <span>FLUX 2 Pro / Turbo (Imagens)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Video className="h-4 w-4 text-purple-500" />
              <span>Kling v3 / Veo 3.1 / Wan 2.6 (Vídeos)</span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Dashboard fal.ai
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Firecrawl */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">Firecrawl</CardTitle>
                <CardDescription>Web scraping para importação</CardDescription>
              </div>
            </div>
            <Badge variant={firecrawlConfigured ? "default" : "outline"} className={firecrawlConfigured ? "bg-green-500/10 text-green-600" : ""}>
              {firecrawlConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {firecrawlConfigured ? "Configurado" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CredentialEditor
            credentialKey="FIRECRAWL_API_KEY"
            label="API Key"
            description="Usado para importar produtos de lojas externas"
            isConfigured={firecrawlConfigured}
            preview={secretsStatus?.firecrawl?.previews?.FIRECRAWL_API_KEY}
            source={secretsStatus?.firecrawl?.sources?.FIRECRAWL_API_KEY as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* OpenAI (Optional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Cpu className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-base">OpenAI</CardTitle>
                <CardDescription>Atendimento IA avançado (opcional)</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={openaiConfigured ? "bg-green-500/10 text-green-600" : ""}>
              {openaiConfigured ? "Configurado" : "Opcional"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CredentialEditor
            credentialKey="OPENAI_API_KEY"
            label="API Key"
            description="Opcional - para atendimento IA com GPT-5"
            isConfigured={openaiConfigured}
            preview={secretsStatus?.openai?.previews?.OPENAI_API_KEY}
            source={secretsStatus?.openai?.sources?.OPENAI_API_KEY as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* Google Gemini (Native) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Google Gemini</CardTitle>
                <CardDescription>Geração de imagens nativa via Google AI Studio</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className={geminiConfigured ? "bg-green-500/10 text-green-600" : ""}>
              {geminiConfigured ? "Configurado" : "Opcional"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <CredentialEditor
            credentialKey="GEMINI_API_KEY"
            label="API Key"
            description="Obtida em ai.google.dev — usada para geração de imagens com Gemini"
            isConfigured={geminiConfigured}
            preview={secretsStatus?.gemini?.previews?.GEMINI_API_KEY}
            source={secretsStatus?.gemini?.sources?.GEMINI_API_KEY as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>
    </div>
  );
}