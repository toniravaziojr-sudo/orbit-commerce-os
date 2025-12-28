import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Globe, CheckCircle, Loader2, Copy, AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  status?: string;
  priority?: number | string;
}

interface DnsLookupResult {
  record_type: string;
  host: string;
  expected_value: string;
  found_values: string[];
  match: boolean;
}

interface EmailDnsConfig {
  id?: string;
  sending_domain: string | null;
  verification_status: "not_started" | "pending" | "verified" | "failed";
  dns_records: DnsRecord[];
  dns_all_ok: boolean;
}

export function EmailDnsSettings() {
  const { currentTenant, profile } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingDomain, setIsAddingDomain] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [dnsLookupResults, setDnsLookupResults] = useState<DnsLookupResult[]>([]);
  const [config, setConfig] = useState<EmailDnsConfig>({
    sending_domain: null,
    verification_status: "not_started",
    dns_records: [],
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
        .select("id, sending_domain, verification_status, dns_records, dns_all_ok")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig({
          id: data.id,
          sending_domain: data.sending_domain || null,
          verification_status: (data.verification_status as EmailDnsConfig["verification_status"]) || "not_started",
          dns_records: Array.isArray(data.dns_records) ? data.dns_records as unknown as DnsRecord[] : [],
          dns_all_ok: (data as any).dns_all_ok || false,
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
    
    try {
      const { data, error } = await supabase.functions.invoke("email-domain-verify", {
        body: { tenant_id: tenantId },
      });

      if (error) throw error;
      if (data?.dns_lookup) setDnsLookupResults(data.dns_lookup);

      if (data?.verified) {
        toast({ title: "Verificado!", description: "Domínio verificado com sucesso!" });
        setDnsLookupResults([]);
      } else {
        const allOk = data?.dns_lookup?.every((r: DnsLookupResult) => r.match);
        toast({ 
          title: allOk ? "DNS OK!" : "Aguardando DNS", 
          description: allOk ? "Registros DNS verificados." : "Configure os registros DNS e tente novamente",
        });
      }
      await fetchConfig();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRemove = async () => {
    if (!tenantId || !config.id) return;
    if (!confirm("Remover configuração de domínio?")) return;
    
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("email_provider_configs")
        .update({
          sending_domain: null,
          resend_domain_id: null,
          dns_records: [],
          dns_all_ok: false,
          is_verified: false,
          verification_status: "not_started",
        })
        .eq("id", config.id);

      if (error) throw error;
      toast({ title: "Removido", description: "Configuração de domínio removida." });
      setConfig({ ...config, sending_domain: null, verification_status: "not_started", dns_records: [], dns_all_ok: false });
      setDomainInput("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsRemoving(false);
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
  const hasDomain = !!config.sending_domain;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Configuração de Domínio
              {isVerified && (
                <StatusBadge variant="success" className="ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />Verificado
                </StatusBadge>
              )}
              {hasDomain && config.dns_all_ok && !isVerified && (
                <StatusBadge variant="warning" className="ml-2">
                  <AlertCircle className="h-3 w-3 mr-1" />DNS OK
                </StatusBadge>
              )}
            </CardTitle>
            <CardDescription>
              Configure o domínio para enviar e receber emails
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasDomain ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seu domínio</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="seudominio.com.br"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                />
                <Button onClick={handleAddDomain} disabled={isAddingDomain || !domainInput.trim()}>
                  {isAddingDomain && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Configurar
                </Button>
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Configure seu domínio uma única vez. Todos os emails (notificações, atendimento, manuais) usarão este domínio.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Domínio configurado</p>
                <p className="font-semibold text-lg">{config.sending_domain}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isRemoving}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            {/* DNS Records */}
            {config.dns_records.length > 0 && !isVerified && (
              <div className="space-y-3">
                <h4 className="font-semibold">Registros DNS Necessários</h4>
                <div className="space-y-2">
                  {config.dns_records.map((record, idx) => (
                    <div key={idx} className="bg-muted/50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono">
                          {record.type}
                        </span>
                        {record.priority !== undefined && (
                          <span className="text-xs text-muted-foreground">[{record.priority}]</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                          {record.name}
                        </code>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(record.value)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                          {record.value}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure estes registros no seu provedor de DNS (Cloudflare, Route53, etc.) com a opção "Somente DNS" (sem proxy).
                </p>
              </div>
            )}

            {/* Lookup results */}
            {dnsLookupResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Resultado da verificação</h4>
                {dnsLookupResults.map((r, i) => (
                  <div key={i} className={`text-xs p-2 rounded ${r.match ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                    <span className={r.match ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                      {r.match ? '✓' : '✗'} {r.record_type}: {r.host}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleVerifyDomain} disabled={isVerifying}>
                {isVerifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verificar DNS
              </Button>
            </div>

            {isVerified && (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Domínio verificado! Você pode configurar os emails nas abas de Notificações e Atendimento.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
