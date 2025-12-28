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
import { Headphones, CheckCircle, XCircle, Loader2, RefreshCw, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SupportEmailConfig {
  support_email_enabled: boolean;
  support_email_address: string;
  support_imap_host: string;
  support_imap_port: number;
  support_imap_user: string;
  support_imap_password: string;
  support_imap_tls: boolean;
  support_reply_from_name: string;
  support_reply_from_email: string;
  support_connection_status: string;
  support_last_error: string | null;
  // Also need sending domain for reply email validation
  sending_domain: string | null;
  from_name: string;
  from_email: string;
}

export function SupportEmailSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [config, setConfig] = useState<SupportEmailConfig>({
    support_email_enabled: false,
    support_email_address: "",
    support_imap_host: "",
    support_imap_port: 993,
    support_imap_user: "",
    support_imap_password: "",
    support_imap_tls: true,
    support_reply_from_name: "",
    support_reply_from_email: "",
    support_connection_status: "not_configured",
    support_last_error: null,
    sending_domain: null,
    from_name: "",
    from_email: "",
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
          support_email_enabled: (data as any).support_email_enabled || false,
          support_email_address: (data as any).support_email_address || "",
          support_imap_host: (data as any).support_imap_host || "",
          support_imap_port: (data as any).support_imap_port || 993,
          support_imap_user: (data as any).support_imap_user || "",
          support_imap_password: (data as any).support_imap_password || "",
          support_imap_tls: (data as any).support_imap_tls ?? true,
          support_reply_from_name: (data as any).support_reply_from_name || "",
          support_reply_from_email: (data as any).support_reply_from_email || "",
          support_connection_status: (data as any).support_connection_status || "not_configured",
          support_last_error: (data as any).support_last_error || null,
          sending_domain: data.sending_domain || null,
          from_name: data.from_name || "",
          from_email: data.from_email || "",
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
    
    if (config.support_email_enabled) {
      if (!config.support_email_address || !config.support_imap_host || !config.support_imap_user) {
        toast({ title: "Erro", description: "Preencha os campos obrigatórios do IMAP", variant: "destructive" });
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
          support_imap_host: config.support_imap_host || null,
          support_imap_port: config.support_imap_port,
          support_imap_user: config.support_imap_user || null,
          support_imap_password: config.support_imap_password || null,
          support_imap_tls: config.support_imap_tls,
          support_reply_from_name: config.support_reply_from_name || null,
          support_reply_from_email: config.support_reply_from_email || null,
          support_connection_status: config.support_email_enabled ? "pending" : "not_configured",
        } as any)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      toast({ title: "Salvo", description: "Configuração de email de atendimento salva" });
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!tenantId) return;
    
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-email-test", {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: "Conexão OK!", description: "IMAP conectou com sucesso" });
      } else {
        toast({ title: "Erro de conexão", description: data?.error || "Falha ao conectar", variant: "destructive" });
      }
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
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

  // Check if transactional email is configured
  const hasTransactionalEmail = !!(config.sending_domain && config.from_email);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Headphones className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Email de Atendimento (SAC)
              {config.support_email_enabled && config.support_connection_status === "connected" && (
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
              Configure um email separado para receber e responder atendimentos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasTransactionalEmail && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              Configure primeiro o <strong>Email Transacional</strong> acima para poder usar email de atendimento separado.
            </AlertDescription>
          </Alert>
        )}

        {hasTransactionalEmail && (
          <>
            {/* Toggle para ativar */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Usar email separado para atendimento</Label>
                <p className="text-sm text-muted-foreground">
                  Ative para receber e responder emails de atendimento por um email diferente do de notificações
                </p>
              </div>
              <Switch
                checked={config.support_email_enabled}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, support_email_enabled: checked }))}
              />
            </div>

            {!config.support_email_enabled && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Modo atual:</strong> Emails de atendimento serão enviados como{" "}
                  <span className="font-mono text-xs">{config.from_email}</span>
                </p>
              </div>
            )}

            {config.support_email_enabled && (
              <div className="space-y-6">
                {/* Status de erro */}
                {config.support_last_error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{config.support_last_error}</AlertDescription>
                  </Alert>
                )}

                {/* Email Address */}
                <div className="space-y-2">
                  <Label htmlFor="support_email">Email de atendimento *</Label>
                  <Input
                    id="support_email"
                    type="email"
                    placeholder="sac@suaempresa.com.br"
                    value={config.support_email_address}
                    onChange={(e) => setConfig(prev => ({ ...prev, support_email_address: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este é o email que seus clientes usam para entrar em contato
                  </p>
                </div>

                {/* IMAP Settings */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <Label className="font-semibold">Configuração IMAP (para receber emails)</Label>
                  <p className="text-sm text-muted-foreground">
                    Configure o acesso IMAP para ler emails recebidos automaticamente
                  </p>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="imap_host">Servidor IMAP *</Label>
                      <Input
                        id="imap_host"
                        placeholder="imap.zoho.com"
                        value={config.support_imap_host}
                        onChange={(e) => setConfig(prev => ({ ...prev, support_imap_host: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imap_port">Porta</Label>
                      <Input
                        id="imap_port"
                        type="number"
                        placeholder="993"
                        value={config.support_imap_port}
                        onChange={(e) => setConfig(prev => ({ ...prev, support_imap_port: parseInt(e.target.value) || 993 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imap_user">Usuário IMAP *</Label>
                      <Input
                        id="imap_user"
                        placeholder="sac@suaempresa.com.br"
                        value={config.support_imap_user}
                        onChange={(e) => setConfig(prev => ({ ...prev, support_imap_user: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imap_password">Senha *</Label>
                      <div className="relative">
                        <Input
                          id="imap_password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={config.support_imap_password}
                          onChange={(e) => setConfig(prev => ({ ...prev, support_imap_password: e.target.value }))}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      id="imap_tls"
                      checked={config.support_imap_tls}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, support_imap_tls: checked }))}
                    />
                    <Label htmlFor="imap_tls">Usar TLS/SSL</Label>
                  </div>
                </div>

                {/* Reply From Settings */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <Label className="font-semibold">Remetente das Respostas</Label>
                  <p className="text-sm text-muted-foreground">
                    Como suas respostas aparecerão para os clientes (enviadas via seu domínio verificado)
                  </p>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reply_name">Nome</Label>
                      <Input
                        id="reply_name"
                        placeholder="Atendimento Minha Loja"
                        value={config.support_reply_from_name}
                        onChange={(e) => setConfig(prev => ({ ...prev, support_reply_from_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reply_email">Email</Label>
                      <Input
                        id="reply_email"
                        type="email"
                        placeholder={`sac@${config.sending_domain}`}
                        value={config.support_reply_from_email}
                        onChange={(e) => setConfig(prev => ({ ...prev, support_reply_from_email: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deve pertencer ao domínio verificado ({config.sending_domain})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {(config.support_reply_from_name || config.support_reply_from_email) && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Prévia do remetente de respostas:</p>
                    <p className="font-medium text-foreground">
                      "{config.support_reply_from_name || "Atendimento"}" &lt;{config.support_reply_from_email || `sac@${config.sending_domain}`}&gt;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              {config.support_email_enabled && (
                <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Testar Conexão IMAP
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
