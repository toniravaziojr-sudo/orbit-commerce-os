// ============================================================
// Pipeline F2 — Catalog Probe — Reg #2.8
//
// Quando o cliente declara DOR/OBJETIVO (calvície, queda, caspa,
// oleosidade, pós-banho), a IA precisa enxergar o TRATAMENTO INTEIRO
// disponível, não só a família que o cliente citou primeiro.
//
// Hoje: cliente diz "shampoo" no turno 1 → family_focus=shampoo →
// próxima search_products vê SÓ shampoos. Balm e Loção (que tratam a
// mesma dor) ficam invisíveis porque não casam com /shampoo/.
//
// Reg #2.8: quando TPR.should_broaden_catalog_for_pain=true, o
// `search_products` ignora o filtro estrito de family_focus e devolve
// 1 representante por FAMÍLIA dentro das categorias pain-match.
//
// Resultado para "shampoo pra calvície + tenho entrada":
//   - Shampoo Calvície Zero (família citada)
//   - Loção Pós-Banho Calvície Zero (categoria pain)
//   - Balm Pós-Banho Calvície Zero (categoria pain)
//   - Kit Banho Calvície Zero (kit oficial da linha)
// ============================================================

const FAMILY_NAME_PATTERNS: Record<string, RegExp> = {
  shampoo: /\bshampoo/i,
  condicionador: /\bcondicionador/i,
  creme: /\bcr[eê]me/i,
  locao: /\blo[çc][ãa]o|lotion\b/i,
  balm: /\bbalm/i,
  serum: /\bs[eé]rum/i,
  tonico: /\bt[ôo]nico/i,
  mascara: /\bm[áa]scara/i,
  gel: /\bgel\b/i,
  sabonete: /\bsabonete/i,
  kit: /\bkit\b/i,
  combo: /\bcombo\b/i,
  perfume: /\bperfume/i,
};

export function classifyProductFamily(name: string): string {
  const n = String(name || "");
  for (const [family, re] of Object.entries(FAMILY_NAME_PATTERNS)) {
    if (re.test(n)) return family;
  }
  return "other";
}

export interface BroadenInput {
  /** Pool já enriquecido vindo do search_products. */
  enriched: Array<{ id: string; name: string; is_kit?: boolean; match_reason?: string }>;
  /** Família que o cliente mencionou primeiro (pode ser null). */
  familyMentionedNow: string | null;
  /** Família com foco persistido (pode ser null). */
  familyFocus: string | null;
  /** Limit pedido pelo cliente (padrão 5). */
  limit: number;
}

export interface BroadenResult<T> {
  filtered: T[];
  reason: string;
  families_returned: string[];
}

/**
 * Quando o TPR sinaliza "should_broaden_catalog_for_pain", devolvemos
 * 1 representante por FAMÍLIA no pool, com prioridade para:
 *   1. família citada pelo cliente
 *   2. famílias com match_reason = "pain_match"
 *   3. kit (sempre incluído por último, se houver)
 *
 * Esta função NÃO consulta banco — opera sobre o pool já enriquecido.
 * É O(n) e determinística.
 */
export function broadenCatalogForPain<T extends { id: string; name: string; is_kit?: boolean; match_reason?: string }>(
  input: { enriched: T[]; familyMentionedNow: string | null; familyFocus: string | null; limit: number }
): BroadenResult<T> {
  const { enriched, familyMentionedNow, familyFocus, limit } = input;
  if (!enriched?.length) {
    return { filtered: [], reason: "empty_pool", families_returned: [] };
  }

  // Agrupa por família
  const byFamily = new Map<string, T[]>();
  for (const item of enriched) {
    const fam = classifyProductFamily(item.name);
    const list = byFamily.get(fam) || [];
    list.push(item);
    byFamily.set(fam, list);
  }

  // Dentro de cada família, prioriza pain_match e produto base (não-kit)
  const pickRepresentative = (list: T[]): T => {
    const sorted = [...list].sort((a, b) => {
      const aPain = a.match_reason === "pain_match" ? 1 : 0;
      const bPain = b.match_reason === "pain_match" ? 1 : 0;
      if (aPain !== bPain) return bPain - aPain;
      const aKit = a.is_kit ? 1 : 0;
      const bKit = b.is_kit ? 1 : 0;
      // Não-kit primeiro
      return aKit - bKit;
    });
    return sorted[0];
  };

  // Ordem das famílias na vitrine
  const familyOrder: string[] = [];
  // 1. Família citada/foco vai primeiro (se existir no pool)
  const preferred = familyMentionedNow || familyFocus;
  if (preferred && byFamily.has(preferred)) familyOrder.push(preferred);
  // 2. Demais famílias não-kit
  for (const fam of byFamily.keys()) {
    if (fam === preferred) continue;
    if (fam === "kit" || fam === "combo") continue;
    familyOrder.push(fam);
  }
  // 3. Kit/combo por último (a IA pode oferecer como upsell consciente)
  for (const fam of ["kit", "combo"]) {
    if (byFamily.has(fam) && !familyOrder.includes(fam)) familyOrder.push(fam);
  }

  const filtered: T[] = [];
  for (const fam of familyOrder) {
    if (filtered.length >= limit) break;
    const list = byFamily.get(fam) || [];
    if (!list.length) continue;
    filtered.push(pickRepresentative(list));
  }

  return {
    filtered,
    reason: "broadened_pain_one_per_family",
    families_returned: filtered.map((f) => classifyProductFamily(f.name)),
  };
}
