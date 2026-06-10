// =============================================
// FISCAL AUTO CREATE DRAFTS
// Cria rascunhos automaticamente para pedidos pagos
// sem NF-e existente
// Modos: CRON (all tenants) | USER (single tenant) | TRIGGER (single order)
// =============================================
import { errorResponse } from "../_shared/error-response.ts";
import { resolveAddressByCep } from "../_shared/cep-lookup.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
// kit-unbundler removido daqui: desmembramento acontece em fiscal-prepare-invoice (PV → NF).
import { getNextFiscalNumber, insertFiscalInvoiceWithRetry } from "../_shared/fiscal-numbering.ts";
import { buildFiscalOrderInheritance } from "../_shared/fiscal-order-mapping.ts";
import { calculateItemTaxes, type FiscalSettingsTax } from "../_shared/fiscal-tax-calculator.ts";
import { resolveOperationNature, pickCfopForUf, pickTaxCodesForCrt, type ResolvedFiscalNature } from "../_shared/fiscal-nature-resolver.ts";

const VERSION = 'v9.2.0';
// v9.2.0 — CFOP via Natureza de Operação vinculada (Fase 2).
//          Header e itens recebem CFOP/finalidade/tipo do registro de natureza
//          (fallback: natureza padrão do tenant → "Venda de Mercadoria" sistema).
//          cfop_override por item continua respeitado.
// v9.1.0 — versão anterior

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  // Get fiscal settings (OPTIONAL — rascunho NÃO depende de configuração fiscal)
  // Configuração só é exigida no momento da emissão (fiscal-emit).
  const { data: fiscalSettingsRaw } = await supabase
    .from('fiscal_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const isFiscalConfigured = !!(fiscalSettingsRaw && fiscalSettingsRaw.is_configured);

  // Defaults seguros para rascunho permissivo (usados quando emissor não configurado)
  const fiscalSettings: any = fiscalSettingsRaw || {};
  const serieNfe = isFiscalConfigured ? (fiscalSettings.serie_nfe || 1) : 0; // 0 = placeholder draft

  // CFOP/finalidade/tipo vêm da Natureza de Operação vinculada (Fase 2).
  // Resolve uma única vez por tenant (default sales nature → fallback "Venda de Mercadoria").
  const defaultNature: ResolvedFiscalNature | null = await resolveOperationNature(
    supabase,
    tenantId,
    { defaultNatureId: fiscalSettings.default_sales_nature_id || null },
  );
  if (!defaultNature) {
    console.warn(`[fiscal-auto-create-drafts] Tenant ${tenantId} sem natureza padrão de vendas resolvida — usando defaults 5102/6102.`);
  }

  let nextNumeroCursor = 0; // 0 = placeholder; só pré-aloca numeração quando configurado
  if (isFiscalConfigured) {
    nextNumeroCursor = await getNextFiscalNumber({
      supabase,
      tenantId,
      serie: serieNfe,
      fallbackNumeroAtual: fiscalSettings.numero_pedido_atual,
      docClass: 'pedido_venda',
    });
  } else {
    console.log(`[fiscal-auto-create-drafts] Tenant ${tenantId} sem emissor configurado — criando rascunho placeholder (numero=0, serie=0)`);
  }

  // Get paid orders without invoices
  let query = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      payment_status,
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
      shipping_carrier,
      shipping_method_name,
      shipping_service_name,
      free_shipping,
      payment_method,
      customer_name,
      customer_cpf,
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
    .not('status', 'in', '(cancelled,rejected)');

  const ordersWithInvoice = new Set((existingInvoices || []).map((inv: any) => inv.order_id));
  const ordersToCreate = paidOrders.filter((order: any) => !ordersWithInvoice.has(order.id));

  // ============= RE-AVALIAÇÃO DE AUTO-EMIT EM RASCUNHOS JÁ EXISTENTES =============
  // Cenário: pedido foi pago (rascunho criado) e depois transitou para 'ready_to_invoice'.
  // O gatilho re-enfileira o pedido; aqui detectamos rascunhos existentes (status=draft)
  // e disparamos fiscal-emit se a configuração de auto-emit casar com o status atual.
  // IMPORTANTE: roda APENAS em modo TRIGGER (singleOrderId definido) para evitar
  // avalanche de chamadas no CRON que tentaria reemitir todos os rascunhos antigos
  // (e bate em rate limit). Pedidos antigos travados são tratados manualmente.
  const ordersWithExistingDraft = singleOrderId
    ? paidOrders.filter((o: any) => ordersWithInvoice.has(o.id))
    : [];
  if (ordersWithExistingDraft.length > 0 && isFiscalConfigured && fiscalSettings.emissao_automatica === true) {
    // Gatilho único: dispara apenas quando o pedido está em 'ready_to_invoice'.
    const existingDraftIds = ordersWithExistingDraft.map((o: any) => o.id);
    const { data: draftInvoices } = await supabase
      .from('fiscal_invoices')
      .select('id, order_id, status, numero')
      .in('order_id', existingDraftIds)
      .eq('status', 'draft')
      .eq('fiscal_stage', 'pedido_venda');

    for (const inv of (draftInvoices || [])) {
      const order = ordersWithExistingDraft.find((o: any) => o.id === inv.order_id);
      if (!order || !inv.numero || inv.numero <= 0) continue;
      const orderStatus = String(order.status || '');
      if (orderStatus !== 'ready_to_invoice') continue;
      try {
        const { data: emitData, error: emitErr } = await supabase.functions.invoke('fiscal-emit', {
          body: { invoice_id: inv.id, tenant_id: tenantId, auto: true },
        });
        if (emitErr) {
          console.error(`[fiscal-auto-create-drafts] Auto-emit (rascunho existente) erro invoice=${inv.id}:`, emitErr);
        } else {
          console.log(`[fiscal-auto-create-drafts] Auto-emit (rascunho existente) ok invoice=${inv.id} pedido=${order.order_number} resp=${JSON.stringify(emitData).slice(0,300)}`);
        }
      } catch (err) {
        console.error(`[fiscal-auto-create-drafts] Erro disparando auto-emit em rascunho existente ${inv.id}:`, err);
      }
    }
  }

  console.log(`[fiscal-auto-create-drafts] Found ${ordersToCreate.length} orders needing drafts`);

  for (const order of ordersToCreate) {
    try {
      // Re-check current invoice existence to avoid race conditions
      const { data: currentInvoice } = await supabase
        .from('fiscal_invoices')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('order_id', order.id)
        .not('status', 'in', '(cancelled,rejected)')
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

      // CFOP vem da Natureza de Operação resolvida + UF + CRT do emitente (Fase 7)
      const emitterCrt = Number(fiscalSettings.crt || 1);
      const cfop = pickCfopForUf(defaultNature, fiscalSettings.endereco_uf, order.shipping_state, emitterCrt);
      const natureTax = pickTaxCodesForCrt(defaultNature, emitterCrt);

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

      // IMPORTANTE: Pedido de Venda sempre nasce com kits como kits. O
      // desmembramento em componentes acontece apenas em fiscal-prepare-invoice
      // no momento PV → NF (decisão sempre baseada na configuração atual).


      // Get fiscal product data + fallback from products table
      const productIds = itemsToProcess.map(item => item.product_id).filter(Boolean);
      
      const [{ data: fiscalProducts }, { data: productsData }] = await Promise.all([
        supabase
          .from('fiscal_products')
          .select('*')
          .in('product_id', productIds),
        supabase
          .from('products')
          .select('id, ncm, cest, origin_code, gtin, barcode, weight')
          .in('id', productIds),
      ]);

      const fiscalProductMap = new Map(
        (fiscalProducts || []).map((fp: any) => [fp.product_id, fp])
      );
      const productMap = new Map(
        (productsData || []).map((p: any) => [p.id, p])
      );

      const sanitizeGtin = (v: any): string => {
        const s = String(v ?? '').trim().toUpperCase();
        if (!s) return 'SEM GTIN';
        if (s === 'SEM GTIN') return 'SEM GTIN';
        const digits = s.replace(/\D/g, '');
        if ([8, 12, 13, 14].includes(digits.length)) return digits;
        return 'SEM GTIN';
      };

      // Settings de tributação (regime + alíquotas padrão)
      const taxSettings: FiscalSettingsTax = {
        regime_tributario: fiscalSettings.regime_tributario || 'simples_nacional',
        pis_aliquota_padrao: Number(fiscalSettings.pis_aliquota_padrao || 0),
        cofins_aliquota_padrao: Number(fiscalSettings.cofins_aliquota_padrao || 0),
        icms_aliquota_padrao: Number(fiscalSettings.icms_aliquota_padrao || 0),
        pis_cst_padrao: fiscalSettings.pis_cst_padrao || '49',
        cofins_cst_padrao: fiscalSettings.cofins_cst_padrao || '49',
        cst_padrao: fiscalSettings.cst_padrao,
        csosn_padrao: fiscalSettings.csosn_padrao,
      };

      // Build invoice items (fiscal_products prioritário, products como fallback)
      const invoiceItemsRaw = itemsToProcess.map((item, index) => {
        const fiscalProduct: any = fiscalProductMap.get(item.product_id);
        const product: any = productMap.get(item.product_id);
        const gtin = sanitizeGtin(product?.gtin || product?.barcode);
        const cestRaw = fiscalProduct?.cest || product?.cest;
        const taxes = calculateItemTaxes(Number(item.total_price || 0), taxSettings, fiscalProduct, natureTax);
        return {
          numero_item: index + 1,
          order_item_id: item.id || null,
          product_id: item.product_id || null,
          codigo_produto: item.sku || item.product_id?.substring(0, 8) || `PROD${index + 1}`,
          descricao: item.product_name || 'Produto',
          ncm: fiscalProduct?.ncm || product?.ncm || '',
          cfop: fiscalProduct?.cfop_override || cfop,
          unidade: fiscalProduct?.unidade_comercial || 'UN',
          quantidade: item.quantity,
          valor_unitario: item.unit_price,
          valor_total: item.total_price,
          origem: (() => {
            const raw = fiscalProduct?.origem ?? product?.origin_code ?? fiscalSettings.origin_code ?? 0;
            const n = Number(raw);
            return Number.isFinite(n) ? Math.trunc(n) : 0;
          })(),
          csosn: taxes.csosn,
          cst: taxes.cst,
          icms_base: taxes.icms_base,
          icms_aliquota: taxes.icms_aliquota,
          icms_valor: taxes.icms_valor,
          pis_cst: taxes.pis_cst,
          pis_base: taxes.pis_base,
          pis_aliquota: taxes.pis_aliquota,
          pis_valor: taxes.pis_valor,
          cofins_cst: taxes.cofins_cst,
          cofins_base: taxes.cofins_base,
          cofins_aliquota: taxes.cofins_aliquota,
          cofins_valor: taxes.cofins_valor,
          gtin,
          gtin_tributavel: gtin,
          cest: cestRaw ? String(cestRaw).replace(/\D/g, '').substring(0, 7) || null : null,
          _weight_grams: Number(product?.weight || 0),
        };
      });

      const pesoBrutoKg = invoiceItemsRaw.reduce(
        (acc: number, it: any) => acc + (Number(it._weight_grams || 0) * Number(it.quantidade || 0)) / 1000,
        0,
      );
      const invoiceItems = invoiceItemsRaw.map(({ _weight_grams, ...rest }: any) => rest);

      // Lookup IBGE: CEP é fonte primária (ViaCEP/BrasilAPI com cache); fallback por nome.
      let destMunicipioCodigo: string | null = null;
      const cepResolved = await resolveAddressByCep(supabase, order.shipping_postal_code);
      if (cepResolved?.ibge) {
        destMunicipioCodigo = cepResolved.ibge;
      } else {
        destMunicipioCodigo = await getIbgeCodigo(supabase, order.shipping_city, order.shipping_state);
      }

      const customerData = Array.isArray(order.customer) ? order.customer[0] : order.customer;
      // Use paid_at as NF date (falls back to order created_at)
      const nfDate = order.paid_at || order.created_at;
      const draftDataBase = {
        tenant_id: tenantId,
        order_id: order.id,
        serie: serieNfe,
        status: 'draft',
        tipo_documento: defaultNature?.tipo_documento ?? 1,
        finalidade_emissao: defaultNature?.finalidade ?? 1,
        natureza_operacao_id: defaultNature?.id ?? null,
        fiscal_stage: 'pedido_venda',
        natureza_operacao: (defaultNature?.nome || 'VENDA DE MERCADORIA').toUpperCase(),
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
        // Nome oficial do município vem do CEP (evita typo do cliente derrubar xMun na SEFAZ)
        dest_endereco_municipio: cepResolved?.cidade || order.shipping_city,
        dest_endereco_municipio_codigo: destMunicipioCodigo,
        dest_endereco_uf: cepResolved?.uf || order.shipping_state,
        dest_endereco_cep: order.shipping_postal_code,
        dest_telefone: customerData?.phone || null,
        dest_email: customerData?.email || null,
        peso_bruto: pesoBrutoKg > 0 ? Number(pesoBrutoKg.toFixed(3)) : null,
        peso_liquido: pesoBrutoKg > 0 ? Number(pesoBrutoKg.toFixed(3)) : null,
        quantidade_volumes: invoiceItems.length > 0 ? 1 : null,
        emitido_por: userId,
        created_at: nfDate,
        // Auto-herda transporte (modalidade SEFAZ + transportadora) e pagamento (tPag SEFAZ + indicador + valor)
        ...buildFiscalOrderInheritance(order),
      };

      let invoice: any;
      let numero: number;

      if (isFiscalConfigured) {
        // Caminho normal: aloca numeração de Pedido de Venda com retry
        const result = await insertFiscalInvoiceWithRetry({
          supabase,
          tenantId,
          serie: serieNfe,
          initialNumber: nextNumeroCursor,
          logPrefix: 'fiscal-auto-create-drafts',
          docClass: 'pedido_venda',
          buildDraftData: (numeroFiscal: number) => ({
            ...draftDataBase,
            numero: numeroFiscal,
          }),
        });
        invoice = result.invoice;
        numero = result.numero;
        nextNumeroCursor = Math.max(nextNumeroCursor, numero + 1);
      } else {
        // Placeholder: numero=0, serie=0. Numeração real será alocada na emissão.
        const { data: insertedInvoice, error: insertError } = await supabase
          .from('fiscal_invoices')
          .insert({ ...draftDataBase, numero: 0 })
          .select()
          .single();

        if (insertError || !insertedInvoice) {
          console.error(`[fiscal-auto-create-drafts] Placeholder insert error for order ${order.order_number}:`, insertError);
          errors.push(`Pedido ${order.order_number}: erro ao criar rascunho placeholder`);
          continue;
        }
        invoice = insertedInvoice;
        numero = 0;
      }

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

      // ============= AUTO-EMISSÃO =============
      // Dispara fiscal-emit em fire-and-forget se TODAS as condições forem verdadeiras:
      //  1. Emissor fiscal totalmente configurado
      //  2. fiscal_settings.emissao_automatica === true
      //  3. Numeração válida (numero > 0)
      //  4. Pedido em 'ready_to_invoice' (único gatilho oficial — opção 'paid' legada removida)
      // Notas com pendências (rejected) ou erro técnico permanecem como rascunho/rejeitadas
      // e aparecem na Central de Execuções para ação manual.
      const orderStatus = String(order.status || '');
      const statusMatches = orderStatus === 'ready_to_invoice';

      if (isFiscalConfigured && fiscalSettings.emissao_automatica === true && numero > 0 && statusMatches) {
        try {
          const { data: emitData, error: emitErr } = await supabase.functions.invoke('fiscal-emit', {
            body: { invoice_id: invoice.id, tenant_id: tenantId, auto: true },
          });
          if (emitErr) {
            console.error(`[fiscal-auto-create-drafts] Auto-emit erro invoice=${invoice.id}:`, emitErr);
          } else {
            console.log(`[fiscal-auto-create-drafts] Auto-emit ok invoice=${invoice.id} pedido=${order.order_number} resp=${JSON.stringify(emitData).slice(0,300)}`);
          }
        } catch (autoEmitErr) {
          console.error(`[fiscal-auto-create-drafts] Erro ao disparar auto-emit:`, autoEmitErr);
        }
      } else if (fiscalSettings.emissao_automatica === true && numero > 0 && !statusMatches) {
        console.log(`[fiscal-auto-create-drafts] Rascunho criado para pedido ${order.order_number} (status=${orderStatus}); auto-emit aguardando status 'ready_to_invoice'.`);
      }

    } catch (error) {
      console.error(`[fiscal-auto-create-drafts] Error processing order ${order.order_number}:`, error);
      errors.push(`Pedido ${order.order_number}: erro ao criar rascunho`);
    }
  }

  // Cursor numero_pedido_atual não é mais avançado por criação de PV.
  // PV puro pode ser excluído e o número volta a estar disponível.
  // A próxima alocação é sempre derivada do maior PV vivo + 1.

  console.log(`[fiscal-auto-create-drafts] Completed for tenant ${tenantId}. Created ${created.count} drafts.`);
  return { created: created.count, errors };
}

