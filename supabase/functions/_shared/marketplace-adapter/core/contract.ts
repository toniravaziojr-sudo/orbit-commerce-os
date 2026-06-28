/**
 * Camada Adaptadora de Marketplaces — contrato genérico (Onda C).
 *
 * Objetivo: padronizar a entrada/saída do motor que resolve atributos e
 * sanitiza payloads de qualquer marketplace (ML hoje; Shopee/TikTok no
 * futuro). Implementações específicas vivem em `_shared/marketplace-adapter/{slug}/`.
 *
 * Doc de referência: docs/especificacoes/marketplaces/_padrao-canonico-marketplaces.md
 */

export type MarketplaceSlug = "mercado_livre" | "shopee" | "tiktok_shop";

export interface AttributeSpec {
  id: string;
  name: string;
  value_type?: string;
  required?: boolean;
  tags?: Record<string, unknown>;
  values?: Array<{ id?: string; name?: string }>;
}

export interface ResolvedAttribute {
  id: string;
  name: string;
  value_id?: string | null;
  value_name?: string | null;
  values?: Array<{ id?: string; name?: string }>;
  source: "cadastro" | "memory" | "dictionary" | "ai" | "fallback" | "n_a";
  status: "ok" | "missing" | "not_applicable";
  required?: boolean;
}

export interface CoverageReport {
  coverage_pct: number;
  required_total: number;
  required_filled: number;
  missing_required: Array<{ id: string; name: string }>;
  sources: Partial<Record<ResolvedAttribute["source"], number>>;
}

export interface AdapterContext {
  tenant_id: string;
  product_id: string;
  category_id: string;
  marketplace: MarketplaceSlug;
}

export interface FriendlyError {
  message: string;
  bullets: string[];
}

/**
 * Toda implementação de marketplace deve expor humanizer + sanitizer ao mínimo.
 * O motor de resolução continua, por enquanto, dentro de cada Edge Function
 * (meli-resolve-attributes) — esta interface formaliza o ponto de extensão.
 */
export interface MarketplaceErrorHumanizer {
  humanize(raw: string, causes: unknown[]): string;
}
