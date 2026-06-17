// =============================================================================
// useProposalOverwrite — Fase 4
// Persiste edições manuais do lojista sobre action_data de uma proposta de
// campanha (ads_autopilot_actions). Sem chamada de IA. Sobrescreve direto.
//
// Regras:
//  - Snapshot da versão original é salvo UMA vez em metadata.original_snapshot
//    (auditoria + base para "Ajustar proposta" da IA, se o usuário quiser voltar).
//  - Toast de aviso aparece UMA vez por sessão+proposta.
// =============================================================================
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PendingAction } from "@/hooks/useAdsPendingActions";

type PatchFn = (current: Record<string, any>) => Record<string, any>;

const sessionWarnedKey = (id: string) => `ads-proposal-overwrite-warned:${id}`;

export function useProposalOverwrite(action: PendingAction) {
  const queryClient = useQueryClient();
  const savingRef = useRef(false);

  const showWarningOnce = useCallback(() => {
    if (typeof window === "undefined") return;
    const key = sessionWarnedKey(action.id);
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    toast.info("Suas alterações vão sobrescrever a proposta original.", {
      description: "Para voltar à versão da IA, use \"Ajustar proposta\".",
      duration: 6000,
    });
  }, [action.id]);

  const overwrite = useCallback(
    async (patch: PatchFn) => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const current = (action.action_data || {}) as Record<string, any>;
        const next = patch(current);

        // Snapshot original 1x (auditoria)
        const metadata = { ...(next.metadata || {}) };
        if (!metadata.original_snapshot) {
          // Clona o action_data ANTES da edição atual.
          metadata.original_snapshot = JSON.parse(JSON.stringify(current));
          metadata.original_snapshot_at = new Date().toISOString();
        }
        metadata.last_manual_edit_at = new Date().toISOString();
        next.metadata = metadata;

        const { error } = await supabase
          .from("ads_autopilot_actions" as any)
          .update({ action_data: next })
          .eq("id", action.id);

        if (error) throw error;

        showWarningOnce();

        // Invalida caches conhecidos.
        queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
        queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
        queryClient.invalidateQueries({ queryKey: ["approved-proposals-awaiting-publish"] });
      } catch (e: any) {
        toast.error("Não foi possível salvar a alteração.", {
          description: e?.message || "Tente novamente em instantes.",
        });
      } finally {
        savingRef.current = false;
      }
    },
    [action.id, action.action_data, queryClient, showWarningOnce],
  );

  return { overwrite };
}
