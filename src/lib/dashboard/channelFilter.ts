// =============================================
// CHANNEL FILTER — Fonte única de verdade da segmentação por canal
// usada pelo Dashboard da Central de Comando e pelo Preview de Vendas.
// =============================================

export type ChannelFilter =
  | "all"          // Geral: loja + todos marketplaces
  | "storefront"   // Loja Virtual (pedidos com sales_channel = storefront)
  | "mercadolivre"
  | "shopee"
  | "tiktok_shop";

/**
 * Aplica o filtro de canal a um query builder de orders já parcialmente montado.
 * - all: não filtra
 * - storefront: sales_channel = 'storefront'
 * - marketplace: marketplace_source = '<chave>'
 */
export function applyChannelFilter<T extends { eq: (col: string, val: any) => T }>(
  query: T,
  channel: ChannelFilter,
): T {
  if (channel === "all") return query;
  if (channel === "storefront") return query.eq("sales_channel", "storefront");
  // marketplace específico
  return query.eq("marketplace_source", channel);
}

/**
 * Marketplaces nunca somam investimento em anúncios (pendente — Em breve).
 * Apenas Geral e Loja Virtual exibem investimento real das plataformas.
 */
export function channelIncludesAds(channel: ChannelFilter): boolean {
  return channel === "all" || channel === "storefront";
}

export function channelLabel(channel: ChannelFilter): string {
  switch (channel) {
    case "all": return "Geral";
    case "storefront": return "Loja Virtual";
    case "mercadolivre": return "Mercado Livre";
    case "shopee": return "Shopee";
    case "tiktok_shop": return "TikTok Shop";
  }
}
