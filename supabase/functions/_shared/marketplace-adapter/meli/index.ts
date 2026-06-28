/**
 * Façade do adaptador Mercado Livre (Onda C).
 * Re-exporta as peças compartilhadas. A medida que as outras Edge Functions
 * (resolve-attributes, publish-listing, bulk-operations) forem migradas para
 * importar daqui, removemos as duplicações locais.
 */
export { humanizeMeliError, prettyAttrName, meliErrorHumanizer } from "./error-humanizer.ts";
export { getMeliCategorySpec } from "../../meli/category-spec.ts";
export { fetchAndPersistMeliHealth, fetchMeliListingHealth } from "../../meli/health.ts";
export const MELI_ADAPTER_VERSION = "v1.0.0";
