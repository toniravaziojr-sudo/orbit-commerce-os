// =============================================
// B2B SETTINGS TAB - Configurações e conectores
// =============================================

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, Plug, Key, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface B2BSource {
  id: string;
  source_type: string;
  provider_name: string;
  display_name: string;
  is_enabled: boolean;
  quota_daily: number;
  quota_used_today: number;
}

// Provedores disponíveis
const AVAILABLE_PROVIDERS = [
  {
    name: "brasilapi",
    display: "BrasilAPI",
    type: "cnpj_api",
    description: "Consulta CNPJ via API pública (grátis)",
    requiresKey: false,
  },
  {
    name: "cnpjws",
    display: "CNPJ.ws",
    type: "cnpj_api", 
    description: "Consulta CNPJ com dados estendidos",
    requiresKey: true,
  },
  {
    name: "tomtom",
    display: "TomTom POI",
    type: "poi_api",
    description: "Busca de pontos de interesse por região",
    requiresKey: true,
  },
];

export default function B2BSettingsTab() {
  const { currentTenant, user } = useAuth();
  const [sources, setSources] = useState<B2BSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentTenant?.id) {
      loadSources();
    }
  }, [currentTenant?.id]);

  const loadSources = async () => {
    if (!currentTenant?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("b2b_sources")
        .select("*")
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;
      setSources(data || []);
    } catch (err: any) {
      console.error("Load sources error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableProvider = async (providerName: string, displayName: string, sourceType: string) => {
    if (!currentTenant?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("b2b_sources").insert({
        tenant_id: currentTenant.id,
        source_type: sourceType as "cnpj_api" | "poi_api" | "enrichment_provider" | "manual",
        provider_name: providerName,
        display_name: displayName,
        is_enabled: true,
        quota_daily: 100,
      });

      if (error) {
        if (error.code === "23505") {
          toast.info("Provedor já está configurado");
        } else {
          throw error;
        }
      } else {
        toast.success("Provedor habilitado!");
        loadSources();
      }
    } catch (err: any) {
      console.error("Enable provider error:", err);
      toast.error("Erro ao habilitar provedor");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSource = async (sourceId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("b2b_sources")
        .update({ is_enabled: enabled })
        .eq("id", sourceId);

      if (error) throw error;

      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, is_enabled: enabled } : s))
      );
      toast.success(enabled ? "Provedor ativado" : "Provedor desativado");
    } catch (err: any) {
      console.error("Toggle source error:", err);
      toast.error("Erro ao atualizar");
    }
  };

  const getSourceByProvider = (providerName: string) => {
    return sources.find((s) => s.provider_name === providerName);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fontes de Dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Fontes de Dados
          </CardTitle>
          <CardDescription>
            Configure os provedores de dados para consulta de CNPJ e POI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {AVAILABLE_PROVIDERS.map((provider) => {
            const source = getSourceByProvider(provider.name);
            const isConfigured = !!source;

            return (
              <div
                key={provider.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      isConfigured && source?.is_enabled
                        ? "bg-green-500/10"
                        : "bg-muted"
                    }`}
                  >
                    {isConfigured && source?.is_enabled ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{provider.display}</p>
                      <Badge variant="outline" className="text-xs">
                        {provider.type === "cnpj_api" ? "CNPJ" : "POI"}
                      </Badge>
                      {!provider.requiresKey && (
                        <Badge className="bg-green-500/10 text-green-600 text-xs">
                          Grátis
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {provider.description}
                    </p>
                    {isConfigured && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Quota: {source.quota_used_today}/{source.quota_daily} consultas hoje
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {isConfigured ? (
                    <Switch
                      checked={source.is_enabled}
                      onCheckedChange={(checked) =>
                        handleToggleSource(source.id, checked)
                      }
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleEnableProvider(
                          provider.name,
                          provider.display,
                          provider.type
                        )
                      }
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Habilitar"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quotas e Limites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Quotas e Limites
          </CardTitle>
          <CardDescription>
            Gerencie os limites de consulta para evitar bloqueios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                As quotas são resetadas automaticamente todo dia à meia-noite.
                APIs públicas como BrasilAPI podem ter rate limiting próprio.
              </p>
            </div>
            {sources.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma fonte configurada ainda
              </p>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <span className="font-medium">{source.display_name}</span>
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="font-medium">{source.quota_used_today}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          / {source.quota_daily}
                        </span>
                      </div>
                      <div
                        className="w-24 h-2 bg-muted rounded-full overflow-hidden"
                      >
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(
                              (source.quota_used_today / source.quota_daily) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
