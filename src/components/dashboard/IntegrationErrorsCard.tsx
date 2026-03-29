import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Plug,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  MessageCircle,
  Facebook,
  Mail,
} from "lucide-react";

interface IntegrationError {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  error: string;
  navigateTo: string;
}

/**
 * Dedicated card for the Command Center that shows integration health.
 * "Tudo funcionando" when no errors, otherwise lists each broken integration.
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
        .from("meta_connections" as any)
        .select("is_active, token_expires_at, last_error, connection_status")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (metaConn) {
        const m = metaConn as any;
        const isExpired = m.token_expires_at ? new Date(m.token_expires_at) < new Date() : false;

        if (isExpired) {
          found.push({
            id: "meta-expired",
            icon: Facebook,
            name: "Meta",
            error: "Token expirado — reconecte sua conta",
            navigateTo: "/integrations?tab=social",
          });
        } else if (m.last_error && m.is_active) {
          found.push({
            id: "meta-error",
            icon: Facebook,
            name: "Meta",
            error: m.last_error.length > 60 ? m.last_error.substring(0, 60) + "..." : m.last_error,
            navigateTo: "/integrations?tab=social",
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
          });
        } else if (waConfig.is_enabled && waConfig.connection_status !== "connected" && waConfig.last_error) {
          found.push({
            id: "whatsapp-error",
            icon: MessageCircle,
            name: "WhatsApp",
            error: waConfig.last_error.length > 60 ? waConfig.last_error.substring(0, 60) + "..." : waConfig.last_error,
            navigateTo: "/integrations?tab=social",
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
            ? emailData.last_verify_error.substring(0, 60) + (emailData.last_verify_error.length > 60 ? "..." : "")
            : "DNS pendente de verificação",
          navigateTo: "/integrations?tab=domain-email",
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Plug className="h-5 w-5 text-muted-foreground" />
          Integrações
        </CardTitle>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Tudo funcionando
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((err) => {
              const Icon = err.icon;
              return (
                <div
                  key={err.id}
                  className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 cursor-pointer hover:bg-destructive/10 transition-colors"
                  onClick={() => navigate(err.navigateTo)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <Icon className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {err.name}
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Erro
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {err.error}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
