import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Bot, CheckCircle2, AlertCircle, ExternalLink, Info, Shield, Flame, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function AIPlatformSettings() {
  const { data: secretsStatus, isLoading } = useQuery({
    queryKey: ['platform-secrets-status', 'ai'],
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
      
      const firecrawl = response.data.integrations?.find((i: any) => i.key === 'firecrawl');
      const lovableAi = response.data.integrations?.find((i: any) => i.key === 'lovable_ai');
      
      return { firecrawl, lovableAi };
    },
  });

  const firecrawlConfigured = secretsStatus?.firecrawl?.status === 'configured';
  const lovableAiConfigured = secretsStatus?.lovableAi?.status === 'configured' || secretsStatus?.lovableAi?.status === 'system';

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
            Serviços de IA para importação, assistente e automações
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Os serviços de IA são utilizados para web scraping na importação de lojas
          e para o assistente inteligente de atendimento.
        </AlertDescription>
      </Alert>

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
                <CardDescription>
                  Web scraping para importação de lojas
                </CardDescription>
              </div>
            </div>
            {firecrawlConfigured ? (
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
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">FIRECRAWL_API_KEY</p>
              {firecrawlConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm font-mono">
              {firecrawlConfigured ? '••••••••••••••••' : 'Não configurado'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Usado para importar produtos, categorias e páginas de lojas externas
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Scraping de Shopify</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Scraping de Nuvemshop</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Scraping de WooCommerce</span>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild>
            <a href="https://docs.firecrawl.dev/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentação Firecrawl
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Lovable AI */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Sparkles className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <CardTitle className="text-base">Lovable AI</CardTitle>
                <CardDescription>
                  Gateway de IA para assistente inteligente
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Shield className="h-3 w-3 mr-1" />
              Sistema
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">LOVABLE_API_KEY</p>
              <Badge variant="outline" className="text-xs">Gerenciado automaticamente</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Este serviço é gerenciado automaticamente pela plataforma Lovable.
              Não requer configuração manual.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Assistente de atendimento</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Respostas automáticas</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Análise de sentimento</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Sugestões de produtos</span>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild>
            <a href="https://docs.lovable.dev/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentação Lovable
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
