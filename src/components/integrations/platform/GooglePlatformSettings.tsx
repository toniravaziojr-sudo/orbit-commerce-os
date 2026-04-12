import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ExternalLink, Globe, Info, Loader2, Megaphone } from "lucide-react";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";
import { CredentialEditor } from "../CredentialEditor";

export function GooglePlatformSettings() {
  const { data: credentials, isLoading } = usePlatformIntegrationStatus("google_platform");

  const clientIdConfigured = !!credentials?.secrets?.GOOGLE_CLIENT_ID;
  const clientSecretConfigured = !!credentials?.secrets?.GOOGLE_CLIENT_SECRET;
  const oauthConfigured = clientIdConfigured && clientSecretConfigured;

  const devTokenConfigured = !!credentials?.secrets?.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-blue-500/10">
          <Globe className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Google</h2>
          <p className="text-sm text-muted-foreground">YouTube, Google Ads, Analytics, Merchant Center</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Credenciais OAuth do Google Cloud. Usadas para YouTube, Google Ads, Analytics, Merchant Center e Search Console.
          <Button variant="link" size="sm" className="ml-1 h-auto p-0" asChild>
            <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
              Google Cloud Console <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        </AlertDescription>
      </Alert>

      {/* Google OAuth (Cloud) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Google OAuth</CardTitle>
                <CardDescription>Client ID e Secret para integrações Google</CardDescription>
              </div>
            </div>
            <Badge variant={oauthConfigured ? "default" : "outline"} className={oauthConfigured ? "bg-green-500/10 text-green-600" : ""}>
              {oauthConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {oauthConfigured ? "Configurado" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialEditor
            credentialKey="GOOGLE_CLIENT_ID"
            label="Client ID"
            description="OAuth Client ID do Google Cloud Console"
            isConfigured={clientIdConfigured}
            preview={credentials?.previews?.GOOGLE_CLIENT_ID}
            source={credentials?.sources?.GOOGLE_CLIENT_ID as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="GOOGLE_CLIENT_SECRET"
            label="Client Secret"
            description="OAuth Client Secret"
            isConfigured={clientSecretConfigured}
            preview={credentials?.previews?.GOOGLE_CLIENT_SECRET}
            source={credentials?.sources?.GOOGLE_CLIENT_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* Google Ads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Megaphone className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Google Ads</CardTitle>
                <CardDescription>Developer Token da plataforma</CardDescription>
              </div>
            </div>
            <Badge variant={devTokenConfigured ? "default" : "outline"} className={devTokenConfigured ? "bg-green-500/10 text-green-600" : ""}>
              {devTokenConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {devTokenConfigured ? "Configurado" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="bg-amber-500/5 border-amber-500/20">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              O Developer Token é obtido na conta MCC do Google Ads (API Center). Identifica a plataforma como desenvolvedora autorizada.
              <Button variant="link" size="sm" className="ml-1 h-auto p-0" asChild>
                <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer">
                  Google Ads API Center <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            </AlertDescription>
          </Alert>

          <CredentialEditor
            credentialKey="GOOGLE_ADS_DEVELOPER_TOKEN"
            label="Developer Token"
            description="Token de desenvolvedor da API do Google Ads (obrigatório para todas as chamadas)"
            isConfigured={devTokenConfigured}
            preview={credentials?.previews?.GOOGLE_ADS_DEVELOPER_TOKEN}
            source={credentials?.sources?.GOOGLE_ADS_DEVELOPER_TOKEN as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
