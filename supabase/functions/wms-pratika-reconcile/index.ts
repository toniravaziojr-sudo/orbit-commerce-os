/**
 * wms-pratika-reconcile
 *
 * Varre NFs autorizadas e remessas com rastreio nas últimas 24h que ainda
 * não tiveram envio bem-sucedido para o WMS Pratika e dispara o reenvio.
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
  const stats = { tenants: 0, nfe_enqueued: 0, tracking_enqueued: 0 };

  try {
    const { data: configs } = await supabase
      .from('wms_pratika_configs')
      .select('tenant_id, is_enabled, auto_send_nfe, auto_send_label')
      .eq('is_enabled', true);

    for (const cfg of configs || []) {
      stats.tenants++;

      // 1) NFs autorizadas sem envio bem-sucedido
      if (cfg.auto_send_nfe) {
        const { data: invoices } = await supabase
          .from('fiscal_invoices')
          .select('id')
          .eq('tenant_id', cfg.tenant_id)
          .eq('status', 'authorized')
          .gte('authorized_at', since)
          .not('xml_url', 'is', null);

        for (const inv of invoices || []) {
          const { data: ok } = await supabase
            .from('wms_pratika_logs')
            .select('id')
            .eq('tenant_id', cfg.tenant_id)
            .eq('reference_id', inv.id)
            .eq('operation', 'nfe')
            .eq('status', 'success')
            .limit(1)
            .maybeSingle();

          if (!ok) {
            stats.nfe_enqueued++;
            fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({ action: 'send_nfe', invoice_id: inv.id, tenant_id: cfg.tenant_id }),
            }).catch((e) => console.error('[wms-reconcile] nfe send error:', e));
          }
        }
      }

      // 2) Remessas com rastreio sem envio bem-sucedido
      if (cfg.auto_send_label) {
        const { data: shipments } = await supabase
          .from('shipments')
          .select('order_id, tracking_code, created_at')
          .eq('tenant_id', cfg.tenant_id)
          .not('tracking_code', 'is', null)
          .gte('created_at', since);

        for (const sh of shipments || []) {
          // Resolver invoice autorizado do pedido
          const { data: inv } = await supabase
            .from('fiscal_invoices')
            .select('id')
            .eq('order_id', sh.order_id)
            .eq('tenant_id', cfg.tenant_id)
            .eq('status', 'authorized')
            .order('authorized_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!inv?.id) continue;

          const { data: ok } = await supabase
            .from('wms_pratika_logs')
            .select('id')
            .eq('tenant_id', cfg.tenant_id)
            .eq('reference_id', inv.id)
            .eq('operation', 'tracking')
            .eq('status', 'success')
            .limit(1)
            .maybeSingle();

          if (!ok) {
            stats.tracking_enqueued++;
            fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                action: 'update_tracking',
                invoice_id: inv.id,
                tracking_code: sh.tracking_code,
                tenant_id: cfg.tenant_id,
              }),
            }).catch((e) => console.error('[wms-reconcile] tracking send error:', e));
          }
        }
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
