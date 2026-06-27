// Espelho server-side da constante de frete grátis obrigatório do ML.
// Mantenha sincronizado com src/lib/marketplaces/meliFreeShipping.ts.
export const MELI_FREE_SHIPPING_THRESHOLD_BRL = 79;

export function isMeliFreeShippingMandatory(price: number | null | undefined): boolean {
  const p = Number(price);
  return Number.isFinite(p) && p >= MELI_FREE_SHIPPING_THRESHOLD_BRL;
}
