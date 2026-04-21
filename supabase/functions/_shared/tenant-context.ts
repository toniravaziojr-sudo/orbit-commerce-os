// =============================================================
// Helper compartilhado: contexto tenant-aware da IA de atendimento
// =============================================================
// Centraliza:
//  - leitura/refresh do snapshot de negócio (tenant_ai_context_snapshot)
//  - formatação para injeção no system prompt
//  - seleção de produtos relevantes para a mensagem do cliente
//
// Princípios:
//  - Snapshot é a base obrigatória de grounding (substitui dependência exclusiva de KB)
//  - RAG/KB continua como camada aditiva quando existir
//  - Refresh é "stale + on-demand": se ausente ou stale, dispara build em background
// =============================================================

export interface TenantContextSnapshot {
  tenant_id: string;
  niche_label: string | null;
  niche_confidence: number | null;
  business_summary: Record<string, any>;
  top_categories: Array<{ name: string; product_count?: number }>;
  top_products: Array<{
    id: string;
    name: string;
    slug?: string;
    price?: number;
    category?: string;
    tags?: string[];
  }>;
  policies_summary: Record<string, any>;
  commercial_signals: Record<string, any>;
  is_stale: boolean;
  generated_at: string | null;
  expires_at: string | null;
}

const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/**
 * Lê o snapshot atual. Se ausente, stale ou expirado, retorna o que tem
 * (mesmo vazio) e dispara um rebuild em background. Para casos sem
 * NENHUM snapshot, força build síncrono curto (best-effort).
 */
export async function getOrBuildTenantContext(
  supabase: any,
  tenantId: string,
  options: { forceSyncIfMissing?: boolean } = {}
): Promise<TenantContextSnapshot | null> {
  const { data: existing } = await supabase
    .from("tenant_ai_context_snapshot")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const isExpired =
    existing?.generated_at &&
    Date.now() - new Date(existing.generated_at).getTime() > SNAPSHOT_TTL_MS;

  const needsRefresh =
    !existing || existing.is_stale || isExpired || !existing.niche_label;

  if (needsRefresh) {
    // Build em background (não bloqueia resposta)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const buildPromise = fetch(
        `${supabaseUrl}/functions/v1/tenant-context-build`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ tenant_id: tenantId }),
        }
      ).catch((err) => {
        console.error("[tenant-context] background build failed:", err);
      });

      // Se totalmente ausente e o caller quer forçar, espera o build curto
      if (!existing && options.forceSyncIfMissing) {
        try {
          await Promise.race([
            buildPromise,
            new Promise((resolve) => setTimeout(resolve, 8000)),
          ]);
          const { data: built } = await supabase
            .from("tenant_ai_context_snapshot")
            .select("*")
            .eq("tenant_id", tenantId)
            .maybeSingle();
          return built ?? null;
        } catch (err) {
          console.error("[tenant-context] sync build failed:", err);
        }
      }
    }
  }

  return (existing as TenantContextSnapshot) ?? null;
}

/**
 * Indica se o snapshot atual tem grounding suficiente para responder
 * sem depender exclusivamente da KB.
 */
export function hasEnoughGrounding(snapshot: TenantContextSnapshot | null): boolean {
  if (!snapshot) return false;
  const hasNiche = !!snapshot.niche_label && snapshot.niche_label.length > 2;
  const hasProducts = Array.isArray(snapshot.top_products) && snapshot.top_products.length >= 3;
  return hasNiche && hasProducts;
}

/**
 * Formata o snapshot como bloco de contexto para o system prompt.
 * Bloco compacto, sem ruído, focado em grounding.
 */
