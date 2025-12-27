import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  Mail, 
  AlertTriangle, 
  ArrowRight,
  CheckCircle
} from "lucide-react";

interface IntegrationHealth {
  whatsapp: {
    configured: boolean;
    connected: boolean;
    lastError: string | null;
  };
  email: {
    configured: boolean;
    verified: boolean;
    usingFallback: boolean;
    lastError: string | null;
  };
}

/**
 * Component that displays alerts for disconnected or failing integrations.
 * Shows actionable CTAs to fix integration issues.
 * Covers both WhatsApp AND Email as per requirements.
 */
export function IntegrationAlerts() {
  const { currentTenant, profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [health, setHealth] = useState<IntegrationHealth | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!tenantId) return;
    
    setIsLoading(true);
    try {
      // Fetch WhatsApp status using RPC (only returns non-sensitive fields)
      const { data: whatsappData } = await supabase
        .rpc("get_whatsapp_config_for_tenant", { p_tenant_id: tenantId });
      
      const whatsappConfig = Array.isArray(whatsappData) && whatsappData.length > 0 
        ? whatsappData[0] 
        : null;

      // Fetch Email status
      const { data: emailData } = await supabase
        .from("email_provider_configs")
        .select("is_verified, verification_status, from_email, from_name, last_verify_error, dns_all_ok")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      // Determine email status
      const emailConfigured = !!emailData?.from_email && !!emailData?.from_name;
      const emailVerified = emailData?.verification_status === "verified" || emailData?.is_verified === true || emailData?.dns_all_ok === true;
      const emailUsingFallback = !emailConfigured || !emailVerified;

      setHealth({
        whatsapp: {
          configured: whatsappConfig?.is_enabled === true,
          connected: whatsappConfig?.connection_status === "connected",
          lastError: whatsappConfig?.last_error || null,
        },
        email: {
          configured: emailConfigured,
          verified: emailVerified,
          usingFallback: emailUsingFallback,
          lastError: emailData?.last_verify_error || null,
        },
      });
    } catch (error) {
      console.error("Error fetching integration health:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (isLoading) {
    return null; // Don't show loading state, just hide until ready
  }

  if (!health) {
    return null;
  }

  // Determine which alerts to show
  const alerts: Array<{
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    variant: "warning" | "destructive" | "info";
    action: { label: string; onClick: () => void };
  }> = [];

  // WhatsApp: configured but disconnected
  if (health.whatsapp.configured && !health.whatsapp.connected) {
    alerts.push({
      id: "whatsapp-disconnected",
      icon: MessageCircle,
      title: "WhatsApp desconectado",
      description: health.whatsapp.lastError 
        ? `Erro: ${health.whatsapp.lastError.substring(0, 50)}...`
        : "Reconecte para continuar enviando mensagens",
      variant: "warning",
      action: {
        label: "Conectar",
        onClick: () => navigate("/integrations?tab=others"),
      },
    });
  }

  // Email: not configured, not verified, or using fallback
  if (health.email.usingFallback) {
    if (!health.email.configured) {
      alerts.push({
        id: "email-not-configured",
        icon: Mail,
        title: "Email não configurado",
        description: "Configure seu domínio para emails personalizados. Usando remetente do sistema.",
        variant: "info",
        action: {
          label: "Configurar",
          onClick: () => navigate("/integrations?tab=others"),
        },
      });
    } else if (!health.email.verified) {
      alerts.push({
        id: "email-not-verified",
        icon: Mail,
        title: "Email pendente de verificação",
        description: health.email.lastError 
          ? `Verifique os registros DNS. ${health.email.lastError.substring(0, 40)}`
          : "Verifique os registros DNS para ativar seu domínio.",
        variant: "warning",
        action: {
          label: "Verificar",
          onClick: () => navigate("/integrations?tab=others"),
        },
      });
    }
  }

  // No alerts to show? Show a success message instead
  if (alerts.length === 0) {
    return null; // Could show a success card if desired
  }

  const iconColors = {
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-blue-500 bg-blue-500/10",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Atenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => {
            const Icon = alert.icon;
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColors[alert.variant]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {alert.title}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {alert.description}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={alert.action.onClick}
                  className="shrink-0"
                >
                  {alert.action.label}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
