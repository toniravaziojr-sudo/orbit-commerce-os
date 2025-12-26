import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Mail, CheckCircle, XCircle, Loader2, Send, RefreshCw, Copy, Globe, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  priority?: number | string;
  ttl?: string;
}

const getMxPriority = (record: DnsRecord): string | null => {
  if (record.type !== "MX") return null;
  if (record.priority !== undefined) return String(record.priority);
  return "10";
};

interface DnsLookupResult {
  record_type: string;
  host: string;
  expected_value: string;
  found_values: string[];
  match: boolean;
  details?: string;
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
  dns_all_ok?: boolean;
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
  const [isRemoving, setIsRemoving] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [dnsLookupResults, setDnsLookupResults] = useState<DnsLookupResult[]>([]);
  const [dnsDiagnosis, setDnsDiagnosis] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testEmailInput, setTestEmailInput] = useState("");
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
    dns_all_ok: false,
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
          dns_records: (Array.isArray(data.dns_records) ? data.dns_records as unknown as DnsRecord[] : []),
          dns_all_ok: (data as any).dns_all_ok || false,
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

      if (error) {
        let errorMessage = "Erro ao adicionar domínio";
        if (error.message) errorMessage = error.message;
        try {
          const ctx = (error as any).context;
          if (ctx?.body) {
            const parsed = typeof ctx.body === 'string' ? JSON.parse(ctx.body) : ctx.body;
            if (parsed?.error) errorMessage = parsed.error;
          }
        } catch {}
        toast({ title: "Erro", description: errorMessage, variant: "destructive" });
        return;
      }

      if (data?.success) {
        toast({ title: "Sucesso", description: data.message });
        await fetchConfig();
      } else {
        toast({ title: "Erro", description: data?.error || "Erro ao adicionar domínio", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setIsAddingDomain(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!tenantId) return;

    setIsVerifying(true);
    setDnsLookupResults([]);
    setDnsDiagnosis([]);
    
    try {
      const { data, error } = await supabase.functions.invoke("email-domain-verify", {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;

      if (data?.dns_lookup) {
        setDnsLookupResults(data.dns_lookup);
      }
      if (data?.diagnosis) {
        setDnsDiagnosis(data.diagnosis);
      }

      if (data?.verified) {
        toast({ title: "Verificado!", description: "Domínio verificado com sucesso!" });
        setDnsLookupResults([]);
        setDnsDiagnosis([]);
      } else {
        const allRecordsOk = data?.dns_lookup?.length > 0 && data.dns_lookup.every((r: DnsLookupResult) => r.match);
        if (allRecordsOk) {
          toast({ 
            title: "DNS OK!", 
            description: "Registros DNS verificados. Você já pode configurar o remetente.",
            duration: 5000,
          });
        } else {
          toast({ 
            title: "Aguardando DNS", 
            description: data?.message || "Configure os registros DNS e tente novamente",
          });
        }
      }
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!tenantId) return;
    
    if (!config.from_email || !config.from_name) {
      toast({ title: "Erro", description: "Preencha o nome e email do remetente", variant: "destructive" });
      return;
    }

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
      setIsEditing(false);
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!tenantId || !config.id) return;
    
    if (!confirm("Remover configuração de email? Os envios voltarão a usar o email do sistema.")) return;
    
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("email_provider_configs")
        .delete()
        .eq("id", config.id);

      if (error) throw error;

      toast({ title: "Removido", description: "Configuração de email removida" });
      setConfig({
        provider_type: "resend",
        from_name: "",
        from_email: "",
        reply_to: "",
        is_verified: false,
        sending_domain: "",
        resend_domain_id: null,
        verification_status: "not_started",
        dns_records: [],
        dns_all_ok: false,
        last_test_at: null,
        last_test_result: null,
        last_verify_error: null,
      });
      setDomainInput("");
      setIsEditing(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsRemoving(false);
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
      
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!" });
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
  const dnsOk = config.dns_all_ok || false;
  const hasSenderConfigured = !!(config.from_email && config.from_name);
  const isFullyConfigured = hasSenderConfigured && config.sending_domain;
  const canSend = isVerified || (dnsOk && hasSenderConfigured);

  // Estado compacto: já configurado e não está editando
  if (isFullyConfigured && !isEditing) {
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
                    <CheckCircle className="h-3 w-3 mr-1" />Ativo
                  </StatusBadge>
                ) : dnsOk ? (
                  <StatusBadge variant="warning" className="ml-2">
                    <AlertCircle className="h-3 w-3 mr-1" />DNS OK
                  </StatusBadge>
                ) : (
                  <StatusBadge variant="warning" className="ml-2">
                    <AlertCircle className="h-3 w-3 mr-1" />Pendente
                  </StatusBadge>
                )}
              </CardTitle>
              <CardDescription>Remetente personalizado configurado</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resumo compacto */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Domínio:</span>
              <span className="font-medium">{config.sending_domain}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Remetente:</span>
              <span className="font-medium">"{config.from_name}" &lt;{config.from_email}&gt;</span>
            </div>
            {config.reply_to && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Responder para:</span>
                <span className="font-medium">{config.reply_to}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status do provedor:</span>
              <span className="font-medium capitalize">{config.verification_status}</span>
            </div>
          </div>

          {/* Status message */}
          {!isVerified && dnsOk && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                DNS verificado. Provedor ainda processando. <strong>Emails já saem com seu remetente.</strong>
              </AlertDescription>
            </Alert>
          )}

          {isVerified && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
                <strong>Ativo!</strong> Todos os emails saem com seu remetente personalizado.
              </AlertDescription>
            </Alert>
          )}

          {!isVerified && !dnsOk && (
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                Aguardando verificação DNS. Emails saem pelo remetente do sistema por enquanto.
              </AlertDescription>
            </Alert>
          )}

          {/* Teste de email */}
          {showTestInput && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Enviar email de teste para:</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={profile?.email || "seu@email.com"}
                  value={testEmailInput}
                  onChange={(e) => setTestEmailInput(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleTest} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar
                </Button>
                <Button variant="ghost" onClick={() => { setShowTestInput(false); setTestEmailInput(""); }}>
                  Cancelar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para enviar para seu email ({profile?.email})
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />Editar
            </Button>
            {!showTestInput && (
              <Button variant="outline" onClick={() => setShowTestInput(true)} disabled={!canSend}>
                <Send className="h-4 w-4 mr-2" />
                Enviar teste
              </Button>
            )}
            {!isVerified && (
              <Button variant="outline" onClick={handleVerifyDomain} disabled={isVerifying}>
                {isVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar DNS
              </Button>
            )}
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Estado de configuração / edição
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
              {isVerified && (
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />Verificado
                </StatusBadge>
              )}
            </CardTitle>
            <CardDescription>
              {isEditing ? "Editar configuração do remetente" : "Configure o domínio de envio para notificações"}
            </CardDescription>
          </div>
          {isEditing && (
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Domain - hide when editing */}
        {!isEditing && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <Label className="font-semibold">1. Domínio de envio</Label>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="respeiteohomem.com.br"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                disabled={!!config.sending_domain}
              />
              <Button onClick={handleAddDomain} disabled={isAddingDomain || !!config.sending_domain}>
                {isAddingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Informe o domínio (ex.: respeiteohomem.com.br). Se informar um email, o domínio será extraído.
            </p>
          </div>
        )}

        {/* Step 2: DNS Records - show only when domain added and not editing */}
        {!isEditing && config.dns_records.length > 0 && !hasSenderConfigured && (
          <div className="space-y-4">
            <Label className="font-semibold">2. Configure os registros DNS</Label>
            
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                Após verificar os registros DNS, aparecerá o formulário para cadastrar o remetente.
              </AlertDescription>
            </Alert>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Valor</th>
                    <th className="text-left p-3 w-20">Prioridade</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {config.dns_records.map((record, i) => {
                    const mxPriority = getMxPriority(record);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-3 font-mono text-xs">{record.type}</td>
                        <td className="p-3 font-mono text-xs break-all">{record.name}</td>
                        <td className="p-3 font-mono text-xs break-all max-w-[300px]">{record.value}</td>
                        <td className="p-3 font-mono text-xs text-center">
                          {mxPriority ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs font-medium">
                              {mxPriority}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(record.value)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <p className="font-medium text-foreground">Dicas de configuração:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>No Cloudflare, desative o proxy (use <span className="font-mono text-xs">"Somente DNS"</span>)</li>
                <li>Para registros MX, informe a <strong>Prioridade = 10</strong></li>
                <li>TTL pode ser "Auto" ou 3600 segundos</li>
              </ul>
            </div>
            
            <Button onClick={handleVerifyDomain} disabled={isVerifying} variant="outline">
              {isVerifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Verificar DNS
            </Button>
            
            {/* DNS Diagnosis */}
            {dnsLookupResults.length > 0 && (
              <div className="space-y-3 mt-4">
                <Label className="font-semibold text-amber-700 dark:text-amber-400">Diagnóstico DNS</Label>
                
                {dnsDiagnosis.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-1">
                    {dnsDiagnosis.map((line, i) => (
                      <p key={i} className="text-sm text-amber-900 dark:text-amber-100">{line}</p>
                    ))}
                  </div>
                )}
                
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-left p-2">Host</th>
                        <th className="text-left p-2">Esperado</th>
                        <th className="text-left p-2">Encontrado</th>
                        <th className="text-left p-2 w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dnsLookupResults.map((result, i) => (
                        <tr key={i} className={`border-t ${result.match ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                          <td className="p-2 font-mono">{result.record_type}</td>
                          <td className="p-2 font-mono break-all max-w-[150px]">{result.host}</td>
                          <td className="p-2 font-mono break-all max-w-[150px] text-muted-foreground">{result.expected_value.substring(0, 40)}...</td>
                          <td className="p-2 font-mono break-all max-w-[150px]">
                            {result.found_values.length > 0 
                              ? result.found_values.map(v => v.substring(0, 30) + '...').join('; ')
                              : <span className="text-red-600 italic">Não encontrado</span>
                            }
                          </td>
                          <td className="p-2 text-center">
                            {result.match ? <CheckCircle className="h-4 w-4 text-green-600 inline" /> : <XCircle className="h-4 w-4 text-red-600 inline" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Sender Info - show when DNS ok OR when editing */}
        {(dnsOk || isVerified || hasSenderConfigured || isEditing) && (
          <div className="space-y-4 pt-4 border-t">
            <Label className="font-semibold">{isEditing ? "Editar remetente" : "3. Configurar remetente"}</Label>
            
            {!isVerified && !isEditing && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
                  <strong>DNS verificado!</strong> Configure o remetente abaixo. Emails já podem ser enviados com seu domínio.
                </AlertDescription>
              </Alert>
            )}
            
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
                <p className="text-xs text-muted-foreground">
                  Deve pertencer ao domínio {config.sending_domain}
                </p>
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
            
            {(config.from_name || config.from_email) && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Prévia do remetente:</p>
                <p className="font-medium text-foreground">
                  "{config.from_name || "Seu Nome"}" &lt;{config.from_email || `contato@${config.sending_domain}`}&gt;
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              {isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
