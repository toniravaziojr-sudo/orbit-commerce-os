import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Stethoscope, Loader2, CheckCircle2, AlertTriangle, Wrench, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

interface Issue {
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  cause: string;
  action_type: "auto" | "user" | "support";
  action_label?: string;
  user_instruction?: string;
}

interface DiagnosisResult {
  status: "healthy" | "warning" | "needs_attention" | "not_configured" | "no_token" | "token_invalid";
  issues: Issue[];
  auto_repairable: boolean;
  auto_actions?: string[];
  user_action_required: boolean;
  phone_status?: string;
  verified_name?: string;
}

/**
 * WhatsAppDiagnosticCard
 * Botão "Diagnosticar e Reparar" — verifica os 4 pontos críticos e
 * executa ações automáticas seguras quando possível.
 */
export function WhatsAppDiagnosticCard() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [showPinField, setShowPinField] = useState(false);

  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-diagnose", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.data as DiagnosisResult;
    },
    onSuccess: (data) => {
      setResult(data);
      const needsPin = data.issues.some((i) => i.code === "NUMBER_NEEDS_PIN");
      setShowPinField(needsPin);
      if (data.status === "healthy") toast.success("Tudo certo com seu WhatsApp!");
    },
    onError: (err) => showErrorToast(err, { module: "whatsapp", action: "diagnosticar" }),
  });

  const recoverMutation = useMutation({
    mutationFn: async ({ pin }: { pin?: string } = {}) => {
      const body: Record<string, unknown> = { tenant_id: tenantId };
      if (pin) body.pin = pin;
      // Se PIN fornecido, força incluir register_phone
      if (pin && result?.issues.some((i) => i.code === "NUMBER_NEEDS_PIN" || i.code === "NUMBER_NOT_REGISTERED")) {
        body.actions = ["subscribe_webhook", "register_phone"];
      }
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-recover", { body });
      if (error) throw error;
      if (!data.success && data?.data?.executed?.length === 0) throw new Error(data.error || "Falha no reparo");
      return data.data;
    },
    onSuccess: (data) => {
      const executed = data.executed || [];
      const allOk = data.all_succeeded;
      if (allOk) {
        toast.success("Reparo concluído! Verificando novo status…");
      } else {
        const failures = executed.filter((e: { success: boolean }) => !e.success);
        toast.warning(`Reparo parcial. Falhas: ${failures.map((f: { detail?: string }) => f.detail).join("; ")}`);
      }
      setPinInput("");
      // Re-diagnosticar
      setTimeout(() => diagnoseMutation.mutate(), 1500);
    },
    onError: (err) => showErrorToast(err, { module: "whatsapp", action: "reparar" }),
  });

  const sevColor = (s: Issue["severity"]) =>
    s === "critical" ? "destructive" : s === "warning" ? "default" : "secondary";

  const sevIcon = (s: Issue["severity"]) =>
    s === "critical" ? AlertTriangle : s === "info" ? Info : AlertTriangle;

  return (
    <div className="space-y-3 rounded-md border border-border/50 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Diagnóstico inteligente</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={() => diagnoseMutation.mutate()}
          disabled={diagnoseMutation.isPending || !tenantId}
        >
          {diagnoseMutation.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Stethoscope className="h-3 w-3 mr-1" />
          )}
          Diagnosticar agora
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Verifica token, status do número, saúde da conta (billing) e webhook em uma única ação. Repara automaticamente o que for seguro.
      </p>

      {result && (
        <div className="space-y-2 pt-1">
          {result.status === "healthy" && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-700 dark:text-green-400">
                Tudo certo. Número {result.verified_name ? `"${result.verified_name}" ` : ""}operando normalmente.
              </span>
            </div>
          )}

          {result.issues.map((issue) => {
            const Icon = sevIcon(issue.severity);
            return (
              <div key={issue.code} className="rounded-md border border-border/50 bg-background p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 ${issue.severity === "critical" ? "text-destructive" : issue.severity === "info" ? "text-blue-600" : "text-amber-600"}`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{issue.title}</span>
                      <Badge variant={sevColor(issue.severity)} className="text-[10px] h-4">
                        {issue.severity === "critical" ? "Crítico" : issue.severity === "info" ? "Info" : "Aviso"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{issue.description}</p>
                    <p className="text-[11px] text-muted-foreground italic">Causa: {issue.cause}</p>
                    {issue.user_instruction && (
                      <p className="text-xs text-foreground/80 mt-1">→ {issue.user_instruction}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Campo de PIN quando necessário */}
          {showPinField && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 space-y-2">
              <p className="text-xs font-medium">Defina um PIN de 6 dígitos para registrar o número</p>
              <p className="text-[11px] text-muted-foreground">
                Esse PIN será salvo de forma segura para futuros reparos automáticos.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Ex: 123456"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => recoverMutation.mutate({ pin: pinInput })}
                  disabled={recoverMutation.isPending || pinInput.length !== 6}
                >
                  {recoverMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wrench className="h-3 w-3 mr-1" />}
                  Reparar com PIN
                </Button>
              </div>
            </div>
          )}

          {/* Botão de reparo automático sem PIN */}
          {result.auto_repairable && !showPinField && (
            <Button
              size="sm"
              className="w-full text-xs h-8"
              onClick={() => recoverMutation.mutate({})}
              disabled={recoverMutation.isPending}
            >
              {recoverMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Wrench className="h-3 w-3 mr-1" />
              )}
              Reparar automaticamente
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
