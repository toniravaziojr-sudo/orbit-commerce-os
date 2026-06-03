// Focused on-demand processor for shipping_draft_queue.
// Invoked fire-and-forget after PV creation/duplication so the operator
// sees the shipment object in "Prontos para emitir" almost instantly,
// without waiting for the 10-min safety-net cron in scheduler-tick.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  let processed = 0
  let created = 0

  try {
    const body = await req.json().catch(() => ({} as any))
    const limit = Math.min(Number(body?.limit) || 10, 25)

    const { data: items, error } = await supabase
      .from('shipping_draft_queue')
      .select('id, tenant_id, order_id, source_pedido_venda_id, provider, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    for (const item of items || []) {
      processed++
      try {
        await supabase
          .from('shipping_draft_queue')
          .update({ status: 'processing', attempts: (item.attempts || 0) + 1 })
          .eq('id', item.id)

        let carrier = item.provider || 'correios'
        let serviceName: string | null = null
        let serviceCode: string | null = null
        let totalWeightGrams = 0
        let maxHeight = 2, maxWidth = 11, maxLength = 16
        let recipientName: string | null = null
        let recipientZip: string | null = null
        let declaredValueCents = 0
        let shippingMethod: string | null = null

        if (item.order_id) {
          const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`id, tenant_id, total, shipping_postal_code, shipping_carrier, shipping_method_name,
              shipping_service_code, shipping_service_name, customer_name`)
            .eq('id', item.order_id)
            .single()
          if (orderError || !order) throw new Error(`Order not found: ${orderError?.message || 'null'}`)

          const { data: orderItems } = await supabase
            .from('order_items')
            .select('quantity, product_id, products(weight, height, width, depth)')
            .eq('order_id', item.order_id)

          for (const oi of orderItems || []) {
            const p = (oi as any).products
            if (p) {
              totalWeightGrams += (p.weight || 300) * (oi.quantity || 1)
              maxHeight = Math.max(maxHeight, p.height || 2)
              maxWidth = Math.max(maxWidth, p.width || 11)
              maxLength = Math.max(maxLength, p.depth || 16)
            } else {
              totalWeightGrams += 300 * (oi.quantity || 1)
            }
          }

          carrier = order.shipping_carrier || item.provider || 'manual'
          serviceName = (order as any).shipping_service_name || null
          serviceCode = order.shipping_service_code || null
          recipientName = order.customer_name
          recipientZip = order.shipping_postal_code
          declaredValueCents = order.total
          shippingMethod = order.shipping_method_name
        } else if (item.source_pedido_venda_id) {
          const { data: pv, error: pvError } = await supabase
            .from('fiscal_invoices')
            .select('id, tenant_id, dest_nome, dest_endereco_cep, valor_total, transportadora_nome, transportadora_servico, peso_bruto, pedido_status, fiscal_stage, source_order_invoice_id')
            .eq('id', item.source_pedido_venda_id)
            .single()
          if (pvError || !pv) throw new Error(`PV not found: ${pvError?.message || 'null'}`)

          if (pv.fiscal_stage !== 'pedido_venda' || pv.source_order_invoice_id !== null || pv.pedido_status !== 'em_aberto') {
            await supabase
              .from('shipping_draft_queue')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancel_reason: `pv_not_em_aberto:${pv.pedido_status || 'unknown'}`,
                processed_at: new Date().toISOString(),
              })
              .eq('id', item.id)
            continue
          }

          const { data: pvItems } = await supabase
            .from('fiscal_invoice_items')
            .select('quantidade, codigo_produto')
            .eq('invoice_id', item.source_pedido_venda_id)

          const codes = (pvItems || []).map((it: any) => it.codigo_produto).filter(Boolean)
          const productMap = new Map<string, any>()
          if (codes.length) {
            const { data: products } = await supabase
              .from('products')
              .select('sku, weight, height, width, depth')
              .eq('tenant_id', pv.tenant_id)
              .in('sku', codes)
            for (const p of products || []) productMap.set((p as any).sku, p)
          }
          for (const it of pvItems || []) {
            const qty = Number((it as any).quantidade) || 1
            const p = productMap.get((it as any).codigo_produto)
            if (p) {
              totalWeightGrams += (p.weight || 300) * qty
              maxHeight = Math.max(maxHeight, p.height || 2)
              maxWidth = Math.max(maxWidth, p.width || 11)
              maxLength = Math.max(maxLength, p.depth || 16)
            } else {
              totalWeightGrams += 300 * qty
            }
          }
          const pesoKg = Number((pv as any).peso_bruto || 0)
          if (pesoKg > 0) totalWeightGrams = Math.round(pesoKg * 1000)

          carrier = (pv.transportadora_nome || item.provider || 'correios').toLowerCase()
          serviceName = pv.transportadora_servico || null
          recipientName = pv.dest_nome
          recipientZip = pv.dest_endereco_cep
          declaredValueCents = Math.round(Number(pv.valor_total || 0) * 100)
          shippingMethod = pv.transportadora_servico || null
        } else {
          throw new Error('Queue item has neither order_id nor source_pedido_venda_id')
        }

        // Dedup
        let dupQuery = supabase.from('shipments').select('id').limit(1)
        if (item.source_pedido_venda_id) dupQuery = dupQuery.eq('source_pedido_venda_id', item.source_pedido_venda_id)
        else if (item.order_id) dupQuery = dupQuery.eq('order_id', item.order_id)
        const { data: existing } = await dupQuery

        if (existing && existing.length > 0) {
          await supabase
            .from('shipping_draft_queue')
            .update({ status: 'done', processed_at: new Date().toISOString() })
            .eq('id', item.id)
          continue
        }

        const { error: insertError } = await supabase.from('shipments').insert({
          tenant_id: item.tenant_id,
          order_id: item.order_id,
          source_pedido_venda_id: item.source_pedido_venda_id,
          carrier: carrier || 'correios',
          tracking_code: '',
          delivery_status: 'draft' as any,
          last_status_at: new Date().toISOString(),
          service_name: serviceName,
          service_code: serviceCode,
          source: 'auto_draft',
          metadata: {
            weight_grams: totalWeightGrams,
            height_cm: maxHeight,
            width_cm: maxWidth,
            length_cm: maxLength,
            shipping_method: shippingMethod,
            recipient_name: recipientName,
            recipient_zip: recipientZip,
            declared_value_cents: declaredValueCents,
          },
        })
        if (insertError) throw new Error(`Insert shipment failed: ${insertError.message}`)

        await supabase
          .from('shipping_draft_queue')
          .update({ status: 'done', processed_at: new Date().toISOString() })
          .eq('id', item.id)
        created++
      } catch (itemError) {
        const maxAttempts = 5
        const newStatus = (item.attempts || 0) + 1 >= maxAttempts ? 'failed' : 'pending'
        await supabase
          .from('shipping_draft_queue')
          .update({
            status: newStatus,
            error_message: String(itemError).substring(0, 500),
            processed_at: newStatus === 'failed' ? new Date().toISOString() : null,
          })
          .eq('id', item.id)
        console.error('[shipping-draft-process] item error', itemError)
      }
    }

    return new Response(JSON.stringify({ success: true, processed, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (e) {
    console.error('[shipping-draft-process] fatal', e)
    return new Response(JSON.stringify({ success: false, error: String(e), processed, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
