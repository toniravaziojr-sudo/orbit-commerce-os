import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, Info, Copy, Check, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "./CredentialEditor";

export function MeliPlatformSettings() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const redirectUri = `https://app.comandocentral.com.br/integrations/meli/callback`;
  const webhookUri = `https://app.comandocentral.com.br/integrations/meli/webhook`;

  const { data: integrationData, isLoading } = useQuery({
    queryKey: ["platform-secrets-status", "meli"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const response = await supabase.functions.invoke("platform-secrets-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      return (response.data.integrations as any[]).find((i) => i.key === "mercadolivre") || null;
    },
  });

  const appIdConfigured = !!integrationData?.secrets?.MELI_APP_ID;
  const secretConfigured = !!integrationData?.secrets?.MELI_CLIENT_SECRET;
  const allConfigured = appIdConfigured && secretConfigured;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(label);
      toast.success(`${label} copiada!`);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-yellow-500/10">
          <ShoppingBag className="h-6 w-6 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Mercado Livre</h2>
          <p className="text-sm text-muted-foreground">Integração global com Mercado Livre</p>
        </div>
      </div>

      {/* Credenciais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <ShoppingBag className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <CardTitle className="text-base">Mercado Livre App</CardTitle>
                <CardDescription>APP ID e Client Secret do DevCenter</CardDescription>
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
            credentialKey="MELI_APP_ID"
            label="APP ID"
            description="APP ID / Client ID do Mercado Livre"
            isConfigured={appIdConfigured}
            preview={integrationData?.previews?.MELI_APP_ID}
            source={integrationData?.sources?.MELI_APP_ID as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="MELI_CLIENT_SECRET"
            label="Client Secret"
            description="Client Secret do Mercado Livre"
            isConfigured={secretConfigured}
            preview={integrationData?.previews?.MELI_CLIENT_SECRET}
            source={integrationData?.sources?.MELI_CLIENT_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* URLs para DevCenter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URLs para o DevCenter</CardTitle>
          <CardDescription>Configure estas URLs no painel de desenvolvedores do Mercado Livre</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-900/10">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Importante</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Acesse o{" "}
              <a href="https://developers.mercadolivre.com.br/devcenter" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                DevCenter do Mercado Livre
              </a>{" "}
              e configure as URLs abaixo.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Redirect URI (OAuth)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={redirectUri} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(redirectUri, "Redirect URI")}>
                  {copiedUrl === "Redirect URI" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">URL de Notificações (Webhook)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={webhookUri} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUri, "Webhook URL")}>
                  {copiedUrl === "Webhook URL" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