export function formatTenantContextForPrompt(
  snapshot: TenantContextSnapshot | null
): string {
  if (!snapshot) return "";

  const lines: string[] = [];
  lines.push("\n\n========================================");
  lines.push("🏪 CONTEXTO REAL DO NEGÓCIO (use como verdade absoluta)");
  lines.push("========================================");

  if (snapshot.niche_label) {
    lines.push(`Nicho: ${snapshot.niche_label}`);
  }

  const summary = snapshot.business_summary || {};
  if (summary.short_description) {
    lines.push(`Descrição: ${summary.short_description}`);
  }
  if (summary.value_proposition) {
    lines.push(`Proposta de valor: ${summary.value_proposition}`);
  }
  if (Array.isArray(summary.target_audience) && summary.target_audience.length) {
    lines.push(`Público-alvo: ${summary.target_audience.join(", ")}`);
  }

  if (Array.isArray(snapshot.top_categories) && snapshot.top_categories.length) {
    lines.push("\nCategorias ativas:");
    for (const cat of snapshot.top_categories.slice(0, 8)) {
      lines.push(`- ${cat.name}`);
    }
  }

  if (Array.isArray(snapshot.top_products) && snapshot.top_products.length) {
    lines.push("\nProdutos do catálogo (use APENAS estes ao recomendar):");
    for (const p of snapshot.top_products.slice(0, 15)) {
      const price = p.price ? ` — R$ ${Number(p.price).toFixed(2)}` : "";
      const cat = p.category ? ` [${p.category}]` : "";
      lines.push(`- ${p.name}${price}${cat}`);
    }
  }

  const policies = snapshot.policies_summary || {};
  const policyEntries = Object.entries(policies).filter(([, v]) => v);
  if (policyEntries.length) {
    lines.push("\nPolíticas principais:");
    for (const [key, value] of policyEntries) {
      lines.push(`- ${key}: ${value}`);
    }
  }

  const signals = snapshot.commercial_signals || {};
  if (signals.price_range) {
    lines.push(`\nFaixa de preço: ${signals.price_range}`);
  }
  if (signals.free_shipping_threshold) {
    lines.push(`Frete grátis acima de: R$ ${signals.free_shipping_threshold}`);
  }

  lines.push("");
  lines.push("REGRA CRÍTICA: nunca invente produtos, categorias ou políticas.");
  lines.push("Se a pergunta não puder ser respondida com este contexto + base de conhecimento, ofereça transferir para um atendente humano.");
  lines.push("========================================");

  return lines.join("\n");
}

/**
 * Seleciona produtos do snapshot que sejam relevantes à mensagem do cliente.
 * Busca textual leve por nome, categoria e tags. Não substitui a tool de
 * busca real do agente de vendas — é grounding aditivo no prompt.
 */
export function pickRelevantProducts(
  snapshot: TenantContextSnapshot | null,
  userMessage: string,
  limit = 8
): Array<{ name: string; price?: number; category?: string }> {
  if (!snapshot || !Array.isArray(snapshot.top_products)) return [];
  const normalized = (userMessage || "").toLowerCase();
  if (!normalized.trim()) return [];

  const tokens = normalized
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length >= 3);

  if (!tokens.length) return [];

  const scored = snapshot.top_products.map((p) => {
    const haystack = [
      p.name,
      p.category ?? "",
      ...(p.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    let score = 0;
    for (const tok of tokens) {
      if (haystack.includes(tok)) score += 1;
    }
    return { product: p, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      name: s.product.name,
      price: s.product.price,
      category: s.product.category,
    }));
}

/**
 * Formata produtos relevantes (recorte por mensagem) como bloco extra
 * para o system prompt. Só emite quando há matches.
 */
export function formatRelevantCatalogForPrompt(
  matches: ReturnType<typeof pickRelevantProducts>
): string {
  if (!matches.length) return "";
  const lines: string[] = [];
  lines.push("\n\n### Produtos relevantes para a pergunta do cliente:");
  for (const p of matches) {
    const price = p.price ? ` — R$ ${Number(p.price).toFixed(2)}` : "";
    const cat = p.category ? ` [${p.category}]` : "";
    lines.push(`- ${p.name}${price}${cat}`);
  }
  return lines.join("\n");
}
