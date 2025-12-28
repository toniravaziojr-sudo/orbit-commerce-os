import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Send, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMailboxes } from "@/hooks/useMailboxes";

export function EmailNotificationsSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const { mailboxes } = useMailboxes();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);
  const [config, setConfig] = useState({
    from_name: "",
    from_email: "",
    reply_to: "",
    sending_domain: "",
    verification_status: "",
    dns_all_ok: false,
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
        .select("from_name, from_email, reply_to, sending_domain, verification_status, dns_all_ok")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig({
          from_name: data.from_name || "",
          from_email: data.from_email || "",
          reply_to: data.reply_to || "",
          sending_domain: data.sending_domain || "",
          verification_status: data.verification_status || "",
          dns_all_ok: (data as any).dns_all_ok || false,
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
    if (!config.from_email || !config.from_name) {
      toast({ title: "Erro", description: "Preencha o nome e email do remetente", variant: "destructive" });
      return;
    }

    const emailDomain = config.from_email.split("@")[1]?.toLowerCase();
    if (config.sending_domain && emailDomain !== config.sending_domain.toLowerCase()) {
      toast({ 
        title: "Erro", 
        description: `O email deve pertencer ao domínio verificado (${config.sending_domain})`, 
        variant: "destructive" 
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("email_provider_configs")
        .update({
          from_name: config.from_name,
          from_email: config.from_email,
          reply_to: config.reply_to || null,
        })
        .eq("tenant_id", tenantId);

      if (error) throw error;
      toast({ title: "Salvo", description: "Configuração de notificações salva" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId) return;
    const targetEmail = testEmailInput.trim() || profile?.email;
    if (!targetEmail) {
      toast({ title: "Erro", description: "Informe o email de destino", variant: "destructive" });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { tenant_id: tenantId, to_email: targetEmail },
      });

      if (error) throw error;
      toast({
        title: data?.success ? "Email enviado!" : "Falha no envio",
        description: data?.message,
        variant: data?.success ? "default" : "destructive",
      });
      if (data?.success) {
        setShowTestInput(false);
        setTestEmailInput("");
      }
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

  const hasDomain = !!config.sending_domain;
  const isVerified = config.verification_status === "verified";
  const canSend = hasDomain && (isVerified || config.dns_all_ok);

  if (!hasDomain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Email de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Configure primeiro seu domínio na aba <strong>Configurações</strong> para usar emails de notificação personalizados.
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle>Email de Notificações</CardTitle>
            <CardDescription>
              Configurar remetente para emails transacionais (pedidos, confirmações, etc.)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome do Remetente</Label>
            <Input
              placeholder="Sua Loja"
              value={config.from_name}
              onChange={(e) => setConfig(prev => ({ ...prev, from_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email do Remetente</Label>
            <Input
              placeholder={`noreply@${config.sending_domain}`}
              value={config.from_email}
              onChange={(e) => setConfig(prev => ({ ...prev, from_email: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Deve usar @{config.sending_domain}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Responder para (opcional)</Label>
          <Input
            placeholder="contato@seudominio.com"
            value={config.reply_to}
            onChange={(e) => setConfig(prev => ({ ...prev, reply_to: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Onde os clientes enviarão respostas
          </p>
        </div>

        {showTestInput && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <Label>Enviar email de teste para:</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={profile?.email || "seu@email.com"}
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleTest} disabled={isTesting}>
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" onClick={() => setShowTestInput(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
          {!showTestInput && canSend && (
            <Button variant="outline" onClick={() => setShowTestInput(true)}>
              <Send className="h-4 w-4 mr-2" />
              Enviar teste
            </Button>
          )}
        </div>

        {!canSend && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              Complete a verificação DNS na aba Configurações para enviar emails.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
