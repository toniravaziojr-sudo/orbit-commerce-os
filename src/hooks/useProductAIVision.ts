import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export type CommercialRole =
  | "primary"
  | "complement"
  | "upgrade"
  | "kit_component"
  | "accessory"
  | "consumable";

export type ProductKind =
  | "single"
  | "kit"
  | "combo"
  | "pack"
  | "bundle"
  | "upgrade"
  | "complement"
  | "replacement";

export type RelationType = "complement" | "related_base" | "upsell" | "cross_sell";

export interface AIPayload {
  id: string;
  tenant_id: string;
  product_id: string;
  commercial_role: CommercialRole;
  product_kind: ProductKind;
  base_product_id: string | null;
  is_base_candidate: boolean | null;
  when_to_recommend: string | null;
  when_not_to_indicate: string | null;
  recommendation_notes: string | null;
  source: "inferred" | "manual" | "hybrid";
  has_manual_overrides: boolean;
  manual_overrides: Record<string, unknown>;
}

export interface AIRelation {
  id: string;
  tenant_id: string;
  source_product_id: string;
  target_product_id: string;
  relation_type: RelationType;
  position: number;
  source: "inferred" | "manual" | "hybrid";
  manual_override: boolean;
  target?: { id: string; name: string; sku: string | null } | null;
}

export function useProductAIVision(productId: string | undefined, tenantId: string | undefined) {
  const qc = useQueryClient();

  const payloadQuery = useQuery({
    queryKey: ["ai-product-payload", productId],
    enabled: !!productId && !!tenantId,
    queryFn: async (): Promise<AIPayload | null> => {
      const { data, error } = await (supabase as any)
        .from("ai_product_commercial_payload")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      if (error) throw error;
      return data as AIPayload | null;
    },
  });

  const relationsQuery = useQuery({
    queryKey: ["ai-product-relations", productId],
    enabled: !!productId && !!tenantId,
    queryFn: async (): Promise<AIRelation[]> => {
      const { data, error } = await (supabase as any)
        .from("ai_product_relations")
        .select("*, target:products!target_product_id(id,name,sku)")
        .eq("source_product_id", productId)
        .order("relation_type")
        .order("position");
      if (error) throw error;
      return (data || []) as AIRelation[];
    },
  });

  const savePayload = useMutation({
    mutationFn: async (patch: Partial<AIPayload>) => {
      if (!productId || !tenantId) throw new Error("Produto/tenant ausente");
      const existing = payloadQuery.data;
      const body: any = {
        ...(existing || {}),
        ...patch,
        tenant_id: tenantId,
        product_id: productId,
        source: "manual",
        has_manual_overrides: true,
      };
      const { error } = await (supabase as any)
        .from("ai_product_commercial_payload")
        .upsert(body, { onConflict: "tenant_id,product_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visão da IA salva");
      qc.invalidateQueries({ queryKey: ["ai-product-payload", productId] });
    },
    onError: (e) => showErrorToast(e, { module: "produtos", action: "salvar" }),
  });

  const addRelation = useMutation({
    mutationFn: async (input: { target_product_id: string; relation_type: RelationType }) => {
      if (!productId || !tenantId) throw new Error("Produto/tenant ausente");
      const max = Math.max(0, ...relationsQuery.data?.filter(r => r.relation_type === input.relation_type).map(r => r.position) ?? [0]);
      const { error } = await (supabase as any).from("ai_product_relations").insert({
        tenant_id: tenantId,
        source_product_id: productId,
        target_product_id: input.target_product_id,
        relation_type: input.relation_type,
        position: max + 1,
        source: "manual",
        manual_override: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Relação adicionada");
      qc.invalidateQueries({ queryKey: ["ai-product-relations", productId] });
    },
    onError: (e) => showErrorToast(e, { module: "produtos", action: "salvar" }),
  });

  const removeRelation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ai_product_relations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-product-relations", productId] });
    },
    onError: (e) => showErrorToast(e, { module: "produtos", action: "excluir" }),
  });

  return {
    payload: payloadQuery.data,
    relations: relationsQuery.data ?? [],
    isLoading: payloadQuery.isLoading || relationsQuery.isLoading,
    savePayload,
    addRelation,
    removeRelation,
  };
}
