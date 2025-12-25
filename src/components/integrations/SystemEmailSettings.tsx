import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Copy, 
  RefreshCw, 
  Send,
  Shield,
  Globe
} from "lucide-react";

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

// Only this email can see this component
const PLATFORM_ADMIN_EMAIL = "respeiteohomem@gmail.com";

export function SystemEmailSettings() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SystemEmailConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Form state
  const [sendingDomain, setSendingDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    // Check if current user is platform admin
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserEmail(user?.email || null);
      if (user?.email === PLATFORM_ADMIN_EMAIL) {
        loadConfig();
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      // Use service role via edge function or direct query
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
      // If the function doesn't exist yet, we'll use defaults
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupDomain = async () => {
    if (!sendingDomain.trim()) {
      toast({ title: "Informe o domínio de envio", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-email-domain-upsert", {
        body: { sending_domain: sendingDomain.trim().toLowerCase() }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: "Domínio configurado!", description: "Configure os registros DNS abaixo." });
      await loadConfig();
    } catch (error: any) {
      toast({ title: "Erro ao configurar domínio", description: error.message, variant: "destructive" });
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
        toast({ title: "Domínio verificado com sucesso!" });
      } else {
        toast({ 
          title: "Verificação em andamento", 
          description: "Aguarde a propagação DNS e tente novamente.",
          variant: "default"
        });
      }
      await loadConfig();
    } catch (error: any) {
      toast({ title: "Erro ao verificar domínio", description: error.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveSender = async () => {
    if (!fromName.trim() || !fromEmail.trim()) {
      toast({ title: "Preencha nome e email do remetente", variant: "destructive" });
      return;
    }

    // Validate email belongs to verified domain
    if (config?.sending_domain) {
      const emailDomain = fromEmail.split("@")[1]?.toLowerCase();
      if (emailDomain !== config.sending_domain.toLowerCase()) {
        toast({ 
          title: "Email inválido", 
          description: `O email deve pertencer ao domínio ${config.sending_domain}`,
          variant: "destructive" 
        });
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

      toast({ title: "Configurações salvas!" });
      await loadConfig();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast({ title: "Informe um email válido", variant: "destructive" });
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
        toast({ title: "Email de teste enviado!", description: `Verifique a caixa de entrada de ${testEmail}` });
      } else {
        toast({ title: "Falha ao enviar", description: data.message || data.error, variant: "destructive" });
      }
      await loadConfig();
    } catch (error: any) {
      toast({ title: "Erro ao enviar teste", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
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

  // Don't render if not platform admin
  if (currentUserEmail !== PLATFORM_ADMIN_EMAIL) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isVerified = config?.verification_status === "verified";

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Email do Sistema (Plataforma)
              {config && getStatusBadge(config.verification_status)}
            </CardTitle>
            <CardDescription>
              Remetente para emails transacionais do Comando Central (login, reset, convites)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Domain Configuration */}
        <div className="space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            1. Domínio de Envio
          </h3>
          
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
          </div>
        </div>

        {/* Step 2: DNS Records */}
        {config?.dns_records && config.dns_records.length > 0 && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                2. Registros DNS
                <span className="text-xs text-muted-foreground font-normal">
                  (configure no seu provedor de DNS)
                </span>
              </h3>

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
          </>
        )}

        {/* Step 3: Sender Info */}
        {isVerified && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                3. Informações do Remetente
              </h3>

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
                Salvar Configurações
              </Button>
            </div>
          </>
        )}

        {/* Step 4: Test Email */}
        {isVerified && config?.from_email && (
          <>
            <Separator />
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Send className="h-4 w-4" />
                4. Testar Envio
              </h3>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </div>
                <Button onClick={handleTestEmail} disabled={isTesting}>
                  {isTesting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {config.last_test_at && (
                <p className="text-xs text-muted-foreground">
                  Último teste: {new Date(config.last_test_at).toLocaleString("pt-BR")}
                  {config.last_test_result?.success ? " ✅" : " ❌"}
                </p>
              )}
            </div>
          </>
        )}

        {/* Auth SMTP Info */}
        <Separator />
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <strong>Emails de autenticação (login/reset)</strong>: Os emails de login e recuperação de senha 
            são enviados pelo sistema de Auth. Para usar o remetente configurado acima, configure o SMTP 
            nas configurações do backend.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
