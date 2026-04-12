import { FileCheck, RefreshCw, Send, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgendaTemplateStatus } from "@/hooks/useAgendaTemplateStatus";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { ptBR } from "date-fns/locale";

import { formatDateTimeBR } from "@/lib/date-format";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <Badge variant="outline" className="text-muted-foreground">Não submetido</Badge>;
  }

  switch (status) {
    case "approved":
      return (
        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Aprovado
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
          <Clock className="h-3 w-3 mr-1" />
          Pendente
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Rejeitado
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function AgendaTemplateStatus() {
  const { status, isLoading, submitTemplate, checkStatus } = useAgendaTemplateStatus();
  const { status: whatsappStatus } = useWhatsAppStatus();

  const isWhatsAppReady = whatsappStatus.isConfigured && whatsappStatus.isConnected;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Template de Lembrete
            </CardTitle>
            <CardDescription className="mt-1">
              Template aprovado pela Meta para enviar lembretes fora da janela de 24h
            </CardDescription>
          </div>
          <StatusBadge status={status.meta_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template Preview */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">Formato do template:</p>
          <p className="text-sm font-mono">🔔 Lembrete: {"{{título}}"}</p>
          <p className="text-sm font-mono">📅 Vencimento: {"{{data}}"}</p>
          <p className="text-sm font-mono">📝 {"{{descrição}}"}</p>
        </div>

        {/* Info based on status */}
        {!status.submitted && (
          <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-3">
            <AlertTriangle className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p>
                Este template precisa ser aprovado pela Meta para que a Agenda possa enviar lembretes 
                proativos no WhatsApp (fora da janela de 24 horas).
              </p>
              <p className="mt-1 text-xs">
                Lembretes enviados dentro da janela de 24h funcionam normalmente sem template.
              </p>
            </div>
          </div>
        )}

        {status.meta_status === "rejected" && status.meta_reject_reason && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Motivo da rejeição:</p>
              <p className="text-muted-foreground">{status.meta_reject_reason}</p>
            </div>
          </div>
        )}

        {status.meta_status === "approved" && (
          <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Template aprovado. Lembretes fora da janela de 24h serão enviados usando este template.
            </p>
          </div>
        )}

        {/* Timestamps */}
        {status.submitted && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {status.submitted_at && (
              <span>Submetido: {formatDateTimeBR(new Date(status.submitted_at))}</span>
            )}
            {status.approved_at && (
              <span>Aprovado: {formatDateTimeBR(new Date(status.approved_at))}</span>
            )}
            {status.last_checked_at && (
              <span>Última verificação: {formatDateTimeBR(new Date(status.last_checked_at))}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {(!status.submitted || status.meta_status === "rejected") && (
            <Button
              size="sm"
              onClick={() => submitTemplate.mutate()}
              disabled={submitTemplate.isPending || !isWhatsAppReady}
            >
              <Send className="h-4 w-4 mr-1" />
              {submitTemplate.isPending ? "Submetendo..." : "Submeter Template"}
            </Button>
          )}

          {status.submitted && status.meta_status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => checkStatus.mutate()}
              disabled={checkStatus.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${checkStatus.isPending ? "animate-spin" : ""}`} />
              {checkStatus.isPending ? "Verificando..." : "Verificar Status"}
            </Button>
          )}
        </div>

        {!isWhatsAppReady && !status.submitted && (
          <p className="text-xs text-muted-foreground">
            Configure o WhatsApp primeiro para submeter o template.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
