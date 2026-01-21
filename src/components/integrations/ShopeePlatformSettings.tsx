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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Logo da Shopee
const ShopeeLogo = () => (
  <svg viewBox="0 0 48 48" className="w-10 h-10">
    <rect width="48" height="48" rx="8" fill="#EE4D2D" />
    <path
      d="M24 10c-2.8 0-5.1 2.1-5.4 4.8h-2.1c-1.6 0-2.9 1.3-2.9 2.9v15.4c0 1.6 1.3 2.9 2.9 2.9h15c1.6 0 2.9-1.3 2.9-2.9V17.7c0-1.6-1.3-2.9-2.9-2.9h-2.1c-.3-2.7-2.6-4.8-5.4-4.8zm0 2.5c1.5 0 2.8 1.2 2.9 2.7h-5.8c.1-1.5 1.4-2.7 2.9-2.7zm0 8.3c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z"
      fill="white"
    />
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

export function ShopeePlatformSettings() {
  const queryClient = useQueryClient();
  const [partnerId, setPartnerId] = useState("");
  const [partnerKey, setPartnerKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // URLs para configuração
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const redirectUri = `${supabaseUrl}/functions/v1/shopee-oauth-callback`;
  const webhookUri = `${supabaseUrl}/functions/v1/shopee-webhook`;

  // Buscar status das credenciais
  const { data: integrationData, isLoading, refetch } = useQuery({
    queryKey: ["shopee-platform-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("platform-secrets-check", {
        body: {},
      });

      if (error) throw error;
      
      // Buscar a integração da Shopee
      const shopeeIntegration = data?.integrations?.find(
        (i: IntegrationData) => i.key === "shopee"
      );
      
      console.log('[ShopeePlatformSettings] Fetched data:', shopeeIntegration);
      return shopeeIntegration as IntegrationData | null;
    },
    staleTime: 0,
  });

  const partnerIdConfigured = integrationData?.secrets?.SHOPEE_PARTNER_ID ?? false;
  const partnerKeyConfigured = integrationData?.secrets?.SHOPEE_PARTNER_KEY ?? false;
  const partnerIdPreview = integrationData?.previews?.SHOPEE_PARTNER_ID ?? "";
  const partnerKeyPreview = integrationData?.previews?.SHOPEE_PARTNER_KEY ?? "";
  const allConfigured = partnerIdConfigured && partnerKeyConfigured;

  // Mutation para salvar credenciais
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates: { key: string; value: string }[] = [];
      
      if (partnerId.trim()) {
        updates.push({ key: "SHOPEE_PARTNER_ID", value: partnerId.trim() });
      }
      if (partnerKey.trim()) {
        updates.push({ key: "SHOPEE_PARTNER_KEY", value: partnerKey.trim() });
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
      setPartnerId("");
      setPartnerKey("");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["shopee-platform-credentials"] });
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
      await queryClient.invalidateQueries({ queryKey: ["shopee-platform-credentials"] });
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
            <ShopeeLogo />
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Shopee
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
                Configurações globais da integração com Shopee
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              {partnerIdConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Partner ID</span>
            </div>
            <div className="flex items-center gap-2">
              {partnerKeyConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Partner Key</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credenciais Salvas */}
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
            {/* Partner ID */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <Label className="text-sm font-medium">Partner ID</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {partnerIdPreview || "••••••••"}
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
                    <AlertDialogTitle>Remover Partner ID?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desconfigurar a integração. Tenants conectados perderão acesso à Shopee.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeMutation.mutate("SHOPEE_PARTNER_ID")}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Partner Key */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex-1">
                <Label className="text-sm font-medium">Partner Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono bg-background px-2 py-1 rounded">
                    {partnerKeyPreview || "••••••••"}
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
                    <AlertDialogTitle>Remover Partner Key?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá desconfigurar a integração. Tenants conectados perderão acesso à Shopee.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => removeMutation.mutate("SHOPEE_PARTNER_KEY")}
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

      {/* URLs para configurar no console Shopee */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">URLs para o Shopee Open Platform</CardTitle>
          <CardDescription>
            Configure estas URLs no console de desenvolvedores da Shopee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-orange-500/30 bg-orange-50 dark:bg-orange-900/10">
            <Info className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-800 dark:text-orange-200">Importante</AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-300">
              Acesse o{" "}
              <a
                href="https://open.shopee.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Shopee Open Platform
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
              <Label className="text-sm font-medium">URL de Notificações (Webhook/Push)</Label>
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
                    ? "Atualize as credenciais da Shopee" 
                    : "Obtenha estas credenciais no Shopee Open Platform"}
                </CardDescription>
              </div>
              {isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setPartnerId("");
                    setPartnerKey("");
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="partnerId">Partner ID</Label>
              <Input
                id="partnerId"
                type="text"
                placeholder={partnerIdConfigured ? `Atual: ${partnerIdPreview}` : "Cole seu Partner ID aqui"}
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
              />
              {partnerIdConfigured && isEditing && (
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter o valor atual: {partnerIdPreview}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="partnerKey">Partner Key (Secret)</Label>
              <div className="relative">
                <Input
                  id="partnerKey"
                  type={showSecret ? "text" : "password"}
                  placeholder={partnerKeyConfigured ? `Atual: ${partnerKeyPreview}` : "Cole seu Partner Key aqui"}
                  value={partnerKey}
                  onChange={(e) => setPartnerKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {partnerKeyConfigured && isEditing && (
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para manter o valor atual: {partnerKeyPreview}
                </p>
              )}
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (!partnerId.trim() && !partnerKey.trim())}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Atualizar Credenciais" : "Salvar Credenciais"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como obter as credenciais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Acesse o{" "}
              <a
                href="https://open.shopee.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Shopee Open Platform
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Faça login com sua conta de desenvolvedor</li>
            <li>Crie ou selecione sua aplicação</li>
            <li>Escolha a região/país (Brasil)</li>
            <li>Copie o <strong>Partner ID</strong> e <strong>Partner Key</strong></li>
            <li>Configure as URLs de Redirect e Webhook acima</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
