// =====================================================================
// Onda G.2 — Identificação determinística de Produto em campanhas existentes.
//
// Sem IA, sem rede. Recebe sinais da campanha (nome, conjuntos, anúncios,
// URLs de destino, IDs de produto de criativos, copy) e o catálogo do
// tenant, e retorna o produto inferido com nível de confiança e fonte.
//
// Hierarquia das fontes (alto → baixo):
//   1) creative_product_id (match exato com id do catálogo) → high
//   2) URL slug do destino bate com slug/nome do catálogo     → high
//   3) Nome da campanha contém nome do produto                 → high/medium
//   4) Nome do conjunto contém nome do produto                 → medium
//   5) Nome do anúncio contém nome do produto                  → medium
//   6) Copy / headline contém nome do produto                  → low
//
// Quando confiança = low/unknown, o consumidor (Strategist) deve declarar
// limitação e proibir pausa automática como ação principal.
// =====================================================================

export type ProductIdConfidence = "high" | "medium" | "low" | "unknown";
export type ProductIdSource =
  | "campaign_name"
  | "adset_name"
  | "ad_name"
  | "url_slug"
  | "creative_product_id"
  | "creative_copy"
  | null;

export interface ProductRef {
  id: string;
  name: string;
  slug?: string | null;
}

export interface CampaignSignals {
  id: string;
  name?: string | null;
  adset_names?: string[];
  ad_names?: string[];
  destination_urls?: string[];
  copy_texts?: string[];
  creative_product_ids?: string[];
}

export interface InferredProduct {
  inferred_product_id: string | null;
  inferred_product_name: string | null;
  inferred_product_source: ProductIdSource;
  product_identification_confidence: ProductIdConfidence;
  diagnosis_limitation: string | null;
}

function norm(s: string | null | undefined): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 3),
  );
}

function nameMatchScore(signal: string, product: ProductRef): number {
  const sn = norm(signal);
  const pn = norm(product.name);
  if (!sn || !pn) return 0;
  if (sn.includes(pn)) return 1;
  const sToks = tokens(signal);
  const pToks = [...tokens(product.name)];
  if (pToks.length === 0) return 0;
  const hits = pToks.filter(t => sToks.has(t)).length;
  return hits / pToks.length;
}

function slugFromUrl(url: string): string {
  if (!url) return "";
  const path = url.split("?")[0].split("#")[0];
  const last = path.split("/").filter(Boolean).pop() || "";
  return last;
}

const NO_MATCH: InferredProduct = {
  inferred_product_id: null,
  inferred_product_name: null,
  inferred_product_source: null,
  product_identification_confidence: "unknown",
  diagnosis_limitation: "Nenhuma referência ao catálogo encontrada em nome, conjunto, anúncio, URL ou texto.",
};

export function identifyProductFromCampaign(
  campaign: CampaignSignals,
  catalog: ProductRef[],
): InferredProduct {
  if (!catalog || catalog.length === 0) {
    return {
      ...NO_MATCH,
      diagnosis_limitation: "Catálogo vazio — não foi possível identificar produto.",
    };
  }

  // 1) creative_product_id
  for (const pid of campaign.creative_product_ids || []) {
    const found = catalog.find(p => p.id === pid);
    if (found) {
      return {
        inferred_product_id: found.id,
        inferred_product_name: found.name,
        inferred_product_source: "creative_product_id",
        product_identification_confidence: "high",
        diagnosis_limitation: null,
      };
    }
  }

  // 2) URL slug
  for (const url of campaign.destination_urls || []) {
    const slug = norm(slugFromUrl(url));
    if (!slug) continue;
    const found = catalog.find(p => {
      const pslug = norm(p.slug || "");
      if (pslug && pslug === slug) return true;
      return norm(p.name).replace(/\s+/g, "-") === slug;
    });
    if (found) {
      return {
        inferred_product_id: found.id,
        inferred_product_name: found.name,
        inferred_product_source: "url_slug",
        product_identification_confidence: "high",
        diagnosis_limitation: null,
      };
    }
  }

  // 3..6) name-based matching
  const sources: Array<{ source: Exclude<ProductIdSource, null | "creative_product_id" | "url_slug">; signals: string[] }> = [
    { source: "campaign_name", signals: [campaign.name || ""] },
    { source: "adset_name", signals: campaign.adset_names || [] },
    { source: "ad_name", signals: campaign.ad_names || [] },
    { source: "creative_copy", signals: campaign.copy_texts || [] },
  ];

  let best: { product: ProductRef; score: number; source: Exclude<ProductIdSource, null> } | null = null;
  for (const { source, signals } of sources) {
    for (const sig of signals) {
      if (!sig) continue;
      for (const p of catalog) {
        const sc = nameMatchScore(sig, p);
        if (sc > 0 && (!best || sc > best.score)) {
          best = { product: p, score: sc, source };
        }
      }
    }
  }

  if (!best) return NO_MATCH;

  const isCopySource = best.source === "creative_copy";
  const confidence: ProductIdConfidence =
    best.score >= 0.99 ? "high" :
    best.score >= 0.6 ? (isCopySource ? "medium" : "high") :
    best.score >= 0.4 ? "medium" :
    "low";

  return {
    inferred_product_id: best.product.id,
    inferred_product_name: best.product.name,
    inferred_product_source: best.source,
    product_identification_confidence: confidence,
    diagnosis_limitation: confidence === "low"
      ? "Casamento parcial — confirme manualmente o produto desta campanha antes de pausar."
      : confidence === "medium"
      ? "Confiança média — produto inferido por texto, valide se necessário."
      : null,
  };
}

/** Quando true, o Strategist NÃO deve sugerir pausa automática como ação principal. */
export function blocksDestructiveActions(conf: ProductIdConfidence): boolean {
  return conf === "low" || conf === "unknown";
}
