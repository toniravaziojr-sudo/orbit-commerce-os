import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  ExternalLink,
  Info,
  Copy,
  Check,
  Trash2,
  Edit3,
  Key,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Logo do Mercado Pago
const MercadoPagoLogo = () => (
  <svg viewBox="0 0 48 48" className="w-10 h-10">
    <rect width="48" height="48" rx="8" fill="#00AEEF" />
    <path
      d="M24 10C16.3 10 10 16.3 10 24s6.3 14 14 14 14-6.3 14-14S31.7 10 24 10zm0 24c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z"
      fill="white"
    />
    <path
      d="M24 16c-1.7 0-3 1.3-3 3v2c0 1.7 1.3 3 3 3s3-1.3 3-3v-2c0-1.7-1.3-3-3-3zm0 6c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1s1 .4 1 1v2c0 .6-.4 1-1 1z"
      fill="white"
    />
    <circle cx="24" cy="28" r="2" fill="white" />
  </svg>
);

interface IntegrationData {
  key: string;
  name: string;
  description: string;
  icon: string;
  docs: string;
  secrets: Record<string, boolean>;
  previews: Record<string, string>;
  sources: Record<string, string>;
  status: string;
  configuredCount: number;
  totalCount: number;
}

/**
 * MercadoPagoPlatformSettings
 * 
 * Componente para gerenciar credenciais do Mercado Pago da PLATAFORMA (SaaS billing).
 * Estas credenciais são usadas para cobrar assinaturas dos clientes do Comando Central,
 * NÃO para processar pagamentos das lojas dos clientes (que fica em payment_providers por tenant).
 * 
 * SEPARAÇÃO IMPORTANTE:
 * - Platform (SaaS): MP_ACCESS_TOKEN, MP_PUBLIC_KEY → Billing de assinaturas
 * - Tenant (Checkout): payment_providers.credentials → Pagamentos da loja do cliente
 */
