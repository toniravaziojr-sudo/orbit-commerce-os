// ============================================================
// Frente D — Ficha Institucional do Tenant
//
// Consolida dados institucionais/comerciais conhecidos do tenant em
// um bloco de prompt determinístico, injetado APENAS quando o turno
// é institucional / política comercial / objeção. Defaults são
// conservadores: se um dado não está preenchido, a IA é instruída a
// NÃO inventar e oferecer humano.
//
// Fonte: ai_support_config.metadata.institutional_sheet (jsonb).
// Estrutura (todos os campos opcionais):
// {
//   delivery_coverage: string,        // cobertura/regiões/prazos
//   business_hours: string,           // horários de atendimento
//   payment_methods: string,          // formas e parcelamento
//   coupons_policy: string,           // política de cupom/desconto
//   guarantee_policy: string,         // garantia, troca e devolução
//   social_proof: string,             // prova social (avaliações, casos, mídia)
//   physical_store: string,           // endereço/ponto físico, se houver
//   contact_human: string,            // como pedir humano (telefone/horário)
//   notes: string                     // observações adicionais livres
// }
// ============================================================

export type InstitutionalSheet = Partial<{
  delivery_coverage: string;
  business_hours: string;
  payment_methods: string;
  coupons_policy: string;
  guarantee_policy: string;
  social_proof: string;
  physical_store: string;
  contact_human: string;
  notes: string;
}>;

export const INSTITUTIONAL_BUCKETS = new Set([
  "institutional",
  "commercial_policy",
  "objection",
]);

const FIELD_ORDER: Array<{ key: keyof InstitutionalSheet; label: string }> = [
  { key: "delivery_coverage", label: "Cobertura e prazos de entrega" },
  { key: "business_hours", label: "Horário de atendimento" },
  { key: "payment_methods", label: "Formas de pagamento e parcelamento" },
  { key: "coupons_policy", label: "Cupons e descontos" },
  { key: "guarantee_policy", label: "Garantia, troca e devolução" },
  { key: "social_proof", label: "Prova social" },
  { key: "physical_store", label: "Loja física" },
  { key: "contact_human", label: "Atendimento humano" },
  { key: "notes", label: "Observações" },
];

export interface InstitutionalBlockResult {
  promptBlock: string | null;
  reason: string;
  fieldsPresent: string[];
  fieldsMissing: string[];
}

function clean(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > 800 ? `${t.slice(0, 800)}…` : t;
}

export function buildInstitutionalBlock(input: {
  intentBucket: string | null | undefined;
  sheet: InstitutionalSheet | null | undefined;
}): InstitutionalBlockResult {
  const bucket = (input.intentBucket || "").toLowerCase();
  if (!INSTITUTIONAL_BUCKETS.has(bucket)) {
    return {
      promptBlock: null,
      reason: `bucket_not_eligible_${bucket || "null"}`,
      fieldsPresent: [],
      fieldsMissing: [],
    };
  }

  const sheet = input.sheet || {};
  const present: string[] = [];
  const missing: string[] = [];
  const lines: string[] = [];

  for (const { key, label } of FIELD_ORDER) {
    const v = clean((sheet as Record<string, unknown>)[key]);
    if (v) {
      present.push(String(key));
      lines.push(`- ${label}: ${v}`);
    } else {
      missing.push(String(key));
    }
  }

  // Mesmo sem dados, emite o bloco de regra dura (não inventar / oferecer
  // humano). Isso é mais importante do que esconder o bloco — evita que a
  // IA improvise frete, garantia ou política de cupom.
  const header =
    bucket === "objection"
      ? "[FICHA INSTITUCIONAL — uso em objeção comercial]"
      : bucket === "commercial_policy"
      ? "[FICHA INSTITUCIONAL — uso em pergunta de política comercial]"
      : "[FICHA INSTITUCIONAL — uso em pergunta institucional]";

  const rules = [
    "REGRAS DURAS:",
    "1. Use APENAS as informações listadas abaixo. Se algo não está listado, NÃO invente — diga que vai checar com um atendente humano e ofereça encaminhar.",
    "2. Em objeção, ancore o valor do produto combinando o(s) item(ns) discutido(s) com a ficha (ex.: garantia, prazo, prova social) — sem prometer condições não listadas.",
    "3. Não cite preço/desconto/frete específicos que não estejam nesta ficha.",
  ];

  if (lines.length === 0) {
    const block = [header, ...rules, "", "Dados disponíveis: NENHUM nesta ficha."].join("\n");
    return {
      promptBlock: block,
      reason: "bucket_eligible_sheet_empty",
      fieldsPresent: present,
      fieldsMissing: missing,
    };
  }

  const block = [header, ...rules, "", "Dados disponíveis:", ...lines].join("\n");
  return {
    promptBlock: block,
    reason: "bucket_eligible_with_data",
    fieldsPresent: present,
    fieldsMissing: missing,
  };
}

/** Lê a ficha do `ai_support_config.metadata.institutional_sheet`. */
export function extractInstitutionalSheetFromConfigMetadata(
  metadata: unknown,
): InstitutionalSheet | null {
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as Record<string, unknown>;
  const raw = meta.institutional_sheet;
  if (!raw || typeof raw !== "object") return null;
  return raw as InstitutionalSheet;
}
