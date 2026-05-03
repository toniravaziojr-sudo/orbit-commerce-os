import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAiSupportConfig } from "@/hooks/useAiSupportConfig";
import { useTenantBrandContext } from "@/hooks/useTenantBrandContext";

export type ChecklistSeverity = "critico" | "recomendado" | "informativo";

export interface ChecklistItem {
  id: string;
  label: string;
  severity: ChecklistSeverity;
  why: string;
  resolved: boolean;
  cta?: { kind: "anchor" | "route"; target: string; label: string };
}

/**
 * Onda 1A — Diagnóstico visual da configuração da IA na própria tela
 * de Configurações Gerais. Não bloqueia. Não escreve.
 */
export function useAiContextChecklist() {
  const { currentTenant } = useAuth();
  const { config } = useAiSupportConfig();
  const { brand } = useTenantBrandContext();

  const aggregates = useQuery({
    queryKey: ["ai-context-checklist-aggregates", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;
      const tenantId = currentTenant.id;

      const [objections, kbDocs, productsWithoutPayload, packsNoBase] = await Promise.all([
        supabase
          .from("ai_intent_objection_map")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        supabase
          .from("knowledge_base_docs")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        supabase
          .from("ai_product_commercial_payload")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .not("commercial_role", "is", null),
        (supabase as any)
          .from("ai_product_commercial_payload")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("product_kind", "pack")
          .is("base_product_id", null),
      ]);

      const productsTotal = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .neq("status", "archived");

      return {
        objectionsCount: objections.count ?? 0,
        kbDocsCount: kbDocs.count ?? 0,
        productsWithRoleCount: productsWithoutPayload.count ?? 0,
        productsTotalCount: productsTotal.count ?? 0,
        packsWithoutBaseCount: (packsNoBase as any).count ?? 0,
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
  });

  const items: ChecklistItem[] = [];

  const has = (s: string | null | undefined) => !!(s && s.trim().length > 0);
  const hasArr = (a: string[] | null | undefined) => Array.isArray(a) && a.length > 0;

  items.push({
    id: "business_context",
    label: "Contexto do negócio",
    severity: "critico",
    why: "Sem isso, a IA improvisa o que sua empresa vende e como funciona.",
    resolved: has(config?.business_context),
    cta: { kind: "anchor", target: "#bloco-contexto", label: "Preencher" },
  });

  items.push({
    id: "attendance_rules",
    label: "Regras gerais de atendimento",
    severity: "recomendado",
    why: "Define como a IA conduz a conversa, quando perguntar e quando escalar.",
    resolved: has(config?.attendance_rules),
    cta: { kind: "anchor", target: "#bloco-regras", label: "Preencher" },
  });

  items.push({
    id: "forbidden_claims",
    label: "Claims/promessas proibidas",
    severity: "critico",
    why: "Evita que a IA prometa resultado, prazo ou efeito que não pode garantir.",
    resolved: hasArr(brand?.banned_claims) || hasArr(brand?.do_not_do),
    cta: { kind: "anchor", target: "#bloco-claims", label: "Preencher" },
  });

  items.push({
    id: "additional_knowledge",
    label: "Conhecimento adicional",
    severity: "informativo",
    why: "Detalhes específicos da loja que não cabem em outros campos.",
    resolved: has(config?.custom_knowledge),
    cta: { kind: "anchor", target: "#bloco-conhecimento-adicional", label: "Preencher" },
  });

  const agg = aggregates.data;
  items.push({
    id: "kb_docs",
    label: "FAQ / base de conhecimento",
    severity: "recomendado",
    why: "Sem políticas e perguntas frequentes, a IA não sabe responder dúvidas comuns.",
    resolved: (agg?.kbDocsCount ?? 0) > 0,
    cta: { kind: "route", target: "/configuracoes/base-conhecimento", label: "Cadastrar" },
  });

  items.push({
    id: "objections",
    label: "Objeções comuns",
    severity: "recomendado",
    why: "Sem objeções mapeadas, a IA não responde bem dúvidas frequentes de venda.",
    resolved: (agg?.objectionsCount ?? 0) >= 3,
    cta: { kind: "anchor", target: "#tab-objections", label: "Cadastrar objeções" },
  });

  // Produto sem visão da IA (sem papel comercial)
  const productsWithoutRole =
    (agg?.productsTotalCount ?? 0) - (agg?.productsWithRoleCount ?? 0);
  items.push({
    id: "products_without_ai",
    label:
      productsWithoutRole > 0
        ? `${productsWithoutRole} produto(s) sem visão da IA`
        : "Produtos com visão da IA",
    severity: "informativo",
    why: "A IA não sabe o papel comercial desses produtos (principal, pack, kit, complemento).",
    resolved: productsWithoutRole === 0 && (agg?.productsTotalCount ?? 0) > 0,
    cta: { kind: "route", target: "/produtos", label: "Disponível na próxima onda" },
  });

  // Pack/kit sem produto-base — fica informativo até Onda 1B
  items.push({
    id: "packs_without_base",
    label: "Packs/kits sem produto-base relacionado",
    severity: "informativo",
    why:
      "A IA pode oferecer um pack quando deveria começar pelo produto-base. Será habilitado quando o cadastro de produto receber a seção 'Visão da IA' (próxima onda).",
    resolved: false,
    cta: undefined,
  });

  return {
    items,
    isLoading: aggregates.isLoading,
    counts: {
      total: items.length,
      resolved: items.filter((i) => i.resolved).length,
      criticosPendentes: items.filter((i) => i.severity === "critico" && !i.resolved).length,
    },
  };
}
