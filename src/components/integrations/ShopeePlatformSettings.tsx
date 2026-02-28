import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2, Info, Copy, Check, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "./CredentialEditor";

export function ShopeePlatformSettings() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const redirectUri = `https://app.comandocentral.com.br/integrations/shopee/callback`;
  const webhookUri = `https://app.comandocentral.com.br/integrations/shopee/webhook`;

  const { data: integrationData, isLoading } = useQuery({
    queryKey: ["platform-secrets-status", "shopee"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const response = await supabase.functions.invoke("platform-secrets-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      return (response.data.integrations as any[]).find((i) => i.key === "shopee") || null;
    },
  });

  const partnerIdConfigured = !!integrationData?.secrets?.SHOPEE_PARTNER_ID;
  const partnerKeyConfigured = !!integrationData?.secrets?.SHOPEE_PARTNER_KEY;
  const allConfigured = partnerIdConfigured && partnerKeyConfigured;

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
        <div className="p-3 rounded-lg bg-orange-500/10">
          <Store className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Shopee</h2>
          <p className="text-sm text-muted-foreground">Integração global com Shopee</p>
        </div>
      </div>

      {/* Credenciais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Store className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">Shopee App</CardTitle>
                <CardDescription>Partner ID e Key do Shopee Open Platform</CardDescription>
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
            credentialKey="SHOPEE_PARTNER_ID"
            label="Partner ID"
            description="Partner ID do Shopee Open Platform"
            isConfigured={partnerIdConfigured}
            preview={integrationData?.previews?.SHOPEE_PARTNER_ID}
            source={integrationData?.sources?.SHOPEE_PARTNER_ID as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="SHOPEE_PARTNER_KEY"
            label="Partner Key"
            description="Partner Key (Secret) da Shopee"
            isConfigured={partnerKeyConfigured}
            preview={integrationData?.previews?.SHOPEE_PARTNER_KEY}
            source={integrationData?.sources?.SHOPEE_PARTNER_KEY as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* URLs para Shopee Console */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URLs para o Shopee Open Platform</CardTitle>
          <CardDescription>Configure estas URLs no console de desenvolvedores da Shopee</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-orange-500/30 bg-orange-50 dark:bg-orange-900/10">
            <Info className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800 dark:text-orange-200">Importante</AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              Acesse o{" "}
              <a href="https://open.shopee.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                Shopee Open Platform
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
              <Label className="text-sm font-medium">URL de Notificações (Webhook/Push)</Label>
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