// ============================
// MAIN HANDLER
// ============================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;
    const isCronMode = isServiceRoleCall;

    // ========== TRIGGER MODE: single order from DB trigger ==========
    // Detected by presence of order_id + tenant_id in body with cron-like auth
    let body: any = {};
    try {
      body = await req.json();
    } catch { /* empty body is ok for cron */ }

    if (isServiceRoleCall && body?.order_id && body?.tenant_id) {
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

    // ========== CRON MODE: process ALL tenants with approved orders ==========
    if (isCronMode) {
      console.log(`[fiscal-auto-create-drafts][${VERSION}] CRON mode — processing all tenants with approved orders`);

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Itera TODOS tenants que têm pedidos aprovados (independente de fiscal_settings).
      // Rascunho é permissivo; configuração é exigida apenas na emissão.
      const { data: tenantsWithOrders, error: tenantsError } = await supabase
        .from('orders')
        .select('tenant_id')
        .eq('payment_status', 'approved')
        .in('status', ['paid', 'ready_to_invoice']);

      if (tenantsError) {
        console.error('[fiscal-auto-create-drafts] Error fetching tenants:', tenantsError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao listar tenants' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const uniqueTenantIds = Array.from(new Set((tenantsWithOrders || []).map((r: any) => r.tenant_id)));

      if (uniqueTenantIds.length === 0) {
        console.log('[fiscal-auto-create-drafts] No tenants with approved orders');
        return new Response(
          JSON.stringify({ success: true, mode: 'cron', tenants_processed: 0, total_created: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let totalCreated = 0;
      const allErrors: string[] = [];

      for (const tenantId of uniqueTenantIds) {
        try {
          const result = await processTenanDrafts(supabase, tenantId, null);
          totalCreated += result.created;
          allErrors.push(...result.errors);
        } catch (err) {
          console.error(`[fiscal-auto-create-drafts] Error for tenant ${tenantId}:`, err);
          allErrors.push(`Tenant ${tenantId}: ${err instanceof Error ? err.message : 'Erro'}`);
        }
      }

      console.log(`[fiscal-auto-create-drafts] CRON complete. ${uniqueTenantIds.length} tenants, ${totalCreated} drafts created.`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'cron',
          tenants_processed: uniqueTenantIds.length, 
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

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Processamento global de rascunhos fiscais é restrito à rotina interna.',
        code: 'GLOBAL_PROCESSING_FORBIDDEN',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'auto-create-drafts' });
  }
});
