// =============================================
// SYNTHETIC MARKETPLACE EMAIL — Display helper
// =============================================
// Marketplaces (Mercado Livre, Shopee, TikTok Shop) nem sempre expõem
// o e-mail real do comprador. Quando não vem, o sync cria um placeholder
// `meli-{orderId}@marketplace.local` para satisfazer a coluna NOT NULL
// `customers.email` — sem fabricar dado real (regra
// `mem://constraints/sistema-nunca-preenche-dado-faltante-do-cliente`).
//
// A UI nunca deve mostrar esse placeholder. Use os helpers abaixo.

const SYNTHETIC_DOMAINS = [
  "@marketplace.local",
  "@shopee.user",
  "@tiktok.user",
];

export function isSyntheticMarketplaceEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return true;
  return SYNTHETIC_DOMAINS.some((d) => normalized.endsWith(d));
}

/** Texto a exibir no lugar do e-mail quando ele for sintético/vazio. */
export const SYNTHETIC_EMAIL_LABEL = "Sem e-mail informado";

/**
 * Retorna o e-mail para renderizar em UI. Devolve `SYNTHETIC_EMAIL_LABEL`
 * quando o valor é um placeholder de marketplace ou vazio.
 */
export function displayCustomerEmail(email: string | null | undefined): string {
  return isSyntheticMarketplaceEmail(email) ? SYNTHETIC_EMAIL_LABEL : String(email);
}
