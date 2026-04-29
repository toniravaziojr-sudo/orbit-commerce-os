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
  const tag = `[enrich-order-context tenant=${tenantId} order=${orderId ?? 'none'}]`;

  // Tenant (store_name) — always try, even without orderId
  try {
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenantId)
      .maybeSingle();
    if (error) console.error(`${tag} tenant query error:`, error.message);
    const storeName = (tenant?.name ?? tenant?.slug ?? "").toString().trim();
    if (storeName) {
      out.store_name = storeName;
    } else {
      console.warn(`${tag} tenant resolved but store_name empty (name=${tenant?.name}, slug=${tenant?.slug})`);
    }
  } catch (err) {
    console.error(`${tag} tenant fetch threw:`, err instanceof Error ? err.message : err);
  }

  if (!orderId) {
    console.log(`${tag} no orderId — returning early with`, out);
    return out;
  }

  // Order header — fallback for order_number / order_total
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_number, total, customer_name")
      .eq("id", orderId)
      .maybeSingle();
    if (error) console.error(`${tag} order query error:`, error.message);
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
    } else {
      console.warn(`${tag} order not found in DB`);
    }
  } catch (err) {
    console.error(`${tag} order fetch threw:`, err instanceof Error ? err.message : err);
  }

  // Order items (product_names)
  try {
    const { data: items, error } = await supabase
      .from("order_items")
      .select("product_name, quantity")
      .eq("order_id", orderId);
    if (error) console.error(`${tag} items query error:`, error.message);
    const formatted = formatProductNames(items ?? []);
    if (formatted) {
      out.product_names = formatted;
    } else {
      console.warn(`${tag} order_items returned ${items?.length ?? 0} rows but product_names empty`);
    }
  } catch (err) {
    console.error(`${tag} items fetch threw:`, err instanceof Error ? err.message : err);
  }

  console.log(`${tag} resolved →`, out);
  return out;
}
