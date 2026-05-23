// ============================================================
// Frente E — Âncora do turno (dor declarada + foco + ficha institucional)
//
// Consolida em UM bloco de contexto, injetado em TODO turno quando há
// algum sinal real persistido, os dados que cada estado deve usar como
// fonte primária — fazendo a "muleta universal" (perguntas genéricas
// de qualificação) virar fallback, não default.
//
// Fontes:
//  - salesMemory.customer_declared_pain (dor literal do cliente)
//  - conversation.metadata.family_focus / last_focused_product
//  - product_focus.product_id (foco ativo)
//  - ai_support_config.metadata.institutional_sheet (campos disponíveis)
//
// Regras:
//  - Bloco SÓ é emitido se houver pelo menos 1 sinal real
//    (dor OU família OU foco OU pelo menos 1 campo institucional).
//  - Não duplica o conteúdo da ficha institucional (Frente D);
//    aqui apenas SINALIZA quais áreas estão cobertas pela ficha
//    (delivery, horários, pagamento, cupom, garantia, etc.) para
//    que o estado saiba que pode se apoiar nelas.
//  - Determinístico: sem LLM, sem dependência de turno do modelo.
// ============================================================

import type { InstitutionalSheet } from "./institutional-sheet.ts";

export interface TurnAnchorInput {
  declaredPain?: string | null;
  familyFocus?: string | null;
  lastFocusedProductName?: string | null;
  productFocusId?: string | null;
  sheet?: InstitutionalSheet | null;
}

export interface TurnAnchorOutput {
  promptBlock: string | null;
  hasPain: boolean;
  hasFamily: boolean;
  hasProductFocus: boolean;
  institutionalAreas: string[];
  reason: string;
}

const SHEET_AREA_LABELS: Record<keyof InstitutionalSheet, string> = {
  delivery_coverage: "entrega/cobertura",
  business_hours: "horários",
  payment_methods: "pagamento",
  coupons_policy: "cupom/desconto",
  guarantee_policy: "garantia/troca",
  social_proof: "prova social",
  physical_store: "loja física",
  contact_human: "atendimento humano",
  notes: "observações da loja",
};

function institutionalAreasOf(sheet?: InstitutionalSheet | null): string[] {
  if (!sheet) return [];
  const areas: string[] = [];
  for (const k of Object.keys(SHEET_AREA_LABELS) as (keyof InstitutionalSheet)[]) {
    const v = (sheet[k] ?? "").toString().trim();
    if (v) areas.push(SHEET_AREA_LABELS[k]);
  }
  return areas;
}

export function buildTurnAnchorBlock(input: TurnAnchorInput): TurnAnchorOutput {
  const declaredPain = (input.declaredPain ?? "").toString().trim();
  const familyFocus = (input.familyFocus ?? "").toString().trim();
  const productName = (input.lastFocusedProductName ?? "").toString().trim();
  const productId = (input.productFocusId ?? "").toString().trim();
  const areas = institutionalAreasOf(input.sheet);

  const hasPain = declaredPain.length > 0;
  const hasFamily = familyFocus.length > 0;
  const hasProductFocus = productId.length > 0 || productName.length > 0;
  const hasInstitutional = areas.length > 0;

  if (!hasPain && !hasFamily && !hasProductFocus && !hasInstitutional) {
    return {
      promptBlock: null,
      hasPain,
      hasFamily,
      hasProductFocus,
      institutionalAreas: areas,
      reason: "no_signal",
    };
  }

  const lines: string[] = [];
  lines.push("### ÂNCORA DESTE TURNO (use como FONTE PRIMÁRIA)");
  lines.push(
    "Antes de fazer pergunta genérica de qualificação (\"pra qual objetivo?\", " +
      "\"qual seu perfil?\"), CONSULTE este bloco. Se houver dor ou foco " +
      "declarado abaixo, NÃO requalifique — apoie a resposta nele.",
  );
  lines.push("");

  if (hasPain) {
    lines.push(`- Dor/objetivo declarado pelo cliente: "${declaredPain}"`);
  } else {
    lines.push("- Dor/objetivo declarado: (ainda não informado)");
  }

  if (hasFamily) {
    lines.push(`- Família em foco: ${familyFocus}`);
  }

  if (hasProductFocus) {
    const label = productName || `id:${productId.slice(0, 8)}`;
    lines.push(`- Produto em foco: ${label}`);
  }

  if (hasInstitutional) {
    lines.push(
      `- Ficha institucional disponível para: ${areas.join(", ")}. ` +
        "Use o bloco específico da ficha (mais abaixo) quando o cliente " +
        "tocar nesses temas — não invente, não oferta humano se a ficha " +
        "responde.",
    );
  } else {
    lines.push(
      "- Ficha institucional: sem dados cadastrados. " +
        "Para temas institucionais (entrega, horário, cupom, garantia), " +
        "ofereça atendimento humano em vez de inventar.",
    );
  }

  lines.push("");
  lines.push("### REGRA DE FALLBACK (MULETA UNIVERSAL)");
  lines.push(
    "Perguntas universais de qualificação (\"pra você ou pra presentear?\", " +
      "\"qual seu objetivo?\") são FALLBACK — só usar quando não há dor, nem " +
      "família, nem produto em foco aqui acima. Se houver QUALQUER sinal, " +
      "o turno avança apoiado nele.",
  );

  const reason = hasPain
    ? "pain_anchor"
    : hasProductFocus
    ? "product_anchor"
    : hasFamily
    ? "family_anchor"
    : "institutional_only";

  return {
    promptBlock: lines.join("\n"),
    hasPain,
    hasFamily,
    hasProductFocus,
    institutionalAreas: areas,
    reason,
  };
}
