// =============================================================================
// destinationResolver — Onda H.2.4 (Contrato Meta Vendas v1.1)
//
// Resolve o "Link de destino" de um anúncio planejado de forma determinística,
// sem chamar IA, sem chamar Meta, sem inventar URL.
//
// Prioridade (decidida pelo usuário):
//   1) URL explícita do próprio anúncio (ad override)
//   2) Landing/oferta vinculada — APENAS se for pública e segura
//   3) URL pública do produto/kit (se já vier resolvida da fonte)
//   4) Derivação `https://{domínio_primário_verificado}/produto/{slug}`
//      — só executa se houver domínio primário verificado E slug do produto
//
// Regras de segurança:
//   - Nunca usa URL não-https
//   - Nunca usa URL interna/admin/preview/checkout administrativo/localhost/lovable.app/supabase.co
//   - Nunca usa domínio não verificado
//   - Não usa URL fixa da conta Meta
//
// UTM template é tratado SEPARADAMENTE; este resolver devolve apenas a URL base.
// =============================================================================

export type DestinationSource =
  | "ad_override"
  | "landing"
  | "product_offer"
  | "domain_derived"
  | null;

export type DestinationPendingReason =
  | "store_public_domain_not_verified"
  | "product_offer_url_missing"
  | "landing_invalid_or_internal"
  | "no_product_or_offer_linked"
  | null;

export interface DestinationResolverInput {
  adExplicitUrl?: string | null;
  landingUrl?: string | null;
  productPublicUrl?: string | null;
  productSlug?: string | null;
  productName?: string | null;
  /** Apenas o domínio (sem protocolo, sem path). Ex.: "www.respeiteohomem.com.br" */
  tenantPrimaryVerifiedDomain?: string | null;
}

export interface DestinationResolverOutput {
  destination_url: string | null;
  destination_source: DestinationSource;
  destination_pending_reason: DestinationPendingReason;
}

const BANNED_URL_FRAGMENTS = [
  "localhost",
  "127.0.0.1",
  "lovable.app",
  "supabase.co",
  "vercel.app",
  "/admin",
  "/preview",
  "/checkout/admin",
  "?preview=",
  "?draft=",
];

const BANNED_DOMAIN_FRAGMENTS = [
  "localhost",
  "lovable.app",
  "supabase.co",
  "vercel.app",
];

export function sanitizePublicUrl(u: string | null | undefined): string | null {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (!s.toLowerCase().startsWith("https://")) return null;
  const lower = s.toLowerCase();
  if (BANNED_URL_FRAGMENTS.some((b) => lower.includes(b))) return null;
  return s;
}

export function sanitizeVerifiedDomain(d: string | null | undefined): string | null {
  if (!d || typeof d !== "string") return null;
  const s = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return null;
  if (BANNED_DOMAIN_FRAGMENTS.some((b) => s.includes(b))) return null;
  return s;
}

export function resolveDestination(input: DestinationResolverInput): DestinationResolverOutput {
  // 1) URL explícita do anúncio
  const adUrl = sanitizePublicUrl(input.adExplicitUrl);
  if (adUrl) {
    return { destination_url: adUrl, destination_source: "ad_override", destination_pending_reason: null };
  }

  // 2) Landing — só vale se pública e segura
  const landing = sanitizePublicUrl(input.landingUrl);
  if (landing) {
    return { destination_url: landing, destination_source: "landing", destination_pending_reason: null };
  }
  // Se veio uma landing mas falhou na sanitização, registramos o motivo claro.
  if (input.landingUrl && !landing) {
    // Continua a cascata — se houver produto/kit, ele será preferido.
    // Se nenhuma outra fonte resolver, devolveremos landing_invalid_or_internal.
  }

  // 3) URL pública do produto/kit já resolvida
  const product = sanitizePublicUrl(input.productPublicUrl);
  if (product) {
    return { destination_url: product, destination_source: "product_offer", destination_pending_reason: null };
  }

  // 4) Derivação por domínio verificado + slug
  const domain = sanitizeVerifiedDomain(input.tenantPrimaryVerifiedDomain);
  const slug = (input.productSlug || "").trim();

  if (slug) {
    if (!domain) {
      return {
        destination_url: null,
        destination_source: null,
        destination_pending_reason: "store_public_domain_not_verified",
      };
    }
    return {
      destination_url: `https://${domain}/produto/${slug}`,
      destination_source: "domain_derived",
      destination_pending_reason: null,
    };
  }

  // Sem nenhuma fonte utilizável
  if (input.landingUrl && !landing) {
    return {
      destination_url: null,
      destination_source: null,
      destination_pending_reason: "landing_invalid_or_internal",
    };
  }

  if (!input.productName && !input.productPublicUrl && !input.landingUrl && !slug) {
    return {
      destination_url: null,
      destination_source: null,
      destination_pending_reason: "no_product_or_offer_linked",
    };
  }

  return {
    destination_url: null,
    destination_source: null,
    destination_pending_reason: "product_offer_url_missing",
  };
}
