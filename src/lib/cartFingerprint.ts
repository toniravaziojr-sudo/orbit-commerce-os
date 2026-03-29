// ============================================
// CART FINGERPRINT - SHA-256 hash of cart items
// Used for shipping quote validation (Security Plan v3.1 Phase 2A)
// ============================================

/**
 * Generates a deterministic SHA-256 fingerprint of cart items.
 * Used to validate that the cart hasn't changed between quote and checkout.
 * 
 * Format: sorted array of {product_id, variant_id, quantity} → JSON → SHA-256 hex
 */
export async function generateCartFingerprint(
  items: Array<{ product_id: string; variant_id?: string; quantity: number }>
): Promise<string> {
  // Sort by product_id + variant_id for determinism
  const normalized = items
    .map(item => ({
      p: item.product_id,
      v: item.variant_id || '',
      q: item.quantity,
    }))
    .sort((a, b) => {
      const keyA = `${a.p}:${a.v}`;
      const keyB = `${b.p}:${b.v}`;
      return keyA.localeCompare(keyB);
    });

  const payload = JSON.stringify(normalized);
  
  // Use Web Crypto API (available in both browser and Deno)
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}