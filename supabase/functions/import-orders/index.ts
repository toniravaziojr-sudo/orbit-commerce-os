import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedOrder {
  orderNumber: string;
  email: string;
  financialStatus: string;
  paidAt: string | null;
  fulfillmentStatus: string;
  subtotal: number;
  shipping: number;
  taxes: number;
  total: number;
  discountCode: string | null;
  discountAmount: number;
  shippingMethod: string | null;
  createdAt: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  trackingCode: string | null;
  cancelledAt: string | null;
  shippingStreet: string | null;
  shippingNumber: string | null;
  shippingComplement: string | null;
  shippingNeighborhood: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  items: Array<{
    quantity: number;
    name: string;
    price: number;
    sku: string;
    discount: number;
  }>;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  try {
    // Format: 2025-12-09 17:01:41 -0300
    const match = dateStr.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{4})/);
    if (match) {
      const [_, date, time, tz] = match;
      return new Date(`${date}T${time}${tz.slice(0, 3)}:${tz.slice(3)}`).toISOString();
    }
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

function mapFinancialStatus(status: string): string {
  const map: Record<string, string> = {
    'paid': 'paid',
    'pending': 'awaiting_payment',
    'expired': 'cancelled',
    'refunded': 'returned',
    'partially_refunded': 'paid',
    'authorized': 'awaiting_payment',
    'voided': 'cancelled',
  };
  return map[status?.toLowerCase()] || 'pending';
}

function mapPaymentStatus(status: string): string {
  const map: Record<string, string> = {
    'paid': 'approved',
    'pending': 'pending',
    'expired': 'cancelled',
    'refunded': 'refunded',
    'partially_refunded': 'approved',
    'authorized': 'processing',
    'voided': 'cancelled',
  };
  return map[status?.toLowerCase()] || 'pending';
}

function mapFulfillmentStatus(status: string): string {
  const map: Record<string, string> = {
    'fulfilled': 'delivered',
    'unfulfilled': 'pending',
    'partial': 'processing',
    'shipped': 'shipped',
  };
  return map[status?.toLowerCase()] || 'pending';
}

function mapPaymentMethod(method: string): string | null {
  if (!method) return null;
  const methodLower = method.toLowerCase();
  if (methodLower.includes('pix')) return 'pix';
  if (methodLower.includes('cartão de crédito') || methodLower.includes('credit')) return 'credit_card';
  if (methodLower.includes('cartão de débito') || methodLower.includes('debit')) return 'debit_card';
  if (methodLower.includes('boleto')) return 'boleto';
  if (methodLower.includes('mercado pago')) return 'mercado_pago';
  if (methodLower.includes('pagar.me') || methodLower.includes('pagarme')) return 'pagarme';
  return null;
}

