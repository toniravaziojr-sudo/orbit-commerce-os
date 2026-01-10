import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Logo do ML
const MercadoLivreLogo = () => (
  <svg viewBox="0 0 48 48" className="w-10 h-10">
    <circle cx="24" cy="24" r="24" fill="#FFE600" />
    <path
      d="M24 8C15.2 8 8 15.2 8 24s7.2 16 16 16 16-7.2 16-16S32.8 8 24 8zm0 28c-6.6 0-12-5.4-12-12s5.4-12 12-12 12 5.4 12 12-5.4 12-12 12z"
      fill="#2D3277"
    />
    <path
      d="M24 14c-2.2 0-4 1.8-4 4v4c0 2.2 1.8 4 4 4s4-1.8 4-4v-4c0-2.2-1.8-4-4-4zm0 10c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2z"
      fill="#2D3277"
    />
    <circle cx="24" cy="30" r="3" fill="#2D3277" />
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

export function MeliPlatformSettings() {
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // URLs para configuração
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const redirectUri = `${supabaseUrl}/functions/v1/meli-oauth-callback`;
  const webhookUri = `${supabaseUrl}/functions/v1/meli-webhook`;

  // Buscar status das credenciais
  const { data: integrationData, isLoading } = useQuery({
    queryKey: ["meli-platform-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("platform-secrets-check", {
        body: {},
      });

      if (error) throw error;
      
      // Buscar a integração do Mercado Livre
      const meliIntegration = data?.integrations?.find(
        (i: IntegrationData) => i.key === "mercadolivre"
      );
      
      return meliIntegration as IntegrationData | null;
    },
  });

  const appIdConfigured = integrationData?.secrets?.MELI_APP_ID ?? false;
  const secretConfigured = integrationData?.secrets?.MELI_CLIENT_SECRET ?? false;
  const appIdPreview = integrationData?.previews?.MELI_APP_ID ?? "";
  const secretPreview = integrationData?.previews?.MELI_CLIENT_SECRET ?? "";
  const allConfigured = appIdConfigured && secretConfigured;

  // Mutation para salvar credenciais
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: { key: string; value: string }[] = [];
      
      if (appId.trim()) {
        updates.push({ key: "MELI_APP_ID", value: appId.trim() });
      }
      if (clientSecret.trim()) {
        updates.push({ key: "MELI_CLIENT_SECRET", value: clientSecret.trim() });
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
    onSuccess: () => {
      toast.success("Credenciais salvas com sucesso");
      setAppId("");
      setClientSecret("");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["meli-platform-credentials"] });
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
          credentialValue: null, // Enviar null para remover
          action: "delete",
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao remover credencial");
      }
    },
    onSuccess: () => {
      toast.success("Credencial removida com sucesso");
      queryClient.invalidateQueries({ queryKey: ["meli-platform-credentials"] });
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
            <MercadoLivreLogo />
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Mercado Livre
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
                Configurações globais da integração com Mercado Livre
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {appIdConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>APP ID</span>
            </div>
            <div className="flex items-center gap-2">
              {secretConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Client Secret</span>
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
                  Credenciais configuradas para a integração
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
            {/* APP ID */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <Label className="text-sm font-medium">APP ID / Client ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {appIdPreview || "••••••••"}
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
                    <AlertDialogTitle>Remover APP ID?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desconfigurar a integração. Tenants conectados perderão acesso ao Mercado Livre.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeMutation.mutate("MELI_APP_ID")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Client Secret */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <Label className="text-sm font-medium">Client Secret</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {secretPreview || "••••••••"}
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
                    <AlertDialogTitle>Remover Client Secret?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desconfigurar a integração. Tenants conectados perderão acesso ao Mercado Livre.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeMutation.mutate("MELI_CLIENT_SECRET")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* URLs para configurar no DevCenter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URLs para o DevCenter</CardTitle>
          <CardDescription>
            Configure estas URLs no painel de desenvolvedores do Mercado Livre
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-900/10">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">Importante</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              Acesse o{" "}
              <a
                href="https://developers.mercadolivre.com.br/devcenter"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                DevCenter do Mercado Livre
              </a>
              {" "}e configure as URLs abaixo na sua aplicação.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Redirect URI (OAuth)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={redirectUri} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(redirectUri, "Redirect URI")}
                >
                  {copiedUrl === "Redirect URI" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">URL de Notificações (Webhook)</Label>
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
          </div>
        </CardContent>
      </Card>

      {/* Formulário de credenciais (quando não configuradas ou editando) */}
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
                    ? "Atualize as credenciais do Mercado Livre" 
                    : "Obtenha estas credenciais no DevCenter do Mercado Livre"}
                </CardDescription>
              </div>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setAppId("");
                    setClientSecret("");
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appId">APP ID / Client ID</Label>
              <Input
                id="appId"
                type="text"
                placeholder={appIdConfigured ? `Atual: ${appIdPreview}` : "Cole seu APP ID aqui"}
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
              {appIdConfigured && isEditing && (
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter o valor atual: {appIdPreview}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="clientSecret"
                  type={showSecret ? "text" : "password"}
                  placeholder={secretConfigured ? `Atual: ${secretPreview}` : "Cole seu Client Secret aqui"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {secretConfigured && isEditing && (
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter o valor atual: {secretPreview}
                </p>
              )}
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href="https://developers.mercadolivre.com.br/devcenter"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir DevCenter
                </a>
              </Button>

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (!appId.trim() && !clientSecret.trim())}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isEditing ? "Atualizar Credenciais" : "Salvar Credenciais"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
