import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface FailedPost {
  id: string;
  platform: string;
  lastError: string;
  scheduledAt: string;
}

/**
 * Full-width card for Command Center showing failed content calendar publications.
 * Matches the visual pattern of CommunicationsWidget / AdsAlertsWidget.
 */
export function ContentCalendarAlertsCard() {
  const { currentTenant, profile } = useAuth();
  const navigate = useNavigate();
  const tenantId = currentTenant?.id || profile?.current_tenant_id;

  const { data: failedPosts, isLoading } = useQuery({
    queryKey: ["content-calendar-failures", tenantId],
    queryFn: async (): Promise<FailedPost[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("social_posts")
        .select("id, platform, last_error_message, scheduled_at, status")
        .eq("tenant_id", tenantId)
        .eq("status", "failed")
        .order("scheduled_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("ContentCalendarAlertsCard error:", error);
        return [];
      }

      return (data || []).map((p: any) => ({
        id: p.id,
        platform: p.platform || "desconhecido",
        lastError: p.last_error_message || "Erro ao publicar",
        scheduledAt: p.scheduled_at || "",
      }));
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  if (isLoading) return null;

  const platformLabels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    threads: "Threads",
    desconhecido: "Publicação",
  };

  const iconColors = {
    destructive: "text-destructive bg-destructive/10",
    success: "text-green-600 bg-green-500/10",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Calendário de Conteúdo
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-primary"
          onClick={() => navigate("/content-calendar")}
        >
          Ver tudo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {!failedPosts || failedPosts.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconColors.success)}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Tudo em dia</p>
                <p className="text-xs text-muted-foreground">Nenhuma publicação com falha</p>
              </div>
            </div>
          ) : (
            failedPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate("/content-calendar")}
              >
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", iconColors.destructive)}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    {platformLabels[post.platform] || post.platform}
                    <Badge variant="destructive" className="text-[10px] h-5">Falhou</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {post.lastError}
                    {post.scheduledAt && (
                      <> · {formatDistanceToNow(new Date(post.scheduledAt), { locale: ptBR, addSuffix: true })}</>
                    )}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}