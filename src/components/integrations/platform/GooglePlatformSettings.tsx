import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ExternalLink, Globe, Info, Loader2 } from "lucide-react";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";
import { CredentialEditor } from "../CredentialEditor";

export function GooglePlatformSettings() {
  const { data: credentials, isLoading } = usePlatformIntegrationStatus("google_platform");

  const clientIdConfigured = !!credentials?.secrets?.GOOGLE_CLIENT_ID;
  const clientSecretConfigured = !!credentials?.secrets?.GOOGLE_CLIENT_SECRET;
  const allConfigured = clientIdConfigured && clientSecretConfigured;

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
            <Badge variant={allConfigured ? "default" : "outline"} className={allConfigured ? "bg-green-500/10 text-green-600" : ""}>
              {allConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {allConfigured ? "Configurado" : "Pendente"}
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
    </div>
  );
}
