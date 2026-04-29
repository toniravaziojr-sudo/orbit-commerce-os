// =============================================================
// Phase 4 — Enrich order/customer/store context for templates
// =============================================================
// Single source of truth for resolving template variables that
// the raw event payload does NOT carry (e.g. `product_names`,
// `store_name`). Called by `process-events` BEFORE rendering any
// notification template.
//
// Contract:
//   - Always returns a partial dict; never throws on missing data.
//   - All values returned are strings (already trimmed).
//   - Caller MUST merge as: { ...payloadVars, ...enrichedVars }
//     so DB-derived values WIN over raw event payload.
//
// Anti-regression: this helper is the ONLY place allowed to read
// `tenants.name` / `order_items.*` for the purpose of building
// notification template variables. See:
//   mem://constraints/notification-template-render-contract
// =============================================================

export interface EnrichedContext {
  store_name?: string;
  product_names?: string;
  customer_first_name?: string;
  order_number?: string;
  order_total?: string;
}

interface SupabaseLike {
  from: (table: string) => any;
}

/**
 * Build the canonical "Produto A (2x), Produto B (1x)" string.
 */
function formatProductNames(items: Array<{ product_name?: string | null; quantity?: number | null }>): string {
  if (!items?.length) return "";
  return items
    .filter((i) => (i.product_name ?? "").trim().length > 0)
    .map((i) => {
      const name = (i.product_name ?? "").trim();
      const qty = Number(i.quantity ?? 1);
      return qty > 1 ? `${name} (${qty}x)` : name;
    })
    .join(", ");
}

/**
 * Resolve enriched template variables for a given order/tenant.
 * Safe to call with null/undefined — returns {} when nothing can be resolved.
 */
export async function enrichOrderContext(
  supabase: SupabaseLike,
  tenantId: string,
  orderId: string | null,
): Promise<EnrichedContext> {
  const out: EnrichedContext = {};

  // Tenant (store_name) — always try, even without orderId
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenantId)
      .maybeSingle();
    const storeName = (tenant?.name ?? tenant?.slug ?? "").toString().trim();
    if (storeName) out.store_name = storeName;
  } catch (_err) {
    // swallow — enrichment is best-effort
  }

  if (!orderId) return out;

  // Order header — fallback for order_number / order_total
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("order_number, total, customer_name")
      .eq("id", orderId)
      .maybeSingle();
    if (order) {
      if (order.order_number != null && String(order.order_number).trim().length > 0) {
        out.order_number = String(order.order_number).trim();
      }
      if (order.total != null) {
        const totalNum = Number(order.total);
        if (!Number.isNaN(totalNum)) {
          out.order_total = totalNum.toFixed(2);
        }
      }
      const fullName = (order.customer_name ?? "").toString().trim();
      if (fullName) out.customer_first_name = fullName.split(/\s+/)[0];
    }
  } catch (_err) {
    // swallow
  }

  // Order items (product_names)
  try {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", orderId);
    const formatted = formatProductNames(items ?? []);
    if (formatted) out.product_names = formatted;
  } catch (_err) {
    // swallow
  }

  return out;
}
