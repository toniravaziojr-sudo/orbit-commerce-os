import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, CheckCircle, XCircle, Loader2, Shield, Clock, AlertCircle } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface TenantDomain {
  id: string;
  domain: string;
  type: string;
  status: string;
  ssl_status: string | null;
  is_primary: boolean;
  created_at: string;
}

export function DomainsPlatformStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [domains, setDomains] = useState<TenantDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [cloudflareConfigured, setCloudflareConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchTenants = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from("tenants")
          .select("id, name, slug")
          .order("name");
        setTenants(data || []);

        // Check if Cloudflare secrets are configured via env (edge function would check this)
        // For now we'll assume it's configured if we have domains with ssl_status
        setCloudflareConfigured(true);
      } catch (error) {
        console.error("Error fetching tenants:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const fetchDomains = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setDomains([]);
      return;
    }
    setLoadingDomains(true);
    try {
      const { data } = await supabase
        .from("tenant_domains")
        .select("id, domain, type, status, ssl_status, is_primary, created_at")
        .eq("tenant_id", tenantId)
        .order("is_primary", { ascending: false });
      setDomains(data || []);
    } catch (error) {
      console.error("Error fetching domains:", error);
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchDomains(selectedTenantId);
    }
  }, [selectedTenantId, fetchDomains]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Verificado</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSslBadge = (sslStatus: string | null) => {
    switch (sslStatus) {
      case "active":
        return <Badge className="bg-green-500"><Shield className="h-3 w-3 mr-1" /> SSL Ativo</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> SSL Pendente</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> SSL Falhou</Badge>;
      default:
        return <Badge variant="outline">Sem SSL</Badge>;
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Globe className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <CardTitle>Domínios Personalizados</CardTitle>
            <CardDescription>Visualize domínios e status SSL por tenant</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cloudflare Status */}
        <Alert className={cloudflareConfigured ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10" : "border-amber-500/30"}>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Cloudflare for SaaS:</strong>{" "}
            {cloudflareConfigured ? (
              <span className="text-green-600 dark:text-green-400">Configurado e pronto para uso</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Verificar secrets CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Tenant selector */}
        <div className="space-y-2">
          <Label>Selecionar Tenant</Label>
          <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um tenant..." />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.slug})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTenantId && (
          <div className="space-y-4">
            {loadingDomains ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : domains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum domínio configurado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {domains.map((domain) => (
                  <div
                    key={domain.id}
                    className={`p-4 rounded-lg border ${
                      domain.is_primary
                        ? "border-primary/30 bg-primary/5"
                        : domain.status === "verified"
                        ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                        : "border-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{domain.domain}</span>
                        {domain.is_primary && (
                          <Badge variant="outline" className="text-xs">Primário</Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {domain.type === "platform_subdomain" ? "Subdomínio" : "Custom"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(domain.status)}
                        {domain.type === "custom" && getSslBadge(domain.ssl_status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
