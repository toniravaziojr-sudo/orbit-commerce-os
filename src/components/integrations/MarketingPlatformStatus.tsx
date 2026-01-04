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
import { BarChart3, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface MarketingIntegration {
  id: string;
  meta_enabled: boolean;
  meta_pixel_id: string | null;
  meta_capi_enabled: boolean;
  google_enabled: boolean;
  google_measurement_id: string | null;
  google_ads_conversion_id: string | null;
  tiktok_enabled: boolean;
  tiktok_pixel_id: string | null;
}

export function MarketingPlatformStatus() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [integration, setIntegration] = useState<MarketingIntegration | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(false);

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

  const fetchIntegration = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setIntegration(null);
      return;
    }
    setLoadingIntegration(true);
    try {
      const { data } = await supabase
        .from("marketing_integrations")
        .select("id, meta_enabled, meta_pixel_id, meta_capi_enabled, google_enabled, google_measurement_id, google_ads_conversion_id, tiktok_enabled, tiktok_pixel_id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      setIntegration(data);
    } catch (error) {
      console.error("Error fetching marketing integration:", error);
    } finally {
      setLoadingIntegration(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      fetchIntegration(selectedTenantId);
    }
  }, [selectedTenantId, fetchIntegration]);

  const maskId = (id: string | null) => {
    if (!id) return null;
    if (id.length <= 6) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10">
            <BarChart3 className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <CardTitle>Integrações de Marketing</CardTitle>
            <CardDescription>Visualize pixels e analytics configurados por tenant</CardDescription>
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
            {loadingIntegration ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !integration ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma integração de marketing configurada</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Meta Pixel */}
                <div className={`p-4 rounded-lg border ${integration.meta_enabled ? "border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/10" : "border-muted bg-muted/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Meta Pixel</span>
                    {integration.meta_enabled ? (
                      <Badge className="bg-blue-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <XCircle className="h-3 w-3 mr-1" /> Inativo
                      </Badge>
                    )}
                  </div>
                  {integration.meta_pixel_id && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ID: {maskId(integration.meta_pixel_id)}
                    </p>
                  )}
                  {integration.meta_capi_enabled && (
                    <Badge variant="secondary" className="mt-2 text-xs">CAPI ativo</Badge>
                  )}
                </div>

                {/* Google Analytics */}
                <div className={`p-4 rounded-lg border ${integration.google_enabled ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10" : "border-muted bg-muted/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Google Analytics</span>
                    {integration.google_enabled ? (
                      <Badge className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <XCircle className="h-3 w-3 mr-1" /> Inativo
                      </Badge>
                    )}
                  </div>
                  {integration.google_measurement_id && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ID: {integration.google_measurement_id}
                    </p>
                  )}
                  {integration.google_ads_conversion_id && (
                    <Badge variant="secondary" className="mt-2 text-xs">Ads ativo</Badge>
                  )}
                </div>

                {/* TikTok Pixel */}
                <div className={`p-4 rounded-lg border ${integration.tiktok_enabled ? "border-pink-500/30 bg-pink-50/50 dark:bg-pink-900/10" : "border-muted bg-muted/30"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">TikTok Pixel</span>
                    {integration.tiktok_enabled ? (
                      <Badge className="bg-pink-500">
                        <CheckCircle className="h-3 w-3 mr-1" /> Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <XCircle className="h-3 w-3 mr-1" /> Inativo
                      </Badge>
                    )}
                  </div>
                  {integration.tiktok_pixel_id && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ID: {maskId(integration.tiktok_pixel_id)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
