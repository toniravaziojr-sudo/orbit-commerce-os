/**
 * wms-pratika-reconcile
 *
 * Varre pedidos com NF autorizada + rastreio nas últimas 24h que ainda não
 * tiveram envio combinado bem-sucedido para o WMS Pratika e dispara a
 * ação send_combined (NF + rastreio juntos sob o mesmo CNPJ).
 *
 * Atua como fallback/reconciliação — o caminho principal é reativo nos
 * eventos de autorização da NF e registro do rastreio.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const stats = { tenants: 0, combined_enqueued: 0 };

  try {
    const { data: configs } = await supabase
      .from('wms_pratika_configs')
      .select('tenant_id, is_enabled, auto_send_nfe, auto_send_label')
      .eq('is_enabled', true);

    for (const cfg of configs || []) {
      stats.tenants++;

      // Pedidos com NF autorizada nas últimas 24h
      const { data: invoices } = await supabase
        .from('fiscal_invoices')
        .select('order_id')
        .eq('tenant_id', cfg.tenant_id)
        .eq('status', 'authorized')
        .gte('authorized_at', since)
        .not('order_id', 'is', null)
        .not('xml_url', 'is', null);

      const orderIds = [...new Set((invoices || []).map(i => i.order_id).filter(Boolean))];

      for (const orderId of orderIds) {
        // Confirmar que existe rastreio — pode vir da tabela interna
        // (shipments, remessas Correios/Frenet) OU do marketplace
        // (marketplace_shipments, etiqueta ML/Shopee). Sem essa segunda
        // fonte, pedidos de marketplace ficam presos e nunca chegam ao WMS.
        const { data: shipInternal } = await supabase
          .from('shipments')
          .select('id')
          .eq('tenant_id', cfg.tenant_id)
          .eq('order_id', orderId)
          .not('tracking_code', 'is', null)
          .neq('tracking_code', '')
          .limit(1)
          .maybeSingle();

        let hasTracking = !!shipInternal;
        if (!hasTracking) {
          const { data: shipMkt } = await supabase
            .from('marketplace_shipments')
            .select('id')
            .eq('tenant_id', cfg.tenant_id)
            .eq('order_id', orderId)
            .not('tracking_number', 'is', null)
            .neq('tracking_number', '')
            .limit(1)
            .maybeSingle();
          hasTracking = !!shipMkt;
        }
        if (!hasTracking) continue;

        // Já enviado combinado com sucesso? (chave é invoice_id no fluxo novo,
        // mas mantemos compat com registros antigos por order_id).
        const { data: okCombined } = await supabase
          .from('wms_pratika_logs')
          .select('id')
          .eq('tenant_id', cfg.tenant_id)
          .eq('reference_id', orderId)
          .eq('operation', 'combined')
          .eq('status', 'success')
          .limit(1)
          .maybeSingle();
        if (okCombined) continue;

        stats.combined_enqueued++;
        fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: 'send_combined',
            order_id: orderId,
            tenant_id: cfg.tenant_id,
          }),
        }).catch((e) => console.error('[wms-reconcile] combined send error:', e));
      }
    }

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[wms-pratika-reconcile] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, stats }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
