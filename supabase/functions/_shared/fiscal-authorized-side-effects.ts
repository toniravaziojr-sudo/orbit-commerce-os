// Side-effects pós-autorização canônicos.
// Disparados SEMPRE após persistAuthorizedState() retornar persisted=true.
// Cada efeito roda em try/catch isolado — uma falha não derruba os outros nem
// reverte o estado autorizado da NF.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { linkNFeToShipment } from "./nfe-shipment-link.ts";

export interface FireSideEffectsParams {
  supabaseClient: SupabaseClient;
  invoice: { id: string; tenant_id: string; order_id: string | null };
  chaveAcesso: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
  callerModule: string;
}

export async function fireAuthorizedSideEffects(params: FireSideEffectsParams): Promise<void> {
  const { supabaseClient, invoice, chaveAcesso, supabaseUrl, supabaseServiceKey, callerModule } = params;

  const { data: settings } = await supabaseClient
    .from("fiscal_settings")
    .select("auto_create_shipment, enviar_email_nfe")
    .eq("tenant_id", invoice.tenant_id)
    .maybeSingle();

  if (invoice.order_id) {
    try {
      await linkNFeToShipment({
        supabaseClient,
        orderId: invoice.order_id,
        invoiceId: invoice.id,
        tenantId: invoice.tenant_id,
        chaveAcesso,
        autoCreateShipment: !!settings?.auto_create_shipment,
        callerModule,
      });
    } catch (err) {
      console.error(`[${callerModule}] linkNFeToShipment falhou (não bloqueante):`, err);
    }
  }

  if (settings?.enviar_email_nfe !== false) {
    fetch(`${supabaseUrl}/functions/v1/fiscal-send-nfe-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ invoice_id: invoice.id, tenant_id: invoice.tenant_id }),
    }).catch((err) => console.error(`[${callerModule}] email error:`, err));
  }

  fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ action: "send_combined", invoice_id: invoice.id, tenant_id: invoice.tenant_id }),
  }).catch((err) => console.error(`[${callerModule}] wms-pratika error:`, err));
}
