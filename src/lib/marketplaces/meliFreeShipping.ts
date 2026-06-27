/**
 * Mercado Livre — Frete Grátis Obrigatório
 *
 * O Mercado Livre Brasil aplica frete grátis OBRIGATÓRIO em todo anúncio
 * cujo preço seja igual ou superior a R$ 79. O custo é assumido pelo vendedor.
 * Vigente desde 2019, estável.
 *
 * Esta constante é a fonte única usada por:
 *  - UI do diálogo (MeliListingCreator, MeliListingWizard) — bloqueia o toggle.
 *  - Edge `meli-publish-listing` — força `shipping.free_shipping = true` no payload.
 *  - Edge `meli-sync-listings` / `meli-webhook` — loga divergência se o ML
 *    aplicar frete grátis em preço abaixo do piso (sinal de que mudou).
 *
 * Detecção passiva: se o ML devolver `free_shipping=true` em um anúncio
 * com `price < MELI_FREE_SHIPPING_THRESHOLD_BRL`, registramos o evento
 * em log para revisão manual do piso — sem cron novo.
 *
 * Doc canônica: docs/especificacoes/marketplaces/mercado-livre.md
 */
export const MELI_FREE_SHIPPING_THRESHOLD_BRL = 79;

export function isMeliFreeShippingMandatory(price: number | null | undefined): boolean {
  const p = Number(price);
  return Number.isFinite(p) && p >= MELI_FREE_SHIPPING_THRESHOLD_BRL;
}
