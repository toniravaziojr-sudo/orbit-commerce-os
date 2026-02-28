import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ExternalLink, Info, Loader2, Music2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CredentialEditor } from "../CredentialEditor";

export function TikTokAdsPlatformSettings() {
  const { data: credentials, isLoading } = useQuery({
    queryKey: ["platform-secrets-status", "tiktok-ads"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const response = await supabase.functions.invoke("platform-secrets-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      return (response.data.integrations as any[]).find((i) => i.key === "tiktok_ads_platform") || null;
    },
  });

  const appIdConfigured = !!credentials?.secrets?.TIKTOK_APP_ID;
  const appSecretConfigured = !!credentials?.secrets?.TIKTOK_APP_SECRET;
  const allConfigured = appIdConfigured && appSecretConfigured;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-pink-500/10">
          <Music2 className="h-6 w-6 text-pink-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">TikTok Ads</h2>
          <p className="text-sm text-muted-foreground">Pixel, CAPI, Campanhas de anúncios</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Credenciais para <strong>TikTok Ads</strong> (Pixel, CAPI, Campanhas).
          Registre seu app no{" "}
          <a href="https://business-api.tiktok.com/portal/apps" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            Business Developer Portal <ExternalLink className="h-3 w-3" />
          </a>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Music2 className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <CardTitle className="text-base">TikTok Ads App</CardTitle>
                <CardDescription>App ID e Secret para TikTok Business API</CardDescription>
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
            credentialKey="TIKTOK_APP_ID"
            label="App ID"
            description="App ID do TikTok Business Developer Portal"
            isConfigured={appIdConfigured}
            preview={credentials?.previews?.TIKTOK_APP_ID}
            source={credentials?.sources?.TIKTOK_APP_ID as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="TIKTOK_APP_SECRET"
            label="App Secret"
            description="App Secret para TikTok Ads API"
            isConfigured={appSecretConfigured}
            preview={credentials?.previews?.TIKTOK_APP_SECRET}
            source={credentials?.sources?.TIKTOK_APP_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
