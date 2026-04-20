import { useWhatsAppHealth } from "@/hooks/useWhatsAppHealth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatRelative(iso?: string | null) {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

export function WhatsAppHealthCard() {
  const { data, isLoading } = useWhatsAppHealth();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-green-600" />
            Saúde do WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.configured) {
    return null;
  }

  const subColor =
    data.subscription_status === "red"
      ? "bg-destructive text-destructive-foreground"
      : data.subscription_status === "yellow"
      ? "bg-yellow-500 text-white"
      : "bg-emerald-500 text-white";

  const subLabel =
    data.subscription_status === "red"
      ? "Recepção comprometida"
      : data.subscription_status === "yellow"
      ? "Atenção"
      : "Recebendo normalmente";

  const hasIncidents = (data.open_incidents?.length || 0) > 0;
  const showSilenceAlert = data.silence_alert && data.silence_alert !== "none";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-green-600" />
            Saúde do WhatsApp
            {data.display_phone_number && (
              <span className="text-xs font-normal text-muted-foreground">
                · {data.display_phone_number}
              </span>
            )}
          </CardTitle>
          <Badge className={subColor}>{subLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Última mensagem recebida</div>
            <div className="mt-1 font-medium">{formatRelative(data.last_inbound_at)}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Última resposta da IA</div>
            <div className="mt-1 font-medium">{formatRelative(data.last_ai_reply_at)}</div>
          </div>
        </div>

        {showSilenceAlert && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm dark:bg-yellow-950/30">
            <Clock className="mt-0.5 h-4 w-4 text-yellow-600" />
            <div>
              <div className="font-medium text-yellow-900 dark:text-yellow-200">
                {data.silence_alert === "red"
                  ? "Mais de 24h sem receber mensagens"
                  : "Mais de 12h sem receber mensagens"}
              </div>
              <div className="text-xs text-yellow-800 dark:text-yellow-300">
                Pode ser período normal de baixo volume — ou um sintoma de recepção quebrada.
                O sistema verifica a assinatura do WhatsApp diariamente e tenta reparar sozinho.
              </div>
            </div>
          </div>
        )}

        {(data.orphan_count_24h || 0) > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            <div className="flex-1">
              <div className="font-medium text-destructive">
                {data.orphan_count_24h} mensagem(ns) chegaram nas últimas 24h sem resposta da IA
              </div>
              <div className="text-xs text-muted-foreground">
                A vigilância automática detectou mensagens recebidas que não foram processadas.
              </div>
            </div>
          </div>
        )}

        {hasIncidents && (
          <div className="space-y-2">
            {data.open_incidents!.map((inc) => (
              <div
                key={inc.id}
                className="flex items-start gap-2 rounded-lg border p-3 text-sm"
              >
                <AlertTriangle
                  className={`mt-0.5 h-4 w-4 ${
                    inc.severity === "critical" ? "text-destructive" : "text-yellow-600"
                  }`}
                />
                <div className="flex-1">
                  <div className="font-medium">{inc.title}</div>
                  {inc.detail && (
                    <div className="text-xs text-muted-foreground">{inc.detail}</div>
                  )}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Detectado {formatRelative(inc.detected_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasIncidents && !showSilenceAlert && (data.orphan_count_24h || 0) === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Pipeline de recepção saudável.
          </div>
        )}

        {data.last_error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {data.last_error}
          </div>
        )}

        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <Link to="/integrations">Gerenciar WhatsApp</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
