// ============================================================
// Reg #2.17 Fase C — Reflexos Determinísticos do Roteador
// ----------------------------------------------------------
// 4 detectores que rodam DEPOIS de decideNextState e ANTES de
// buildPromptForState. Consomem o turno consolidado pelo Turn
// Orchestrator e o intent já classificado, e:
//   1. Aplicam override de estado (quando o roteador errou).
//   2. Injetam um bloco de instrução curta no prompt para
//      ancorar o comportamento esperado.
//
// Princípios:
// - Nunca contradizer a máquina de estados; só corrigir desvios
//   reconhecíveis (greeting/discovery quando o sinal é claro).
// - Sempre aditivos: se nenhum reflexo dispara, retorna null.
// - Respeitam Turn Orchestrator (texto consolidado), Reg #2.8
//   (TPR como fonte primária) e Reg #2.17 Fase A (dor != reclamação).
// ============================================================

import type { PipelineState } from "./states.ts";
import type { TurnIntent } from "./transitions.ts";

export interface ReflexInput {
  consolidatedText: string;
  state: PipelineState;
  hasActiveCart: boolean;
  familyFocus: string | null;
  lastFocusedProductName: string | null;
  turnIntent: TurnIntent | null;
  // Sinais TPR já hidratados (asked_about_shipping, is_support_topic, etc.)
  tprAskedShipping: boolean | null;
  tprIsSupportTopic: boolean | null;
  tprAskedPaymentLink: boolean | null;
  hasKnownCustomerCep: boolean;
}

export interface ReflexOutput {
  reflexId:
    | "cep_received"
    | "shipping_question"
    | "post_sale_question"
    | "short_turn_with_intent"
    | "presence_ping";
  newState: PipelineState | null; // null = não muda estado
  reason: string;
  promptBlock: string; // bloco anexado ao contextualBlocks
}


// Detecta CEP brasileiro: 8 dígitos contíguos OU formato 00000-000.
const CEP_REGEX = /(?<!\d)(\d{5})-?(\d{3})(?!\d)/;

// Sinais regex de pergunta de frete (rede de segurança caso TPR caia).
const SHIPPING_REGEX =
  /\b(frete|entrega|prazo|chega quando|chega em|quanto tempo|quanto demora|quando recebo|quando entrega)\b/i;

// Sinais regex de pós-venda: cliente fala de PEDIDO já feito.
const POST_SALE_REGEX =
  /\b(meu pedido|pedido n[uú]mero|n[uú]mero do pedido|c[oó]digo de rastrei|rastreio|rastrear|j[aá] comprei|j[aá] paguei|n[ãa]o chegou|n[ãa]o recebi|cad[eê] meu|onde est[aá] meu|ainda n[ãa]o chegou)\b/i;

// Pré-check: quando tudo é só ruído ("?", "ok", "tá").
function tokenCount(text: string): number {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return 0;
  return cleaned.split(" ").filter(Boolean).length;
}

