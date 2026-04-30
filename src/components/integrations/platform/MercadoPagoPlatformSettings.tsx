import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2, Info, CreditCard, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { CredentialEditor } from "../CredentialEditor";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";

/**
 * Mercado Pago — credenciais do APP INTEGRADOR (OAuth).
 *
 * Esta tela configura APENAS o app de developer do Mercado Pago, usado para que
 * lojistas conectem suas próprias contas MP via OAuth.
 *
 * As credenciais RECEBEDORAS da plataforma (assinaturas, créditos, plano inicial)
 * ficam em "Minha Loja → Integrações → Pagamentos" do tenant admin — mesmo lugar
 * que qualquer lojista usa para configurar seu gateway recebedor.
 */
export function MercadoPagoPlatformSettings() {
  const { data: integrationData, isLoading } = usePlatformIntegrationStatus("mercadopago_platform");

  const clientIdConfigured = !!integrationData?.secrets?.MP_CLIENT_ID;
  const clientSecretConfigured = !!integrationData?.secrets?.MP_CLIENT_SECRET;
  const allConfigured = clientIdConfigured && clientSecretConfigured;

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
        <div className="p-3 rounded-lg bg-sky-500/10">
          <CreditCard className="h-6 w-6 text-sky-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Mercado Pago — Integrador</h2>
          <p className="text-sm text-muted-foreground">
            App de developer usado para conectar contas MP de lojistas via OAuth
          </p>
        </div>
      </div>

      <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-900/10">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">
          Esta tela é só do integrador
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300 space-y-2">
          <p>
            <strong>Aqui:</strong> Client ID e Client Secret do app Mercado Pago de developer.
            São usados para gerar a URL de OAuth quando um lojista conecta sua conta MP.
          </p>
          <p>
            <strong>Recebedor da plataforma</strong> (assinaturas, créditos de IA, plano inicial)
            é configurado em{" "}
            <Link
              to="/integrations"
              className="font-semibold underline inline-flex items-center gap-1"
            >
              Minha Loja → Integrações → Pagamentos
              <ArrowRight className="h-3 w-3" />
            </Link>
            , igual qualquer lojista — porque o tenant admin também opera como loja própria.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <CreditCard className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <CardTitle className="text-base">App Mercado Pago (OAuth)</CardTitle>
                <CardDescription>Client ID e Client Secret do app de developer</CardDescription>
              </div>
            </div>
            <Badge
              variant={allConfigured ? "default" : "outline"}
              className={allConfigured ? "bg-green-500/10 text-green-600" : ""}
            >
              {allConfigured ? (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              ) : (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {allConfigured ? "Configurado" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialEditor
            credentialKey="MP_CLIENT_ID"
            label="Client ID"
            description="ID público do app no painel de developers do Mercado Pago"
            isConfigured={clientIdConfigured}
            preview={integrationData?.previews?.MP_CLIENT_ID}
            source={integrationData?.sources?.MP_CLIENT_ID as "db" | "env" | null}
          />
          <CredentialEditor
            credentialKey="MP_CLIENT_SECRET"
            label="Client Secret"
            description="Chave secreta do app — usada para trocar code por access_token na conexão OAuth"
            isConfigured={clientSecretConfigured}
            preview={integrationData?.previews?.MP_CLIENT_SECRET}
            source={integrationData?.sources?.MP_CLIENT_SECRET as "db" | "env" | null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
