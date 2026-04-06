// =============================================
// FISCAL AUTO CREATE DRAFTS
// Cria rascunhos automaticamente para pedidos pagos
// sem NF-e existente
// Modos: CRON (all tenants) | USER (single tenant) | TRIGGER (single order)
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { unbundleKitItems } from "../_shared/kit-unbundler.ts";
import { getNextFiscalNumber, insertFiscalInvoiceWithRetry, syncFiscalNumberCursor } from "../_shared/fiscal-numbering.ts";

const VERSION = 'v8.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Determine CFOP based on origin and destination UF
function determineCfop(originUf: string, destUf: string, defaultIntra: string, defaultInter: string): string {
  if (originUf === destUf) {
    return defaultIntra || '5102';
  }
  return defaultInter || '6102';
}

/**
 * Busca código IBGE do município
 */
async function getIbgeCodigo(supabase: any, cidade: string, uf: string): Promise<string | null> {
  if (!cidade || !uf) return null;
  
  const cidadeNorm = cidade
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  
  // Busca exata
  const { data: exact } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .eq('nome', cidadeNorm)
    .maybeSingle();
  
  if (exact?.codigo) return exact.codigo;
  
  // Busca com a cidade original
  const { data: original } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .eq('nome', cidade.toUpperCase().trim())
    .maybeSingle();
  
  if (original?.codigo) return original.codigo;
  
  // Busca por prefixo
  const { data: prefix } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .ilike('nome', cidadeNorm + '%')
    .limit(1)
    .maybeSingle();
  
  if (prefix?.codigo) return prefix.codigo;
  
  // Busca por conteúdo
  const { data: contains } = await supabase
    .from('ibge_municipios')
    .select('codigo')
    .eq('uf', uf.toUpperCase())
    .ilike('nome', '%' + cidadeNorm + '%')
    .limit(1)
    .maybeSingle();
  
  return contains?.codigo || null;
}

/**
 * Process drafts for a single tenant. Returns { created, errors }.
 */
