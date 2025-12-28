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

export function SupportEmailSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
    
    // If exclusive email is set, validate it's from the same domain
    if (config.support_email_address && config.sending_domain) {
      const emailDomain = config.support_email_address.split("@")[1];
      if (emailDomain !== config.sending_domain) {
        toast({ 
          title: "Erro", 
          description: `O email exclusivo deve pertencer ao domínio verificado (${config.sending_domain})`, 
          variant: "destructive" 
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("email_provider_configs")
        .update({
          support_email_enabled: config.support_email_enabled,
          support_email_address: config.support_email_address || null,
          support_reply_from_name: config.support_reply_from_name || null,
          support_connection_status: config.support_email_enabled ? "active" : "not_configured",
        })
        .eq("tenant_id", tenantId);

      if (error) throw error;

      toast({ title: "Salvo", description: "Configuração de atendimento por email salva" });
      await fetchConfig();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

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
  const effectiveSupportEmail = config.support_email_address || config.from_email;
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

                {/* Instruções de configuração DNS para receber emails */}
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200 space-y-4">
                    <p className="font-semibold text-base">⚠️ Configuração DNS necessária para receber emails</p>
                    
                    <div className="bg-white/60 dark:bg-black/30 rounded-lg p-4 space-y-3 text-sm">
                      <p>
                        Para que clientes possam enviar emails para <strong>{effectiveSupportEmail}</strong>, 
                        você precisa adicionar um <strong>registro MX</strong> no DNS do seu domínio:
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
                        
                        <div className="text-xs">
                          <span className="text-muted-foreground">Nome:</span>
                          <span className="font-mono font-semibold ml-2">@</span>
                          <span className="text-muted-foreground ml-2">(use @ para o domínio raiz)</span>
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

                      <div className="bg-amber-100 dark:bg-amber-900/30 rounded p-3 text-xs space-y-2">
                        <p className="font-semibold">⚠️ Importante:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>
                            Se você já usa email corporativo (Google Workspace, Microsoft 365, etc), 
                            adicionar este MX pode interferir no recebimento de emails.
                          </li>
                          <li>
                            Nesse caso, use um subdomínio: no campo Nome coloque <code className="bg-white/50 px-1 rounded">suporte</code> 
                            {" "}para criar <code className="bg-white/50 px-1 rounded">suporte.{config.sending_domain}</code>
                          </li>
                        </ul>
                      </div>

                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Passo final:</strong> Após configurar o DNS, entre em contato com o suporte da plataforma 
                        para ativarmos o recebimento de emails (Inbound Parse no SendGrid).
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* Webhook URL info for admin */}
                <div className="bg-muted/30 rounded-lg p-4 border">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Informações técnicas (para suporte)</p>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p><strong>Email de destino:</strong> {effectiveSupportEmail}</p>
                        <div className="flex items-center gap-2">
                          <strong>Webhook URL:</strong>
                          <code className="bg-muted px-2 py-0.5 rounded text-xs flex-1 truncate">{webhookUrl}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => copyToClipboard(webhookUrl)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email exclusivo opcional */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="font-semibold">Email exclusivo para SAC (opcional)</Label>
                    <p className="text-sm text-muted-foreground">
                      Se quiser usar um email diferente do de notificações para atendimento
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder={`sac@${config.sending_domain}`}
                      value={config.support_email_address}
                      onChange={(e) => setConfig(prev => ({ ...prev, support_email_address: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Deve pertencer ao domínio verificado ({config.sending_domain}). 
                      Deixe em branco para usar <span className="font-mono">{config.from_email}</span>
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
