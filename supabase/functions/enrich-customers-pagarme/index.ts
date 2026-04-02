// =============================================
// ENRICH CUSTOMERS FROM PAGAR.ME
// Fetches CPF, address and phone from Pagar.me orders
// and fills missing data in customers + orders tables
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id required");

    // Get orders with approved payment but missing CPF
    const { data: orders, error: ordErr } = await supabase
      .from("orders")
      .select("id, order_number, customer_email, customer_name, payment_gateway_id, customer_cpf")
      .eq("tenant_id", tenant_id)
      .eq("payment_status", "approved")
      .not("payment_gateway_id", "is", null)
      .or("customer_cpf.is.null,customer_cpf.eq.")
      .order("created_at", { ascending: false });

    if (ordErr) throw ordErr;

    console.log(`Found ${orders?.length || 0} orders missing CPF`);

    const results = { enriched: 0, skipped: 0, errors: 0, details: [] as any[] };

    for (const order of (orders || [])) {
      try {
        // Fetch order from Pagar.me
        const pagarmeOrderId = order.payment_gateway_id;
        const authHeader = btoa(`${PAGARME_API_KEY}:`);
        
        const resp = await fetch(`https://api.pagar.me/core/v5/orders/${pagarmeOrderId}`, {
          headers: { Authorization: `Basic ${authHeader}` },
        });

        if (!resp.ok) {
          console.log(`Pagar.me ${pagarmeOrderId}: HTTP ${resp.status}`);
          results.skipped++;
          results.details.push({ order: order.order_number, status: "pagarme_error", http: resp.status });
          continue;
        }

        const pgOrder = await resp.json();
        const customer = pgOrder.customer || {};
        const address = pgOrder.shipping?.address || pgOrder.charges?.[0]?.last_transaction?.card?.billing_address || {};

        const cpf = customer.document || null;
        const phone = customer.phones?.mobile_phone
          ? `${customer.phones.mobile_phone.area_code}${customer.phones.mobile_phone.number}`
          : customer.phones?.home_phone
          ? `${customer.phones.home_phone.area_code}${customer.phones.home_phone.number}`
          : null;

        if (!cpf) {
          results.skipped++;
          results.details.push({ order: order.order_number, status: "no_cpf_in_pagarme" });
          continue;
        }

        // Update order with CPF and billing address
        const orderUpdate: Record<string, any> = { customer_cpf: cpf };
        
        if (address.line_1) {
          // Pagar.me line_1 format: "number, street, neighborhood"
          const parts = (address.line_1 || "").split(",").map((s: string) => s.trim());
          orderUpdate.billing_number = parts[0] || null;
          orderUpdate.billing_street = parts[1] || null;
          orderUpdate.billing_neighborhood = parts[2] || null;
          orderUpdate.billing_city = address.city || null;
          orderUpdate.billing_state = address.state || null;
          orderUpdate.billing_postal_code = address.zip_code || null;
          orderUpdate.billing_country = address.country || "BR";
        }

        // Also update shipping address if empty
        const shippingAddr = pgOrder.shipping?.address;
        if (shippingAddr?.line_1) {
          const sParts = (shippingAddr.line_1 || "").split(",").map((s: string) => s.trim());
          orderUpdate.shipping_number = orderUpdate.shipping_number || sParts[0] || null;
          orderUpdate.shipping_street = orderUpdate.shipping_street || sParts[1] || null;
          orderUpdate.shipping_neighborhood = orderUpdate.shipping_neighborhood || sParts[2] || null;
          orderUpdate.shipping_city = orderUpdate.shipping_city || shippingAddr.city || null;
          orderUpdate.shipping_state = orderUpdate.shipping_state || shippingAddr.state || null;
          orderUpdate.shipping_postal_code = orderUpdate.shipping_postal_code || shippingAddr.zip_code || null;
          orderUpdate.shipping_country = orderUpdate.shipping_country || shippingAddr.country || "BR";
        }

        await supabase.from("orders").update(orderUpdate).eq("id", order.id);

        // Update customer CPF and phone
        const custUpdate: Record<string, any> = {};
        custUpdate.cpf = cpf;
        if (phone) custUpdate.phone = phone;

        await supabase
          .from("customers")
          .update(custUpdate)
          .eq("tenant_id", tenant_id)
          .eq("email", order.customer_email)
          .or("cpf.is.null,cpf.eq.");

        // Also save customer address
        if (address.line_1 || shippingAddr?.line_1) {
          const addrSource = shippingAddr?.line_1 ? shippingAddr : address;
          const addrParts = (addrSource.line_1 || "").split(",").map((s: string) => s.trim());
          
          // Get customer id
          const { data: cust } = await supabase
            .from("customers")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("email", order.customer_email)
            .single();

          if (cust) {
            // Check if address already exists
            const { data: existing } = await supabase
              .from("customer_addresses")
              .select("id")
              .eq("customer_id", cust.id)
              .limit(1);

            if (!existing || existing.length === 0) {
              await supabase.from("customer_addresses").insert({
                customer_id: cust.id,
                tenant_id: tenant_id,
                label: "Principal",
                street: addrParts[1] || "",
                number: addrParts[0] || "",
                neighborhood: addrParts[2] || "",
                city: addrSource.city || "",
                state: addrSource.state || "",
                postal_code: addrSource.zip_code || "",
                country: addrSource.country || "BR",
                is_default: true,
              });
            }
          }
        }

        results.enriched++;
        results.details.push({ order: order.order_number, cpf, status: "enriched" });
        console.log(`✅ ${order.order_number} → CPF: ${cpf}`);

        // Rate limit: 200ms between requests
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        results.errors++;
        results.details.push({ order: order.order_number, status: "error", message: String(err) });
        console.error(`❌ ${order.order_number}: ${err}`);
      }
    }

    console.log(`Done: ${results.enriched} enriched, ${results.skipped} skipped, ${results.errors} errors`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Fatal:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
