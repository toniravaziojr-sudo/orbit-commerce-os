// =============================================
// useProductCommercialClassification — Frente 4
// Lê produto + composição e devolve classificação + fit gate para a UI.
// =============================================
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyProduct,
  type ClassificationResult,
} from "../../supabase/functions/_shared/ads-autopilot/productCommercialClassifier";
import {
  evaluateProductFunnelFit,
  normalizeFunnelStage,
  type FitGateResult,
} from "../../supabase/functions/_shared/ads-autopilot/productFunnelFitGate";

export interface ProductFitData {
  classification: ClassificationResult;
  fit: FitGateResult;
  product_name?: string | null;
  components_summary?: Array<{ name: string; quantity: number }>;
}

export function useProductCommercialFit(
  productId: string | null | undefined,
  funnelStageRaw: string | null | undefined,
  tenantId: string | null | undefined,
) {
  return useQuery<ProductFitData | null>({
    queryKey: ["product-commercial-fit", productId, funnelStageRaw, tenantId],
    enabled: !!productId && !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!productId || !tenantId) return null;

      // 1) Produto + tags + categorias
      const [{ data: product }, { data: components }, { data: payload }, { data: floor }] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, price, product_format, tags")
          .eq("id", productId)
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase
          .from("product_components")
          .select("component_product_id, quantity, component:products!component_product_id(name)")
          .eq("parent_product_id", productId),
        supabase
          .from("ai_product_commercial_payload")
          .select("is_base_candidate, base_product_id")
          .eq("product_id", productId)
          .maybeSingle(),
        supabase
          .from("products")
          .select("price")
          .eq("tenant_id", tenantId)
          .eq("product_format", "simple")
          .eq("status", "active")
          .is("deleted_at", null)
          .not("price", "is", null)
          .order("price", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!product) return null;

      const compRows = (components || []).map((c: any) => ({
        component_product_id: c.component_product_id,
        quantity: Number(c.quantity) || 0,
      }));
      const compSummary = (components || []).map((c: any) => ({
        name: c.component?.name || "",
        quantity: Number(c.quantity) || 0,
      }));

      const classification = classifyProduct({
        product: {
          id: product.id,
          name: product.name,
          price: product.price != null ? Number(product.price) : null,
          product_format: product.product_format,
          tags: Array.isArray(product.tags) ? product.tags : [],
          is_base_candidate: payload?.is_base_candidate ?? null,
          base_product_id: payload?.base_product_id ?? null,
        },
        components: compRows.length > 0 ? compRows : undefined,
        basePriceFloor: floor?.price != null ? Number(floor.price) : null,
      });

      const fit = evaluateProductFunnelFit({
        commercial_class: classification.commercial_class,
        classification_confidence: classification.confidence,
        funnel_stage: normalizeFunnelStage(funnelStageRaw ?? null),
      });

      return { classification, fit, product_name: product.name, components_summary: compSummary };
    },
  });
}
