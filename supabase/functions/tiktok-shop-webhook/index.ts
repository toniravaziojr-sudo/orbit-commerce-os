import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIKTOK_SHOP_API = "https://open-api.tiktokglobalshop.com";

Deno.serve(async (req) => {
  console.log(`[tiktok-shop-webhook][${VERSION}] Request received: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    console.log(`[tiktok-shop-webhook][${VERSION}] Event type: ${body.type}, event_id: ${body.event_id}`);

    const eventType = body.type || 'unknown';
    const eventId = body.event_id || null;
    const shopId = body.shop_id || null;

    // Find tenant by shop_id
    let tenantId: string | null = null;
    if (shopId) {
      const { data: conn } = await supabase
        .from('tiktok_shop_connections')
        .select('tenant_id')
        .eq('shop_id', shopId)
        .eq('is_active', true)
        .single();
      tenantId = conn?.tenant_id || null;
    }

    if (!tenantId) {
      console.warn(`[tiktok-shop-webhook] No tenant found for shop_id: ${shopId}`);
      // Still store the event for debugging
      await supabase.from('tiktok_shop_webhook_events').insert({
        tenant_id: '00000000-0000-0000-0000-000000000000', // orphan
        event_type: eventType,
        event_id: eventId,
        shop_id: shopId,
        payload: body,
        status: 'failed',
        error_message: 'No tenant found for shop_id',
      });
      return new Response(JSON.stringify({ success: false, error: 'Unknown shop' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store webhook event
    const { data: event, error: insertError } = await supabase
      .from('tiktok_shop_webhook_events')
      .insert({
        tenant_id: tenantId,
        event_type: eventType,
        event_id: eventId,
        shop_id: shopId,
        payload: body,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error(`[tiktok-shop-webhook] Insert error:`, insertError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to store event' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const webhookEventId = event?.id;

    // Process event based on type
    try {
      switch (eventType) {
        case 'ORDER_STATUS_CHANGE':
        case 'ORDER_PAYMENT':
        case 'ORDER_SHIPMENT': {
          // Trigger order sync for the affected order
          const orderData = body.data || {};
          const orderId = orderData.order_id;

          if (orderId) {
            // Update or create order in tiktok_shop_orders
            const { data: existingOrder } = await supabase
              .from('tiktok_shop_orders')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('tiktok_order_id', orderId)
              .single();

            if (existingOrder) {
              // Update status from webhook data
              const statusMap: Record<string, string> = {
                'ORDER_STATUS_CHANGE': orderData.new_status || 'unknown',
                'ORDER_PAYMENT': 'paid',
                'ORDER_SHIPMENT': 'shipped',
              };

              await supabase
                .from('tiktok_shop_orders')
                .update({
                  status: statusMap[eventType] || existingOrder.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingOrder.id);
            }

            console.log(`[tiktok-shop-webhook] Order ${orderId} event processed: ${eventType}`);
          }
          break;
        }

        case 'PRODUCT_STATUS_CHANGE': {
          const productData = body.data || {};
          const productId = productData.product_id;

          if (productId) {
            await supabase
              .from('tiktok_shop_products')
              .update({
                tiktok_status: productData.new_status || 'unknown',
                updated_at: new Date().toISOString(),
              })
              .eq('tenant_id', tenantId)
              .eq('tiktok_product_id', productId);

            console.log(`[tiktok-shop-webhook] Product ${productId} status updated`);
          }
          break;
        }

        case 'RETURN_STATUS_CHANGE': {
          const returnData = body.data || {};
          const returnId = returnData.return_id;

          if (returnId) {
            await supabase
              .from('tiktok_shop_returns')
              .update({
                status: returnData.new_status || 'unknown',
                updated_at: new Date().toISOString(),
              })
              .eq('tenant_id', tenantId)
              .eq('tiktok_return_id', returnId);

            console.log(`[tiktok-shop-webhook] Return ${returnId} status updated`);
          }
          break;
        }

        default:
          console.log(`[tiktok-shop-webhook] Unhandled event type: ${eventType}`);
      }

      // Mark event as processed
      await supabase
        .from('tiktok_shop_webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', webhookEventId);

    } catch (processError) {
      console.error(`[tiktok-shop-webhook] Processing error:`, processError);
      await supabase
        .from('tiktok_shop_webhook_events')
        .update({
          status: 'failed',
          error_message: (processError as any).message || 'Processing failed',
        })
        .eq('id', webhookEventId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`[tiktok-shop-webhook][${VERSION}] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: (err as any).message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
