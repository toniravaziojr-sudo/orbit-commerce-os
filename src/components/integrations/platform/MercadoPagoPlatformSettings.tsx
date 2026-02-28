import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2, Info, Copy, Check, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CredentialEditor } from "../CredentialEditor";

export function MercadoPagoPlatformSettings() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const webhookUri = `https://app.comandocentral.com.br/integrations/billing/webhook`;

  const { data: integrationData, isLoading } = useQuery({
    queryKey: ["platform-secrets-status", "mercadopago"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");
      const response = await supabase.functions.invoke("platform-secrets-check", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      return (response.data.integrations as any[]).find((i) => i.key === "mercadopago_platform") || null;
    },
  });

  const accessTokenConfigured = !!integrationData?.secrets?.MP_ACCESS_TOKEN;
  const publicKeyConfigured = !!integrationData?.secrets?.MP_PUBLIC_KEY;
  const webhookSecretConfigured = !!integrationData?.secrets?.MP_WEBHOOK_SECRET;
  const allConfigured = accessTokenConfigured && publicKeyConfigured;

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
        <div className="p-3 rounded-lg bg-sky-500/10">
          <CreditCard className="h-6 w-6 text-sky-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Mercado Pago (Billing SaaS)</h2>
          <p className="text-sm text-muted-foreground">Credenciais para cobrar assinaturas do Comando Central</p>
        </div>
      </div>

      <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-900/10">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Separação Platform vs Tenant</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>Estas credenciais são para cobrar assinaturas do SaaS.</strong>
          <br />
          Os clientes configuram as próprias credenciais MP em{" "}
          <code className="text-xs bg-background px-1 rounded">Integrações → Pagamentos</code> para receber pagamentos nas lojas deles.
        </AlertDescription>
      </Alert>

      {/* Credenciais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10">
                <CreditCard className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <CardTitle className="text-base">Mercado Pago Billing</CardTitle>
                <CardDescription>Access Token, Public Key e Webhook Secret</CardDescription>
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
            credentialKey="MP_ACCESS_TOKEN"
            label="Access Token"
            description="Token de acesso da aplicação Mercado Pago (Production)"
            isConfigured={accessTokenConfigured}
            preview={integrationData?.previews?.MP_ACCESS_TOKEN}
            source={integrationData?.sources?.MP_ACCESS_TOKEN as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="MP_PUBLIC_KEY"
            label="Public Key"
            description="Chave pública para checkout (Production)"
            isConfigured={publicKeyConfigured}
            preview={integrationData?.previews?.MP_PUBLIC_KEY}
            source={integrationData?.sources?.MP_PUBLIC_KEY as 'db' | 'env' | null}
          />
          <CredentialEditor
            credentialKey="MP_WEBHOOK_SECRET"
            label="Webhook Secret"
            description="Opcional — para validação de assinatura dos webhooks"
            isConfigured={webhookSecretConfigured}
            preview={integrationData?.previews?.MP_WEBHOOK_SECRET}
            source={integrationData?.sources?.MP_WEBHOOK_SECRET as 'db' | 'env' | null}
          />
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URL do Webhook</CardTitle>
          <CardDescription>Configure esta URL no painel do Mercado Pago</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label className="text-sm font-medium">Webhook URL</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUri} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUri, "Webhook URL")}>
                {copiedUrl === "Webhook URL" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
