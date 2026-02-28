import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FileText, CheckCircle2, AlertCircle, ExternalLink, Info, Shield, RefreshCw, Loader2, Cloud } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "./CredentialEditor";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";

export function FiscalPlatformSettings() {
  const queryClient = useQueryClient();
  
  const { data: secretStatus, isLoading } = usePlatformIntegrationStatus("nuvem_fiscal");

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fiscal-test-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Conexão estabelecida com sucesso', {
          description: `Ambiente: ${data.environment === 'production' ? 'Produção' : 'Homologação'}`
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

  const isClientIdConfigured = secretStatus?.secrets?.NUVEM_FISCAL_CLIENT_ID || false;
  const isClientSecretConfigured = secretStatus?.secrets?.NUVEM_FISCAL_CLIENT_SECRET || false;
  const isConfigured = isClientIdConfigured && isClientSecretConfigured;

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
        <div className="p-3 rounded-lg bg-blue-500/10">
          <Cloud className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Fiscal (Nuvem Fiscal)</h2>
          <p className="text-sm text-muted-foreground">
            Emissão de NF-e para todos os tenants da plataforma
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          As credenciais Nuvem Fiscal (Client ID e Secret) são utilizadas globalmente para todos os tenants. 
          Cada tenant configura seu próprio CNPJ e certificado digital.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Credenciais Nuvem Fiscal
              </CardTitle>
              <CardDescription>
                Credenciais OAuth2 para comunicação com a API
              </CardDescription>
            </div>
            {isConfigured ? (
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
          <div className="grid gap-4 md:grid-cols-2">
            <CredentialEditor
              credentialKey="NUVEM_FISCAL_CLIENT_ID"
              label="Client ID"
              description="ID do cliente OAuth2 da Nuvem Fiscal"
              isConfigured={isClientIdConfigured}
              preview={secretStatus?.previews?.NUVEM_FISCAL_CLIENT_ID}
              source={secretStatus?.sources?.NUVEM_FISCAL_CLIENT_ID as 'db' | 'env' | null}
              placeholder="Cole o Client ID aqui..."
            />
            <CredentialEditor
              credentialKey="NUVEM_FISCAL_CLIENT_SECRET"
              label="Client Secret"
              description="Secret do cliente OAuth2 da Nuvem Fiscal"
              isConfigured={isClientSecretConfigured}
              preview={secretStatus?.previews?.NUVEM_FISCAL_CLIENT_SECRET}
              source={secretStatus?.sources?.NUVEM_FISCAL_CLIENT_SECRET as 'db' | 'env' | null}
              placeholder="Cole o Client Secret aqui..."
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnectionMutation.mutate()}
              disabled={!isConfigured || testConnectionMutation.isPending}
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
            <h4 className="text-sm font-medium mb-2">Como funciona</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                Configure o Client ID e Client Secret clicando em "Alterar" ou "Configurar"
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                Cada tenant configura seu CNPJ e certificado A1 no painel
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                As NF-e são emitidas usando as credenciais globais + certificado do tenant
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                Nuvem Fiscal se comunica com a SEFAZ de cada estado automaticamente
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
              <span>Emissão de NF-e</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Cancelamento de NF-e</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Carta de Correção (CC-e)</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Inutilização de numeração</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Download de DANFE e XML</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Consulta de status em tempo real</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="https://dev.nuvemfiscal.com.br/docs" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Documentação Nuvem Fiscal
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="https://app.nuvemfiscal.com.br/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Painel Nuvem Fiscal
          </a>
        </Button>
      </div>
    </div>
  );
}
