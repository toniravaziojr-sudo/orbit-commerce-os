import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FailedPost {
  id: string;
  platform: string;
  lastError: string;
  scheduledAt: string;
}

/**
 * Card for the Command Center that shows failed content calendar publications.
 * Shows "Tudo em dia" when no failures, otherwise lists recent failed posts.
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          Calendário de Conteúdo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!failedPosts || failedPosts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Tudo em dia
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {failedPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 cursor-pointer hover:bg-destructive/10 transition-colors"
                onClick={() => navigate("/content-calendar")}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    {platformLabels[post.platform] || post.platform}
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      Falhou
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {post.lastError}
                    {post.scheduledAt && (
                      <> · {formatDistanceToNow(new Date(post.scheduledAt), { locale: ptBR, addSuffix: true })}</>
                    )}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
