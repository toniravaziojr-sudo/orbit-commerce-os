// =============================================================================
// guidelineResolver — Onda H.4.1 Fase 2
// Resolve diretrizes comerciais da plataforma a partir de Type + Function do
// produto. A categoria é INFERIDA por keyword matching simples (rápido,
// determinístico, sem custo de LLM). Quando não bate, devolve null e o motor
// de geração trata como "sem restrição categórica" (fallback aberto).
// =============================================================================

export interface ResolvedGuideline {
  platform: string;
  inferred_category: string;
  allowed_claims: string | null;
  prohibited_claims: string | null;
  sensitive_notes: string | null;
  required_disclaimers: string | null;
  source_url: string | null;
  last_verified_at: string;
}

// Heurística leve. Ordem importa — mais específico primeiro.
const KEYWORD_MAP: Array<{ category: string; needles: string[] }> = [
  { category: "suplemento", needles: ["suplement", "vitamin", "whey", "protein", "creatina", "colágen", "colagen", "termogên"] },
  { category: "cosmetico", needles: ["shampoo", "condicionador", "cosmét", "cosmet", "creme", "loção", "locao", "perfume", "maquia", "batom", "sérum", "serum", "hidratant", "protetor solar"] },
  { category: "moda", needles: ["camiseta", "vestido", "calça", "calca", "tênis", "tenis", "sapato", "moda", "roupa", "blusa", "jaqueta", "bolsa"] },
  { category: "eletronico", needles: ["eletrôn", "eletron", "fone", "celular", "smartphone", "notebook", "carregador", "cabo usb"] },
  { category: "pet", needles: ["ração", "racao", "pet", "cachorro", "gato", "coleira"] },
  { category: "alimento", needles: ["alimento", "snack", "barra de cere", "biscoito", "café", "cafe"] },
  { category: "infantil", needles: ["infantil", "criança", "crianca", "bebê", "bebe", "brinquedo"] },
];

export function inferCategory(productType: string | null, mainFunction: string | null): string | null {
  const haystack = `${productType ?? ""} ${mainFunction ?? ""}`.toLowerCase();
  if (!haystack.trim()) return null;
  for (const entry of KEYWORD_MAP) {
    if (entry.needles.some((n) => haystack.includes(n))) return entry.category;
  }
  return null;
}

export async function resolveGuidelinesForProduct(
  supabase: any,
  platforms: string[],
  productType: string | null,
  mainFunction: string | null,
): Promise<{ inferred_category: string | null; guidelines: ResolvedGuideline[] }> {
  const category = inferCategory(productType, mainFunction);
  if (!category) return { inferred_category: null, guidelines: [] };

  const { data, error } = await supabase
    .from("platform_commercial_guidelines")
    .select("platform, inferred_category, allowed_claims, prohibited_claims, sensitive_notes, required_disclaimers, source_url, last_verified_at")
    .in("platform", platforms)
    .eq("inferred_category", category)
    .eq("status", "active");

  if (error || !data) return { inferred_category: category, guidelines: [] };
  return { inferred_category: category, guidelines: data as ResolvedGuideline[] };
}
