import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, CheckCircle, XCircle, Loader2, Shield, AlertCircle } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface FiscalSettings {
  id: string;
  provider: string | null;
  provider_token: string | null;
  ambiente: string | null;
  certificado_senha: string | null;
  certificado_valido_ate: string | null;
  crt: number | null;
}

export function FiscalPlatformStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [settings, setSettings] = useState<FiscalSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);

  useEffect(() => {
    const fetchTenants = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from("tenants")
          .select("id, name, slug")
          .order("name");
        setTenants(data || []);
      } catch (error) {
        console.error("Error fetching tenants:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const fetchSettings = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setSettings(null);
      return;
    }
    setLoadingSettings(true);
    try {
      const { data } = await supabase
        .from("fiscal_settings")
        .select("id, provider, provider_token, ambiente, certificado_senha, certificado_valido_ate, crt")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      setSettings(data);
    } catch (error) {
      console.error("Error fetching fiscal settings:", error);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchSettings(selectedTenantId);
    }
  }, [selectedTenantId, fetchSettings]);

  const hasToken = !!settings?.provider_token;
  const hasCertificate = !!settings?.certificado_senha;
  const certificateExpired = settings?.certificado_valido_ate
    ? new Date(settings.certificado_valido_ate) < new Date()
    : false;

  const getRegimeLabel = (crt: number | null) => {
    const regimes: Record<number, string> = {
      1: "Simples Nacional",
      2: "Simples Nacional - Excesso",
      3: "Regime Normal",
    };
    return crt ? regimes[crt] || `CRT ${crt}` : "Não definido";
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <FileText className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <CardTitle>Configurações Fiscais (Focus NFe)</CardTitle>
            <CardDescription>Visualize o status da integração fiscal por tenant</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
            {loadingSettings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !settings ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Configurações fiscais não encontradas</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Token Status */}
                <div className={`p-4 rounded-lg border ${hasToken ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10" : "border-muted"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Token Focus NFe</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {hasToken ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Configurado
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <XCircle className="h-3 w-3 mr-1" /> Não configurado
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Certificate Status */}
                <div className={`p-4 rounded-lg border ${
                  hasCertificate && !certificateExpired
                    ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                    : certificateExpired
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-muted"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">Certificado Digital</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {certificateExpired ? (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" /> Expirado
                      </Badge>
                    ) : hasCertificate ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Válido
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <XCircle className="h-3 w-3 mr-1" /> Não configurado
                      </Badge>
                    )}
                  </div>
                  {settings.certificado_valido_ate && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Expira em: {new Date(settings.certificado_valido_ate).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>

                {/* Environment */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Ambiente:</span>
                    <Badge variant={settings.ambiente === "producao" ? "default" : "secondary"}>
                      {settings.ambiente === "producao" ? "Produção" : "Homologação"}
                    </Badge>
                  </div>
                </div>

                {/* Regime Tributário */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Regime:</span>
                    <Badge variant="outline">{getRegimeLabel(settings.crt)}</Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
