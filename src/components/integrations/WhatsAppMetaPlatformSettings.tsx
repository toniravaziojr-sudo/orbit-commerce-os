import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, Copy, Check, ExternalLink, Shield, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface MetaCredentials {
  META_APP_ID: string;
  META_APP_SECRET: string;
  META_GRAPH_API_VERSION: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
}

const DEFAULT_GRAPH_VERSION = "v21.0";

export function WhatsAppMetaPlatformSettings() {
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [formData, setFormData] = useState<MetaCredentials>({
    META_APP_ID: "",
    META_APP_SECRET: "",
    META_GRAPH_API_VERSION: DEFAULT_GRAPH_VERSION,
    META_WEBHOOK_VERIFY_TOKEN: "",
  });

  // Fetch existing credentials
  const { data: credentials, isLoading } = useQuery({
    queryKey: ["meta-whatsapp-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_credentials")
        .select("credential_key, credential_value")
        .in("credential_key", ["META_APP_ID", "META_APP_SECRET", "META_GRAPH_API_VERSION", "META_WEBHOOK_VERIFY_TOKEN"])
        .eq("is_active", true);

      if (error) throw error;

      const credMap: Record<string, string> = {};
      data?.forEach((c) => {
        credMap[c.credential_key] = c.credential_value;
      });

      // Set form data
      setFormData({
        META_APP_ID: credMap.META_APP_ID || "",
        META_APP_SECRET: credMap.META_APP_SECRET || "",
        META_GRAPH_API_VERSION: credMap.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION,
        META_WEBHOOK_VERIFY_TOKEN: credMap.META_WEBHOOK_VERIFY_TOKEN || "",
      });

      return credMap;
    },
  });

  // Save credentials mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(formData).filter(([_, value]) => value.trim());
      
      for (const [key, value] of entries) {
        const { error } = await supabase
          .from("platform_credentials")
          .upsert({
            credential_key: key,
            credential_value: value,
            is_active: true,
            updated_at: new Date().toISOString(),
          }, { onConflict: "credential_key" });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Credenciais salvas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["meta-whatsapp-credentials"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar credenciais");
    },
  });

  // Generate verify token
  const generateVerifyToken = () => {
    const token = crypto.randomUUID();
    setFormData((prev) => ({ ...prev, META_WEBHOOK_VERIFY_TOKEN: token }));
    toast.success("Token de verificação gerado!");
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Webhook URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/meta-whatsapp-webhook`;

  const hasCredentials = credentials?.META_APP_ID && credentials?.META_APP_SECRET;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-base">Meta WhatsApp Cloud API - Integrador</CardTitle>
            </div>
            {hasCredentials ? (
              <Badge className="bg-green-500">Configurado</Badge>
            ) : (
              <Badge variant="secondary">Não Configurado</Badge>
            )}
          </div>
          <CardDescription>
            Configure as credenciais do seu App Meta para permitir que os tenants conectem seus WhatsApp Business.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Credenciais do App Meta
          </CardTitle>
          <CardDescription>
            Obtenha essas credenciais no{" "}
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Meta for Developers <ExternalLink className="h-3 w-3" />
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* App ID */}
          <div className="space-y-2">
            <Label htmlFor="app-id">App ID</Label>
            <Input
              id="app-id"
              value={formData.META_APP_ID}
              onChange={(e) => setFormData((prev) => ({ ...prev, META_APP_ID: e.target.value }))}
              placeholder="123456789012345"
            />
          </div>

          {/* App Secret */}
          <div className="space-y-2">
            <Label htmlFor="app-secret">App Secret</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="app-secret"
                  type={showSecret ? "text" : "password"}
                  value={formData.META_APP_SECRET}
                  onChange={(e) => setFormData((prev) => ({ ...prev, META_APP_SECRET: e.target.value }))}
                  placeholder="••••••••••••••••"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Graph API Version */}
          <div className="space-y-2">
            <Label htmlFor="api-version">Graph API Version</Label>
            <Input
              id="api-version"
              value={formData.META_GRAPH_API_VERSION}
              onChange={(e) => setFormData((prev) => ({ ...prev, META_GRAPH_API_VERSION: e.target.value }))}
              placeholder="v21.0"
            />
            <p className="text-xs text-muted-foreground">
              Versão atual recomendada: {DEFAULT_GRAPH_VERSION}
            </p>
          </div>

          {/* Webhook Verify Token */}
          <div className="space-y-2">
            <Label htmlFor="verify-token">Webhook Verify Token</Label>
            <div className="flex gap-2">
              <Input
                id="verify-token"
                value={formData.META_WEBHOOK_VERIFY_TOKEN}
                onChange={(e) => setFormData((prev) => ({ ...prev, META_WEBHOOK_VERIFY_TOKEN: e.target.value }))}
                placeholder="Clique em Gerar para criar um token"
                readOnly
              />
              <Button type="button" variant="outline" onClick={generateVerifyToken}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar
              </Button>
              {formData.META_WEBHOOK_VERIFY_TOKEN && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(formData.META_WEBHOOK_VERIFY_TOKEN, "verify")}
                >
                  {copiedField === "verify" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !formData.META_APP_ID || !formData.META_APP_SECRET}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Salvar Credenciais
          </Button>
        </CardContent>
      </Card>

      {/* Webhook URL Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URL do Webhook</CardTitle>
          <CardDescription>
            Configure esta URL no painel do Meta para receber eventos de mensagens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-sm" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(webhookUrl, "webhook")}
            >
              {copiedField === "webhook" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Passos para configurar o Webhook no Meta:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Acesse seu App no Meta for Developers</li>
                <li>Vá em WhatsApp → Configuration</li>
                <li>Em Webhook, clique em Edit</li>
                <li>Cole a URL acima e o Verify Token</li>
                <li>Selecione os campos: messages, message_delivery_updates</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              1
            </span>
            <div>
              <p className="font-medium text-foreground">Crie um App no Meta</p>
              <p>Tipo: Business, com WhatsApp configurado</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              2
            </span>
            <div>
              <p className="font-medium text-foreground">Configure as Credenciais</p>
              <p>Insira App ID e App Secret acima</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              3
            </span>
            <div>
              <p className="font-medium text-foreground">Configure o Webhook</p>
              <p>Use a URL e Verify Token no painel Meta</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              4
            </span>
            <div>
              <p className="font-medium text-foreground">Solicite Aprovação para Embedded Signup</p>
              <p>Isso permite que tenants conectem seus números via OAuth (2-4 semanas)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentation Links */}
      <div className="flex flex-wrap gap-3 text-sm">
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Documentação Cloud API
        </a>
        <a
          href="https://developers.facebook.com/docs/whatsapp/embedded-signup"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Embedded Signup
        </a>
        <a
          href="https://business.facebook.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Meta Business Suite
        </a>
      </div>
    </div>
  );
}
