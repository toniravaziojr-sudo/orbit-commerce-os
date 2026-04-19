// =============================================
// PURCHASE EVENT ID — SERVER-SIDE NORMALIZER
// Mirror of src/lib/marketingTracker.ts (browser).
// MUST stay byte-identical so Meta deduplicates browser↔server.
// =============================================

/**
 * Normalize an order identifier so the same order produces the same key,
 * regardless of formatting (#, spaces, dashes, casing).
 */
export function normalizeOrderIdForEventId(orderId: string): string {
  if (!orderId) return '';
  const stripped = String(orderId).replace(/[^a-z0-9]/gi, '');
  return (stripped || String(orderId)).toLowerCase();
}

/**
 * Build deterministic Purchase event_id.
 * Format: purchase_<mode>_<normalized_order_id>
 */
export function buildDeterministicPurchaseEventId(
  mode: 'all_orders' | 'paid_only',
  orderId: string
): string {
  const normalized = normalizeOrderIdForEventId(orderId);
  if (mode === 'paid_only') {
    return `purchase_paid_${normalized}`;
  }
  return `purchase_created_${normalized}`;
}
