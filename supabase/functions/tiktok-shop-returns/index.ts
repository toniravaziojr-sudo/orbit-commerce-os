import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: list, sync, approve/reject returns
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// TikTok Return Status → Local Status mapping
const RETURN_STATUS_MAP: Record<string, string> = {
  'RETURN_OR_REFUND_REQUEST_PENDING': 'pending',
  'RETURN_OR_REFUND_REQUEST_REJECT': 'rejected',
  'RETURN_OR_REFUND_REQUEST_APPROVE': 'approved',
  'BUYER_RETURN_OR_REFUND_REQUEST_CANCEL': 'cancelled',
  'AWAITING_BUYER_SHIP': 'approved',
  'BUYER_SHIPPED_ITEM': 'approved',
  'SELLER_REJECT_RETURN': 'rejected',
  'REFUND_OR_RETURN_COMPLETE': 'completed',
  'REPLACE_COMPLETE': 'completed',
  'REFUND_COMPLETE': 'completed',
};

function mapTikTokReturnStatus(tikTokStatus: string): string {
  return RETURN_STATUS_MAP[tikTokStatus] || 'pending';
}

function mapReturnType(tikTokType: string): string {
  if (tikTokType?.includes('REFUND')) return 'refund';
  if (tikTokType?.includes('REPLACE')) return 'replacement';
  return 'return';
}

