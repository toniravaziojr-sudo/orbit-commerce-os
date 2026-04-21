import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Wifi,
  Inbox,
  Info,
} from "lucide-react";
import { useWhatsAppHealth } from "@/hooks/useWhatsAppHealth";
import { useOpenWhatsAppValidationWindow } from "@/hooks/useWhatsAppValidation";
import { CrossBusinessAuthorizationWizard } from "./CrossBusinessAuthorizationWizard";
import { Skeleton } from "@/components/ui/skeleton";

type ChannelState =
  | "disconnected"
  | "technically_connected"
  | "real_reception_pending"
  | "operational_validated"
  | "no_recent_evidence"
  | "degraded_after_validation";

const STATE_BUSINESS_LABEL: Record<ChannelState, { label: string; tone: "ok" | "info" | "warn" | "bad" }> = {
  disconnected: { label: "WhatsApp desconectado", tone: "bad" },
  technically_connected: { label: "Conectado, recepção ainda não comprovada", tone: "warn" },
  real_reception_pending: { label: "Recepção real ainda não comprovada", tone: "warn" },
  operational_validated: { label: "Recebendo normalmente", tone: "ok" },
  no_recent_evidence: { label: "Sem mensagens recentes — revalidação recomendada", tone: "info" },
  degraded_after_validation: { label: "Possível autorização pendente — recomendamos revalidar", tone: "warn" },
};

const STATE_HYPOTHESIS: Record<ChannelState, string | null> = {
  disconnected: "Reconecte o WhatsApp para retomar a operação.",
  technically_connected: "Hipótese principal: autorização administrativa pendente no painel da Meta. Não confirmado.",
  real_reception_pending:
    "Hipótese principal: autorização administrativa pendente no painel da Meta. Não confirmado — depende de comprovação por mensagem real.",
  operational_validated: null,
  no_recent_evidence:
    "Pode ser silêncio natural. Recomendamos enviar uma mensagem real para revalidar.",
  degraded_after_validation:
    "Possível autorização administrativa pendente. Não confirmado. Revalide enviando uma mensagem real.",
};

function SignalRow({ icon: Icon, label, ok, neutralLabel }: { icon: any; label: string; ok: boolean | null; neutralLabel?: string }) {
  const Status = ok === true ? CheckCircle2 : ok === false ? XCircle : Clock;
  const color = ok === true ? "text-green-600" : ok === false ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <Status className={`h-4 w-4 ${color}`} />
      <span className={`text-xs ${color}`}>
        {ok === true ? "OK" : ok === false ? "Pendente" : neutralLabel || "—"}
      </span>
    </div>
  );
}

export function WhatsAppChannelStatusCard() {
  const { data: health, isLoading } = useWhatsAppHealth();
  const openWindow = useOpenWhatsAppValidationWindow();
  const [wizardOpen, setWizardOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  if (!health || !health.configured) return null;

  const v2Active = (health as any).v2_visually_active === true;
  const state = (((health as any).channel_state as ChannelState) || "real_reception_pending");
  const signals = (health as any).signals as { technical: boolean; admin_authorization: boolean; real_reception: boolean } | undefined;
  const validationWindow = (health as any).validation_window as { active: boolean; expires_at: string | null } | undefined;
  const stateMeta = STATE_BUSINESS_LABEL[state];
  const hypothesis = STATE_HYPOTHESIS[state];

  // During the 7-day informative rollout, suppress yellow visuals on the main card.
  const visualTone = v2Active ? stateMeta.tone : (stateMeta.tone === "warn" || stateMeta.tone === "info" ? "info" : stateMeta.tone);

  const toneClasses = {
    ok: "border-green-500/40 bg-green-50/50 dark:bg-green-950/20",
    info: "border-blue-500/40 bg-blue-50/50 dark:bg-blue-950/20",
    warn: "border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20",
    bad: "border-red-500/50 bg-red-50/50 dark:bg-red-950/20",
  }[visualTone];

  const toneIcon = {
    ok: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    info: <Info className="h-5 w-5 text-blue-600" />,
    warn: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    bad: <XCircle className="h-5 w-5 text-red-600" />,
  }[visualTone];

  const showWizardButton = state === "real_reception_pending" || state === "degraded_after_validation" || state === "technically_connected";

  return (
    <>
      <Card className={`border-l-4 ${toneClasses}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {toneIcon}
              <div>
                <CardTitle className="text-base">{stateMeta.label}</CardTitle>
                {hypothesis && (
                  <p className="text-xs text-muted-foreground mt-1">{hypothesis}</p>
                )}
              </div>
            </div>
            {!v2Active && (
              <Badge variant="outline" className="text-[10px]">Modo informativo</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {signals && (
            <div className="space-y-2 rounded-md border bg-background/60 p-3">
              <div className="text-xs font-medium text-muted-foreground mb-1">Sinais do canal</div>
              <SignalRow icon={Wifi} label="Conexão técnica" ok={signals.technical} />
              <SignalRow icon={ShieldCheck} label="Autorização administrativa" ok={signals.admin_authorization} />
              <SignalRow
                icon={Inbox}
                label="Recepção real comprovada"
                ok={signals.real_reception}
                neutralLabel="Aguardando comprovação"
              />
            </div>
          )}

          {validationWindow?.active && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Janela de validação aberta.</strong> Envie uma mensagem real ao seu número
                nos próximos minutos. Quando chegar, o canal é promovido automaticamente para
                "Recebendo normalmente".
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              onClick={() => openWindow.mutate()}
              disabled={openWindow.isPending || validationWindow?.active}
            >
              {validationWindow?.active ? "Janela aberta — envie a mensagem" : "Validar agora"}
            </Button>
            {showWizardButton && (
              <Button size="sm" variant="outline" onClick={() => setWizardOpen(true)}>
                Abrir passo a passo da Meta
              </Button>
            )}
          </div>

          {state === "no_recent_evidence" && (
            <p className="text-xs text-muted-foreground">
              Nenhuma mensagem recente foi recebida. Não significa, por si só, que algo está errado —
              mas se você espera receber mensagens regularmente, recomendamos revalidar.
            </p>
          )}
        </CardContent>
      </Card>

      <CrossBusinessAuthorizationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
}
