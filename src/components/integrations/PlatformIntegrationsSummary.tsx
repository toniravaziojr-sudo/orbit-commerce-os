import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  CreditCard,
  FileText,
  Truck,
  BarChart3,
  Globe,
  MessageCircle,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  whatsapp: boolean;
  email: boolean;
  payments: boolean;
  fiscal: boolean;
  shipping: boolean;
  marketing: boolean;
  domains: number;
}

interface CategorySummary {
  total: number;
  configured: number;
  pending: number;
}

export function PlatformIntegrationsSummary() {
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [summary, setSummary] = useState<Record<string, CategorySummary>>({
    whatsapp: { total: 0, configured: 0, pending: 0 },
    email: { total: 0, configured: 0, pending: 0 },
    payments: { total: 0, configured: 0, pending: 0 },
    fiscal: { total: 0, configured: 0, pending: 0 },
    shipping: { total: 0, configured: 0, pending: 0 },
    marketing: { total: 0, configured: 0, pending: 0 },
    domains: { total: 0, configured: 0, pending: 0 },
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // Fetch all tenants
      const { data: tenantsData } = await supabase
        .from("tenants")
        .select("id, name, slug")
        .order("name");

      if (!tenantsData) return;

      // Fetch all integrations data in parallel
      const [
        whatsappConfigs,
        emailConfigs,
        paymentProviders,
        fiscalSettings,
        shippingProviders,
        marketingIntegrations,
        tenantDomains
      ] = await Promise.all([
        supabase.from("whatsapp_configs").select("tenant_id, connection_status"),
        supabase.from("email_provider_configs").select("tenant_id, is_verified"),
        supabase.from("payment_providers").select("tenant_id, is_enabled"),
        supabase.from("fiscal_settings").select("tenant_id, provider_token"),
        supabase.from("shipping_providers").select("tenant_id, is_enabled"),
        supabase.from("marketing_integrations").select("tenant_id, meta_enabled, google_enabled, tiktok_enabled"),
        supabase.from("tenant_domains").select("tenant_id, type, status")
      ]);

      // Build tenant summaries
      const tenantSummaries: TenantSummary[] = tenantsData.map(tenant => {
        const whatsapp = whatsappConfigs.data?.find(w => w.tenant_id === tenant.id);
        const email = emailConfigs.data?.find(e => e.tenant_id === tenant.id);
        const payments = paymentProviders.data?.filter(p => p.tenant_id === tenant.id && p.is_enabled);
        const fiscal = fiscalSettings.data?.find(f => f.tenant_id === tenant.id);
        const shipping = shippingProviders.data?.filter(s => s.tenant_id === tenant.id && s.is_enabled);
        const marketing = marketingIntegrations.data?.find(m => m.tenant_id === tenant.id);
        const domains = tenantDomains.data?.filter(d => d.tenant_id === tenant.id && d.type === 'custom');

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          whatsapp: whatsapp?.connection_status === 'connected',
          email: email?.is_verified ?? false,
          payments: (payments?.length ?? 0) > 0,
          fiscal: !!fiscal?.provider_token,
          shipping: (shipping?.length ?? 0) > 0,
          marketing: marketing?.meta_enabled || marketing?.google_enabled || marketing?.tiktok_enabled || false,
          domains: domains?.length ?? 0,
        };
      });

      setTenants(tenantSummaries);

      // Calculate summary
      const totalTenants = tenantSummaries.length;
      setSummary({
        whatsapp: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.whatsapp).length,
          pending: totalTenants - tenantSummaries.filter(t => t.whatsapp).length,
        },
        email: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.email).length,
          pending: totalTenants - tenantSummaries.filter(t => t.email).length,
        },
        payments: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.payments).length,
          pending: totalTenants - tenantSummaries.filter(t => t.payments).length,
        },
        fiscal: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.fiscal).length,
          pending: totalTenants - tenantSummaries.filter(t => t.fiscal).length,
        },
        shipping: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.shipping).length,
          pending: totalTenants - tenantSummaries.filter(t => t.shipping).length,
        },
        marketing: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.marketing).length,
          pending: totalTenants - tenantSummaries.filter(t => t.marketing).length,
        },
        domains: {
          total: totalTenants,
          configured: tenantSummaries.filter(t => t.domains > 0).length,
          pending: totalTenants - tenantSummaries.filter(t => t.domains > 0).length,
        },
      });
    } catch (error) {
      console.error("Error fetching integration summary:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-500" },
    { key: "email", label: "Email", icon: Mail, color: "text-blue-500" },
    { key: "payments", label: "Pagamentos", icon: CreditCard, color: "text-purple-500" },
    { key: "fiscal", label: "Fiscal", icon: FileText, color: "text-amber-500" },
    { key: "shipping", label: "Logística", icon: Truck, color: "text-cyan-500" },
    { key: "marketing", label: "Marketing", icon: BarChart3, color: "text-pink-500" },
    { key: "domains", label: "Domínios", icon: Globe, color: "text-indigo-500" },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {categories.map(cat => {
          const data = summary[cat.key];
          const Icon = cat.icon;
          const allConfigured = data.configured === data.total && data.total > 0;
          const noneConfigured = data.configured === 0;

          return (
            <Card key={cat.key} className="hover:border-primary/30 transition-colors">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${cat.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cat.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {data.configured}/{data.total} tenants
                      </p>
                    </div>
                  </div>
                  <div>
                    {allConfigured ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : noneConfigured ? (
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tenant Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status por Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Tenant</th>
                  {categories.map(cat => (
                    <th key={cat.key} className="text-center py-2 px-2 font-medium">
                      <cat.icon className="h-4 w-4 mx-auto" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 px-2">
                      <div>
                        <p className="font-medium">{tenant.name}</p>
                        <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.whatsapp ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.email ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.payments ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.fiscal ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.shipping ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.marketing ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">
                      {tenant.domains > 0 ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">{tenant.domains}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">-</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
