import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Globe, CheckCircle2, AlertCircle, ExternalLink, Info, Shield, RefreshCw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "./CredentialEditor";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";

export function DomainsPlatformSettings() {
  const queryClient = useQueryClient();
  
  const { data: secretStatus, isLoading } = usePlatformIntegrationStatus("cloudflare");

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cloudflare-test-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Conexão estabelecida com sucesso', {
          description: data.results?.zoneId?.zoneName 
            ? `Zone: ${data.results.zoneId.zoneName}` 
            : 'API Token válido'
        });
      } else {
        toast.error('Falha na conexão', { description: data.error });
      }
      queryClient.invalidateQueries({ queryKey: ['platform-secrets-status'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao testar conexão', { description: error.message });
    },
  });

  const isConfigured = secretStatus?.status === 'configured';
  const isPartial = secretStatus?.status === 'partial';
  const apiTokenConfigured = secretStatus?.secrets?.CLOUDFLARE_API_TOKEN || false;
  const zoneIdConfigured = secretStatus?.secrets?.CLOUDFLARE_ZONE_ID || false;

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
        <div className="p-3 rounded-lg bg-orange-500/10">
          <Globe className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Domínios (Cloudflare)</h2>
          <p className="text-sm text-muted-foreground">
            Cloudflare for SaaS para domínios customizados e SSL automático
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          O Cloudflare for SaaS permite que cada tenant use seu próprio domínio customizado
          com SSL automático, sem necessidade de configuração manual de certificados.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Credenciais Cloudflare
              </CardTitle>
              <CardDescription>
                API Token e Zone ID para gerenciamento de domínios
              </CardDescription>
            </div>
            {isConfigured ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configurado
              </Badge>
            ) : isPartial ? (
              <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                <AlertCircle className="h-3 w-3 mr-1" />
                Parcial
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
          <div className="grid gap-4 md:grid-cols-2">
            <CredentialEditor
              credentialKey="CLOUDFLARE_API_TOKEN"
              label="Novo API Token"
              description="Token com permissões de SSL for SaaS"
              isConfigured={apiTokenConfigured}
              preview={secretStatus?.previews?.CLOUDFLARE_API_TOKEN}
              source={secretStatus?.sources?.CLOUDFLARE_API_TOKEN as 'db' | 'env' | null}
              placeholder="Cole o API Token aqui..."
            />
            <CredentialEditor
              credentialKey="CLOUDFLARE_ZONE_ID"
              label="Novo Zone ID"
              description="Zone ID do domínio comandocentral.com.br"
              isConfigured={zoneIdConfigured}
              preview={secretStatus?.previews?.CLOUDFLARE_ZONE_ID}
              source={secretStatus?.sources?.CLOUDFLARE_ZONE_ID as 'db' | 'env' | null}
              placeholder="Cole o Zone ID aqui..."
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={!apiTokenConfigured || testConnectionMutation.isPending}
            >
              {testConnectionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Configuração Necessária</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                Ativar Cloudflare for SaaS no domínio base
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                Configurar Fallback Origin (ex: shops.comandocentral.com.br)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                Gerar API Token com permissões de SSL for SaaS
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                Configurar Zone ID e API Token via Lovable Cloud Secrets
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos da Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>SSL automático para domínios custom</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Verificação de domínio via TXT</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>CDN global Cloudflare</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Proteção DDoS</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Subdomínios automáticos *.shops</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Renovação automática de SSL</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Docs Cloudflare for SaaS
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Dashboard Cloudflare
          </a>
        </Button>
      </div>
    </div>
  );
}
