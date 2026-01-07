import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant_id from user's tenant_users
    const { data: tenantUser, error: tenantError } = await supabaseAdmin
      .from('tenant_users')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (tenantError || !tenantUser) {
      console.error('[admin-create-test-order] tenant lookup error:', tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is owner or admin
    if (tenantUser.role !== 'owner' && tenantUser.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas owner/admin podem criar pedidos de teste.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    console.log(`[admin-create-test-order] Creating test order for tenant ${tenantId}`);

    // Generate test order number with TEST prefix
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `TEST-${timestamp}${random}`;

    // Create the test order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        tenant_id: tenantId,
        order_number: orderNumber,
        customer_name: 'Cliente Teste (Rastreio)',
        customer_email: user.email || 'teste@teste.com',
        customer_phone: '11999999999',
        status: 'pending',
        payment_status: 'pending',
        shipping_status: 'pending',
        subtotal: 100,
        discount_total: 0,
        shipping_total: 15,
        tax_total: 0,
        total: 115,
        shipping_street: 'Rua de Teste',
        shipping_number: '123',
        shipping_neighborhood: 'Centro',
        shipping_city: 'São Paulo',
        shipping_state: 'SP',
        shipping_postal_code: '01310-100',
        shipping_country: 'BR',
        internal_notes: '[PEDIDO TESTE] Criado para validar tracking automático. Pode ser removido após teste.',
      })
      .select()
      .single();

    if (orderError) {
      console.error('[admin-create-test-order] order creation error:', orderError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar pedido de teste', details: orderError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-create-test-order] Order created: ${order.order_number} (${order.id})`);

    // Create a dummy order item
    const { error: itemError } = await supabaseAdmin
      .from('order_items')
      .insert({
        order_id: order.id,
        product_id: null, // dummy item
        sku: 'TESTE-SKU-001',
        product_name: 'Produto de Teste (Rastreio)',
        quantity: 1,
        unit_price: 100,
        discount_amount: 0,
        total_price: 100,
      });

    if (itemError) {
      console.error('[admin-create-test-order] item creation error:', itemError);
      // Don't fail the whole operation, order was created
    }

    // Create a shipment ready for tracking
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .insert({
        order_id: order.id,
        tenant_id: tenantId,
        carrier: 'unknown', // Will be inferred from tracking code
        tracking_code: null, // To be filled by user
        status: 'unknown',
        next_poll_at: new Date().toISOString(), // Ready for polling immediately
        metadata: { is_test: true },
      })
      .select()
      .single();

    if (shipmentError) {
      console.error('[admin-create-test-order] shipment creation error:', shipmentError);
      // Don't fail, order was created
    }

    // Add order history
    await supabaseAdmin.from('order_history').insert({
      order_id: order.id,
      author_id: user.id,
      action: 'test_order_created',
      description: `Pedido de teste ${orderNumber} criado para validar tracking automático`,
      new_value: { status: 'pending', is_test: true },
    });

    console.log(`[admin-create-test-order] Test order complete: ${order.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
        },
        shipment: shipment ? {
          id: shipment.id,
        } : null,
        message: `Pedido de teste ${order.order_number} criado com sucesso! Agora insira um código de rastreio real no detalhe do pedido.`,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[admin-create-test-order] unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
