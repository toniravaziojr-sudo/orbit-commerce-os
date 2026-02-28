import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlatformSecretsStatus } from "@/hooks/usePlatformSecretsStatus";
import { CredentialEditor } from "./CredentialEditor";
import { 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Copy, 
  RefreshCw, 
  Send,
  Shield,
  Globe,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2
} from "lucide-react";
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

interface DnsRecord {
  name: string;
  type: string;
  value: string;
  status?: string;
  priority?: number;
}

interface SystemEmailConfig {
  id: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  sending_domain: string | null;
  resend_domain_id: string | null;
  verification_status: "not_started" | "pending" | "verified" | "failed";
  dns_records: DnsRecord[];
  verified_at: string | null;
  last_verify_check_at: string | null;
  last_verify_error: string | null;
  last_test_at: string | null;
  last_test_result: { success: boolean; message_id?: string; error?: string } | null;
}

export function EmailAndDomainsPlatformSettings() {
  const queryClient = useQueryClient();
  
  // Email config state
  const [config, setConfig] = useState<SystemEmailConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Form state
  const [sendingDomain, setSendingDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testEmail, setTestEmail] = useState("");

  // Fetch platform secrets status for both SendGrid and Cloudflare (shared cache)
  const { data: allIntegrations, isLoading: isLoadingSecrets } = usePlatformSecretsStatus();
  const secretsStatus = {
    sendgrid: allIntegrations?.find((i) => i.key === 'sendgrid'),
    cloudflare: allIntegrations?.find((i) => i.key === 'cloudflare'),
  };

  // Test Cloudflare connection mutation
  const testCloudflareConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cloudflare-test-connection');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Conexão Cloudflare OK', {
          description: data.results?.zoneId?.zoneName 
            ? `Zone: ${data.results.zoneId.zoneName}` 
            : 'API Token válido'
        });
      } else {
        toast.error('Falha na conexão', { description: data.error });
      }
      queryClient.invalidateQueries({ queryKey: ['platform-secrets-status'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao testar conexão', { description: error.message });
    },
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoadingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("integration-config", {
        body: { action: "get-system-email-config" }
      });

      if (error) throw error;

      if (data?.config) {
        const cfg = data.config;
        setConfig({
          ...cfg,
          dns_records: Array.isArray(cfg.dns_records) ? cfg.dns_records as unknown as DnsRecord[] : [],
          last_test_result: cfg.last_test_result as SystemEmailConfig["last_test_result"],
        });
        setSendingDomain(cfg.sending_domain || "comandocentral.com.br");
        setFromName(cfg.from_name || "Comando Central");
        setFromEmail(cfg.from_email || "contato@comandocentral.com.br");
        setReplyTo(cfg.reply_to || "");
      }
    } catch (error: any) {
      console.error("Error loading system email config:", error);
      setConfig(null);
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSetupDomain = async () => {
    if (!sendingDomain.trim()) {
      toast.error("Informe o domínio de envio");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-email-domain-upsert", {
        body: { sending_domain: sendingDomain.trim().toLowerCase() }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success("Domínio configurado!", { description: "Configure os registros DNS abaixo." });
      await loadConfig();
    } catch (error: any) {
      toast.error("Erro ao configurar domínio", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-email-domain-verify", {});

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      if (data.verification_status === "verified") {
        toast.success("Domínio verificado com sucesso!");
      } else {
        toast.info("Verificação em andamento", { description: "Aguarde a propagação DNS e tente novamente." });
      }
      await loadConfig();
    } catch (error: any) {
      toast.error("Erro ao verificar domínio", { description: error.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveSender = async () => {
    if (!fromName.trim() || !fromEmail.trim()) {
      toast.error("Preencha nome e email do remetente");
      return;
    }

    if (config?.sending_domain) {
      const emailDomain = fromEmail.split("@")[1]?.toLowerCase();
      if (emailDomain !== config.sending_domain.toLowerCase()) {
        toast.error("Email inválido", { description: `O email deve pertencer ao domínio ${config.sending_domain}` });
        return;
      }
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("integration-config", {
        body: { 
          action: "update-system-email-config",
          from_name: fromName.trim(),
          from_email: fromEmail.trim().toLowerCase(),
          reply_to: replyTo.trim() || null
        }
      });

      if (error) throw error;

      toast.success("Configurações salvas!");
      await loadConfig();
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast.error("Informe um email válido");
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-system-email", {
        body: {
          to: testEmail.trim(),
          subject: "Teste de Email do Sistema - Comando Central",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">✅ Email de Teste</h1>
              <p>Este é um email de teste do sistema Comando Central.</p>
              <p>Se você está lendo esta mensagem, a configuração de email está funcionando corretamente!</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
              <p style="color: #666; font-size: 12px;">
                Enviado em: ${new Date().toLocaleString("pt-BR")}
              </p>
            </div>
          `,
          email_type: "test"
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Email de teste enviado!", { description: `Verifique a caixa de entrada de ${testEmail}` });
      } else {
        toast.error("Falha ao enviar", { description: data.message || data.error });
      }
      await loadConfig();
    } catch (error: any) {
      toast.error("Erro ao enviar teste", { description: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetConfig = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("integration-config", {
        body: { action: "reset-system-email-config" }
      });

      if (error) throw error;

      toast.success("Configuração resetada!", { description: "Configure o novo domínio de envio." });
      setSendingDomain("");
      setFromName("Comando Central");
      setFromEmail("");
      setReplyTo("");
      await loadConfig();
    } catch (error: any) {
      toast.error("Erro ao resetar", { description: error.message });
    } finally {
      setIsResetting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const getStatusBadge = (status: SystemEmailConfig["verification_status"]) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Verificado</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Falhou</Badge>;
      default:
        return <Badge variant="outline">Não iniciado</Badge>;
    }
  };

  const isLoading = isLoadingConfig || isLoadingSecrets;
  const isVerified = config?.verification_status === "verified";

  // Cloudflare status
  const cloudflareStatus = secretsStatus?.cloudflare;
  const cloudflareConfigured = cloudflareStatus?.status === 'configured';
  const cloudflarePartial = cloudflareStatus?.status === 'partial';
  const cloudflareApiToken = cloudflareStatus?.secrets?.CLOUDFLARE_API_TOKEN || false;
  const cloudflareZoneId = cloudflareStatus?.secrets?.CLOUDFLARE_ZONE_ID || false;

  // SendGrid status
  const sendgridStatus = secretsStatus?.sendgrid;
  const sendgridConfigured = sendgridStatus?.secrets?.SENDGRID_API_KEY || false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section: SendGrid - Email Transacional */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Email Transacional (SendGrid)</h2>
            <p className="text-sm text-muted-foreground">
              Configuração de envio de emails do sistema (login, reset, notificações)
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O SendGrid é usado para enviar todos os emails transacionais da plataforma.
            Configure a API Key e o domínio de envio para garantir entregabilidade.
          </AlertDescription>
        </Alert>

        {/* SendGrid API Key */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base">Credencial SendGrid</CardTitle>
                  <CardDescription>API Key para envio de emails</CardDescription>
                </div>
              </div>
              {sendgridConfigured ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <CredentialEditor
              credentialKey="SENDGRID_API_KEY"
              label="API Key"
              description="Chave de API do SendGrid com permissão de envio"
              isConfigured={sendgridConfigured}
              preview={sendgridStatus?.previews?.SENDGRID_API_KEY}
              source={sendgridStatus?.sources?.SENDGRID_API_KEY as 'db' | 'env' | null}
              placeholder="SG.xxxxxxxxxxxxxxxx"
            />
          </CardContent>
        </Card>

        {/* Domain Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Domínio de Envio
                  {config && getStatusBadge(config.verification_status)}
                </CardTitle>
                <CardDescription>
                  Configure o domínio para envio autenticado (melhora entregabilidade)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="comandocentral.com.br"
                  value={sendingDomain}
                  onChange={(e) => setSendingDomain(e.target.value)}
                  disabled={isVerified}
                />
              </div>
              <Button 
                onClick={handleSetupDomain} 
                disabled={isSaving || isVerified}
                variant={config?.resend_domain_id ? "outline" : "default"}
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Configurar"}
              </Button>
              
              {config?.resend_domain_id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      disabled={isResetting}
                      className="text-destructive hover:text-destructive"
                    >
                      {isResetting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso vai remover a configuração atual do domínio de email. Você poderá configurar um novo domínio em seguida.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetConfig}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>

            {/* DNS Records */}
            {config?.dns_records && config.dns_records.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <h4 className="text-sm font-medium">Registros DNS</h4>
                <div className="space-y-2">
                  {config.dns_records.map((record, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${
                        record.status === "verified" 
                          ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10" 
                          : "border-muted"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">{record.type}</Badge>
                            {record.status === "verified" && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                          <p className="text-sm font-mono truncate">{record.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate mt-1">
                            {record.value}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(record.value)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={handleVerifyDomain} 
                  disabled={isVerifying || isVerified}
                  variant={isVerified ? "outline" : "default"}
                  className="w-full"
                >
                  {isVerifying ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {isVerified ? "Domínio Verificado" : "Verificar DNS"}
                </Button>

                {config.last_verify_error && !isVerified && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{config.last_verify_error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Sender Info - only after domain verified */}
            {isVerified && (
              <div className="space-y-4">
                <Separator />
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Informações do Remetente
                </h4>

                <div className="grid gap-4">
                  <div>
                    <Label>Nome do remetente</Label>
                    <Input
                      placeholder="Comando Central"
                      value={fromName}
                      onChange={(e) => setFromName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Email do remetente</Label>
                    <Input
                      type="email"
                      placeholder={`contato@${config?.sending_domain || "comandocentral.com.br"}`}
                      value={fromEmail}
                      onChange={(e) => setFromEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Deve pertencer ao domínio {config?.sending_domain}
                    </p>
                  </div>
                  <div>
                    <Label>Reply-To (opcional)</Label>
                    <Input
                      type="email"
                      placeholder="suporte@comandocentral.com.br"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveSender} disabled={isSaving}>
                  {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Remetente
                </Button>
              </div>
            )}

            {/* Test Email - only after domain verified */}
            {isVerified && (
              <div className="space-y-4">
                <Separator />
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Testar Envio
                </h4>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  <Button onClick={handleTestEmail} disabled={isTesting}>
                    {isTesting ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="outline" asChild>
          <a href="https://app.sendgrid.com/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Dashboard SendGrid
          </a>
        </Button>
      </div>

      <Separator className="my-8" />

      {/* Section: Cloudflare - Domínios Custom */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-orange-500/10">
            <Globe className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Domínios Custom (Cloudflare)</h2>
            <p className="text-sm text-muted-foreground">
              Cloudflare for SaaS para domínios customizados e SSL automático
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O Cloudflare for SaaS permite que cada tenant use seu próprio domínio customizado
            com SSL automático, sem necessidade de configuração manual de certificados.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Credenciais Cloudflare
                </CardTitle>
                <CardDescription>
                  API Token e Zone ID para gerenciamento de domínios
                </CardDescription>
              </div>
              {cloudflareConfigured ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Configurado
                </Badge>
              ) : cloudflarePartial ? (
                <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Parcial
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pendente
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <CredentialEditor
                credentialKey="CLOUDFLARE_API_TOKEN"
                label="API Token"
                description="Token com permissões de SSL for SaaS"
                isConfigured={cloudflareApiToken}
                preview={cloudflareStatus?.previews?.CLOUDFLARE_API_TOKEN}
                source={cloudflareStatus?.sources?.CLOUDFLARE_API_TOKEN as 'db' | 'env' | null}
                placeholder="Cole o API Token aqui..."
              />
              <CredentialEditor
                credentialKey="CLOUDFLARE_ZONE_ID"
                label="Zone ID"
                description="Zone ID do domínio comandocentral.com.br"
                isConfigured={cloudflareZoneId}
                preview={cloudflareStatus?.previews?.CLOUDFLARE_ZONE_ID}
                source={cloudflareStatus?.sources?.CLOUDFLARE_ZONE_ID as 'db' | 'env' | null}
                placeholder="Cole o Zone ID aqui..."
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => testCloudflareConnection.mutate()}
              disabled={!cloudflareApiToken || testCloudflareConnection.isPending}
            >
              {testCloudflareConnection.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Testar Conexão
            </Button>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-2">Configuração Necessária</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  Ativar Cloudflare for SaaS no domínio base
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  Configurar Fallback Origin (ex: shops.comandocentral.com.br)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  Gerar API Token com permissões de SSL for SaaS
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">4.</span>
                  Configurar Zone ID e API Token acima
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recursos da Integração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>SSL automático para domínios custom</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Verificação de domínio via TXT</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>CDN global Cloudflare</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Proteção DDoS</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Subdomínios automáticos *.shops</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Renovação automática de SSL</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <a href="https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Docs Cloudflare for SaaS
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Dashboard Cloudflare
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
