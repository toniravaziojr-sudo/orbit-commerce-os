import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, Calendar, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "../CredentialEditor";
import { useQuery } from "@tanstack/react-query";

export function LatePlatformSettings() {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    configured: boolean;
    valid?: boolean;
  } | null>(null);

  // Check Late status using platform-secrets-check
  const { data: secretStatus, isLoading } = useQuery({
    queryKey: ['platform-secrets-status', 'late'],
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
      
      const late = response.data.integrations?.find((i: any) => i.key === 'late');
      return late || null;
    },
  });

  const isConfigured = secretStatus?.status === 'configured';
  const apiKeyPreview = secretStatus?.previews?.LATE_API_KEY || '';
  const apiKeySource = secretStatus?.sources?.LATE_API_KEY;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("late-test-connection", {
        body: {},
      });

      if (error) {
        setTestResult({
          success: false,
          message: error.message || "Erro ao testar conexão",
          configured: false,
        });
        return;
      }

      setTestResult({
        success: data.success,
        message: data.message || data.error || "Teste realizado",
        configured: data.configured ?? false,
        valid: data.valid,
      });

      if (data.success) {
        toast.success("Late API funcionando!");
      } else {
        toast.error(data.error || "Falha no teste");
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || "Erro interno",
        configured: false,
      });
      toast.error("Erro ao testar");
    } finally {
      setIsTesting(false);
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/late-webhook`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Late - Agendamento de Publicações</CardTitle>
              <CardDescription>
                Configure a API Late para permitir que tenants agendem posts em redes sociais.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Fluxo:</strong> Você configura a API Key aqui (global). 
              Cada tenant conecta suas próprias contas de Facebook/Instagram em Integrações.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">Credenciais da API</h4>
            
            <CredentialEditor
              credentialKey="LATE_API_KEY"
              label="Late API Key"
              description="Chave de API obtida em getlate.dev"
              isConfigured={isConfigured}
              preview={apiKeyPreview}
              source={apiKeySource as 'db' | 'env' | null}
              placeholder="late_..."
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium">URLs de Configuração</h4>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  <strong>Webhook URL</strong> - Configure esta URL no painel da Late em "API Keys" → Webhook:
                </p>
                <code className="block rounded-md bg-muted px-3 py-2 text-sm break-all">
                  {webhookUrl}
                </code>
              </div>
            </div>

            <Alert variant="default" className="bg-muted/50">
              <AlertDescription className="text-sm">
                <strong>Eventos a habilitar no Webhook:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>post.scheduled</li>
                  <li>post.published</li>
                  <li>post.failed</li>
                  <li>post.partial</li>
                  <li>account.disconnected</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={handleTestConnection} disabled={isTesting}>
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                "Testar Conexão"
              )}
            </Button>

            <Button variant="outline" asChild>
              <a href="https://getlate.dev" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Documentação Late
              </a>
            </Button>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
