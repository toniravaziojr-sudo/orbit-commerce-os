import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Plug,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  Facebook,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationError {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  error: string;
  navigateTo: string;
  variant: "warning" | "destructive";
}

/**
 * Full-width card for Command Center showing integration health.
 * Matches the visual pattern of CommunicationsWidget / AdsAlertsWidget.
 */
export function IntegrationErrorsCard() {
  const { currentTenant, profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;

  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<IntegrationError[]>([]);

  const fetchErrors = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);

    const found: IntegrationError[] = [];

    try {
      // 1. Meta connection — expired or with error
      const { data: metaConn } = await supabase
        .from("marketplace_connections" as any)
        .select("is_active, expires_at, last_error, external_username")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "meta")
        .maybeSingle();

      if (metaConn) {
        const m = metaConn as any;
        const isExpired = m.expires_at ? new Date(m.expires_at) < new Date() : false;

        if (isExpired) {
          found.push({
            id: "meta-expired",
            icon: Facebook,
            name: "Meta",
            error: "Token expirado — reconecte sua conta",
            navigateTo: "/integrations?tab=social",
            variant: "destructive",
          });
        } else if (m.last_error && m.is_active) {
          found.push({
            id: "meta-error",
            icon: Facebook,
            name: "Meta",
            error: m.last_error.length > 80 ? m.last_error.substring(0, 80) + "..." : m.last_error,
            navigateTo: "/integrations?tab=social",
            variant: "warning",
          });
        }
      }

      // 2. WhatsApp — pending registration or has error
      const { data: waData } = await supabase
        .rpc("get_whatsapp_config_for_tenant", { p_tenant_id: tenantId });

      const waConfig = Array.isArray(waData) && waData.length > 0 ? waData[0] : null;
      if (waConfig) {
        if (waConfig.connection_status === "pending_registration") {
          found.push({
            id: "whatsapp-pending",
            icon: MessageCircle,
            name: "WhatsApp",
            error: "Número pendente de registro na Cloud API",
            navigateTo: "/integrations?tab=social",
            variant: "warning",
          });
        } else if (waConfig.is_enabled && waConfig.connection_status !== "connected" && waConfig.last_error) {
          found.push({
            id: "whatsapp-error",
            icon: MessageCircle,
            name: "WhatsApp",
            error: waConfig.last_error.length > 80 ? waConfig.last_error.substring(0, 80) + "..." : waConfig.last_error,
            navigateTo: "/integrations?tab=social",
            variant: "destructive",
          });
        }
      }

      // 3. Email — not verified
      const { data: emailData } = await supabase
        .from("email_provider_configs")
        .select("is_verified, verification_status, from_email, from_name, last_verify_error, dns_all_ok")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (emailData?.from_email && !emailData.is_verified && emailData.verification_status !== "verified" && !emailData.dns_all_ok) {
        found.push({
          id: "email-unverified",
          icon: Mail,
          name: "Email",
          error: emailData.last_verify_error
            ? emailData.last_verify_error.substring(0, 80) + (emailData.last_verify_error.length > 80 ? "..." : "")
            : "DNS pendente de verificação",
          navigateTo: "/integrations?tab=domain-email",
          variant: "warning",
        });
      }
    } catch (e) {
      console.error("IntegrationErrorsCard fetch error:", e);
    } finally {
      setErrors(found);
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  if (isLoading) return null;

  const iconColors = {
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    success: "text-green-600 bg-green-500/10",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          Integrações
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-primary"
          onClick={() => navigate("/integrations")}
        >
          Ver tudo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {errors.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconColors.success)}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Tudo funcionando</p>
                <p className="text-xs text-muted-foreground">Todas as integrações estão ativas e sem erros</p>
              </div>
            </div>
          ) : (
            errors.map((err) => {
              const Icon = err.icon;
              return (
                <div
                  key={err.id}
                  className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(err.navigateTo)}
                >
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconColors[err.variant])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {err.name}
                      <Badge variant="destructive" className="text-[10px] h-5">Erro</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{err.error}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
