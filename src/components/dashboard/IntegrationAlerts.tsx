import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePlatformOperator } from "@/hooks/usePlatformOperator";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  Mail, 
  AlertTriangle, 
  ArrowRight,
  CheckCircle,
  Shield
} from "lucide-react";

interface IntegrationHealth {
  whatsapp: {
    configured: boolean;
    connected: boolean;
    lastError: string | null;
    connectionStatus: string | null;
  };
  email: {
    configured: boolean;
    verified: boolean;
    usingFallback: boolean;
    lastError: string | null;
  };
}

interface SystemHealth {
  emailVerified: boolean;
  emailLastError: string | null;
}

/**
 * Component that displays alerts for disconnected or failing integrations.
 * Shows actionable CTAs to fix integration issues.
 * 
 * For TENANT: Shows WhatsApp and Email alerts
 * For PLATFORM ADMIN: Also shows system-level alerts
 */
export function IntegrationAlerts() {
  const { currentTenant, profile } = useAuth();
  const { isPlatformOperator } = usePlatformOperator();
  const navigate = useNavigate();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;
  
  const [isLoading, setIsLoading] = useState(true);
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

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
          connectionStatus: whatsappConfig?.connection_status || null,
        },
        email: {
          configured: emailConfigured,
          verified: emailVerified,
          usingFallback: emailUsingFallback,
          lastError: emailData?.last_verify_error || null,
        },
      });

      // For platform admin, also fetch system email status
      if (isPlatformOperator) {
        try {
          const { data: systemData } = await supabase.functions.invoke("integration-config", {
            body: { action: "get-system-email-config" }
          });
          
          if (systemData?.config) {
            setSystemHealth({
              emailVerified: systemData.config.verification_status === "verified",
              emailLastError: systemData.config.last_verify_error || null,
            });
          }
        } catch (e) {
          console.error("Error fetching system health:", e);
        }
      }
    } catch (error) {
      console.error("Error fetching integration health:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, isPlatformOperator]);

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
    variant: "warning" | "destructive" | "info" | "platform";
    action: { label: string; onClick: () => void };
  }> = [];

  // WhatsApp: configured but disconnected or has error
  if (health.whatsapp.configured && !health.whatsapp.connected) {
    const isQrPending = health.whatsapp.connectionStatus === "qr_pending";
    alerts.push({
      id: "whatsapp-disconnected",
      icon: MessageCircle,
      title: isQrPending ? "WhatsApp aguardando conexão" : "WhatsApp desconectado",
      description: health.whatsapp.lastError 
        ? `${health.whatsapp.lastError.substring(0, 60)}${health.whatsapp.lastError.length > 60 ? "..." : ""}`
        : isQrPending 
          ? "Escaneie o QR Code para conectar"
          : "Reconecte para continuar enviando mensagens",
      variant: isQrPending ? "info" : "warning",
      action: {
        label: isQrPending ? "Ver QR Code" : "Conectar",
        onClick: () => navigate("/integrations?tab=others"),
      },
    });
  }

  // Email: not configured or not verified
  if (!health.email.configured) {
    alerts.push({
      id: "email-not-configured",
      icon: Mail,
      title: "Email não configurado",
      description: "Configure seu domínio para enviar emails personalizados. Usando remetente do sistema.",
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
        ? `${health.email.lastError.substring(0, 50)}${health.email.lastError.length > 50 ? "..." : ""}`
        : "Verifique os registros DNS para ativar seu domínio.",
      variant: "warning",
      action: {
        label: "Verificar",
        onClick: () => navigate("/integrations?tab=others"),
      },
    });
  }

  // Platform admin: system email not verified
  if (isPlatformOperator && systemHealth && !systemHealth.emailVerified) {
    alerts.push({
      id: "system-email-not-verified",
      icon: Shield,
      title: "Email do Sistema pendente",
      description: systemHealth.emailLastError 
        ? `Verificação: ${systemHealth.emailLastError.substring(0, 40)}...`
        : "Configure o email do sistema para autenticação.",
      variant: "platform",
      action: {
        label: "Configurar",
        onClick: () => navigate("/platform/integrations"),
      },
    });
  }

  // No alerts to show
  if (alerts.length === 0) {
    return null;
  }

  const iconColors: Record<string, string> = {
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-blue-500 bg-blue-500/10",
    platform: "text-primary bg-primary/10",
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
                className={`flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                  alert.variant === "platform" 
                    ? "border-primary/30 bg-primary/5" 
                    : "border-border/50 bg-muted/30"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColors[alert.variant]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    {alert.title}
                    {alert.variant === "platform" && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Admin</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {alert.description}
                  </p>
                </div>
                <Button 
                  variant={alert.variant === "platform" ? "default" : "ghost"}
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
