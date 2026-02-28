import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, ExternalLink, Info, Loader2, ShoppingBag } from "lucide-react";
import { usePlatformIntegrationStatus } from "@/hooks/usePlatformSecretsStatus";
import { CredentialEditor } from "../CredentialEditor";

export function TikTokShopPlatformSettings() {
  const { data: credentials, isLoading } = usePlatformIntegrationStatus("tiktok_shop_platform");

  const appKeyConfigured = !!credentials?.secrets?.TIKTOK_SHOP_APP_KEY;
  const appSecretConfigured = !!credentials?.secrets?.TIKTOK_SHOP_APP_SECRET;
  const allConfigured = appKeyConfigured && appSecretConfigured;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-orange-500/10">
          <ShoppingBag className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">TikTok Shop</h2>
          <p className="text-sm text-muted-foreground">Catálogo, Pedidos, Fulfillment, Devoluções</p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Credenciais para <strong>TikTok Shop</strong> (Catálogo, Pedidos, Fulfillment).
          Registre seu app no{" "}
          <a href="https://partner.tiktokshop.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
            Shop Partner Center <ExternalLink className="h-3 w-3" />
          </a>.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ShoppingBag className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">TikTok Shop App</CardTitle>
                <CardDescription>App Key e Secret para TikTok Shop Partner API</CardDescription>
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
            credentialKey="TIKTOK_SHOP_APP_KEY"
            label="App Key"
            description="App Key do TikTok Shop Partner Center"
            isConfigured={appKeyConfigured}
            preview={credentials?.previews?.TIKTOK_SHOP_APP_KEY}
            source={credentials?.sources?.TIKTOK_SHOP_APP_KEY as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="TIKTOK_SHOP_APP_SECRET"
            label="App Secret"
            description="App Secret para TikTok Shop API"
            isConfigured={appSecretConfigured}
            preview={credentials?.previews?.TIKTOK_SHOP_APP_SECRET}
            source={credentials?.sources?.TIKTOK_SHOP_APP_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
