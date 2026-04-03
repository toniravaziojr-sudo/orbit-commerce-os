/**
 * Trigger fiscal draft creation for a paid order.
 * Non-blocking: logs errors but never throws, so it doesn't break the webhook flow.
 */
export async function triggerFiscalDraftCreation(params: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  orderId: string;
  tenantId: string;
  logPrefix: string;
}): Promise<void> {
  const { supabaseUrl, supabaseServiceKey, orderId, tenantId, logPrefix } = params;

  try {
    const url = `${supabaseUrl}/functions/v1/fiscal-auto-create-drafts`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ order_id: orderId, tenant_id: tenantId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${logPrefix}] Fiscal draft trigger failed (${response.status}): ${errorText}`);
    } else {
      const result = await response.json();
      console.log(`[${logPrefix}] Fiscal draft trigger result:`, result);
    }
  } catch (error) {
    console.error(`[${logPrefix}] Fiscal draft trigger error (non-blocking):`, error);
  }
}