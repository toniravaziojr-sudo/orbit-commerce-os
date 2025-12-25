import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle, XCircle, Loader2, Send, RefreshCw, Copy, Globe, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  priority?: number;
  ttl?: string;
}

interface EmailConfig {
  id?: string;
  provider_type: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  is_verified: boolean;
  sending_domain: string;
  resend_domain_id: string | null;
  verification_status: "not_started" | "pending" | "verified" | "failed";
  dns_records: DnsRecord[];
  last_test_at: string | null;
  last_test_result: { success: boolean; message: string } | null;
  last_verify_error: string | null;
}

export function EmailProviderSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [config, setConfig] = useState<EmailConfig>({
    provider_type: "resend",
    from_name: "",
    from_email: "",
    reply_to: "",
    is_verified: false,
    sending_domain: "",
    resend_domain_id: null,
    verification_status: "not_started",
    dns_records: [],
    last_test_at: null,
    last_test_result: null,
    last_verify_error: null,
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
          id: data.id,
          provider_type: data.provider_type || "resend",
          from_name: data.from_name || "",
          from_email: data.from_email || "",
          reply_to: data.reply_to || "",
          is_verified: data.is_verified || false,
          sending_domain: data.sending_domain || "",
          resend_domain_id: data.resend_domain_id || null,
          verification_status: (data.verification_status as EmailConfig["verification_status"]) || "not_started",
          dns_records: (data.dns_records as DnsRecord[]) || [],
          last_test_at: data.last_test_at,
          last_test_result: data.last_test_result as EmailConfig["last_test_result"],
          last_verify_error: data.last_verify_error || null,
        });
        setDomainInput(data.sending_domain || "");
      }
    } catch (error) {
      console.error("Error fetching email config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!tenantId || !domainInput.trim()) {
      toast({ title: "Erro", description: "Informe o domínio", variant: "destructive" });
      return;
    }

    setIsAddingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-domain-upsert", {
        body: { tenant_id: tenantId, sending_domain: domainInput.trim().toLowerCase() },
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: "Domínio adicionado", description: data.message });
        await fetchConfig();
      } else {
        toast({ title: "Erro", description: data?.error || "Erro ao adicionar domínio", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error adding domain:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!tenantId) return;

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-domain-verify", {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      if (data?.verified) {
        toast({ title: "Verificado!", description: "Domínio verificado com sucesso!" });
      } else {
        toast({ 
          title: "Aguardando DNS", 
          description: data?.message || "Configure os registros DNS e tente novamente",
          variant: "default"
        });
      }
      await fetchConfig();
    } catch (error: any) {
      console.error("Error verifying domain:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (config.verification_status !== "verified") {
      toast({ title: "Erro", description: "Verifique o domínio antes de configurar o remetente", variant: "destructive" });
      return;
    }
    if (!config.from_email || !config.from_name) {
      toast({ title: "Erro", description: "Preencha o nome e email do remetente", variant: "destructive" });
      return;
    }

    // Validate from_email belongs to verified domain
    const emailDomain = config.from_email.split("@")[1]?.toLowerCase();
    if (emailDomain !== config.sending_domain?.toLowerCase()) {
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
        .eq("id", config.id);

      if (error) throw error;

      toast({ title: "Configuração salva", description: "As configurações de email foram salvas" });
    } catch (error: any) {
      console.error("Error saving email config:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!tenantId || config.verification_status !== "verified") {
      toast({ title: "Erro", description: "Verifique o domínio primeiro", variant: "destructive" });
      return;
    }

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { tenant_id: tenantId, to_email: profile?.email },
      });

      if (error) throw error;

      toast({
        title: data?.success ? "Email enviado!" : "Falha no envio",
        description: data?.message,
        variant: data?.success ? "default" : "destructive",
      });
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Valor copiado para a área de transferência" });
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

  const isVerified = config.verification_status === "verified";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Email Transacional
              {isVerified ? (
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />Verificado
                </StatusBadge>
              ) : config.sending_domain ? (
                <StatusBadge variant="warning" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />Pendente
                </StatusBadge>
              ) : null}
            </CardTitle>
            <CardDescription>Configure o domínio de envio para notificações</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Domain */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <Label className="font-semibold">1. Domínio de envio</Label>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="exemplo.com.br"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              disabled={isVerified}
            />
            <Button onClick={handleAddDomain} disabled={isAddingDomain || isVerified}>
              {isAddingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
            </Button>
          </div>
        </div>

        {/* Step 2: DNS Records */}
        {config.dns_records.length > 0 && (
          <div className="space-y-4">
            <Label className="font-semibold">2. Configure os registros DNS</Label>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Valor</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {config.dns_records.map((record, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 font-mono text-xs">{record.type}</td>
                      <td className="p-3 font-mono text-xs break-all">{record.name}</td>
                      <td className="p-3 font-mono text-xs break-all max-w-[300px]">{record.value}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(record.value)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleVerifyDomain} disabled={isVerifying || isVerified} variant="outline">
                {isVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {isVerified ? "Verificado" : "Verificar DNS"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Sender Info */}
        {isVerified && (
          <div className="space-y-4 pt-4 border-t">
            <Label className="font-semibold">3. Configurar remetente</Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from_name">Nome do remetente *</Label>
                <Input
                  id="from_name"
                  placeholder="Minha Loja"
                  value={config.from_name}
                  onChange={(e) => setConfig(prev => ({ ...prev, from_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_email">Email do remetente *</Label>
                <Input
                  id="from_email"
                  type="email"
                  placeholder={`contato@${config.sending_domain}`}
                  value={config.from_email}
                  onChange={(e) => setConfig(prev => ({ ...prev, from_email: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reply_to">Responder para (opcional)</Label>
                <Input
                  id="reply_to"
                  type="email"
                  placeholder="suporte@minhaloja.com.br"
                  value={config.reply_to}
                  onChange={(e) => setConfig(prev => ({ ...prev, reply_to: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={isTesting || !config.from_email}>
                {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar teste
              </Button>
            </div>
          </div>
        )}

        {!isVerified && config.sending_domain && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configure os registros DNS no seu provedor e clique em "Verificar DNS". A propagação pode levar alguns minutos.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
