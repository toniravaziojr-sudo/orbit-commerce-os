// ============================================
// CART FINGERPRINT (Server-side) - SHA-256 hash of cart items
// Mirror of src/lib/cartFingerprint.ts for Deno edge functions
// ============================================

/**
 * Generates a deterministic SHA-256 fingerprint of cart items.
 * Must produce identical output to the client-side version.
 */
export async function generateCartFingerprint(
  items: Array<{ product_id: string; variant_id?: string; quantity: number }>
): Promise<string> {
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
  
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