export function detectDeterministicReflex(input: ReflexInput): ReflexOutput | null {
  const text = (input.consolidatedText || "").trim();
  if (!text) return null;

  // ── Reflexo 1: CEP recebido ─────────────────────────────
  const cepMatch = text.match(CEP_REGEX);
  if (cepMatch) {
    const cepDigits = `${cepMatch[1]}${cepMatch[2]}`;
    if (input.hasActiveCart) {
      // Carrinho ativo → avança para checkout_assist e força cotação.
      return {
        reflexId: "cep_received",
        newState: "checkout_assist",
        reason: "cep_received_with_active_cart",
        promptBlock:
          `\n[REFLEXO — CEP RECEBIDO]\n` +
          `O cliente informou o CEP ${cepDigits}. Há carrinho ativo.\n` +
          `Ação obrigatória: chamar calculate_shipping AGORA. ` +
          `Não responder em texto antes da cotação. Após a cotação, ` +
          `aplicar a regra de upsell (Reg #19.2) se houver oportunidade ` +
          `e seguir para o link de checkout.\n`,
      };
    }
    // Sem carrinho → mantém estado atual mas confirma CEP e pede produto/família.
    return {
      reflexId: "cep_received",
      newState: null,
      reason: "cep_received_without_cart",
      promptBlock:
        `\n[REFLEXO — CEP RECEBIDO SEM CARRINHO]\n` +
        `O cliente informou o CEP ${cepDigits}, mas ainda não há produto ` +
        `selecionado. Ação obrigatória: confirmar que o CEP foi anotado em ` +
        `UMA linha curta e perguntar qual produto/linha ele quer cotar. ` +
        `Não responder com saudação genérica nem com pergunta de descoberta ampla.\n`,
    };
  }

  // ── Reflexo 2: Pergunta sobre frete ─────────────────────
  const askedShipping =
    input.tprAskedShipping === true || SHIPPING_REGEX.test(text);
  if (askedShipping) {
    if (input.hasActiveCart && input.hasKnownCustomerCep) {
      return {
        reflexId: "shipping_question",
        newState: "checkout_assist",
        reason: "shipping_question_cart_and_cep",
        promptBlock:
          `\n[REFLEXO — PERGUNTA DE FRETE]\n` +
          `Cliente perguntou sobre frete/entrega/prazo. CEP e carrinho já existem.\n` +
          `Ação obrigatória: chamar calculate_shipping AGORA. Proibido ` +
          `responder em texto genérico antes da cotação real (Reg #17.x).\n`,
      };
    }
    if (input.hasActiveCart && !input.hasKnownCustomerCep) {
      return {
        reflexId: "shipping_question",
        newState: null,
        reason: "shipping_question_cart_no_cep",
        promptBlock:
          `\n[REFLEXO — PERGUNTA DE FRETE SEM CEP]\n` +
          `Cliente perguntou sobre frete e há carrinho ativo, mas o CEP ` +
          `ainda não é conhecido. Ação obrigatória: pedir o CEP em UMA linha ` +
          `curta e PARAR. Não inventar prazo, não responder genérico.\n`,
      };
    }
    // Sem carrinho: precisa primeiro escolher produto.
    return {
      reflexId: "shipping_question",
      newState: input.state === "greeting" ? "recommendation" : null,
      reason: "shipping_question_no_cart",
      promptBlock:
        `\n[REFLEXO — PERGUNTA DE FRETE SEM CARRINHO]\n` +
        `Cliente perguntou sobre frete antes de escolher um produto. ` +
        `Ação: dizer em UMA linha que o frete depende do produto + CEP, ` +
        `e oferecer ajuda para escolher o produto da família/objetivo dele. ` +
        `Não cair em pergunta de descoberta genérica.\n`,
    };
  }

  // ── Reflexo 3: Pergunta de pós-venda ────────────────────
  const isPostSale =
    input.tprIsSupportTopic === true || POST_SALE_REGEX.test(text);
  if (isPostSale) {
    return {
      reflexId: "post_sale_question",
      newState: "support",
      reason: "post_sale_topic_detected",
      promptBlock:
        `\n[REFLEXO — PÓS-VENDA]\n` +
        `Cliente está falando sobre um pedido JÁ FEITO (rastreio, entrega, ` +
        `status). Ação obrigatória: tratar como suporte pós-venda. Pedir os ` +
        `dados de identificação do pedido (e-mail/CPF/número) em UMA mensagem ` +
        `curta. Proibido responder com pergunta de descoberta de venda ou ` +
        `oferta de produto novo.\n`,
    };
  }

  // ── Reflexo 4: Turno curto + intent classificado ────────
  const tokens = tokenCount(text);
  const intent = input.turnIntent;
  const stateLandedOnEarly =
    input.state === "greeting" || input.state === "discovery";
  const intentSignalsPurchase =
    intent === "purchase_intent" ||
    intent === "product_named" ||
    intent === "family_or_objective_query";

  if (tokens <= 4 && stateLandedOnEarly && intentSignalsPurchase) {
    const targetState: PipelineState =
      intent === "product_named" && input.lastFocusedProductName
        ? "product_detail"
        : "recommendation";
    return {
      reflexId: "short_turn_with_intent",
      newState: targetState,
      reason: `short_turn_intent_${intent}`,
      promptBlock:
        `\n[REFLEXO — TURNO CURTO COM INTENÇÃO CLARA]\n` +
        `Turno curto (${tokens} palavras) com intenção classificada como ` +
        `"${intent}". Proibido responder com "Me conta o que você precisa" ` +
        `ou pergunta de descoberta ampla. Ação: consumir o sinal — ` +
        `${
          targetState === "product_detail"
            ? "falar do produto em foco e oferecer próximo passo (variantes/quantidade)."
            : "apresentar até 3 opções da família/objetivo declarado e pedir 1 qualificação curta."
        }\n`,
    };
  }

  return null;
}
