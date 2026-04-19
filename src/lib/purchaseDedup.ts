// =============================================
// PURCHASE EVENT DEDUPLICATION (CLIENT-SIDE)
// Persistent guard: same Purchase event must not fire twice
// for the same order on the same device within 30 days.
// =============================================
// This protects against re-fires when the user reopens the
// thank-you link, navigates back, refreshes, or shares it.
// Server-side dedup (event_id) on Meta complements this.
// =============================================

const STORAGE_KEY_PREFIX = 'sf_purchase_fired_';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface DedupRecord {
  firedAt: string; // ISO timestamp
  eventId: string;
}

/**
 * Build the storage key for a tenant + order pair.
 * Order number is normalized (digits only, lowercase) for stability.
 */
function buildKey(tenantId: string, orderNumber: string): string {
  const cleanOrder = String(orderNumber).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const cleanTenant = String(tenantId).replace(/[^a-z0-9-]/gi, '').toLowerCase();
  return `${STORAGE_KEY_PREFIX}${cleanTenant}_${cleanOrder}`;
}

/**
 * Returns true if a Purchase event was already fired for this
 * tenant+order on this device within the TTL window.
 */
export function hasPurchaseAlreadyFired(tenantId: string, orderNumber: string): boolean {
  if (typeof window === 'undefined' || !tenantId || !orderNumber) return false;

  try {
    const raw = localStorage.getItem(buildKey(tenantId, orderNumber));
    if (!raw) return false;

    const record = JSON.parse(raw) as DedupRecord;
    const firedAt = new Date(record.firedAt).getTime();
    if (Number.isNaN(firedAt)) return false;

    const ageMs = Date.now() - firedAt;
    if (ageMs > TTL_MS) {
      // Expired — clean up and allow re-fire
      localStorage.removeItem(buildKey(tenantId, orderNumber));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark the Purchase event as fired for this tenant+order.
 * Idempotent — safe to call multiple times.
 */
export function markPurchaseAsFired(tenantId: string, orderNumber: string, eventId: string): void {
  if (typeof window === 'undefined' || !tenantId || !orderNumber) return;

  try {
    const record: DedupRecord = {
      firedAt: new Date().toISOString(),
      eventId,
    };
    localStorage.setItem(buildKey(tenantId, orderNumber), JSON.stringify(record));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/**
 * Sweep expired dedup records from localStorage.
 * Run on app boot (best-effort, non-blocking).
 */
export function cleanupExpiredPurchaseDedup(): void {
  if (typeof window === 'undefined') return;

  try {
    const now = Date.now();
    const toRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const record = JSON.parse(raw) as DedupRecord;
        const firedAt = new Date(record.firedAt).getTime();
        if (Number.isNaN(firedAt) || now - firedAt > TTL_MS) {
          toRemove.push(key);
        }
      } catch {
        toRemove.push(key); // malformed → drop
      }
    }

    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
