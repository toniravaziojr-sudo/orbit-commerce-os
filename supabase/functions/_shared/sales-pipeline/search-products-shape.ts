// Pipeline F2 — Normalizador do retorno de search_products.
//
// Contrato evolutivo:
//   • Formato LEGADO  : Array<ProductRow>
//   • Formato NOVO    : { items: Array<ProductRow>, family_shipping_summary?: FamilyShippingSummary }
//
// Toda leitura do retorno deve passar por `parseSearchProductsResult` para
// suportar ambos durante a transição. Quem produz hoje é o handler da tool
// `search_products` em `ai-support-chat/index.ts`. Quem consome:
//   1) `buildHumanFallbackFromTools` no próprio index (fallback humanizado)
//   2) Snapshots em `toolResultsThisTurn`
//   3) (futuro) qualquer outro consumidor que herde o snapshot
//
// Mantemos o normalizador no _shared para não duplicar regra.

export interface ProductRow {
  id: string;
  name: string;
  slug?: string | null;
  price?: number | null;
  compare_at_price?: number | null;
  stock?: number | null;
  image?: string | null;
  image_alt?: string | null;
  is_kit?: boolean;
  has_variants?: boolean;
  manage_stock?: boolean;
  allow_backorder?: boolean;
  free_shipping?: boolean;
  match_reason?: "pain_match" | "name_match" | string;
  // Quando o item é um pack/kit, esses campos descrevem a linha-base.
  base_product_id?: string | null;
  base_product_name?: string | null;
  pack_size?: number | null;
}

export interface FreeShippingOffer {
  id: string;
  name: string;
  price?: number | null;
  is_kit: boolean;
  pack_label?: string | null; // ex: "3x", "6x"
}

export interface FamilyShippingSummary {
  // Existe pelo menos um item NA MESMA LINHA com frete grátis?
  has_free_shipping_offers: boolean;
  // Resumo curto e literal pra IA citar sem inventar.
  free_shipping_offers: FreeShippingOffer[];
  // Itens da mesma linha que pagam frete (informativo).
  paid_shipping_offers: FreeShippingOffer[];
  // ID do produto-base da linha (usado p/ casar foco com a linha do summary).
  line_base_product_id?: string | null;
}

export interface SearchProductsResult {
  items: ProductRow[];
  family_shipping_summary?: FamilyShippingSummary;
}

/**
 * Aceita o retorno em qualquer um dos dois formatos e devolve o formato novo.
 * NUNCA lança — entrada inválida vira `{ items: [] }`.
 */
export function parseSearchProductsResult(input: unknown): SearchProductsResult {
  if (Array.isArray(input)) {
    return { items: input as ProductRow[] };
  }
  if (input && typeof input === "object" && Array.isArray((input as any).items)) {
    return {
      items: (input as any).items as ProductRow[],
      family_shipping_summary: (input as any).family_shipping_summary,
    };
  }
  return { items: [] };
}

/**
 * Detecta o "produto-base" de uma linha de packs.
 * Recebe rows enriquecidos + um mapa pack→base resolvido via product_components.
 * Retorna `pack_label` curto (ex.: "2x") inferido pelo nome OU pela quantidade.
 */
export function inferPackLabel(name: string | null | undefined, packSize: number | null | undefined): string | null {
  if (typeof packSize === "number" && packSize >= 2) return `${packSize}x`;
  const m = String(name || "").match(/\(?\s*(\d+)\s*x\s*\)?/i);
  if (m) return `${m[1]}x`;
  return null;
}