export function MercadoPagoPlatformSettings() {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // URLs para configuração (via Cloudflare proxy - domínio público)
  const webhookUri = `https://app.comandocentral.com.br/integrations/billing/webhook`;

  // Buscar status das credenciais
  const { data: integrationData, isLoading, refetch } = useQuery({
    queryKey: ["mp-platform-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("platform-secrets-check", {
        body: {},
      });

      if (error) throw error;
      
      // Buscar a integração do Mercado Pago Platform
      const mpIntegration = data?.integrations?.find(
        (i: IntegrationData) => i.key === "mercadopago_platform"
      );
      
      console.log('[MercadoPagoPlatformSettings] Fetched data:', mpIntegration);
      return mpIntegration as IntegrationData | null;
    },
    staleTime: 0,
  });

  const accessTokenConfigured = integrationData?.secrets?.MP_ACCESS_TOKEN ?? false;
  const publicKeyConfigured = integrationData?.secrets?.MP_PUBLIC_KEY ?? false;
  const webhookSecretConfigured = integrationData?.secrets?.MP_WEBHOOK_SECRET ?? false;
  const accessTokenPreview = integrationData?.previews?.MP_ACCESS_TOKEN ?? "";
  const publicKeyPreview = integrationData?.previews?.MP_PUBLIC_KEY ?? "";
  const webhookSecretPreview = integrationData?.previews?.MP_WEBHOOK_SECRET ?? "";
  const allConfigured = accessTokenConfigured && publicKeyConfigured;

  // Mutation para salvar credenciais
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: { key: string; value: string }[] = [];
      
      if (accessToken.trim()) {
        updates.push({ key: "MP_ACCESS_TOKEN", value: accessToken.trim() });
      }
      if (publicKey.trim()) {
        updates.push({ key: "MP_PUBLIC_KEY", value: publicKey.trim() });
      }
      if (webhookSecret.trim()) {
        updates.push({ key: "MP_WEBHOOK_SECRET", value: webhookSecret.trim() });
      }

      if (updates.length === 0) {
        throw new Error("Nenhum valor para salvar");
      }

      for (const update of updates) {
        const { data, error } = await supabase.functions.invoke("platform-credentials-update", {
          body: {
            credentialKey: update.key,
            credentialValue: update.value,
          },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || `Erro ao salvar ${update.key}`);
        }
      }
    },
    onSuccess: async () => {
      toast.success("Credenciais salvas com sucesso");
      setAccessToken("");
      setPublicKey("");
      setWebhookSecret("");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["mp-platform-credentials"] });
      await refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao salvar credenciais");
    },
  });

  // Mutation para remover credenciais
  const removeMutation = useMutation({
    mutationFn: async (credentialKey: string) => {
      const { data, error } = await supabase.functions.invoke("platform-credentials-update", {
        body: {
          credentialKey,
          credentialValue: null,
          action: "delete",
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao remover credencial");
      }
    },
    onSuccess: async () => {
      toast.success("Credencial removida com sucesso");
      await queryClient.invalidateQueries({ queryKey: ["mp-platform-credentials"] });
      await refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao remover credencial");
    },
  });

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
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className={allConfigured ? "border-green-500/30" : "border-amber-500/30"}>
        <CardHeader>
          <div className="flex items-center gap-4">
            <MercadoPagoLogo />
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Mercado Pago (Billing SaaS)
                {allConfigured ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Configurado
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    <Settings className="h-3 w-3 mr-1" />
                    Configuração Pendente
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Credenciais para cobrar assinaturas do Comando Central
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {accessTokenConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Access Token</span>
            </div>
            <div className="flex items-center gap-2">
              {publicKeyConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Public Key</span>
            </div>
            <div className="flex items-center gap-2">
              {webhookSecretConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>Webhook Secret (opcional)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credenciais Salvas (quando configuradas) */}
      {allConfigured && !isEditing && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Credenciais Salvas
                </CardTitle>
                <CardDescription>
                  Credenciais configuradas para billing da plataforma
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Access Token */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <Label className="text-sm font-medium">Access Token</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {accessTokenPreview || "••••••••"}
                  </code>
                  <Badge variant="secondary" className="text-xs">
                    Configurado
                  </Badge>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover Access Token?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desconfigurar o billing. Novos pagamentos de assinatura não serão processados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeMutation.mutate("MP_ACCESS_TOKEN")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Public Key */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <Label className="text-sm font-medium">Public Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {publicKeyPreview || "••••••••"}
                  </code>
                  <Badge variant="secondary" className="text-xs">
                    Configurado
                  </Badge>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover Public Key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desconfigurar o checkout de billing.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeMutation.mutate("MP_PUBLIC_KEY")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Webhook Secret */}
            {webhookSecretConfigured && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Webhook Secret</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                      {webhookSecretPreview || "••••••••"}
                    </code>
                    <Badge variant="secondary" className="text-xs">
                      Configurado
                    </Badge>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      disabled={removeMutation.isPending}
                    >
                      {removeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover Webhook Secret?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Webhooks continuarão funcionando, mas sem validação de assinatura.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeMutation.mutate("MP_WEBHOOK_SECRET")}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* URLs para configurar no DevCenter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URLs para o Mercado Pago</CardTitle>
          <CardDescription>
            Configure esta URL no painel de desenvolvedores do Mercado Pago para webhooks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-900/10">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Importante</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Acesse o{" "}
              <a
                href="https://www.mercadopago.com.br/developers/panel"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Painel de Desenvolvedores do Mercado Pago
              </a>
              {" "}→ Sua aplicação → Webhooks e configure a URL abaixo.
              <br />
              <strong>Eventos recomendados:</strong> payment, subscription_preapproval
            </AlertDescription>
          </Alert>

          <div>
            <Label className="text-sm font-medium">URL de Webhook (Billing)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUri} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUri, "Webhook URL")}
              >
                {copiedUrl === "Webhook URL" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de credenciais */}
      {(!allConfigured || isEditing) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {isEditing ? "Editar Credenciais" : "Credenciais da Aplicação"}
                </CardTitle>
                <CardDescription>
                  {isEditing 
                    ? "Atualize as credenciais do Mercado Pago" 
                    : "Obtenha estas credenciais no Painel de Desenvolvedores do Mercado Pago"}
                </CardDescription>
              </div>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setAccessToken("");
                    setPublicKey("");
                    setWebhookSecret("");
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token (Produção)</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showSecret ? "text" : "password"}
                  placeholder={accessTokenConfigured ? `Atual: ${accessTokenPreview}` : "APP_USR-..."}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Encontre em: Suas credenciais → Produção → Access Token
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicKey">Public Key</Label>
              <Input
                id="publicKey"
                type="text"
                placeholder={publicKeyConfigured ? `Atual: ${publicKeyPreview}` : "APP_USR-..."}
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Suas credenciais → Produção → Public Key
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Webhook Secret (opcional)</Label>
              <Input
                id="webhookSecret"
                type={showSecret ? "text" : "password"}
                placeholder={webhookSecretConfigured ? `Atual: ${webhookSecretPreview}` : "Opcional - para validar assinatura"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usado para validar webhooks. Encontre em: Webhooks → Segredo
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                asChild
              >
                <a
                  href="https://www.mercadopago.com.br/developers/panel"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Painel MP
                </a>
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (!accessToken.trim() && !publicKey.trim() && !webhookSecret.trim())}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
