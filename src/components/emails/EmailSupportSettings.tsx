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
import { Headphones, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EmailSupportSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingUpInbound, setIsSettingUpInbound] = useState(false);
  const [inboundConfigured, setInboundConfigured] = useState(false);
  const [config, setConfig] = useState({
    support_email_enabled: false,
    support_email_address: "",
    support_reply_from_name: "",
    support_connection_status: "not_configured",
    support_last_error: null as string | null,
    sending_domain: null as string | null,
    from_name: "",
    verification_status: null as string | null,
  });

  useEffect(() => {
    if (tenantId) fetchConfig();
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
          verification_status: data.verification_status || null,
        });
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
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

      if (config.support_email_enabled && config.sending_domain) {
        await setupInboundParse();
      }

      toast({ title: "Salvo", description: "Configuração de atendimento salva" });
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const setupInboundParse = async () => {
    if (!tenantId || !config.sending_domain) return;
    setIsSettingUpInbound(true);
    try {
      const { data, error } = await supabase.functions.invoke("sendgrid-inbound-setup", {
        body: {
          action: "setup",
          hostname: config.sending_domain,
          tenant_id: tenantId,
        },
      });

      if (error) throw error;
      if (data?.success) {
        setInboundConfigured(true);
        toast({ title: "Recebimento ativado", description: "Emails serão recebidos automaticamente" });
      }
    } catch (error: any) {
      console.error("Inbound Parse setup error:", error);
    } finally {
      setIsSettingUpInbound(false);
    }
  };

  useEffect(() => {
    if (config.support_email_enabled && config.sending_domain) {
      supabase.functions.invoke("sendgrid-inbound-setup", {
        body: { action: "check", hostname: config.sending_domain, tenant_id: tenantId },
      }).then(({ data }) => {
        if (data?.configured) setInboundConfigured(true);
      });
    }
  }, [config.support_email_enabled, config.sending_domain, tenantId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasDomain = !!config.sending_domain;
  const isVerified = config.verification_status === "verified";
  const supportEmailLocal = config.support_email_address?.split('@')[0] || 'atendimento';
  const effectiveSupportEmail = config.sending_domain ? `${supportEmailLocal}@${config.sending_domain}` : '';
  const effectiveSupportName = config.support_reply_from_name || config.from_name || "Atendimento";

  if (!hasDomain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Atendimento por Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Configure primeiro seu domínio na aba <strong>Configurações</strong> para ativar o atendimento por email.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5" />
            Atendimento por Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Complete a verificação DNS na aba <strong>Configurações</strong> para ativar o atendimento por email.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

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
              {config.support_email_enabled && inboundConfigured && (
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />Ativo
                </StatusBadge>
              )}
            </CardTitle>
            <CardDescription>
              Receba emails e responda com IA automaticamente
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {config.support_last_error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{config.support_last_error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="font-medium">Ativar atendimento por email</Label>
            <p className="text-sm text-muted-foreground">
              Receba emails e a IA responde automaticamente
            </p>
          </div>
          <Switch
            checked={config.support_email_enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, support_email_enabled: checked }))}
          />
        </div>

        {config.support_email_enabled && (
          <div className="space-y-4">
            {inboundConfigured ? (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <p className="font-semibold">✅ Recebimento ativo</p>
                  <p className="text-sm">
                    Emails para <strong>{effectiveSupportEmail}</strong> serão recebidos e a IA responderá.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <Button onClick={setupInboundParse} disabled={isSettingUpInbound}>
                {isSettingUpInbound && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Ativar recebimento
              </Button>
            )}

            <div className="space-y-4 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label>Nome do email de atendimento</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    placeholder="atendimento"
                    value={config.support_email_address?.split('@')[0] || ''}
                    onChange={(e) => {
                      const localPart = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                      setConfig(prev => ({ ...prev, support_email_address: localPart }));
                    }}
                    className="max-w-40"
                  />
                  <span className="text-muted-foreground">@{config.sending_domain}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clientes enviarão emails para: <strong>{effectiveSupportEmail}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nome de resposta</Label>
                <Input
                  placeholder={config.from_name || "Atendimento"}
                  value={config.support_reply_from_name}
                  onChange={(e) => setConfig(prev => ({ ...prev, support_reply_from_name: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Respostas sairão como: "{effectiveSupportName}" &lt;{effectiveSupportEmail}&gt;
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