function extractTrackingCode(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Cód\. de Rastreamento:\s*([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const tenantId = formData.get("tenantId") as string;

    if (!file || !tenantId) {
      return new Response(
        JSON.stringify({ error: "File and tenantId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting order import for tenant ${tenantId}`);
    
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV file is empty or has no data rows" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = parseCSVLine(lines[0]);
    console.log(`CSV headers count: ${headers.length}`);
    
    // Build header index map
    const headerIndex: Record<string, number> = {};
    headers.forEach((h, i) => { headerIndex[h.toLowerCase().trim()] = i; });

    // Group orders by order number (Name column), since multi-item orders have multiple rows
    const ordersMap = new Map<string, ParsedOrder>();
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 10) continue;

      const orderNumber = values[headerIndex['name']] || '';
      if (!orderNumber || orderNumber.trim() === '') continue;

      const existingOrder = ordersMap.get(orderNumber);
      
      const item = {
        quantity: parseInt(values[headerIndex['lineitem quantity']] || '1') || 1,
        name: values[headerIndex['lineitem name']] || 'Produto',
        price: parseFloat(values[headerIndex['lineitem price']] || '0') || 0,
        sku: values[headerIndex['lineitem sku']] || '',
        discount: parseFloat(values[headerIndex['lineitem discount']] || '0') || 0,
      };

      if (existingOrder) {
        // Add item to existing order
        existingOrder.items.push(item);
      } else {
        // Create new order
        const notes = values[headerIndex['notes']] || null;
        
        ordersMap.set(orderNumber, {
          orderNumber,
          email: values[headerIndex['email']] || '',
          financialStatus: values[headerIndex['financial status']] || 'pending',
          paidAt: parseDate(values[headerIndex['paid at']] || ''),
          fulfillmentStatus: values[headerIndex['fulfillment status']] || 'unfulfilled',
          subtotal: parseFloat(values[headerIndex['subtotal']] || '0') || 0,
          shipping: parseFloat(values[headerIndex['shipping']] || '0') || 0,
          taxes: parseFloat(values[headerIndex['taxes']] || '0') || 0,
          total: parseFloat(values[headerIndex['total']] || '0') || 0,
          discountCode: values[headerIndex['discount code']] || null,
          discountAmount: parseFloat(values[headerIndex['discount amount']] || '0') || 0,
          shippingMethod: values[headerIndex['shipping method']] || null,
          createdAt: values[headerIndex['created at']] || new Date().toISOString(),
          paymentMethod: values[headerIndex['payment method']] || null,
          paymentReference: values[headerIndex['payment reference']] || null,
          customerName: values[headerIndex['shipping name']] || values[headerIndex['billing name']] || 'Cliente',
          customerPhone: values[headerIndex['shipping phone']] || values[headerIndex['billing phone']] || null,
          notes,
          trackingCode: extractTrackingCode(notes),
          cancelledAt: parseDate(values[headerIndex['cancelled at']] || ''),
          shippingStreet: values[headerIndex['shipping address1']] || null,
          shippingNumber: null, // Extract from address if possible
          shippingComplement: values[headerIndex['shipping address2']] || null,
          shippingNeighborhood: null,
          shippingCity: values[headerIndex['shipping city']] || null,
          shippingState: values[headerIndex['shipping province']] || null,
          shippingPostalCode: values[headerIndex['shipping zip']] || null,
          shippingCountry: values[headerIndex['shipping country']] || 'BR',
          items: [item],
        });
      }
    }

    console.log(`Parsed ${ordersMap.size} unique orders`);

    // Get existing customers by email for linking
    const { data: customers } = await supabase
      .from('customers')
      .select('id, email')
      .eq('tenant_id', tenantId);

    const customerEmailMap = new Map<string, string>();
    customers?.forEach(c => customerEmailMap.set(c.email.toLowerCase(), c.id));

    // Get existing orders to avoid duplicates
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('order_number')
      .eq('tenant_id', tenantId);

    const existingOrderNumbers = new Set(existingOrders?.map(o => o.order_number) || []);

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (const [orderNumber, order] of ordersMap) {
      try {
        // Skip if order already exists
        if (existingOrderNumbers.has(orderNumber)) {
          skipped++;
          continue;
        }

        const customerId = customerEmailMap.get(order.email.toLowerCase()) || null;
        const orderStatus = mapFinancialStatus(order.financialStatus);
        const paymentStatus = mapPaymentStatus(order.financialStatus);
        const shippingStatus = mapFulfillmentStatus(order.fulfillmentStatus);
        const paymentMethod = mapPaymentMethod(order.paymentMethod || '');
        
        // Determine payment gateway from method string
        let paymentGateway = null;
        if (order.paymentMethod) {
          if (order.paymentMethod.toLowerCase().includes('mercado pago')) {
            paymentGateway = 'mercado_pago';
          } else if (order.paymentMethod.toLowerCase().includes('pagar.me')) {
            paymentGateway = 'pagarme';
          }
        }

        // Create order
        const { data: newOrder, error: orderError } = await supabase
          .from('orders')
          .insert({
            tenant_id: tenantId,
            order_number: orderNumber,
            customer_id: customerId,
            status: orderStatus,
            subtotal: order.subtotal,
            discount_total: order.discountAmount,
            shipping_total: order.shipping,
            tax_total: order.taxes,
            total: order.total,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            payment_gateway: paymentGateway,
            payment_gateway_id: order.paymentReference,
            paid_at: order.paidAt,
            shipping_status: shippingStatus,
            shipping_carrier: order.shippingMethod,
            tracking_code: order.trackingCode,
            shipped_at: shippingStatus === 'shipped' || shippingStatus === 'delivered' ? order.paidAt : null,
            delivered_at: shippingStatus === 'delivered' ? order.paidAt : null,
            customer_name: order.customerName,
            customer_email: order.email,
            customer_phone: order.customerPhone,
            shipping_street: order.shippingStreet,
            shipping_complement: order.shippingComplement,
            shipping_city: order.shippingCity,
            shipping_state: order.shippingState,
            shipping_postal_code: order.shippingPostalCode,
            shipping_country: order.shippingCountry,
            customer_notes: order.notes,
            cancelled_at: order.cancelledAt,
            created_at: parseDate(order.createdAt) || new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Error creating order ${orderNumber}:`, orderError);
          errors.push(`${orderNumber}: ${orderError.message}`);
          continue;
        }

        // Create order items
        const orderItems = order.items.map(item => ({
          order_id: newOrder.id,
          sku: item.sku || 'N/A',
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          discount_amount: item.discount,
          total_price: (item.price - item.discount) * item.quantity,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error(`Error creating items for order ${orderNumber}:`, itemsError);
        }

        // Create history entry
        await supabase.from('order_history').insert({
          order_id: newOrder.id,
          action: 'order_imported',
          description: `Pedido importado do Shopify`,
          new_value: { status: orderStatus },
        });

        imported++;
      } catch (e) {
        console.error(`Error processing order ${orderNumber}:`, e);
        errors.push(`${orderNumber}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        errors: errors.slice(0, 10), // Return first 10 errors only
        totalErrors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
