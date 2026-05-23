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
  input: { enriched: T[]; familyMentionedNow: string | null; familyFocus: string | null; limit: number; classifier?: (name: string) => string }
): BroadenResult<T> {
  const classify = input.classifier ?? classifyProductFamily;
  const { enriched, familyMentionedNow, familyFocus, limit } = input;
  if (!enriched?.length) {
    return { filtered: [], reason: "empty_pool", families_returned: [] };
  }

  // Agrupa por família
  const byFamily = new Map<string, T[]>();
  for (const item of enriched) {
    const fam = classify(item.name);
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

// ============================================================
// Onda 18 — Fase A: enforceFamilyBaseFirst
//
// Problema: consultas como "tem alguma loção pra crescer cabelo?"
// podem ranquear kits/packs antes de produtos-base, escondendo a loção
// unitária real. O ranking atual (exact-match + pain_match) NÃO sabe
// distinguir "kit de quantidade" (2x, 3x, 6x do mesmo produto) de
// "kit complementar" (combina produtos diferentes), e às vezes empurra
// um pack pra cima da base.
//
// Esta função roda APENAS atrás da flag arch18_catalog_base_forced
// (decisão Fase A), DEPOIS do enrichment e ANTES do limit final.
//
// Regras (alinhadas com a decisão do produto):
//  1. Particiona em: bases_pain, bases_outras, kits_complementares, kits_quantidade.
//     - "kit complementar"  = pack com ≥2 component_product_ids distintos.
//     - "kit de quantidade" = pack com 1 component_product_id (Nx do mesmo).
//  2. Quando há família detectada e há ≥1 base elegível:
//     - TODAS as bases relevantes vêm primeiro (pain primeiro, depois outras).
//     - Kits complementares vêm depois (secundário, opcional).
//     - Kits de quantidade NÃO entram na vitrine inicial.
//  3. Quando não há base elegível, devolve a lista original (fail-safe).
//  4. Função pura: NÃO consulta banco. Quem chama deve passar `kitComponentMap`
//     resolvido (parent_product_id → array de component_product_ids).
// ============================================================

export type KitClass = "complementary" | "quantity" | "not_a_kit";

export interface BaseFirstInput<T extends { id: string; name: string; is_kit?: boolean; match_reason?: string }> {
  /** Pool já enriquecido (após enrichList). */
  enriched: T[];
  /** Família detectada por regex no input do turno (pode ser null). */
  familyDetected: string | null;
  /**
   * Mapa parent_product_id → array de component_product_ids únicos.
   * Permite classificar kit como complementar (≥2 components distintos)
   * vs kit de quantidade (1 component repetido). Quem chama resolve via DB.
   */
  kitComponentMap: Map<string, string[]>;
  /** Limite comercial. */
  limit: number;
}

export interface BaseFirstResult<T> {
  filtered: T[];
  forced_base: boolean;
  reason: string;
  bases_pain_count: number;
  bases_outras_count: number;
  kits_complementary_count: number;
  kits_quantity_excluded_count: number;
}

export function classifyKit(
  productId: string,
  isKit: boolean,
  kitComponentMap: Map<string, string[]>
): KitClass {
  if (!isKit) return "not_a_kit";
  const comps = kitComponentMap.get(productId) || [];
  const distinct = new Set(comps);
  // 0 components conhecidos: trata como complementar conservador (não esconde).
  if (distinct.size === 0) return "complementary";
  if (distinct.size === 1) return "quantity";
  return "complementary";
}

export function enforceFamilyBaseFirst<T extends { id: string; name: string; is_kit?: boolean; match_reason?: string }>(
  input: BaseFirstInput<T>
): BaseFirstResult<T> {
  const { enriched, familyDetected, kitComponentMap, limit } = input;

  if (!enriched?.length) {
    return {
      filtered: [],
      forced_base: false,
      reason: "empty_pool",
      bases_pain_count: 0,
      bases_outras_count: 0,
      kits_complementary_count: 0,
      kits_quantity_excluded_count: 0,
    };
  }

  // Família efetiva: a detectada no input. Se vazia, tentamos inferir
  // pela maioria do pool (fallback raro — só pra não perder oportunidade).
  const familyOf = (name: string) => classifyProductFamily(name);
  const targetFamily =
    familyDetected ||
    (() => {
      const counts = new Map<string, number>();
      for (const it of enriched) {
        const f = familyOf(it.name);
        if (f === "other" || f === "kit" || f === "combo") continue;
        counts.set(f, (counts.get(f) || 0) + 1);
      }
      let best: string | null = null;
      let max = 0;
      for (const [f, c] of counts) {
        if (c > max) {
          max = c;
          best = f;
        }
      }
      return best;
    })();

  // Particiona
  const basesPain: T[] = [];
  const basesOutras: T[] = [];
  const kitsComplementary: T[] = [];
  let kitsQuantityExcluded = 0;

  for (const item of enriched) {
    const itemFamily = familyOf(item.name);
    const kitClass = classifyKit(item.id, !!item.is_kit, kitComponentMap);

    if (kitClass === "quantity") {
      // Kit de quantidade NÃO entra na vitrine inicial.
      kitsQuantityExcluded += 1;
      continue;
    }

    if (kitClass === "complementary") {
      // Só inclui se a família-alvo aparecer entre os components OU
      // se não houver família-alvo definida (deixa LLM oferecer kit misto).
      kitsComplementary.push(item);
      continue;
    }

    // não-kit (base)
    if (!targetFamily) {
      basesOutras.push(item);
      continue;
    }
    if (itemFamily !== targetFamily) {
      // Base de outra família — não entra (manteria comportamento de filtro estrito).
      continue;
    }

    if (item.match_reason === "pain_match") {
      basesPain.push(item);
    } else {
      basesOutras.push(item);
    }
  }

  const totalBases = basesPain.length + basesOutras.length;

  // Fail-safe: se não conseguimos isolar base relevante, devolve o original.
  // Isso protege casos em que o regex detectou família que não existe no pool.
  if (totalBases === 0) {
    return {
      filtered: enriched.slice(0, limit),
      forced_base: false,
      reason: targetFamily
        ? `no_base_for_family_${targetFamily}_keep_original`
        : "no_family_no_base_keep_original",
      bases_pain_count: 0,
      bases_outras_count: 0,
      kits_complementary_count: kitsComplementary.length,
      kits_quantity_excluded_count: kitsQuantityExcluded,
    };
  }

  // Ordem final: TODAS as bases pain → TODAS as bases outras → kits complementares.
  // Respeita o limit comercial.
  const ordered: T[] = [];
  for (const it of basesPain) {
    if (ordered.length >= limit) break;
    ordered.push(it);
  }
  for (const it of basesOutras) {
    if (ordered.length >= limit) break;
    ordered.push(it);
  }
  for (const it of kitsComplementary) {
    if (ordered.length >= limit) break;
    ordered.push(it);
  }

  return {
    filtered: ordered,
    forced_base: true,
    reason: `family_${targetFamily ?? "auto"}_base_first`,
    bases_pain_count: basesPain.length,
    bases_outras_count: basesOutras.length,
    kits_complementary_count: kitsComplementary.length,
    kits_quantity_excluded_count: kitsQuantityExcluded,
  };
}

// Detecta família mencionada no texto livre do cliente (input do turno).
// Reusa FAMILY_NAME_PATTERNS — determinístico, zero LLM.
export function detectFamilyInText(text: string): string | null {
  const t = String(text || "");
  for (const [family, re] of Object.entries(FAMILY_NAME_PATTERNS)) {
    // pula kit/combo: cliente que pede "kit" não está pedindo família-base.
    if (family === "kit" || family === "combo") continue;
    if (re.test(t)) return family;
  }
  return null;
}

// ============================================================
// Onda 3.3 (Reg #2.18) — Versões universais (segment-agnostic)
//
// Usam o vocabulário do tenant carregado pelo Resolver (Onda 1).
// Caller deve chamar `loadTenantVocabulary(tenantId)` UMA vez no
// início do turno para aquecer o cache. Aqui usamos `peek` síncrono
// para manter a assinatura compatível com `classifyProductFamily` /
// `detectFamilyInText` legados.
//
// Comportamento:
//  - Se o vocabulário do tenant estiver disponível, classifica via
//    longest-match contra os tokens do tenant (família + sinônimos +
//    aliases). Retorna a `family.key` estável do tenant.
//  - Se o vocabulário não estiver no cache (cold start) OU não houver
//    match, cai no detector legado como rede de segurança.
// ============================================================

import { peekTenantVocabularyFromCache, buildFamilyTokenSet, normalizeVocabularyKey } from "./tenant-vocabulary-resolver.ts";

function matchLongestFamilyToken(text: string, tokenMap: Map<string, string>): string | null {
  if (!text || tokenMap.size === 0) return null;
  const normalized = normalizeVocabularyKey(text);
  if (!normalized) return null;
  // Ordena tokens por tamanho desc para garantir longest-match
  const tokens = [...tokenMap.keys()].sort((a, b) => b.length - a.length);
  for (const tok of tokens) {
    if (!tok) continue;
    // boundary simples: começo, fim ou cercado por espaço
    const idx = normalized.indexOf(tok);
    if (idx < 0) continue;
    const before = idx === 0 ? " " : normalized[idx - 1];
    const after = idx + tok.length >= normalized.length ? " " : normalized[idx + tok.length];
    if (/[\s\-]/.test(before) && /[\s\-]/.test(after)) {
      return tokenMap.get(tok) ?? null;
    }
  }
  return null;
}

export function classifyProductFamilyUniversal(name: string, tenantId: string | null): string {
  const vocab = tenantId ? peekTenantVocabularyFromCache(tenantId) : null;
  if (vocab) {
    const tokenMap = buildFamilyTokenSet(vocab);
    const fam = matchLongestFamilyToken(name, tokenMap);
    if (fam) return fam;
  }
  // Fallback legado
  return classifyProductFamily(name);
}

export function detectFamilyInTextUniversal(text: string, tenantId: string | null): string | null {
  const vocab = tenantId ? peekTenantVocabularyFromCache(tenantId) : null;
  if (vocab) {
    const tokenMap = buildFamilyTokenSet(vocab);
    // remove kit/combo aqui também: cliente que pede "kit" não está pedindo família-base
    const filtered = new Map<string, string>();
    for (const [tok, key] of tokenMap) {
      if (key === "kit" || key === "combo") continue;
      filtered.set(tok, key);
    }
    const fam = matchLongestFamilyToken(text, filtered);
    if (fam) return fam;
  }
  // Fallback legado
  return detectFamilyInText(text);
}
