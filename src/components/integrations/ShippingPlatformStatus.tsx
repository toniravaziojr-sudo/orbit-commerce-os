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
import { Truck, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface ShippingProvider {
  id: string;
  provider: string;
  is_enabled: boolean;
  supports_quote: boolean;
  supports_tracking: boolean;
}

export function ShippingPlatformStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

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

  const fetchProviders = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setProviders([]);
      return;
    }
    setLoadingProviders(true);
    try {
      const { data } = await supabase
        .from("shipping_providers")
        .select("id, provider, is_enabled, supports_quote, supports_tracking")
        .eq("tenant_id", tenantId);
      setProviders(data || []);
    } catch (error) {
      console.error("Error fetching shipping providers:", error);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchProviders(selectedTenantId);
    }
  }, [selectedTenantId, fetchProviders]);

  const getProviderDisplayName = (name: string) => {
    const names: Record<string, string> = {
      frenet: "Frenet",
      correios: "Correios",
      loggi: "Loggi",
      jadlog: "JadLog",
      melhorenvio: "Melhor Envio",
    };
    return names[name.toLowerCase()] || name;
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
            <Truck className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <CardTitle>Transportadoras</CardTitle>
            <CardDescription>Visualize as transportadoras configuradas por tenant</CardDescription>
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
            {loadingProviders ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma transportadora configurada</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => (
                  <div
                    key={provider.id}
                    className={`p-4 rounded-lg border ${
                      provider.is_enabled
                        ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                        : "border-muted bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {getProviderDisplayName(provider.provider)}
                      </span>
                      {provider.is_enabled ? (
                        <Badge className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <XCircle className="h-3 w-3 mr-1" /> Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {provider.supports_quote && (
                        <Badge variant="secondary" className="text-xs">Cotação</Badge>
                      )}
                      {provider.supports_tracking && (
                        <Badge variant="secondary" className="text-xs">Rastreio</Badge>
                      )}
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
