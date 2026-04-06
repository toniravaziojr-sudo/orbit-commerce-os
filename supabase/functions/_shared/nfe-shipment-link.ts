/**
 * nfe-shipment-link.ts
 * 
 * Helper para vincular NF-e autorizada ao rascunho logístico existente.
 * Chamado por: fiscal-submit, fiscal-emit, fiscal-webhook, fiscal-check-status
 * 
 * Responsabilidades:
 * 1. Preencher shipments.nfe_key e shipments.invoice_id no draft existente
 * 2. Se auto_create_shipment = true, chamar shipping-create-shipment
 * 3. Atualizar order.status para 'processing' (nunca 'shipped' — shipped vem do rastreio)
 */

interface LinkNFeToShipmentParams {
  supabaseClient: any; // SupabaseClient with service_role
  orderId: string;
  invoiceId: string;
  tenantId: string;
  chaveAcesso: string;
  autoCreateShipment: boolean;
  callerModule: string; // for logging
}

export async function linkNFeToShipment({
  supabaseClient,
  orderId,
  invoiceId,
  tenantId,
  chaveAcesso,
  autoCreateShipment,
  callerModule,
}: LinkNFeToShipmentParams): Promise<void> {
  const prefix = `[${callerModule}]`;

  // 1. Vincular NF-e ao shipment draft existente
  const { data: existingShipment, error: shipError } = await supabaseClient
    .from('shipments')
    .select('id, delivery_status')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingShipment) {
    const updatePayload: Record<string, unknown> = {
      nfe_key: chaveAcesso,
      invoice_id: invoiceId,
      updated_at: new Date().toISOString(),
    };

    await supabaseClient
      .from('shipments')
      .update(updatePayload)
      .eq('id', existingShipment.id);

    console.log(`${prefix} Linked NF-e ${invoiceId} to shipment ${existingShipment.id} (nfe_key: ${chaveAcesso?.substring(0, 10)}...)`);
  } else {
    console.warn(`${prefix} No shipment draft found for order ${orderId}`);
  }

  // 2. Se auto_create_shipment, enviar remessa à transportadora
  if (autoCreateShipment) {
    console.log(`${prefix} Auto-creating shipment for order ${orderId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    try {
      const shipResponse = await fetch(`${supabaseUrl}/functions/v1/shipping-create-shipment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ 
          order_id: orderId,
          invoice_id: invoiceId,
        }),
      });

      const shipResult = await shipResponse.json();
      console.log(`${prefix} Shipment creation result:`, JSON.stringify(shipResult));

      if (!shipResult.success) {
        console.error(`${prefix} Shipment creation failed: ${shipResult.error}`);
        // Shipment com erro vai para aba "Remessas pendentes" automaticamente
        // Atualizar shipment draft para failed se existir
        if (existingShipment) {
          await supabaseClient
            .from('shipments')
            .update({ 
              delivery_status: 'failed',
              last_status_at: new Date().toISOString(),
            })
            .eq('id', existingShipment.id);
        }
      }
      // Se sucesso, o shipping-create-shipment já atualizou o shipment
    } catch (shipError) {
      console.error(`${prefix} Failed to call shipping-create-shipment:`, shipError);
    }
  }

  // 3. Atualizar pedido para 'processing' (aguardando despacho manual)
  // NUNCA mudar para 'shipped' aqui — shipped vem da primeira movimentação do rastreio
  await supabaseClient
    .from('orders')
    .update({ status: 'processing' })
    .eq('id', orderId);

  console.log(`${prefix} Order ${orderId} status set to 'processing'`);
}