async function processTenanDrafts(
  supabase: any,
  tenantId: string,
  userId: string | null,
  singleOrderId?: string,
): Promise<{ created: number; errors: string[] }> {
  const created = { count: 0 };
  const errors: string[] = [];

  const mode = singleOrderId ? 'TRIGGER' : 'BATCH';
  console.log(`[fiscal-auto-create-drafts][${VERSION}] Starting ${mode} for tenant:`, tenantId, singleOrderId ? `order: ${singleOrderId}` : '');

  // Get fiscal settings
  const { data: fiscalSettings, error: settingsError } = await supabase
    .from('fiscal_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (settingsError || !fiscalSettings || !fiscalSettings.is_configured) {
    console.log('[fiscal-auto-create-drafts] Fiscal not configured for tenant', tenantId);
    // Throw so queue item stays pending and will be retried when settings exist
    throw new Error('FISCAL_NOT_CONFIGURED');
  }

  const serieNfe = fiscalSettings.serie_nfe || 1;
  let nextNumeroCursor = await getNextFiscalNumber({
    supabase,
    tenantId,
    serie: serieNfe,
    fallbackNumeroAtual: fiscalSettings.numero_nfe_atual,
  });

  // Get paid orders without invoices
  let query = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      total,
      subtotal,
      shipping_total,
      discount_total,
      shipping_street,
      shipping_number,
      shipping_complement,
      shipping_neighborhood,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      customer_name,
      paid_at,
      created_at,
      customer:customers(id, full_name, cpf, email, phone)
    `)
    .eq('tenant_id', tenantId)
    .eq('payment_status', 'approved');

  if (singleOrderId) {
    // TRIGGER mode: specific order
    query = query.eq('id', singleOrderId);
  } else {
    // BATCH mode: all paid orders with eligible status
    query = query
      .in('status', ['paid', 'ready_to_invoice'])
      .order('created_at', { ascending: false })
      .limit(50);
  }

  const { data: paidOrders, error: ordersError } = await query;

  if (ordersError) {
    console.error('[fiscal-auto-create-drafts] Error fetching orders:', ordersError);
    throw ordersError;
  }

  if (!paidOrders || paidOrders.length === 0) {
    console.log('[fiscal-auto-create-drafts] No paid orders found');
    return { created: 0, errors: [] };
  }

  // Get existing invoices for these orders
  const orderIds = paidOrders.map((o: any) => o.id);
  const { data: existingInvoices } = await supabase
    .from('fiscal_invoices')
    .select('order_id')
    .in('order_id', orderIds)
    .neq('status', 'canceled');

  const ordersWithInvoice = new Set((existingInvoices || []).map((inv: any) => inv.order_id));
  const ordersToCreate = paidOrders.filter((order: any) => !ordersWithInvoice.has(order.id));

  console.log(`[fiscal-auto-create-drafts] Found ${ordersToCreate.length} orders needing drafts`);

  for (const order of ordersToCreate) {
    try {
      // Re-check current invoice existence to avoid race conditions
      const { data: currentInvoice } = await supabase
        .from('fiscal_invoices')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('order_id', order.id)
        .neq('status', 'canceled')
        .limit(1)
        .maybeSingle();

      if (currentInvoice?.id) {
        console.log(`[fiscal-auto-create-drafts] Order ${order.order_number} already has invoice, skipping`);
        continue;
      }

      // Get order items
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order.id);

      if (!orderItems || orderItems.length === 0) {
        console.log(`[fiscal-auto-create-drafts] Order ${order.order_number} has no items, skipping`);
        continue;
      }

      // Determine CFOP
      const cfop = determineCfop(
        fiscalSettings.endereco_uf,
        order.shipping_state,
        fiscalSettings.cfop_intrastadual,
        fiscalSettings.cfop_interestadual
      );

      let itemsToProcess: Array<{
        id?: string;
        product_id: string;
        product_name: string;
        sku: string;
        quantity: number;
        unit_price: number;
        total_price: number;
      }> = orderItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name || 'Produto',
        sku: item.sku || '',
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      // Unbundle kits if setting is enabled
      if (fiscalSettings.desmembrar_estrutura) {
        console.log(`[fiscal-auto-create-drafts] Unbundling kits for order ${order.order_number}`);
        itemsToProcess = await unbundleKitItems(supabase, itemsToProcess);
      }

      // Get fiscal product data
      const productIds = itemsToProcess.map(item => item.product_id).filter(Boolean);
      const { data: fiscalProducts } = await supabase
        .from('fiscal_products')
        .select('*')
        .in('product_id', productIds);

      const fiscalProductMap = new Map(
        (fiscalProducts || []).map((fp: any) => [fp.product_id, fp])
      );

      // Build invoice items
      const invoiceItems = itemsToProcess.map((item, index) => {
        const fiscalProduct = fiscalProductMap.get(item.product_id);
        return {
          numero_item: index + 1,
          order_item_id: item.id || null,
          codigo_produto: item.sku || item.product_id?.substring(0, 8) || `PROD${index + 1}`,
          descricao: item.product_name || 'Produto',
          ncm: fiscalProduct?.ncm || '',
          cfop: fiscalProduct?.cfop_override || cfop,
          unidade: fiscalProduct?.unidade_comercial || 'UN',
          quantidade: item.quantity,
          valor_unitario: item.unit_price,
          valor_total: item.total_price,
          origem: fiscalProduct?.origem || 0,
          csosn: fiscalProduct?.csosn_override || fiscalSettings.csosn_padrao,
          cst: fiscalProduct?.cst_override || fiscalSettings.cst_padrao,
        };
      });

      // Lookup IBGE code
      const destMunicipioCodigo = await getIbgeCodigo(supabase, order.shipping_city, order.shipping_state);

      const customerData = Array.isArray(order.customer) ? order.customer[0] : order.customer;
      // Use paid_at as NF date (falls back to order created_at)
      const nfDate = order.paid_at || order.created_at;
      const draftDataBase = {
        tenant_id: tenantId,
        order_id: order.id,
        serie: serieNfe,
        status: 'draft',
        natureza_operacao: 'VENDA DE MERCADORIA',
        cfop: cfop,
        valor_total: order.total,
        valor_produtos: order.subtotal,
        valor_frete: order.shipping_total || 0,
        valor_desconto: order.discount_total || 0,
        dest_nome: customerData?.full_name || order.customer_name || 'Cliente',
        dest_cpf_cnpj: customerData?.cpf || order.customer_cpf || order.customer_cnpj || '',
        dest_inscricao_estadual: null,
        dest_endereco_logradouro: order.shipping_street,
        dest_endereco_numero: order.shipping_number || 'S/N',
        dest_endereco_complemento: order.shipping_complement,
        dest_endereco_bairro: order.shipping_neighborhood,
        dest_endereco_municipio: order.shipping_city,
        dest_endereco_municipio_codigo: destMunicipioCodigo,
        dest_endereco_uf: order.shipping_state,
        dest_endereco_cep: order.shipping_postal_code,
        dest_telefone: customerData?.phone || null,
        dest_email: customerData?.email || null,
        emitido_por: userId,
        created_at: nfDate,
      };

      const { invoice, numero } = await insertFiscalInvoiceWithRetry({
        supabase,
        tenantId,
        serie: serieNfe,
        initialNumber: nextNumeroCursor,
        logPrefix: 'fiscal-auto-create-drafts',
        buildDraftData: (numeroFiscal: number) => ({
          ...draftDataBase,
          numero: numeroFiscal,
        }),
      });

      nextNumeroCursor = Math.max(nextNumeroCursor, numero + 1);

      // Insert items
      const itemsToInsert = invoiceItems.map(item => ({
        ...item,
        invoice_id: invoice.id,
      }));

      const { error: itemsError } = await supabase
        .from('fiscal_invoice_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error(`[fiscal-auto-create-drafts] Error inserting items for order ${order.order_number}:`, itemsError);
        await supabase.from('fiscal_invoices').delete().eq('id', invoice.id);
        errors.push(`Pedido ${order.order_number}: Erro ao inserir itens`);
        continue;
      }

      // Log event
      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice.id,
          tenant_id: tenantId,
          event_type: 'draft_auto_created',
          event_data: { order_id: order.id, order_number: order.order_number, numero },
          user_id: userId,
        });

      created.count++;
      console.log(`[fiscal-auto-create-drafts] Created draft for order ${order.order_number} with numero ${numero}`);

    } catch (error) {
      console.error(`[fiscal-auto-create-drafts] Error processing order ${order.order_number}:`, error);
      errors.push(`Pedido ${order.order_number}: erro ao criar rascunho`);
    }
  }

  await syncFiscalNumberCursor({
    supabase,
    tenantId,
    serie: serieNfe,
    currentCursor: nextNumeroCursor,
    logPrefix: 'fiscal-auto-create-drafts',
  });

  console.log(`[fiscal-auto-create-drafts] Completed for tenant ${tenantId}. Created ${created.count} drafts.`);
  return { created: created.count, errors };
}

// ============================
// MAIN HANDLER
// ============================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const isSystemCall = !authHeader 
      || authHeader === `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      || authHeader === `Bearer ${supabaseServiceKey}`;
    const isCronMode = isSystemCall;

    // ========== TRIGGER MODE: single order from DB trigger ==========
    // Detected by presence of order_id + tenant_id in body with cron-like auth
    let body: any = {};
    try {
      body = await req.json();
    } catch { /* empty body is ok for cron */ }

    if (isCronMode && body?.order_id && body?.tenant_id) {
      console.log(`[fiscal-auto-create-drafts][${VERSION}] TRIGGER mode — order: ${body.order_id}, tenant: ${body.tenant_id}`);
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const result = await processTenanDrafts(supabase, body.tenant_id, null, body.order_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'trigger',
          created: result.created,
          errors: result.errors.length > 0 ? result.errors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== CRON MODE: process ALL configured tenants ==========
    if (isCronMode) {
      console.log(`[fiscal-auto-create-drafts][${VERSION}] CRON mode — processing all tenants`);

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Get all tenants with fiscal configured
      const { data: configuredTenants, error: tenantsError } = await supabase
        .from('fiscal_settings')
        .select('tenant_id')
        .eq('is_configured', true);

      if (tenantsError || !configuredTenants || configuredTenants.length === 0) {
        console.log('[fiscal-auto-create-drafts] No configured tenants found');
        return new Response(
          JSON.stringify({ success: true, mode: 'cron', tenants_processed: 0, total_created: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let totalCreated = 0;
      const allErrors: string[] = [];

      for (const tenant of configuredTenants) {
        try {
          const result = await processTenanDrafts(supabase, tenant.tenant_id, null);
          totalCreated += result.created;
          allErrors.push(...result.errors);
        } catch (err) {
          console.error(`[fiscal-auto-create-drafts] Error for tenant ${tenant.tenant_id}:`, err);
          allErrors.push(`Tenant ${tenant.tenant_id}: ${err instanceof Error ? err.message : 'Erro'}`);
        }
      }

      console.log(`[fiscal-auto-create-drafts] CRON complete. ${configuredTenants.length} tenants, ${totalCreated} drafts created.`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'cron',
          tenants_processed: configuredTenants.length, 
          total_created: totalCreated,
          errors: allErrors.length > 0 ? allErrors : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== USER MODE: process single tenant ==========
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'No tenant selected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;
    const result = await processTenanDrafts(supabase, tenantId, user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        mode: 'user',
        created: result.created,
        errors: result.errors.length > 0 ? result.errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'auto-create-drafts' });
  }
});
