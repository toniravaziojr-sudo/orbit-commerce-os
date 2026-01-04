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
import { CreditCard, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface PaymentProvider {
  id: string;
  provider: string;
  is_enabled: boolean;
  environment: string;
  settings: Json;
}

export function PaymentsPlatformStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
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
        .from("payment_providers")
        .select("id, provider, is_enabled, environment, settings")
        .eq("tenant_id", tenantId);
      setProviders(data || []);
    } catch (error) {
      console.error("Error fetching payment providers:", error);
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
      pagarme: "Pagar.me",
      mercadopago: "Mercado Pago",
    };
    return names[name] || name;
  };

  const getPaymentMethods = (settings: Json): string[] => {
    if (typeof settings === 'object' && settings !== null && !Array.isArray(settings)) {
      const s = settings as Record<string, unknown>;
      if (Array.isArray(s.payment_methods)) {
        return s.payment_methods as string[];
      }
    }
    return [];
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      credit_card: "Cartão",
      pix: "PIX",
      boleto: "Boleto",
    };
    return labels[method] || method;
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
            <CreditCard className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <CardTitle>Gateways de Pagamento</CardTitle>
            <CardDescription>Visualize os gateways configurados por tenant</CardDescription>
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
                <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum gateway de pagamento configurado</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {providers.map((provider) => {
                  const methods = getPaymentMethods(provider.settings);
                  return (
                    <div
                      key={provider.id}
                      className={`p-4 rounded-lg border ${
                        provider.is_enabled
                          ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                          : "border-muted bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
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
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Ambiente:</span>
                          <Badge variant="outline">
                            {provider.environment === "production" ? "Produção" : "Sandbox"}
                          </Badge>
                        </div>
                        {methods.length > 0 && (
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Métodos:</span>
                            <div className="flex gap-1 flex-wrap justify-end">
                              {methods.map((method) => (
                                <Badge key={method} variant="secondary" className="text-xs">
                                  {getMethodLabel(method)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
