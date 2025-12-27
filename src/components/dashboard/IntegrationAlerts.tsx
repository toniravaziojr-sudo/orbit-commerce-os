import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageCircle, 
  Mail, 
  AlertTriangle, 
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2
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
        .select("is_verified, verification_status, from_email, last_verify_error")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      setHealth({
        whatsapp: {
          configured: whatsappConfig?.is_enabled === true,
          connected: whatsappConfig?.connection_status === "connected",
          lastError: whatsappConfig?.last_error || null,
        },
        email: {
          configured: !!emailData?.from_email,
          verified: emailData?.verification_status === "verified" || emailData?.is_verified === true,
          usingFallback: !emailData?.from_email || !emailData?.is_verified,
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
      description: "Reconecte para continuar enviando mensagens",
      variant: "warning",
      action: {
        label: "Conectar",
        onClick: () => navigate("/integrations?tab=others"),
      },
    });
  }

  // Email: not configured or not verified (using fallback)
  if (!health.email.configured || health.email.usingFallback) {
    alerts.push({
      id: "email-fallback",
      icon: Mail,
      title: "Email usando sistema",
      description: "Configure seu domínio para emails personalizados",
      variant: "info",
      action: {
        label: "Configurar",
        onClick: () => navigate("/integrations?tab=others"),
      },
    });
  }

  // No alerts to show? Don't render the card
  if (alerts.length === 0) {
    return null;
  }

  const iconColors = {
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Integrações
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
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconColors[alert.variant]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {alert.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
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
