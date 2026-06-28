/**
 * Coleta a "saúde" oficial de um anúncio do Mercado Livre (nota 0-100 + ações
 * pendentes) e persiste em `meli_listings.health_score / health_actions /
 * health_checked_at`. Não lança — é seguro chamar em fire-and-forget após
 * publish/update. Reaproveitado por edge functions (`meli-publish-listing`,
 * `meli-health-sync`) e futuras integrações multi-marketplace.
 */
export interface MeliHealthResult {
  score: number | null;
  actions: any[] | null;
  raw: any;
}

/**
 * Busca a ficha de saúde do item via API oficial do ML.
 * Endpoint usado: GET /items/{id}/health?include=actions
 */
export async function fetchMeliListingHealth(
  accessToken: string,
  meliItemId: string,
): Promise<MeliHealthResult | null> {
  try {
    const res = await fetch(
      `https://api.mercadolibre.com/items/${meliItemId}/health?include=actions`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok) {
      console.warn(
        `[meli-health] fetch ${meliItemId} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
      return null;
    }
    const data = await res.json();
    // Estrutura ML: { health: 0..1 (ou 0..100 dependendo da resposta), actions: [...] }
    let score: number | null = null;
    if (typeof data?.health === "number") {
      score = data.health <= 1 ? Math.round(data.health * 100) : Math.round(data.health);
    } else if (typeof data?.score === "number") {
      score = data.score <= 1 ? Math.round(data.score * 100) : Math.round(data.score);
    }
    const actions = Array.isArray(data?.actions) ? data.actions : null;
    return { score, actions, raw: data };
  } catch (err) {
    console.warn(`[meli-health] fetch failed for ${meliItemId}:`, err);
    return null;
  }
}

/**
 * Busca e persiste a saúde. Sempre retorna — silenciosamente — sem propagar
 * erro. Atualiza a coluna `health_checked_at` mesmo em caso de score nulo,
 * para garantir cadência conhecida da última tentativa.
 */
export async function fetchAndPersistMeliHealth(
  supabase: any,
  accessToken: string,
  listingId: string,
  meliItemId: string,
): Promise<MeliHealthResult | null> {
  const result = await fetchMeliListingHealth(accessToken, meliItemId);
  try {
    await supabase
      .from("meli_listings")
      .update({
        health_score: result?.score ?? null,
        health_actions: result?.actions ?? null,
        health_checked_at: new Date().toISOString(),
      })
      .eq("id", listingId);
  } catch (err) {
    console.warn(`[meli-health] persist failed for ${listingId}:`, err);
  }
  return result;
}
