import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppHealth } from "@/hooks/useWhatsAppHealth";

/**
 * Banner do Dashboard mostrado APENAS quando:
 *  - canal está em "real_reception_pending" há mais de 24h
 *  - rollout v2 já está visualmente ativo (após 7 dias informativos)
 *
 * Não aparece para "no_recent_evidence" (esse estado é informativo, não bloqueante).
 */
export function WhatsAppRealReceptionPendingBanner() {
  const { data: health } = useWhatsAppHealth();
  const navigate = useNavigate();

  if (!health || !health.configured) return null;

  const v2Active = (health as any).v2_visually_active === true;
  if (!v2Active) return null;

  const state = (health as any).channel_state as string | undefined;
  if (state !== "real_reception_pending") return null;

  const validatedAt = (health as any).last_inbound_validated_at as string | null;
  const lastAttemptAt = (health as any).validation_window?.last_attempt_at as string | null;

  // Show only if pending for > 24h (use last attempt or linked_at as proxy)
  const referenceMs = lastAttemptAt ? new Date(lastAttemptAt).getTime()
    : health.linked_at ? new Date(health.linked_at).getTime()
    : null;
  if (referenceMs !== null && Date.now() - referenceMs < 24 * 36e5) return null;
  if (validatedAt) return null;

  return (
    <Alert variant="default" className="border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Recepção real do WhatsApp ainda não comprovada</AlertTitle>
      <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">
          Hipótese principal: falta uma autorização administrativa no painel da Meta. Não confirmado.
        </span>
        <Button size="sm" variant="outline" onClick={() => navigate("/integrations")}>
          Resolver agora
        </Button>
      </AlertDescription>
    </Alert>
  );
}
