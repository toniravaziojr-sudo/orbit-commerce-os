import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Headphones, CheckCircle, XCircle, Loader2, AlertCircle, Info, Copy, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SupportEmailConfig {
  support_email_enabled: boolean;
  support_email_address: string;
  support_reply_from_name: string;
  support_connection_status: string;
  support_last_error: string | null;
  // Notification email (default for SAC if no exclusive is set)
  sending_domain: string | null;
  from_name: string;
  from_email: string;
  verification_status: string | null;
}

// Subdomain prefix for inbound parsing - avoids conflicts with corporate email
const INBOUND_SUBDOMAIN_PREFIX = 'suporte';

export function SupportEmailSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingUpInbound, setIsSettingUpInbound] = useState(false);
  const [inboundConfigured, setInboundConfigured] = useState(false);
  const [config, setConfig] = useState<SupportEmailConfig>({
    support_email_enabled: false,
    support_email_address: "",
    support_reply_from_name: "",
    support_connection_status: "not_configured",
    support_last_error: null,
    sending_domain: null,
    from_name: "",
    from_email: "",
    verification_status: null,
  });

  useEffect(() => {
    if (tenantId) {
      fetchConfig();
    }
  }, [tenantId]);

  const fetchConfig = async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_provider_configs")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          support_email_enabled: data.support_email_enabled || false,
          support_email_address: data.support_email_address || "",
          support_reply_from_name: data.support_reply_from_name || "",
          support_connection_status: data.support_connection_status || "not_configured",
          support_last_error: data.support_last_error || null,
          sending_domain: data.sending_domain || null,
          from_name: data.from_name || "",
          from_email: data.from_email || "",
          verification_status: data.verification_status || null,
        });
      }
    } catch (error) {
      console.error("Error fetching support email config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;

    setIsSaving(true);
    try {
      // Store only the local part of support email address
      const supportEmailLocal = config.support_email_address?.split('@')[0] || '';
      
      const { error } = await supabase
        .from("email_provider_configs")
        .update({
          support_email_enabled: config.support_email_enabled,
          support_email_address: supportEmailLocal || null,
          support_reply_from_name: config.support_reply_from_name || null,
          support_connection_status: config.support_email_enabled ? "pending_inbound" : "not_configured",
        })
        .eq("tenant_id", tenantId);

      if (error) throw error;

      // If enabling support, automatically setup Inbound Parse
      if (config.support_email_enabled && config.sending_domain) {
        await setupInboundParse();
      }

      toast({ title: "Salvo", description: "Configuração de atendimento por email salva" });
      await fetchConfig();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Use subdomain to avoid conflicts with corporate email
  const inboundHostname = config.sending_domain ? `${INBOUND_SUBDOMAIN_PREFIX}.${config.sending_domain}` : null;
  
  const setupInboundParse = async () => {
    if (!tenantId || !inboundHostname) return;
    
    setIsSettingUpInbound(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendgrid-inbound-setup", {
        body: {
          action: "setup",
          hostname: inboundHostname,
          tenant_id: tenantId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setInboundConfigured(true);
        toast({ 
          title: "Inbound Parse configurado", 
          description: "O recebimento de emails foi ativado automaticamente" 
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao configurar Inbound Parse";
      console.error("Inbound Parse setup error:", error);
      toast({ 
        title: "Aviso", 
        description: `Recebimento de emails pode requerer configuração manual: ${message}`,
        variant: "destructive"
      });
    } finally {
      setIsSettingUpInbound(false);
    }
  };

  const checkInboundStatus = async () => {
    if (!tenantId || !inboundHostname) return;
    
    try {
      const { data } = await supabase.functions.invoke("sendgrid-inbound-setup", {
        body: {
          action: "check",
          hostname: inboundHostname,
          tenant_id: tenantId,
        },
      });

      if (data?.configured) {
        setInboundConfigured(true);
      }
    } catch (error) {
      console.error("Error checking inbound status:", error);
    }
  };

  // Check inbound status on load if support is enabled
  useEffect(() => {
    if (config.support_email_enabled && inboundHostname) {
      checkInboundStatus();
    }
  }, [config.support_email_enabled, inboundHostname]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência" });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Check if transactional email is configured and verified
  const hasTransactionalEmail = !!(config.sending_domain && config.from_email);
  const isEmailVerified = config.verification_status === "verified";
  
  // Determine which email will be used for SAC
  // Support email uses the inbound subdomain to avoid conflicts
  const supportEmailLocal = config.support_email_address?.split('@')[0] || 'atendimento';
  const effectiveSupportEmail = inboundHostname 
    ? `${supportEmailLocal}@${inboundHostname}` 
    : config.from_email;
  const effectiveSupportName = config.support_reply_from_name || config.from_name || "Atendimento";

  // Webhook URL for SendGrid Inbound Parse
  const webhookUrl = `https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/support-email-inbound`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Headphones className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Atendimento por Email
              {config.support_email_enabled && config.support_connection_status === "active" && (
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />Ativo
                </StatusBadge>
              )}
              {config.support_email_enabled && config.support_connection_status === "error" && (
                <StatusBadge variant="destructive" className="ml-2">
                  <XCircle className="h-3 w-3 mr-1" />Erro
                </StatusBadge>
              )}
            </CardTitle>
            <CardDescription>
              Receba emails de clientes e responda automaticamente com IA
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasTransactionalEmail && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              Configure primeiro o <strong>Email Transacional</strong> acima para poder usar atendimento por email.
            </AlertDescription>
          </Alert>
        )}

        {hasTransactionalEmail && !isEmailVerified && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              Verifique seu domínio de email antes de ativar o atendimento. Complete a configuração DNS acima.
            </AlertDescription>
          </Alert>
        )}

        {hasTransactionalEmail && isEmailVerified && (
          <>
            {/* Toggle para ativar atendimento por email */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Ativar atendimento por email</Label>
                <p className="text-sm text-muted-foreground">
                  Receba emails de clientes e a IA responde automaticamente
                </p>
              </div>
              <Switch
                checked={config.support_email_enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, support_email_enabled: checked }))}
              />
            </div>

            {config.support_email_enabled && (
              <div className="space-y-6">
                {/* Status de erro */}
                {config.support_last_error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{config.support_last_error}</AlertDescription>
                  </Alert>
                )}

                {/* Status do Inbound Parse */}
                {inboundConfigured ? (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200 space-y-2">
                      <p className="font-semibold">✅ Recebimento de emails ativo</p>
                      <p className="text-sm">
                        Emails enviados para <strong>{effectiveSupportEmail}</strong> serão recebidos automaticamente e a IA responderá.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : isSettingUpInbound ? (
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">
                      Configurando recebimento de emails automaticamente...
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {/* Instruções de configuração DNS para receber emails */}
                    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-4">
                        <p className="font-semibold text-base">⚠️ Configuração DNS necessária para receber emails</p>
                        
                        <div className="bg-white/60 dark:bg-black/30 rounded-lg p-4 space-y-3 text-sm">
                          <p>
                            Para receber emails de clientes em <strong>{effectiveSupportEmail}</strong>, 
                            adicione um <strong>registro MX</strong> no DNS do seu domínio:
                          </p>
                          
                          <div className="bg-white dark:bg-black/40 rounded border p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Tipo:</span>
                                <span className="font-mono font-semibold ml-2">MX</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Prioridade:</span>
                                <span className="font-mono font-semibold ml-2">10</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Nome:</span>
                              <code className="bg-muted px-2 py-1 rounded font-mono font-semibold">{INBOUND_SUBDOMAIN_PREFIX}</code>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => copyToClipboard(INBOUND_SUBDOMAIN_PREFIX)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <span className="text-muted-foreground">(cria {inboundHostname})</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">Servidor de email:</span>
                              <code className="bg-muted px-2 py-1 rounded font-mono">mx.sendgrid.net</code>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => copyToClipboard("mx.sendgrid.net")}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          <div className="bg-green-100 dark:bg-green-900/30 rounded p-3 text-xs space-y-2">
                            <p className="font-semibold">✅ Vantagem do subdomínio:</p>
                            <p>
                              Usando <strong>{inboundHostname}</strong>, seu email corporativo no domínio raiz 
                              ({config.sending_domain}) continua funcionando normalmente. 
                              Não há conflito com Google Workspace, Microsoft 365, Zoho, etc.
                            </p>
                          </div>

                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Após configurar o MX no DNS</strong>, clique em "Ativar recebimento" abaixo.
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>

                    {/* Botão para tentar configurar manualmente */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={setupInboundParse}
                        disabled={isSettingUpInbound}
                      >
                        {isSettingUpInbound && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Ativar recebimento de emails
                      </Button>
                    </div>
                  </>
                )}

                {/* Email exclusivo opcional */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="font-semibold">Nome do email de atendimento</Label>
                    <p className="text-sm text-muted-foreground">
                      Nome que aparece antes do @ no email de atendimento
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        placeholder="atendimento"
                        value={config.support_email_address?.split('@')[0] || ''}
                        onChange={(e) => {
                          const localPart = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                          setConfig(prev => ({ ...prev, support_email_address: localPart }));
                        }}
                        className="max-w-[180px]"
                      />
                      <span className="text-sm text-muted-foreground font-mono">@{inboundHostname}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Email final: <strong className="font-mono">{effectiveSupportEmail}</strong>
                    </p>
                  </div>
                </div>

                {/* Nome do remetente para respostas */}
                <div className="space-y-2">
                  <Label htmlFor="reply_name">Nome do remetente nas respostas</Label>
                  <Input
                    id="reply_name"
                    placeholder={config.from_name || "Atendimento"}
                    value={config.support_reply_from_name}
                    onChange={(e) => setConfig(prev => ({ ...prev, support_reply_from_name: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para usar "{config.from_name || "Atendimento"}"
                  </p>
                </div>

                {/* Preview */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Prévia do remetente nas respostas:</p>
                  <p className="font-medium text-foreground">
                    "{effectiveSupportName}" &lt;{effectiveSupportEmail}&gt;
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
