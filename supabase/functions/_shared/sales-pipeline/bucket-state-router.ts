// ============================================================
// Frente 3 — Bucket → State Router (institucional / pós-venda /
// objeção / hesitação / humano / fora de escopo)
//
// Consome o `IntentBucket` do Frente 2 e devolve, para os buckets
// NÃO-vendas, um override de estado (quando aplicável) + um bloco
// curto de instrução de prompt. Aditivo: para buckets de venda
// (`product_question`, `catalog_question`, `commercial_policy`,
// `open_discovery`, `social`) NÃO emite nada — a pipeline segue
// normal.
//
// Princípios:
// - Roda DEPOIS do reflexo determinístico. Se o reflexo já fixou
//   state, nós não sobrescrevemos — só anexamos bloco de prompt
//   quando complementar (objeção/hesitação/fora de escopo).
// - Lê KB do tenant já carregada (business_context, attendance_rules)
//   + brand context opcional (banned_claims, do_not_do).
// - Se KB do tenant é vazia para um tema institucional, instruí-mos
//   a IA a **não inventar** e oferecer humano.
// ============================================================

import type { IntentBucket } from "./scope-router.ts";
import type { PipelineState } from "./states.ts";

export interface BucketRouterTenantKB {
  /** ai_support_config.business_context */
  businessContext: string | null;
  /** ai_support_config.attendance_rules */
  attendanceRules: string | null;
  /** tenant_brand_context.banned_claims */
  bannedClaims: string[] | null;
  /** tenant_brand_context.do_not_do */
  doNotDo: string[] | null;
  /** ai_support_config.handoff_keywords (lista de gatilhos manuais) */
  handoffKeywords: string[] | null;
}

export interface BucketRouterInput {
  bucket: IntentBucket;
  currentState: PipelineState;
  /** true se um reflexo determinístico já fixou um state nesta volta. */
  reflexAlreadyOverrodeState: boolean;
  kb: BucketRouterTenantKB;
}

export interface BucketRouterResult {
  /** Estado a ser usado em buildPromptForState. null = manter currentState. */
  stateOverride: PipelineState | null;
  /** Bloco de instrução curto a adicionar em contextualBlocks. null = nada. */
  promptBlock: string | null;
  reason: string;
  appliedTo: IntentBucket;
}

const NULL_RESULT = (bucket: IntentBucket, reason: string): BucketRouterResult => ({
  stateOverride: null,
  promptBlock: null,
  reason,
  appliedTo: bucket,
});

function clampList(items: string[] | null | undefined, max = 6): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, max);
}

function clampText(text: string | null | undefined, max = 800): string | null {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max).trimEnd() + "…" : t;
}

function institutionalBlock(kb: BucketRouterTenantKB): string {
  const biz = clampText(kb.businessContext, 900);
  const rules = clampText(kb.attendanceRules, 600);
  const banned = clampList(kb.bannedClaims, 6);
  const doNot = clampList(kb.doNotDo, 6);

  const lines: string[] = [];
  lines.push("INSTITUCIONAL — Cliente perguntou sobre a marca/loja/política (loja física, horário, garantia, troca, devolução, sobre a empresa).");
  lines.push("REGRAS:");
  lines.push("- Responda SOMENTE com base no que estiver descrito abaixo. Se a informação pedida não estiver aqui, diga com transparência que vai checar e ofereça falar com um atendente humano. NÃO invente dado institucional.");
  lines.push("- Resposta curta, direta, sem encerrar pedindo discovery de venda. Pergunte ao final apenas se o cliente quer ajuda em algo mais.");

  if (biz) {
    lines.push("");
    lines.push("CONTEXTO DO NEGÓCIO (fonte oficial):");
    lines.push(biz);
  }
  if (rules) {
    lines.push("");
    lines.push("REGRAS DE ATENDIMENTO (fonte oficial):");
    lines.push(rules);
  }
  if (banned.length > 0) {
    lines.push("");
    lines.push("Claims PROIBIDAS (nunca prometer):");
    for (const c of banned) lines.push(`- ${c}`);
  }
  if (doNot.length > 0) {
    lines.push("");
    lines.push("O que NÃO fazer:");
    for (const c of doNot) lines.push(`- ${c}`);
  }

  if (!biz && !rules) {
    lines.push("");
    lines.push("ATENÇÃO: ainda não há base institucional cadastrada. NÃO invente. Diga que vai verificar com a equipe e ofereça humano.");
  }
  return lines.join("\n");
}

