import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ExternalLink, Globe, Info, Loader2 } from "lucide-react";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";
import { CredentialEditor } from "../CredentialEditor";

export function MetaPlatformSettings() {
  const { data: secretsStatus, isLoading } = usePlatformIntegrationStatus("meta_platform");

  const appIdConfigured = !!secretsStatus?.secrets?.META_APP_ID;
  const appSecretConfigured = !!secretsStatus?.secrets?.META_APP_SECRET;
  const allConfigured = appIdConfigured && appSecretConfigured;

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
          <Globe className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Meta (Facebook / Instagram)</h2>
          <p className="text-sm text-muted-foreground">
            Credenciais do app Meta for Developers
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Usadas para OAuth, Pixel, Catálogo, Ads e WhatsApp Cloud API.
          <Button variant="link" size="sm" className="ml-1 h-auto p-0" asChild>
            <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer">
              Meta for Developers <ExternalLink className="h-3 w-3 ml-1" />
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
                <CardTitle className="text-base">Meta App</CardTitle>
                <CardDescription>App ID e Secret para integrações Meta</CardDescription>
              </div>
            </div>
            <Badge
              variant={allConfigured ? "default" : "outline"}
              className={allConfigured ? "bg-green-500/10 text-green-600" : ""}
            >
              {allConfigured ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
              {allConfigured ? "Configurado" : "Pendente"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialEditor
            credentialKey="META_APP_ID"
            label="App ID"
            description="ID do app Meta for Developers"
            isConfigured={appIdConfigured}
            preview={secretsStatus?.previews?.META_APP_ID}
            source={secretsStatus?.sources?.META_APP_ID as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="META_APP_SECRET"
            label="App Secret"
            description="Chave secreta do app"
            isConfigured={appSecretConfigured}
            preview={secretsStatus?.previews?.META_APP_SECRET}
            source={secretsStatus?.sources?.META_APP_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
