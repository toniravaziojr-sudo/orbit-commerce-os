// =============================================================================
// Storefront public routes — fonte única (Onda H.2.4)
//
// Centraliza o padrão de rota pública do storefront da plataforma para uso por
// QUALQUER módulo backend que precise montar uma URL pública sem chamar o front.
//
// Hoje a plataforma tem um único storefront com rota canônica /produto/{slug}.
// Esta é a fonte de verdade — não duplicar a string em outros módulos.
//
// Override por tenant: ainda não há fonte segura de configuração por tenant.
// Quando existir, basta passar `overrideTemplate` para `buildPublicProductPath`
// — nenhum outro módulo precisará mudar.
// =============================================================================

/** Template padrão global da rota pública de produto no storefront da plataforma. */
export const STOREFRONT_PRODUCT_PATH_TEMPLATE = "/produto/{slug}";

/**
 * Monta o path público do produto a partir do slug.
 * - Usa `overrideTemplate` somente se vier explicitamente (futuro: per-tenant).
 * - Não inventa rota. Não chama IA. Não faz checagem HTTP.
 */
export function buildPublicProductPath(
  slug: string,
  overrideTemplate?: string | null,
): string | null {
  const s = (slug || "").trim();
  if (!s) return null;
  const template = (overrideTemplate && overrideTemplate.includes("{slug}"))
    ? overrideTemplate
    : STOREFRONT_PRODUCT_PATH_TEMPLATE;
  return template.replace("{slug}", s);
}
