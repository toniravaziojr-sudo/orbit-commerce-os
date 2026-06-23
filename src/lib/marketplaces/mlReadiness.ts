/**
 * Mercado Livre — Cadastro como Fonte Única (v1)
 *
 * Validação canônica de campos obrigatórios para publicar produto no
 * Mercado Livre. Mesma fonte usada em:
 *  - ProductForm (banner + bloqueio ao salvar edição)
 *  - ProductList (filtro "Incompletos para Mercado Livre" + contador)
 *  - MeliListingWizard (checagem silenciosa antes de publicar)
 *
 * Regra: estes campos passam a ser obrigatórios no cadastro do produto.
 * O motor de atributos do ML não chama IA para estes valores — todos
 * vêm direto do cadastro. Se faltar, bloqueia e direciona ao cadastro.
 */

export type MlMissingField =
  | "brand"
  | "gtin"
  | "model"
  | "weight"
  | "width"
  | "height"
  | "depth"
  | "universal_category_id"
  | "net_content"
  | "dermatologically_tested"
  | "hypoallergenic"
  | "cruelty_free"
  | "vegan"
  | "has_fragrance";

export interface MlMissingEntry {
  field: MlMissingField;
  label: string;
  hint?: string;
  /** âncora dentro do ProductForm (id da seção / tab a focar). */
  anchor?: string;
}

const LABELS: Record<MlMissingField, { label: string; hint: string; anchor?: string }> = {
  brand: { label: "Marca", hint: "Obrigatório para o Mercado Livre", anchor: "brand" },
  gtin: { label: "Código de barras (GTIN/EAN)", hint: "8 a 14 dígitos", anchor: "gtin" },
  model: { label: "Modelo", hint: 'Preencha ou clique em "Marcar como Genérico"', anchor: "model" },
  weight: { label: "Peso (g)", hint: "Obrigatório para frete e ML", anchor: "weight" },
  width: { label: "Largura (cm)", hint: "Obrigatório para frete e ML", anchor: "width" },
  height: { label: "Altura (cm)", hint: "Obrigatório para frete e ML", anchor: "height" },
  depth: { label: "Profundidade (cm)", hint: "Obrigatório para frete e ML", anchor: "depth" },
  universal_category_id: {
    label: "Categoria universal",
    hint: "Classifica o produto para os marketplaces",
    anchor: "universal_category_id",
  },
  net_content: {
    label: "Conteúdo líquido (valor + unidade)",
    hint: "Ex: 200 ml, 100 g, 1 un",
    anchor: "net_content_value",
  },
  dermatologically_tested: { label: "Dermatologicamente testado", hint: "Cosméticos", anchor: "dermatologically_tested" },
  hypoallergenic: { label: "Hipoalergênico", hint: "Cosméticos", anchor: "hypoallergenic" },
  cruelty_free: { label: "Cruelty free", hint: "Cosméticos", anchor: "cruelty_free" },
  vegan: { label: "Vegano", hint: "Cosméticos", anchor: "vegan" },
  has_fragrance: { label: "Tem fragrância", hint: "Cosméticos", anchor: "has_fragrance" },
};

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return !Number.isFinite(v) || v <= 0;
  return false;
};

const isEmptyChoice = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
};

// Marca consciente de "produto sem modelo específico". Persistido em products.model.
export const GENERIC_MODEL_VALUE = "Genérico";

export interface MlReadinessInput {
  brand?: string | null;
  gtin?: string | null;
  barcode?: string | null;
  model?: string | null;
  weight?: number | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  universal_category_id?: string | null;
  net_content_value?: number | null;
  net_content_unit?: string | null;
  regulatory_regime?: string | null;
  regulatory_category?: string | null;
  dermatologically_tested?: string | null;
  hypoallergenic?: string | null;
  cruelty_free?: string | null;
  vegan?: string | null;
  has_fragrance?: string | null;
}

export interface MlReadinessResult {
  ready: boolean;
  missing: MlMissingEntry[];
}

export function checkMlReadiness(p: MlReadinessInput | null | undefined): MlReadinessResult {
  const missing: MlMissingEntry[] = [];
  if (!p) return { ready: false, missing };

  const add = (field: MlMissingField) => {
    const meta = LABELS[field];
    missing.push({ field, label: meta.label, hint: meta.hint, anchor: meta.anchor });
  };

  if (isEmpty(p.brand)) add("brand");
  if (isEmpty(p.gtin) && isEmpty(p.barcode)) add("gtin");
  if (isEmpty(p.model)) add("model"); // "Genérico" conta como preenchido consciente
  if (isEmpty(p.weight)) add("weight");
  if (isEmpty(p.width)) add("width");
  if (isEmpty(p.height)) add("height");
  if (isEmpty(p.depth)) add("depth");
  if (isEmpty(p.universal_category_id)) add("universal_category_id");
  if (isEmpty(p.net_content_value) || isEmpty(p.net_content_unit)) add("net_content");

  const isCosmetic =
    p.regulatory_regime === "anvisa_cosmetic" || p.regulatory_category === "cosmetic_hair";
  if (isCosmetic) {
    if (isEmptyChoice(p.dermatologically_tested)) add("dermatologically_tested");
    if (isEmptyChoice(p.hypoallergenic)) add("hypoallergenic");
    if (isEmptyChoice(p.cruelty_free)) add("cruelty_free");
    if (isEmptyChoice(p.vegan)) add("vegan");
    if (isEmptyChoice(p.has_fragrance)) add("has_fragrance");
  }

  return { ready: missing.length === 0, missing };
}

export function formatMissingForToast(missing: MlMissingEntry[]): string {
  if (!missing.length) return "";
  return missing.map((m) => `• ${m.label}`).join("\n");
}
