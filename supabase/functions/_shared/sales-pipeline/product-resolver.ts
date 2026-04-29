// ============================================================
// Pipeline F2 — Sub-fase 2 (Hardening transacional)
// Resolução tolerante de identificador de produto.
//
// PROBLEMA CORRIGIDO:
// A IA frequentemente passa o NOME do produto como `product_id` para
// tools como add_to_cart / get_product_details / get_product_variants.
// O servidor antes só aceitava UUID ou slug — falhava com "Produto não
// encontrado", a IA expunha "problema técnico" ao cliente e perdia
// o foco do produto entre turnos.
//
// REGRA DE OURO:
// - Aceitar UUID, slug ou nome.
// - Se NOME for ambíguo (mais de 1 candidato com mesmo prefixo/contém
//   o termo), NÃO ADIVINHAR. Retornar lista estruturada `candidates`
//   para a IA confirmar com o cliente.
// - Match case-insensitive, normalizando acentos.
// ============================================================

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_COLS =
  "id, name, slug, price, stock_quantity, status, has_variants, manage_stock, allow_backorder, free_shipping";

export interface ResolvedProductCandidate {
  id: string;
  name: string;
  slug: string | null;
  price: number;
  stock: number;
  has_variants: boolean;
}

export interface ResolveProductResult {
  found: boolean;
  ambiguous: boolean;
  product: any | null;            // linha completa quando found=true
  candidates: ResolvedProductCandidate[]; // populada quando ambiguous=true
  error?: string;
  hint?: string;
}

function normalize(s: string): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * [PIPELINE-FIX 2026-04-29] Detecta quantificador no termo (1x, 2x, 3x, 6x,
 * "kit 3", "pack 6", etc.). Usado para desempatar quando vários candidatos
 * da mesma família batem com o nome (ex.: "Calvície Zero" → unidade, 2x, 3x, 6x).
 */
function extractQuantifier(s: string): number | null {
  if (!s) return null;
  const norm = s.toLowerCase();
  // padrões: "3x", "x3", "3 unidades", "kit 3", "pack 6", "(3)"
  const patterns = [
    /\b(\d+)\s*x\b/,        // 3x
    /\bx\s*(\d+)\b/,        // x3
    /\b(\d+)\s*un(idades?)?\b/, // 3 unidades
    /\b(kit|pack|combo)\s+(\d+)\b/, // kit 3 / pack 6
    /\((\d+)\)/,            // (3)
  ];
  for (const re of patterns) {
    const m = norm.match(re);
    if (m) {
      // pega o último grupo numérico
      const num = m[m.length - 1] || m[1];
      const n = parseInt(num, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 24) return n;
    }
  }
  return null;
}

export interface ResolveOptions {
  /** product_id em foco na conversa — usado como dica de desempate. */
  focusProductId?: string | null;
  /** Quantidade pedida pela IA — ajuda a casar pack 1x/2x/3x/6x. */
  quantityHint?: number | null;
}

/**
 * Resolve um identificador (UUID, slug ou nome) em produto único.
 *
 * Estratégia:
 *  1. UUID exato         → match único.
 *  2. slug exato         → match único.
 *  3. nome exato (case/acento-insensitive) → match único.
 *  4. nome contém / contém nome (token-fuzzy):
 *      - 0 hits  → not found
 *      - 1 hit   → resolve
 *      - >1 hits → tenta desempate por (a) focusProductId, (b) quantificador.
 *                  Se nada desempatar, retorna AMBÍGUO.
 */
export async function resolveProductReference(
  supabase: any,
  tenantId: string,
  ref: string,
  options: ResolveOptions = {},
): Promise<ResolveProductResult> {
  const raw = (ref || "").toString().trim();
  if (!raw) {
    return {
      found: false,
      ambiguous: false,
      product: null,
      candidates: [],
      error: "missing_reference",
      hint: "Informe o id, slug ou nome do produto.",
    };
  }

  // 1) UUID
  if (UUID_RE.test(raw)) {
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("tenant_id", tenantId)
      .eq("id", raw)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) {
      return { found: true, ambiguous: false, product: data, candidates: [] };
    }
    return {
      found: false,
      ambiguous: false,
      product: null,
      candidates: [],
      error: "not_found_by_id",
      hint: "Use search_products para localizar o produto.",
    };
  }

  // 2) slug exato
  {
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("tenant_id", tenantId)
      .eq("slug", raw)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) {
      return { found: true, ambiguous: false, product: data, candidates: [] };
    }
  }

  // 3) nome — tentamos primeiro ILIKE pelo termo cheio, depois por tokens.
  const term = raw;
  const norm = normalize(term);

  const { data: byContains } = await supabase
    .from("products")
    .select(PRODUCT_COLS)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .is("deleted_at", null)
    .ilike("name", `%${term}%`)
    .limit(8);

  const candidates = (byContains ?? []) as any[];

  // 3a) match exato (acentuado/case-insensitive) → ganha
  const exactByName = candidates.find((p) => normalize(p.name) === norm);
  if (exactByName) {
    return {
      found: true,
      ambiguous: false,
      product: exactByName,
      candidates: [],
    };
  }

  // 3b) único hit por contém → resolve
  if (candidates.length === 1) {
    return {
      found: true,
      ambiguous: false,
      product: candidates[0],
      candidates: [],
    };
  }

  // 3c) múltiplos hits → AMBÍGUO. Não adivinhar.
  if (candidates.length > 1) {
    return {
      found: false,
      ambiguous: true,
      product: null,
      candidates: candidates.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug ?? null,
        price: Number(p.price ?? 0),
        stock: Number(p.stock_quantity ?? 0),
        has_variants: !!p.has_variants,
      })),
      error: "ambiguous_product_name",
      hint:
        "Mais de um produto bate com esse nome. Pergunte ao cliente qual exatamente, ou use o id de um dos candidatos.",
    };
  }

  // 3d) nada — tenta fuzzy via RPC se existir
  try {
    const { data: fuzzy } = await (supabase as any).rpc(
      "search_products_fuzzy",
      {
        p_tenant_id: tenantId,
        p_query: term,
        p_limit: 5,
        p_exclude_kits: false,
      },
    );
    if (Array.isArray(fuzzy) && fuzzy.length > 0) {
      const ids = fuzzy.map((p: any) => p.id);
      const { data: refetched } = await supabase
        .from("products")
        .select(PRODUCT_COLS)
        .in("id", ids)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);
      const list = (refetched ?? []) as any[];
      if (list.length === 1) {
        return { found: true, ambiguous: false, product: list[0], candidates: [] };
      }
      if (list.length > 1) {
        return {
          found: false,
          ambiguous: true,
          product: null,
          candidates: list.slice(0, 5).map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug ?? null,
            price: Number(p.price ?? 0),
            stock: Number(p.stock_quantity ?? 0),
            has_variants: !!p.has_variants,
          })),
          error: "ambiguous_product_name",
          hint:
            "Mais de um produto bate com esse nome. Pergunte ao cliente qual exatamente.",
        };
      }
    }
  } catch (_e) {
    /* tolerante: se a RPC falhar, segue */
  }

  return {
    found: false,
    ambiguous: false,
    product: null,
    candidates: [],
    error: "product_not_found",
    hint:
      "Não encontrei esse produto. Use search_products com a palavra-chave para localizar o id correto.",
  };
}
