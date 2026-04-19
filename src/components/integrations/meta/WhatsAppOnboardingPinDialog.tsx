import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

/**
 * WhatsAppOnboardingPinDialog
 *
 * Modal disparado automaticamente logo após a conclusão do Embedded Signup
 * quando o número não tem PIN salvo. Garante que todo número novo entra
 * em produção com PIN definido — pré-requisito do protocolo de auto-recovery.
 *
 * Renderiza apenas quando: ?whatsapp_connected=true na URL E config existe sem register_pin.
 * "Pular" é permitido, mas reabre via banner persistente em outras telas.
 */
export function WhatsAppOnboardingPinDialog() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("whatsapp_connected") !== "true") return;

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_configs")
        .select("register_pin, phone_number_id")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .maybeSingle();
      if (cancelled) return;
      if (data?.phone_number_id && !data.register_pin) {
        setOpen(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const setPinMutation = useMutation({
    mutationFn: async (pinValue: string) => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-set-pin", {
        body: { tenant_id: tenantId, pin: pinValue, register_now: false },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Falha ao salvar PIN");
      return data;
    },
    onSuccess: () => {
      toast.success("PIN salvo. Seu número está protegido para reparos automáticos.");
      setOpen(false);
      setPin("");
      setConfirmPin("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-pin-status", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: "whatsapp", action: "salvar PIN" }),
  });

  const pinsMatch = pin.length === 6 && pin === confirmPin;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Proteja seu número WhatsApp
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block">
              Seu WhatsApp foi conectado com sucesso! Para garantir que o número
              continue funcionando mesmo se houver qualquer instabilidade no
              futuro, defina agora um <strong>PIN de 6 dígitos</strong>.
            </span>
            <span className="block text-xs text-muted-foreground">
              Esse PIN é exigido pela Meta em qualquer reativação do número.
              Salvando agora, deixamos a recuperação automática para qualquer
              eventualidade futura.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">PIN de 6 dígitos</label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center text-lg tracking-[0.5em]"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Confirme o PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="••••••"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center text-lg tracking-[0.5em]"
            />
            {confirmPin.length === 6 && pin !== confirmPin && (
              <p className="text-xs text-destructive">Os PINs não coincidem.</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Anote esse PIN em local seguro. Ele será reutilizado em qualquer
            reparo automático futuro.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Pular por enquanto
          </Button>
          <Button
            onClick={() => setPinMutation.mutate(pin)}
            disabled={!pinsMatch || setPinMutation.isPending}
          >
            {setPinMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4 mr-2" />
            )}
            Salvar PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
