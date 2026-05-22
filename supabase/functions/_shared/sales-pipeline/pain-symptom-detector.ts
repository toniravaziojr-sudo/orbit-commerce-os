// ============================================================
// Pipeline F2 — Pain Symptom vs Order Complaint detector (Reg #2.17 — Fase 1)
//
// Separa dois sinais que historicamente caíam ambos como "complaint":
//   - is_product_pain_symptom: dor/sintoma físico que o catálogo trata
//     (queda de cabelo, ressecamento, caspa, coceira, oleosidade, calvície,
//     coroa ralinha, entradas, etc.). É SEMPRE oportunidade comercial e
//     NUNCA dispara handoff humano.
//   - is_order_complaint: reclamação real de pedido/entrega/atendimento/
//     produto já comprado. Caminho legítimo de handoff humano.
//
// Heurística determinística (regex) intencional: serve como veto de
// segurança DEPOIS do classificador de intenção. Se o classificador
// rotulou como "complaint" mas o detector identifica dor pura, o
// handoff comercial é vetado.
//
// Doc: docs/especificacoes/ia/modo-vendas-whatsapp.md
// ============================================================

export interface PainSymptomSignal {
  isProductPainSymptom: boolean;
  isOrderComplaint: boolean;
  matchedPainTerms: string[];
  matchedComplaintTerms: string[];
}

// Sintomas físicos / dores que o catálogo trata.
// Foco: cabelo/pele/barba/saúde estética — domínio típico de e-commerce de cosmético.
// Mantemos genérico o bastante para não exigir mapa por tenant.
const PAIN_SYMPTOM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bcalv[íi]cie\b/i, label: "calvicie" },
  { re: /\bcalvo\b/i, label: "calvo" },
  { re: /\bquedas?\s+(de\s+)?cabelo\b/i, label: "queda_cabelo" },
  { re: /\bcabelo\s+caindo\b/i, label: "cabelo_caindo" },
  { re: /\bca[ií]ndo\s+(o\s+)?cabelo\b/i, label: "caindo_cabelo" },
  { re: /\bcaspa\b/i, label: "caspa" },
  { re: /\bseborr[eé]ica?\b/i, label: "seborreia" },
  { re: /\bco[çc]eira\b/i, label: "coceira" },
  { re: /\bco[çc]ando\b/i, label: "cocando" },
  { re: /\bressecad[oa]s?\b/i, label: "ressecado" },
  { re: /\bressecamento\b/i, label: "ressecamento" },
  { re: /\boleos[ao]s?\b/i, label: "oleoso" },
  { re: /\boleosidade\b/i, label: "oleosidade" },
  { re: /\bcoroa\s+(ral|fina|aberta)/i, label: "coroa_ralinha" },
  { re: /\bentradas?\b/i, label: "entradas" },
  { re: /\bafinad[oa]\b/i, label: "afinado" },
  { re: /\bquebradi[çc]o\b/i, label: "quebradico" },
  { re: /\bpontas\s+duplas\b/i, label: "pontas_duplas" },
  { re: /\bfrizz\b/i, label: "frizz" },
  { re: /\bacne\b/i, label: "acne" },
  { re: /\bespinhas?\b/i, label: "espinha" },
  { re: /\bcravos?\b/i, label: "cravo" },
  { re: /\bbarba\s+(falhada|falhas|rala|fraca)/i, label: "barba_falhada" },
];

// Reclamações reais de pedido/serviço (caminho legítimo de handoff).
const ORDER_COMPLAINT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bn[ãa]o\s+(chegou|recebi|veio)\b/i, label: "nao_chegou" },
  { re: /\batras(ad[oa]|ou|ando)\b/i, label: "atrasado" },
  { re: /\bextrav(iad[oa]|io)\b/i, label: "extraviado" },
  { re: /\bcancel(ar|amento|a o pedido)\b/i, label: "cancelar_pedido" },
  { re: /\breembols(o|ar)\b/i, label: "reembolso" },
  { re: /\bestorn(o|ar)\b/i, label: "estorno" },
  { re: /\bdevolu[çc][ãa]o\b/i, label: "devolucao" },
  { re: /\btroca\s+(do|da|de)\s+(produto|pedido)/i, label: "troca_pedido" },
  { re: /\bdefeit(o|uoso)\b/i, label: "defeito" },
  { re: /\bquebrad[oa]\s+(na\s+)?(entrega|caixa)/i, label: "produto_quebrado" },
  { re: /\bproduto\s+errad[oa]\b/i, label: "produto_errado" },
  { re: /\bn[ãa]o\s+funciona\b/i, label: "nao_funciona" },
  { re: /\bchargeback\b/i, label: "chargeback" },
  { re: /\brastreio\b/i, label: "rastreio" },
  { re: /\bn[uú]mero\s+do\s+pedido\b/i, label: "numero_pedido" },
  { re: /\bcomprei\s+e\b/i, label: "comprei_e" },
  { re: /\bj[áa]\s+paguei\b/i, label: "ja_paguei" },
  { re: /\bprocon\b/i, label: "procon" },
  { re: /\breclam(e|a[çc][ãa]o|ar|o aqui)\b/i, label: "reclamacao_explicita" },
  { re: /\babsurd[oa]\b/i, label: "absurdo" },
  { re: /\bp[eé]ssim[oa]\s+atendimento\b/i, label: "pessimo_atendimento" },
];

export function detectProductPainSymptom(message: string): PainSymptomSignal {
  const text = (message || "").trim();
  if (!text) {
    return {
      isProductPainSymptom: false,
      isOrderComplaint: false,
      matchedPainTerms: [],
      matchedComplaintTerms: [],
    };
  }

  const matchedPainTerms: string[] = [];
  for (const { re, label } of PAIN_SYMPTOM_PATTERNS) {
    if (re.test(text)) matchedPainTerms.push(label);
  }

  const matchedComplaintTerms: string[] = [];
  for (const { re, label } of ORDER_COMPLAINT_PATTERNS) {
    if (re.test(text)) matchedComplaintTerms.push(label);
  }

  return {
    isProductPainSymptom: matchedPainTerms.length > 0,
    isOrderComplaint: matchedComplaintTerms.length > 0,
    matchedPainTerms,
    matchedComplaintTerms,
  };
}

/**
 * Veto comercial: dada a intenção do classificador e o sinal determinístico,
 * informa se um handoff por "complaint/urgência" deve ser BLOQUEADO porque
 * na verdade é dor física do cliente (oportunidade de venda).
 *
 * Regra:
 *   - Se houver ORDER_COMPLAINT explícito → não veta (handoff legítimo).
 *   - Se intent=purchase_intent → veta sempre (cliente quer comprar).
 *   - Se for dor pura sem reclamação de pedido → veta.
 */
export function shouldVetoComplaintHandoff(params: {
  intent?: string | null;
  signal: PainSymptomSignal;
}): { veto: boolean; reason: string } {
  const { intent, signal } = params;

  if (signal.isOrderComplaint) {
    return { veto: false, reason: "order_complaint_present" };
  }

  if (intent === "purchase_intent") {
    return { veto: true, reason: "purchase_intent_overrides_complaint" };
  }

  if (signal.isProductPainSymptom) {
    return { veto: true, reason: "product_pain_symptom_not_complaint" };
  }

  return { veto: false, reason: "no_signal" };
}
