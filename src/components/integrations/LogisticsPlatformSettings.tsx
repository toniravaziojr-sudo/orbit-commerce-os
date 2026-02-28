import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Truck, CheckCircle2, AlertCircle, ExternalLink, Info, Shield, RefreshCw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "./CredentialEditor";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";

export function LogisticsPlatformSettings() {
  const queryClient = useQueryClient();
  
  const { data: secretStatus, isLoading } = usePlatformIntegrationStatus("loggi");

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('loggi-test-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Autenticação OAuth bem sucedida', {
          description: `Token expira em ${data.expiresIn}s`
        });
      } else {
        toast.error('Falha na autenticação OAuth', { description: data.error });
      }
      queryClient.invalidateQueries({ queryKey: ['platform-secrets-status'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao testar conexão', { description: error.message });
    },
  });

  const isConfigured = secretStatus?.status === 'configured';
  const isPartial = secretStatus?.status === 'partial';
  const clientIdConfigured = secretStatus?.secrets?.LOGGI_CLIENT_ID || false;
  const clientSecretConfigured = secretStatus?.secrets?.LOGGI_CLIENT_SECRET || false;
  const externalServiceIdConfigured = secretStatus?.secrets?.LOGGI_EXTERNAL_SERVICE_ID || false;

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
        <div className="p-3 rounded-lg bg-purple-500/10">
          <Truck className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Logística (Loggi)</h2>
          <p className="text-sm text-muted-foreground">
            OAuth para entregas Loggi (cada tenant fornece seu company_id)
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          A integração Loggi usa OAuth centralizado. Cada tenant configura seu próprio
          company_id para criar coletas e rastrear entregas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Credenciais OAuth Loggi
              </CardTitle>
              <CardDescription>
                Credenciais de aplicação para autenticação OAuth 2.0
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
                Parcial ({secretStatus?.configuredCount}/{secretStatus?.totalCount})
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
          <div className="grid gap-4 md:grid-cols-3">
            <CredentialEditor
              credentialKey="LOGGI_CLIENT_ID"
              label="Novo Client ID"
              description="Client ID do aplicativo OAuth"
              isConfigured={clientIdConfigured}
              preview={secretStatus?.previews?.LOGGI_CLIENT_ID}
              source={secretStatus?.sources?.LOGGI_CLIENT_ID as 'db' | 'env' | null}
              placeholder="Cole o Client ID aqui..."
            />
            <CredentialEditor
              credentialKey="LOGGI_CLIENT_SECRET"
              label="Novo Client Secret"
              description="Client Secret do aplicativo OAuth"
              isConfigured={clientSecretConfigured}
              preview={secretStatus?.previews?.LOGGI_CLIENT_SECRET}
              source={secretStatus?.sources?.LOGGI_CLIENT_SECRET as 'db' | 'env' | null}
              placeholder="Cole o Client Secret aqui..."
            />
            <CredentialEditor
              credentialKey="LOGGI_EXTERNAL_SERVICE_ID"
              label="Novo External Service ID"
              description="ID do serviço externo Loggi"
              isConfigured={externalServiceIdConfigured}
              preview={secretStatus?.previews?.LOGGI_EXTERNAL_SERVICE_ID}
              source={secretStatus?.sources?.LOGGI_EXTERNAL_SERVICE_ID as 'db' | 'env' | null}
              placeholder="Cole o External Service ID aqui..."
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={!clientIdConfigured || !clientSecretConfigured || testConnectionMutation.isPending}
            >
              {testConnectionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Autenticação OAuth
            </Button>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Como funciona</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                Você configurou as credenciais OAuth via Lovable Cloud Secrets
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                Cada tenant configura seu próprio company_id no painel
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                O sistema autentica via OAuth e usa o company_id do tenant
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                Coletas são criadas e rastreadas na conta do tenant
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
              <span>Cotação de frete</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Criação de coleta</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Geração de etiqueta</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Rastreamento de pacotes</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Webhooks de status</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Múltiplos tenants</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="https://docs.loggi.com/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Documentação Loggi
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://www.loggi.com/para-empresas/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Loggi para Empresas
          </a>
        </Button>
      </div>
    </div>
  );
}
