import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Instagram, Facebook, RefreshCw, XCircle, AlertTriangle, CheckCircle2, Clock, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSocialPosts, useSocialPostActions, type SocialPostEntry } from "@/hooks/useSocialPosts";

interface PlatformStatusPanelProps {
  calendarItemId: string;
  compact?: boolean;
}

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-orange-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  published: { label: "Publicado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> },
  scheduled: { label: "Agendado", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: <Clock className="h-3.5 w-3.5 text-blue-600" /> },
  publishing: { label: "Publicando", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: <Loader2 className="h-3.5 w-3.5 text-orange-600 animate-spin" /> },
  failed: { label: "Com Erro", color: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3.5 w-3.5 text-destructive" /> },
  canceled: { label: "Encerrado", color: "bg-muted text-muted-foreground", icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> },
  superseded: { label: "Substituído", color: "bg-muted text-muted-foreground line-through", icon: <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> },
};

function friendlyError(code: string | null, message: string | null): string {
  if (!code && !message) return "Erro desconhecido";
  const map: Record<string, string> = {
    no_connection: "Rede social não conectada",
    token_expired: "Token expirado — reconecte nas Integrações",
    no_ig_account: "Conta Instagram não encontrada",
    no_fb_page: "Página Facebook não encontrada",
    preflight_failed: "Validação falhou antes do envio",
    max_retries_exceeded: "Falhou após 3 tentativas automáticas",
    permanent: "Erro permanente — não será reenviado automaticamente",
    retryable: "Erro temporário — tentando novamente automaticamente",
    media_incompatible_video_format: "Formato de vídeo incompatível",
    media_unconvertible_format: "Formato de mídia não suportado",
  };
  return map[code || ""] || message || "Erro desconhecido";
}

function PostRow({ post, onRetry, onDismiss, isActing }: {
  post: SocialPostEntry;
  onRetry: () => void;
  onDismiss: () => void;
  isActing: boolean;
}) {
  const config = statusConfig[post.status] || statusConfig.failed;
  const hasWarnings = post.warning_flags && post.warning_flags.length > 0;
  const isRetryPending = post.status === "failed" && post.next_retry_at && (post.attempt_count || 0) < 3;

  return (
    <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/50">
      <div className="flex-shrink-0 mt-0.5">
        {platformIcons[post.platform] || <span className="text-xs">{post.platform}</span>}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium">{platformLabels[post.platform] || post.platform}</span>
          <Badge className={cn("text-[10px] h-4 gap-0.5", config.color)}>
            {config.icon}
            {isRetryPending ? "Aguardando retry" : config.label}
          </Badge>
          {hasWarnings && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-3.5 w-3.5 text-warning cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{post.warning_flags![0].message}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Published info */}
        {post.status === "published" && post.published_at && (
          <p className="text-[10px] text-muted-foreground">
            Publicado em {format(new Date(post.published_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}

        {/* Error info */}
        {post.status === "failed" && (
          <p className="text-[10px] text-destructive">
            {friendlyError(post.last_error_code, post.last_error_message)}
            {post.attempt_count && post.attempt_count > 1 ? ` (${post.attempt_count} tentativas)` : ""}
          </p>
        )}

        {/* Retry pending info */}
        {isRetryPending && post.next_retry_at && (
          <p className="text-[10px] text-muted-foreground">
            Próxima tentativa: {format(new Date(post.next_retry_at), "HH:mm", { locale: ptBR })}
          </p>
        )}

        {/* Actions for failed posts */}
        {post.status === "failed" && !isRetryPending && (
          <div className="flex gap-1 mt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={onRetry}
              disabled={isActing}
            >
              <RefreshCw className="h-3 w-3" />
              Reenviar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] gap-1 text-muted-foreground"
              onClick={onDismiss}
              disabled={isActing}
            >
              <XCircle className="h-3 w-3" />
              Encerrar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PlatformStatusPanel({ calendarItemId, compact = false }: PlatformStatusPanelProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  const { data: posts, isLoading } = useSocialPosts(calendarItemId);
  const { performAction } = useSocialPostActions();

  if (isLoading) return null;

  // Filter out superseded/canceled for the main view, but keep for history
  const activePosts = (posts || []).filter(p => !["superseded", "canceled"].includes(p.status));
  const archivedPosts = (posts || []).filter(p => ["superseded", "canceled"].includes(p.status));

  if (activePosts.length === 0 && archivedPosts.length === 0) return null;

  const content = (
    <div className="space-y-1.5">
      {activePosts.map(post => (
        <PostRow
          key={post.id}
          post={post}
          onRetry={() => performAction.mutate({ action: "retry_platform", socialPostId: post.id })}
          onDismiss={() => performAction.mutate({ action: "dismiss_failure", socialPostId: post.id })}
          isActing={performAction.isPending}
        />
      ))}
      {archivedPosts.length > 0 && (
        <details className="text-[10px] text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            {archivedPosts.length} registro(s) anterior(es)
          </summary>
          <div className="space-y-1 mt-1 opacity-60">
            {archivedPosts.map(post => (
              <PostRow
                key={post.id}
                post={post}
                onRetry={() => {}}
                onDismiss={() => {}}
                isActing={false}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full">
            <span className="font-medium">Status por rede</span>
            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {/* Quick summary when collapsed */}
            {!isOpen && activePosts.length > 0 && (
              <span className="ml-auto flex gap-1">
                {activePosts.map(p => (
                  <span key={p.id} className="flex items-center gap-0.5">
                    {platformIcons[p.platform]}
                    {statusConfig[p.status]?.icon}
                  </span>
                ))}
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-1.5">
          {content}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Status por rede social</p>
      {content}
    </div>
  );
}