import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageCircle, Copy, Check, ExternalLink, Shield, RefreshCw, Eye, EyeOff, FlaskConical, CheckCircle2, XCircle, Send, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface MetaCredentials {
  META_APP_ID: string;
  META_APP_SECRET: string;
  META_GRAPH_API_VERSION: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
}

const DEFAULT_GRAPH_VERSION = "v21.0";

interface TestModeChecklist {
  sendOk: boolean | null;
  webhookVerified: boolean | null;
  eventReceived: boolean | null;
}

export function WhatsAppMetaPlatformSettings() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const [showSecret, setShowSecret] = useState(false);
  const [showTestToken, setShowTestToken] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [formData, setFormData] = useState<MetaCredentials>({
    META_APP_ID: "",
    META_APP_SECRET: "",
    META_GRAPH_API_VERSION: DEFAULT_GRAPH_VERSION,
    META_WEBHOOK_VERIFY_TOKEN: "",
  });
  
  // Test mode state
  const [testMode, setTestMode] = useState({
    phoneNumberId: "",
    accessToken: "",
    toPhone: "",
    message: "Olá! Esta é uma mensagem de teste do Comando Central.",
    templateName: "hello_world",
    useTemplate: true,
    testTenantId: "", // Tenant where test messages will appear
  });
  const [testChecklist, setTestChecklist] = useState<TestModeChecklist>({
    sendOk: null,
    webhookVerified: null,
    eventReceived: null,
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testConfigSaved, setTestConfigSaved] = useState(false);

  // Set default test tenant to current tenant
  useEffect(() => {
    if (currentTenant?.id && !testMode.testTenantId) {
      setTestMode(prev => ({ ...prev, testTenantId: currentTenant.id }));
    }
  }, [currentTenant?.id]);

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

  // Test send mutation - token is NOT persisted
  const testSendMutation = useMutation({
    mutationFn: async () => {
      setTestResult(null);
      
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-test-send", {
        body: {
          phone_number_id: testMode.phoneNumberId,
          access_token: testMode.accessToken, // NOT logged or saved
          to_phone: testMode.toPhone,
          message: testMode.useTemplate ? undefined : testMode.message,
          template_name: testMode.useTemplate ? testMode.templateName : undefined,
          template_language: "pt_BR",
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        setTestResult({ success: true, message: `Mensagem enviada! ID: ${data.message_id}` });
        setTestChecklist((prev) => ({ ...prev, sendOk: true }));
        toast.success("Mensagem de teste enviada com sucesso!");
      } else {
        setTestResult({ success: false, message: data.error || "Erro desconhecido" });
        setTestChecklist((prev) => ({ ...prev, sendOk: false }));
        toast.error(data.error || "Falha ao enviar mensagem de teste");
      }
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message || "Erro de conexão" });
      setTestChecklist((prev) => ({ ...prev, sendOk: false }));
      toast.error(error.message || "Erro ao enviar mensagem de teste");
    },
  });

  // Mutation to save test config (tenant + phone_number_id for routing)
  const saveTestConfigMutation = useMutation({
    mutationFn: async () => {
      // Save test tenant ID
      await supabase
        .from("platform_credentials")
        .upsert({
          credential_key: "META_WHATSAPP_TEST_TENANT_ID",
          credential_value: testMode.testTenantId,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "credential_key" });

      // Save test phone number ID
      await supabase
        .from("platform_credentials")
        .upsert({
          credential_key: "META_WHATSAPP_TEST_PHONE_NUMBER_ID",
          credential_value: testMode.phoneNumberId,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "credential_key" });
    },
    onSuccess: () => {
      setTestConfigSaved(true);
      toast.success("Configuração de teste salva! Respostas do WhatsApp irão para o Atendimento.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar configuração de teste");
    },
  });

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

      {/* Test Mode Card - Admin Only */}
      <Card className="border-amber-500/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Modo Teste – Cloud API</CardTitle>
            </div>
            <Badge variant="outline" className="text-amber-600 border-amber-500">
              Validação Meta
            </Badge>
          </div>
          <CardDescription>
            Use os dados de teste do Meta para validar a integração antes da aprovação do app.
            <strong className="block mt-1 text-amber-600">⚠️ O token NÃO é salvo no sistema.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800">
              Obtenha os dados de teste (Phone Number ID, WABA ID, Token temporário) no{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Meta for Developers → WhatsApp → API Setup
              </a>
            </AlertDescription>
          </Alert>

          {/* Tenant de destino */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <Label htmlFor="test-tenant-id" className="flex items-center gap-2">
              <span>Tenant de Destino (Atendimento)</span>
              {testConfigSaved && <Badge variant="outline" className="text-green-600 border-green-500 text-xs">Salvo</Badge>}
            </Label>
            <div className="flex gap-2">
              <Input
                id="test-tenant-id"
                value={testMode.testTenantId}
                onChange={(e) => {
                  setTestMode((prev) => ({ ...prev, testTenantId: e.target.value }));
                  setTestConfigSaved(false);
                }}
                placeholder="ID do tenant"
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => saveTestConfigMutation.mutate()}
                disabled={saveTestConfigMutation.isPending || !testMode.testTenantId || !testMode.phoneNumberId}
              >
                {saveTestConfigMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Seu tenant atual: <code className="bg-muted px-1 rounded">{currentTenant?.name || currentTenant?.id}</code>. 
              As mensagens de resposta do WhatsApp aparecerão no Atendimento deste tenant.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Phone Number ID */}
            <div className="space-y-2">
              <Label htmlFor="test-phone-number-id">Phone Number ID</Label>
              <Input
                id="test-phone-number-id"
                value={testMode.phoneNumberId}
                onChange={(e) => {
                  setTestMode((prev) => ({ ...prev, phoneNumberId: e.target.value }));
                  setTestConfigSaved(false);
                }}
                placeholder="123456789012345"
              />
            </div>

            {/* Destinatário */}
            <div className="space-y-2">
              <Label htmlFor="test-to-phone">Telefone Destinatário (E.164)</Label>
              <Input
                id="test-to-phone"
                value={testMode.toPhone}
                onChange={(e) => setTestMode((prev) => ({ ...prev, toPhone: e.target.value }))}
                placeholder="5511999999999"
              />
            </div>
          </div>

          {/* Access Token - Masked */}
          <div className="space-y-2">
            <Label htmlFor="test-access-token">Access Token (temporário do Meta)</Label>
            <div className="flex gap-2">
              <Input
                id="test-access-token"
                type={showTestToken ? "text" : "password"}
                value={testMode.accessToken}
                onChange={(e) => setTestMode((prev) => ({ ...prev, accessToken: e.target.value }))}
                placeholder="EAAxxxxxxx..."
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowTestToken(!showTestToken)}
              >
                {showTestToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este token é usado apenas nesta requisição e NÃO é salvo.
            </p>
          </div>

          {/* Template vs Text */}
          <div className="flex items-center gap-4">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="test-message-type"
                checked={testMode.useTemplate}
                onChange={() => setTestMode((prev) => ({ ...prev, useTemplate: true }))}
                className="accent-primary"
              />
              Usar Template (recomendado)
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="test-message-type"
                checked={!testMode.useTemplate}
                onChange={() => setTestMode((prev) => ({ ...prev, useTemplate: false }))}
                className="accent-primary"
              />
              Texto livre (requer janela 24h)
            </Label>
          </div>

          {testMode.useTemplate ? (
            <div className="space-y-2">
              <Label htmlFor="test-template-name">Nome do Template</Label>
              <Input
                id="test-template-name"
                value={testMode.templateName}
                onChange={(e) => setTestMode((prev) => ({ ...prev, templateName: e.target.value }))}
                placeholder="hello_world"
              />
              <p className="text-xs text-muted-foreground">
                Use "hello_world" (template padrão do Meta) para testes iniciais.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="test-message">Mensagem de Texto</Label>
              <Input
                id="test-message"
                value={testMode.message}
                onChange={(e) => setTestMode((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="Olá! Esta é uma mensagem de teste."
              />
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={() => testSendMutation.mutate()}
            disabled={
              testSendMutation.isPending ||
              !testMode.phoneNumberId ||
              !testMode.accessToken ||
              !testMode.toPhone
            }
            className="w-full"
            variant="outline"
          >
            {testSendMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Mensagem de Teste
          </Button>

          {/* Test Result */}
          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription className="text-sm">
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Checklist de Validação:</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {testChecklist.sendOk === null ? (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                ) : testChecklist.sendOk ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span>Envio de mensagem via Cloud API</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {testChecklist.webhookVerified === null ? (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                ) : testChecklist.webhookVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span>Webhook verificado pelo Meta</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {testChecklist.eventReceived === null ? (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                ) : testChecklist.eventReceived ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span>Evento recebido no Atendimento</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Após enviar uma mensagem de teste, responda pelo WhatsApp para verificar se o webhook está recebendo eventos.
            </p>
          </div>
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
