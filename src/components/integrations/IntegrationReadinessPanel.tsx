import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  MessageCircle,
  Mail,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface IntegrationStatus {
  whatsapp: {
    configured: boolean;
    connected: boolean;
    lastError: string | null;
    phoneNumber: string | null;
  };
  email: {
    configured: boolean;
    verified: boolean;
    domain: string | null;
    lastError: string | null;
  };
  systemEmail: {
    configured: boolean;
    verified: boolean;
  };
}

export function IntegrationReadinessPanel() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, name, slug')
          .order('name');

        if (error) throw error;
        setTenants(data || []);
        if (data && data.length > 0) {
          setSelectedTenantId(data[0].id);
        }
      } catch (error) {
        console.error('Error fetching tenants:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
  }, []);

  // Fetch integration status for selected tenant
  const fetchStatus = async (tenantId: string) => {
    if (!tenantId) return;
    
    setIsRefreshing(true);
    try {
      // Fetch WhatsApp config
      const { data: whatsappConfig } = await supabase
        .from('whatsapp_configs')
        .select('instance_id, instance_token, client_token, connection_status, phone_number, last_error')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Fetch Email config
      const { data: emailConfig } = await supabase
        .from('email_provider_configs')
        .select('sending_domain, verification_status, last_verify_error')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Fetch System Email config (global)
      const { data: systemEmailConfig } = await supabase
        .from('system_email_config')
        .select('verification_status')
        .limit(1)
        .maybeSingle();

      setStatus({
        whatsapp: {
          configured: !!(whatsappConfig?.instance_id && whatsappConfig?.instance_token && whatsappConfig?.client_token),
          connected: whatsappConfig?.connection_status === 'connected',
          lastError: whatsappConfig?.last_error || null,
          phoneNumber: whatsappConfig?.phone_number || null,
        },
        email: {
          configured: !!emailConfig?.sending_domain,
          verified: emailConfig?.verification_status === 'verified',
          domain: emailConfig?.sending_domain || null,
          lastError: emailConfig?.last_verify_error || null,
        },
        systemEmail: {
          configured: !!systemEmailConfig,
          verified: systemEmailConfig?.verification_status === 'verified',
        },
      });
    } catch (error) {
      console.error('Error fetching integration status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedTenantId) {
      fetchStatus(selectedTenantId);
    }
  }, [selectedTenantId]);

  const getStatusIcon = (ready: boolean, partialReady?: boolean) => {
    if (ready) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (partialReady) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Prontidão de Integrações</CardTitle>
            <CardDescription>Resumo por tenant (WhatsApp + Email)</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => fetchStatus(selectedTenantId)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tenant selector */}
        <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um tenant..." />
          </SelectTrigger>
          <SelectContent>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name} ({tenant.slug})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {status && (
          <div className="space-y-3">
            {/* WhatsApp Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <div>
                  <span className="font-medium text-sm">WhatsApp</span>
                  {status.whatsapp.phoneNumber && (
                    <p className="text-xs text-muted-foreground">{status.whatsapp.phoneNumber}</p>
                  )}
                  {status.whatsapp.lastError && (
                    <p className="text-xs text-destructive">{status.whatsapp.lastError}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status.whatsapp.connected, status.whatsapp.configured)}
                <Badge variant={status.whatsapp.connected ? 'secondary' : 'outline'}>
                  {status.whatsapp.connected 
                    ? 'Conectado' 
                    : status.whatsapp.configured 
                      ? 'Desconectado' 
                      : 'Não configurado'}
                </Badge>
              </div>
            </div>

            {/* Email Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <span className="font-medium text-sm">Email Tenant</span>
                  {status.email.domain && (
                    <p className="text-xs text-muted-foreground">{status.email.domain}</p>
                  )}
                  {status.email.lastError && (
                    <p className="text-xs text-destructive">{status.email.lastError}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status.email.verified, status.email.configured)}
                <Badge variant={status.email.verified ? 'secondary' : 'outline'}>
                  {status.email.verified 
                    ? 'Verificado' 
                    : status.email.configured 
                      ? 'Pendente' 
                      : 'Não configurado'}
                </Badge>
              </div>
            </div>

            {/* System Email Status */}
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <span className="font-medium text-sm">Email Sistema</span>
                  <p className="text-xs text-muted-foreground">Usado como fallback</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(status.systemEmail.verified, status.systemEmail.configured)}
                <Badge variant={status.systemEmail.verified ? 'secondary' : 'outline'}>
                  {status.systemEmail.verified 
                    ? 'OK' 
                    : status.systemEmail.configured 
                      ? 'Pendente' 
                      : 'Não configurado'}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