function objectionBlock(kb: BucketRouterTenantKB): string {
  const banned = clampList(kb.bannedClaims, 6);
  const doNot = clampList(kb.doNotDo, 6);
  const lines: string[] = [];
  lines.push("OBJEÇÃO — Cliente demonstrou resistência (preço, ceticismo, medo, frustração).");
  lines.push("REGRAS:");
  lines.push("- NÃO ofereça desconto, cupom ou condição que não esteja explicitamente cadastrada. Não invente promoção.");
  lines.push("- Acolha a objeção em UMA frase, reforce um diferencial real do produto/marca já citado e devolva a decisão ao cliente sem pressão.");
  lines.push("- Se a objeção for sobre eficácia, use só prova que esteja cadastrada (garantia, política de troca, depoimento já listado). Sem promessa nova.");
  if (banned.length > 0) {
    lines.push("");
    lines.push("Claims PROIBIDAS:");
    for (const c of banned) lines.push(`- ${c}`);
  }
  if (doNot.length > 0) {
    lines.push("");
    lines.push("O que NÃO fazer:");
    for (const c of doNot) lines.push(`- ${c}`);
  }
  return lines.join("\n");
}

const HESITATION_BLOCK = [
  "HESITAÇÃO — Cliente está adiando ('vou pensar', 'depois', 'talvez').",
  "REGRAS:",
  "- NÃO pressione. Não repita oferta. Não force pergunta de discovery.",
  "- Em UMA frase, reconheça o tempo do cliente e deixe a porta aberta (ex.: 'Sem pressa, qualquer dúvida estou aqui').",
  "- NÃO encerre com pergunta. Apenas valide.",
].join("\n");

const OUT_OF_SCOPE_BLOCK = [
  "FORA DE ESCOPO — Cliente trouxe assunto que não é do negócio.",
  "REGRAS:",
  "- Responda em UMA frase, com leveza, sem entrar no mérito do tema.",
  "- Convide gentilmente de volta para o que a loja resolve, SEM forçar venda nem fazer discovery longa.",
].join("\n");

const HUMAN_REQUEST_BLOCK = [
  "PEDIDO DE HUMANO — Cliente pediu explicitamente atendente humano.",
  "REGRAS:",
  "- Confirme em UMA frase que vai chamar a equipe.",
  "- NÃO tente resolver venda nem fazer mais perguntas. NÃO peça desculpa repetida.",
  "- O sistema vai sinalizar handoff. Sua resposta deve ser apenas a transição educada.",
].join("\n");

const POST_SALE_BLOCK = [
  "PÓS-VENDA — Cliente está falando de pedido existente / rastreio / defeito / NF / cancelamento.",
  "REGRAS:",
  "- NÃO ofereça produto novo. NÃO faça discovery de venda.",
  "- Se tiver dado do pedido na ferramenta, responda objetivo. Se não tiver, peça nº do pedido / e-mail / CPF (uma única vez).",
  "- Para defeito, atraso grave ou cancelamento, ofereça humano se a política do tenant não estiver explícita.",
].join("\n");

export function routeBucketToState(input: BucketRouterInput): BucketRouterResult {
  const { bucket, currentState, reflexAlreadyOverrodeState, kb } = input;

  // Buckets de venda → não interferimos.
  if (
    bucket === "product_question" ||
    bucket === "catalog_question" ||
    bucket === "commercial_policy" ||
    bucket === "open_discovery" ||
    bucket === "social"
  ) {
    return NULL_RESULT(bucket, "sales_or_social_no_op");
  }

  switch (bucket) {
    case "human_request": {
      // Reflex pode ter colocado em handoff já; respeitamos.
      const stateOverride: PipelineState | null = reflexAlreadyOverrodeState
        ? null
        : currentState === "handoff" ? null : "handoff";
      return {
        stateOverride,
        promptBlock: HUMAN_REQUEST_BLOCK,
        reason: "human_request_to_handoff",
        appliedTo: bucket,
      };
    }

    case "post_sale": {
      const stateOverride: PipelineState | null = reflexAlreadyOverrodeState
        ? null
        : currentState === "support" ? null : "support";
      return {
        stateOverride,
        promptBlock: POST_SALE_BLOCK,
        reason: "post_sale_to_support",
        appliedTo: bucket,
      };
    }

    case "institutional": {
      // Institucional vai para `support` (fora do funil de venda) só se o
      // reflex não tiver fixado outro state e estivermos em estados de
      // venda ativa. Se já estivermos em checkout_assist/handoff, não
      // mexemos.
      const STAY = currentState === "checkout_assist" || currentState === "handoff" || currentState === "support";
      const stateOverride: PipelineState | null =
        reflexAlreadyOverrodeState || STAY ? null : "support";
      return {
        stateOverride,
        promptBlock: institutionalBlock(kb),
        reason: "institutional_kb_block",
        appliedTo: bucket,
      };
    }

    case "objection": {
      // Não muda estado — só injeta bloco de manejo.
      return {
        stateOverride: null,
        promptBlock: objectionBlock(kb),
        reason: "objection_handler_block",
        appliedTo: bucket,
      };
    }

    case "hesitation": {
      return {
        stateOverride: null,
        promptBlock: HESITATION_BLOCK,
        reason: "hesitation_no_pressure_block",
        appliedTo: bucket,
      };
    }

    case "out_of_scope": {
      return {
        stateOverride: null,
        promptBlock: OUT_OF_SCOPE_BLOCK,
        reason: "out_of_scope_redirect_block",
        appliedTo: bucket,
      };
    }

    default:
      return NULL_RESULT(bucket, "unknown_bucket");
  }
}