interface RequestBody {
  tenantId: string;
  action: 'list' | 'sync' | 'approve' | 'reject';
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[tiktok-shop-returns][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { tenantId, action, data } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: LIST =====
    if (action === 'list') {
      console.log(`[tiktok-shop-returns][${VERSION}] Listing returns for tenant ${tenantId}`);

      let query = supabase
        .from('tiktok_shop_returns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (data?.status && typeof data.status === 'string') {
        query = query.eq('status', data.status);
      }
      if (data?.tiktokOrderId && typeof data.tiktokOrderId === 'string') {
        query = query.eq('tiktok_order_id', data.tiktokOrderId);
      }

      const { data: returns, error } = await query.limit(100);

      if (error) {
        console.error(`[tiktok-shop-returns][${VERSION}] List error:`, error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: returns || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== ACTION: SYNC =====
    if (action === 'sync') {
      console.log(`[tiktok-shop-returns][${VERSION}] Syncing returns for tenant ${tenantId}`);

      // Get TikTok Shop connection
      const { data: connection, error: connError } = await supabase
        .from('tiktok_shop_connections')
        .select('access_token, shop_id, shop_cipher')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .single();

      if (connError || !connection) {
        return new Response(
          JSON.stringify({ success: false, error: 'Conexão TikTok Shop não encontrada ou inativa' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { access_token, shop_cipher } = connection;

      // Call TikTok Seller API - Reverse Orders (returns/refunds)
      const apiUrl = `https://open-api.tiktokglobalshop.com/reverse/202309/reverse_orders/search`;

      const requestBody: Record<string, unknown> = {
        page_size: 50,
      };

      // Date filter
      if (data?.dateFrom) {
        requestBody.create_time_ge = Math.floor(new Date(data.dateFrom as string).getTime() / 1000);
      }
      if (data?.dateTo) {
        requestBody.create_time_lt = Math.floor(new Date(data.dateTo as string).getTime() / 1000);
      }

      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': access_token,
            'x-use-boe': 'false',
          },
          body: JSON.stringify(requestBody),
        });

        const responseText = await apiResponse.text();
        let apiData: Record<string, unknown>;
        try {
          apiData = JSON.parse(responseText);
        } catch {
          console.error(`[tiktok-shop-returns][${VERSION}] Failed to parse API response:`, responseText.substring(0, 200));
          return new Response(
            JSON.stringify({ success: false, error: 'Resposta inválida da API TikTok' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if ((apiData as any).code !== 0) {
          console.error(`[tiktok-shop-returns][${VERSION}] API error:`, apiData);
          return new Response(
            JSON.stringify({ success: false, error: (apiData as any).message || 'Erro na API TikTok' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const reverseOrders = ((apiData as any).data?.reverse_order_list || []) as any[];
        let synced = 0;

        for (const ro of reverseOrders) {
          const returnId = ro.reverse_order_id || ro.id;
          const orderId = ro.order_id;
          const tikTokStatus = ro.reverse_order_status || ro.status || '';
          const returnType = ro.reverse_type || ro.type || '';

          // Try to find matching local tiktok_shop_order
          let tiktokShopOrderId: string | null = null;
          if (orderId) {
            const { data: localOrder } = await supabase
              .from('tiktok_shop_orders')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('tiktok_order_id', orderId)
              .single();
            if (localOrder) tiktokShopOrderId = localOrder.id;
          }

          const returnRecord = {
            tenant_id: tenantId,
            tiktok_order_id: orderId || '',
            tiktok_return_id: returnId,
            tiktok_shop_order_id: tiktokShopOrderId,
            return_type: mapReturnType(returnType),
            status: mapTikTokReturnStatus(tikTokStatus),
            tiktok_status: tikTokStatus,
            reason: ro.reverse_reason?.text || ro.reason || null,
            buyer_comments: ro.buyer_comment || null,
            refund_amount_cents: ro.refund_total ? Math.round(parseFloat(ro.refund_total.amount || ro.refund_total) * 100) : 0,
            currency: ro.refund_total?.currency || 'BRL',
            items: ro.reverse_order_line_items || ro.items || [],
            return_data: ro,
            return_tracking_code: ro.reverse_shipping?.tracking_number || null,
            return_carrier: ro.reverse_shipping?.shipping_provider_name || null,
            requested_at: ro.create_time ? new Date(ro.create_time * 1000).toISOString() : null,
            resolved_at: ro.update_time && mapTikTokReturnStatus(tikTokStatus) === 'completed'
              ? new Date(ro.update_time * 1000).toISOString() : null,
            synced_at: new Date().toISOString(),
            last_error: null,
          };

          const { error: upsertError } = await supabase
            .from('tiktok_shop_returns')
            .upsert(returnRecord, { onConflict: 'tenant_id,tiktok_return_id' });

          if (upsertError) {
            console.error(`[tiktok-shop-returns][${VERSION}] Upsert error for ${returnId}:`, upsertError);
          } else {
            synced++;
          }
        }

        console.log(`[tiktok-shop-returns][${VERSION}] Synced ${synced}/${reverseOrders.length} returns`);

        return new Response(
          JSON.stringify({ success: true, data: { synced, total: reverseOrders.length } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError) {
        console.error(`[tiktok-shop-returns][${VERSION}] Fetch error:`, fetchError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao conectar com API TikTok' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== ACTION: APPROVE =====
    if (action === 'approve') {
      console.log(`[tiktok-shop-returns][${VERSION}] Approving return`);

      const returnId = data?.returnId as string;
      if (!returnId) {
        return new Response(
          JSON.stringify({ success: false, error: 'returnId é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get return record
      const { data: returnRecord, error: fetchError } = await supabase
        .from('tiktok_shop_returns')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', returnId)
        .single();

      if (fetchError || !returnRecord) {
        return new Response(
          JSON.stringify({ success: false, error: 'Devolução não encontrada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get connection
      const { data: connection } = await supabase
        .from('tiktok_shop_connections')
        .select('access_token, shop_cipher')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .single();

      if (!connection) {
        return new Response(
          JSON.stringify({ success: false, error: 'Conexão TikTok Shop não encontrada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Call TikTok API to approve
      const tiktokReturnId = returnRecord.tiktok_return_id;
      const apiUrl = `https://open-api.tiktokglobalshop.com/reverse/202309/reverse_orders/${tiktokReturnId}/approve`;

      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': connection.access_token,
          },
          body: JSON.stringify({}),
        });

        const responseText = await apiResponse.text();
        const apiData = JSON.parse(responseText);

        if (apiData.code !== 0) {
          // Update local record with error
          await supabase
            .from('tiktok_shop_returns')
            .update({ last_error: apiData.message || 'Erro ao aprovar', updated_at: new Date().toISOString() })
            .eq('id', returnId);

          return new Response(
            JSON.stringify({ success: false, error: apiData.message || 'Erro ao aprovar devolução' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update local record
        await supabase
          .from('tiktok_shop_returns')
          .update({
            status: 'approved',
            seller_comments: (data?.sellerComments as string) || null,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', returnId);

        return new Response(
          JSON.stringify({ success: true, data: { approved: true } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error(`[tiktok-shop-returns][${VERSION}] Approve error:`, err);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao conectar com API TikTok' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== ACTION: REJECT =====
    if (action === 'reject') {
      console.log(`[tiktok-shop-returns][${VERSION}] Rejecting return`);

      const returnId = data?.returnId as string;
      const rejectReason = (data?.reason as string) || '';

      if (!returnId) {
        return new Response(
          JSON.stringify({ success: false, error: 'returnId é obrigatório' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get return record
      const { data: returnRecord } = await supabase
        .from('tiktok_shop_returns')
        .select('tiktok_return_id')
        .eq('tenant_id', tenantId)
        .eq('id', returnId)
        .single();

      if (!returnRecord) {
        return new Response(
          JSON.stringify({ success: false, error: 'Devolução não encontrada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get connection
      const { data: connection } = await supabase
        .from('tiktok_shop_connections')
        .select('access_token')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .single();

      if (!connection) {
        return new Response(
          JSON.stringify({ success: false, error: 'Conexão TikTok Shop não encontrada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tiktokReturnId = returnRecord.tiktok_return_id;
      const apiUrl = `https://open-api.tiktokglobalshop.com/reverse/202309/reverse_orders/${tiktokReturnId}/reject`;

      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': connection.access_token,
          },
          body: JSON.stringify({
            reject_reason: rejectReason,
          }),
        });

        const responseText = await apiResponse.text();
        const apiData = JSON.parse(responseText);

        if (apiData.code !== 0) {
          await supabase
            .from('tiktok_shop_returns')
            .update({ last_error: apiData.message || 'Erro ao rejeitar' })
            .eq('id', returnId);

          return new Response(
            JSON.stringify({ success: false, error: apiData.message || 'Erro ao rejeitar devolução' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase
          .from('tiktok_shop_returns')
          .update({
            status: 'rejected',
            seller_comments: rejectReason || null,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', returnId);

        return new Response(
          JSON.stringify({ success: true, data: { rejected: true } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error(`[tiktok-shop-returns][${VERSION}] Reject error:`, err);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao conectar com API TikTok' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[tiktok-shop-returns][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
