import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Loader2, ShieldCheck, ShieldAlert, RefreshCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

/**
 * WhatsAppPinManager
 *
 * Botão e diálogo unificados para gerenciar o PIN de 6 dígitos do número WhatsApp Cloud API.
 * Substitui a dependência exclusiva do Card de Diagnóstico para definir/atualizar PIN.
 * Sempre visível enquanto houver número conectado, mesmo em status saudável.
 *
 * Estados:
 *  - PIN não definido → CTA "Definir PIN agora" (recomendado)
 *  - PIN definido     → "Atualizar PIN" (preventivo)
 */
export function WhatsAppPinManager({ compact = false }: { compact?: boolean }) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const { data: pinStatus, isLoading } = useQuery({
    queryKey: ["whatsapp-pin-status", tenantId],
    queryFn: async () => {
      if (!tenantId) return { hasConfig: false, hasPin: false };
      const { data } = await supabase
        .from("whatsapp_configs")
        .select("id, register_pin, connection_status, phone_number_id")
        .eq("tenant_id", tenantId)
        .eq("provider", "meta")
        .maybeSingle();
      return {
        hasConfig: !!data?.id && !!data?.phone_number_id,
        hasPin: !!data?.register_pin,
        status: data?.connection_status,
      };
    },
    enabled: !!tenantId,
  });

  const setPinMutation = useMutation({
    mutationFn: async ({ pin, registerNow }: { pin: string; registerNow: boolean }) => {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-set-pin", {
        body: { tenant_id: tenantId, pin, register_now: registerNow },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Falha ao salvar PIN");
      return data.data;
    },
    onSuccess: (data) => {
      const wasFirst = data?.was_first_time;
      toast.success(wasFirst ? "PIN definido com sucesso!" : "PIN atualizado com sucesso!");
      setOpen(false);
      setPin("");
      setConfirmPin("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-pin-status", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-meta-config", tenantId] });
    },
    onError: (err) => showErrorToast(err, { module: "whatsapp", action: "salvar PIN" }),
  });

  if (!pinStatus?.hasConfig) return null;

  const hasPin = pinStatus.hasPin;
  const numberPending = pinStatus.status !== "connected";
  const pinsMatch = pin.length === 6 && pin === confirmPin;
  // Quando o número está pendente, ofertar registrar imediatamente
  const shouldRegisterNow = numberPending;

  const triggerLabel = hasPin ? "Atualizar PIN" : "Definir PIN";
  const TriggerIcon = hasPin ? RefreshCcw : KeyRound;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact ? (
          <Button size="sm" variant="outline" className="text-xs h-7">
            <TriggerIcon className="h-3 w-3 mr-1" />
            {triggerLabel}
            {!hasPin && (
              <Badge variant="destructive" className="ml-2 h-4 text-[10px] px-1">
                Recomendado
              </Badge>
            )}
          </Button>
        ) : (
          <Button variant={hasPin ? "outline" : "default"} size="sm">
            {hasPin ? (
              <ShieldCheck className="h-4 w-4 mr-2" />
            ) : (
              <ShieldAlert className="h-4 w-4 mr-2" />
            )}
            {hasPin ? "PIN salvo · Atualizar" : "Definir PIN do número"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {hasPin ? "Atualizar PIN do número" : "Definir PIN de 6 dígitos"}
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <span className="block">
              Esse PIN é uma exigência da Meta para registrar o seu número no
              WhatsApp Cloud API. Sem ele, se o número for desativado por
              qualquer motivo (faturamento, manutenção, política), não
              conseguimos reativá-lo automaticamente.
            </span>
            <span className="block text-xs text-muted-foreground">
              <strong>Importante:</strong> guarde este PIN em local seguro. Ele
              será usado em qualquer reparo automático futuro.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Novo PIN (6 dígitos)</label>
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

          {numberPending && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Seu número está pendente. Ao salvar, vamos registrar o número
                automaticamente usando este PIN.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => setPinMutation.mutate({ pin, registerNow: shouldRegisterNow })}
            disabled={!pinsMatch || setPinMutation.isPending || isLoading}
          >
            {setPinMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4 mr-2" />
            )}
            {shouldRegisterNow ? "Salvar e registrar número" : "Salvar PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
