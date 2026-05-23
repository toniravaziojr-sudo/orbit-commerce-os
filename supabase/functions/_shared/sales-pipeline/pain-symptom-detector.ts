// ============================================================
// Pipeline F2 — Order-complaint detector + commercial veto (Reg #2.17 — Fase 1, v2)
//
// LÓGICA UNIVERSAL DE VENDA (segment-agnostic):
//
// Historicamente o classificador de turno marcava como "complaint" tanto
// (a) reclamação real de pedido/entrega já comprado, quanto
// (b) qualquer cliente expressando um PROBLEMA/NECESSIDADE que o catálogo
//     pode resolver — em QUALQUER segmento (cosmético, pet, moda, eletrônico,
//     suplemento, software, etc.). O caminho (b) virava handoff prematuro
//     e perdia venda.
//
// A correção NÃO enumera sintomas por segmento (proibido por governança:
// motor-contexto-comercial.md). Em vez disso:
//
//   1. Detectamos APENAS sinais UNIVERSAIS de reclamação de pedido
//      (palavras de pós-venda: pedido, entrega, rastreio, reembolso,
//      devolução, defeito de entrega, etc.). Isso é universal porque
//      todo e-commerce tem pedido/entrega.
//
//   2. O veto comercial é derivado: se o classificador disse "complaint"
//      mas NÃO há sinal de pós-venda, é falso positivo — trate como
//      oportunidade comercial, independente do que o cliente descreveu.
//
// Assim a regra serve igualmente para "meu cabelo cai", "meu sapato aperta",
// "meu cachorro não come a ração", "meu controle não funciona" — sem
// hardcode por segmento.
// ============================================================

export interface PainSymptomSignal {
  /**
   * Mantido por compatibilidade com o handoff-motor.
   * Semântica nova: "o turno parece dor/necessidade comercial e NÃO é
   * reclamação de pedido". Calculado no veto, não aqui — aqui sempre false.
   * O motor consulta `isOrderComplaint` + intent para decidir.
   */
  isProductPainSymptom: boolean;
  isOrderComplaint: boolean;
  matchedPainTerms: string[];
  matchedComplaintTerms: string[];
}

// Reclamações reais de pedido/serviço (UNIVERSAL — todo e-commerce tem).
const ORDER_COMPLAINT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bmeu\s+pedido\b/i, label: "meu_pedido" },
  { re: /\bn[uú]mero\s+do\s+pedido\b/i, label: "numero_pedido" },
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

  const matchedComplaintTerms: string[] = [];
  for (const { re, label } of ORDER_COMPLAINT_PATTERNS) {
    if (re.test(text)) matchedComplaintTerms.push(label);
  }

  return {
    // Por design: não enumeramos sintomas por segmento.
    // O motor de handoff calcula a inferência via intent + ausência
    // de sinal de pós-venda.
    isProductPainSymptom: false,
    isOrderComplaint: matchedComplaintTerms.length > 0,
    matchedPainTerms: [],
    matchedComplaintTerms,
  };
}

/**
 * Veto comercial UNIVERSAL.
 *
 * Regra (segment-agnostic):
 *   - Se houver sinal explícito de reclamação de pedido → NÃO veta
 *     (handoff legítimo de pós-venda).
 *   - Se intent=purchase_intent → VETA sempre (cliente quer comprar,
 *     escalar é perda de venda).
 *   - Se classificador disse "complaint" mas não há sinal de pós-venda
 *     → VETA (falso positivo: é cliente expressando problema/necessidade
 *     que o catálogo resolve, em qualquer segmento).
 *   - Caso contrário → não veta.
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

  // Universal: classificador chamou de complaint mas não há sinal
  // de pós-venda → tratar como oportunidade comercial em qualquer segmento.
  if (intent === "complaint") {
    return { veto: true, reason: "complaint_without_order_signal_is_commercial" };
  }

  return { veto: false, reason: "no_signal" };
}
