// ============================================================
// Pipeline F2 — Sub-fase 1.3
// Regra determinística de variante obrigatória.
//
// FONTE DE VERDADE (precedência):
//   1. ai_product_commercial_payload.has_mandatory_variants
//      (sinal curado pelo cérebro — "este produto EXIGE variante pra vender")
//   2. products.has_variants
//      (sinal estrutural — "existe product_variant associada")
//
// Quando o payload comercial existe, ele manda. Quando não existe, caímos
// no sinal estrutural. Isso cobre casos onde o produto TEM variantes no
// catálogo (sabor, aroma) mas comercialmente não precisa perguntar — e
// também casos onde o produto TEM variantes e a venda SÓ fecha com escolha.
//
// PERSISTÊNCIA:
//   conversations.metadata.product_focus = {
//     product_id,
//     variant_id,
//     variant_label,
//     resolved_at,
//     source: "user_selection" | "single_variant" | "no_variants_needed"
//   }
// ============================================================

export type VariantGateStatus =
  | "ok_no_variant_needed"    // produto não precisa de variante
  | "ok_already_resolved"     // foco já tem variante resolvida p/ este produto
  | "ok_single_variant"       // só existe 1 variante ativa → resolve automático
  | "ask_variant";            // precisa perguntar ao cliente

export interface VariantGateResult {
  status: VariantGateStatus;
  variant_id: string | null;
  variant_label: string | null;
  reason: string;
}

export interface ProductFocus {
  product_id: string;
  variant_id: string | null;
  variant_label: string | null;
  resolved_at: string;
  source: "user_selection" | "single_variant" | "no_variants_needed";
}

export interface VariantGateInput {
  product_id: string;
  // products.has_variants
  product_has_variants: boolean;
  // ai_product_commercial_payload.has_mandatory_variants (null se payload ausente)
  commercial_has_mandatory_variants: boolean | null;
  // Foco atual da conversa (lido de conversations.metadata.product_focus)
  current_focus: ProductFocus | null;
  // Variante explícita vinda do tool_call (cliente/IA escolheu neste turno)
  explicit_variant_id?: string | null;
  // Lista de variantes ativas conhecidas (apenas para resolver caso "1 única variante")
  active_variants?: Array<{ id: string; label: string | null }>;
}

/**
 * Decide, de forma determinística, se precisamos pedir variante ao cliente.
 * NÃO executa efeitos colaterais — apenas responde.
 */
export function evaluateVariantGate(input: VariantGateInput): VariantGateResult {
  const {
    product_id,
    product_has_variants,
    commercial_has_mandatory_variants,
    current_focus,
    explicit_variant_id,
    active_variants,
  } = input;

  // 0. Variante explícita neste turno → respeita (quem chamou já escolheu).
  if (explicit_variant_id) {
    return {
      status: "ok_already_resolved",
      variant_id: explicit_variant_id,
      variant_label: null,
      reason: "explicit_variant_in_tool_call",
    };
  }

  // 1. Foco já persistido para ESTE produto com variant_id → não pergunta de novo.
  if (current_focus && current_focus.product_id === product_id && current_focus.variant_id) {
    return {
      status: "ok_already_resolved",
      variant_id: current_focus.variant_id,
      variant_label: current_focus.variant_label,
      reason: "variant_persisted_in_conversation_focus",
    };
  }

  // 2. Precedência do payload comercial — fonte curada.
  //    Só quando o payload EXISTE (não-null) ele supera o sinal estrutural.
  if (commercial_has_mandatory_variants === false) {
    return {
      status: "ok_no_variant_needed",
      variant_id: null,
      variant_label: null,
      reason: "commercial_payload_says_not_mandatory",
    };
  }

  // 3. Produto sem variantes no catálogo → nada a perguntar.
  if (!product_has_variants) {
    return {
      status: "ok_no_variant_needed",
      variant_id: null,
      variant_label: null,
      reason: "product_has_no_variants",
    };
  }

  // 4. Produto tem variantes, mas só existe UMA ativa → resolve automático.
  if (Array.isArray(active_variants) && active_variants.length === 1) {
    const only = active_variants[0];
    return {
      status: "ok_single_variant",
      variant_id: only.id,
      variant_label: only.label,
      reason: "single_active_variant_auto_resolved",
    };
  }

  // 5. Caso restante: tem variantes, múltiplas ativas, sem foco persistido,
  //    sem escolha explícita → PERGUNTAR.
  return {
    status: "ask_variant",
    variant_id: null,
    variant_label: null,
    reason:
      commercial_has_mandatory_variants === true
        ? "commercial_payload_marks_variants_mandatory"
        : "product_has_variants_and_no_resolution",
  };
}

/**
 * Monta o objeto product_focus que deve ser gravado em conversations.metadata.
 */
export function buildProductFocus(args: {
  product_id: string;
  variant_id: string | null;
  variant_label: string | null;
  source: ProductFocus["source"];
}): ProductFocus {
  return {
    product_id: args.product_id,
    variant_id: args.variant_id,
    variant_label: args.variant_label,
    resolved_at: new Date().toISOString(),
    source: args.source,
  };
}

/**
 * Extrai o product_focus atual do metadata da conversa, com tipagem segura.
 */
export function readProductFocus(metadata: unknown): ProductFocus | null {
  if (!metadata || typeof metadata !== "object") return null;
  const pf = (metadata as Record<string, unknown>).product_focus;
  if (!pf || typeof pf !== "object") return null;
  const obj = pf as Record<string, unknown>;
  if (typeof obj.product_id !== "string") return null;
  return {
    product_id: obj.product_id,
    variant_id: typeof obj.variant_id === "string" ? obj.variant_id : null,
    variant_label: typeof obj.variant_label === "string" ? obj.variant_label : null,
    resolved_at: typeof obj.resolved_at === "string" ? obj.resolved_at : new Date().toISOString(),
    source:
      obj.source === "user_selection" ||
      obj.source === "single_variant" ||
      obj.source === "no_variants_needed"
        ? obj.source
        : "user_selection",
  };
}
