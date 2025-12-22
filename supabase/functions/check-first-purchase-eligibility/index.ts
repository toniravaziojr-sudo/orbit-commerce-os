// ============================================
// CHECK FIRST PURCHASE ELIGIBILITY
// Server-side check if customer is eligible for first-purchase discount
// Returns eligible discount if found
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EligibilityRequest {
  store_host: string;
  customer_email: string;
  subtotal: number;
  shipping_price?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: EligibilityRequest = await req.json();
    const { store_host, customer_email, subtotal, shipping_price = 0 } = body;

    console.log("[check-first-purchase] Request:", { store_host, customer_email, subtotal });

    if (!store_host || !customer_email) {
      return new Response(
        JSON.stringify({ eligible: false, error: "store_host e customer_email são obrigatórios" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve tenant from host
    const { data: domain } = await supabase
      .from("tenant_domains")
      .select("tenant_id")
      .eq("domain", store_host.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    let tenantId = domain?.tenant_id;

    if (!tenantId) {
      const slugMatch = store_host.match(/^([^.]+)\.shops\./i);
      if (slugMatch) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("id")
          .eq("slug", slugMatch[1].toLowerCase())
          .maybeSingle();
        tenantId = tenant?.id;
      }
    }

    if (!tenantId) {
      console.log("[check-first-purchase] Tenant not found for host:", store_host);
      return new Response(
        JSON.stringify({ eligible: false, error: "Loja não encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = customer_email.trim().toLowerCase();

    // Check if customer has previous valid orders (not cancelled)
    // "Valid order" = status != 'cancelled' AND (payment_status = 'paid' OR was at least placed)
    const { data: existingOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("tenant_id", tenantId)
      .ilike("customer_email", normalizedEmail)
      .neq("status", "cancelled")
      .limit(1);

    if (ordersError) {
      console.error("[check-first-purchase] Error checking orders:", ordersError);
      return new Response(
        JSON.stringify({ eligible: false, error: "Erro ao verificar histórico" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // If customer has any valid orders, not eligible
    if (existingOrders && existingOrders.length > 0) {
      console.log("[check-first-purchase] Customer has previous orders, not eligible");
      return new Response(
        JSON.stringify({ eligible: false, reason: "already_purchased" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find active first-purchase discount
    const now = new Date().toISOString();
    const { data: discount, error: discountError } = await supabase
      .from("discounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("auto_apply_first_purchase", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("value", { ascending: false }) // Prefer higher value discount
      .limit(1)
      .maybeSingle();

    if (discountError) {
      console.error("[check-first-purchase] Error finding discount:", discountError);
      return new Response(
        JSON.stringify({ eligible: false, error: "Erro ao buscar desconto" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!discount) {
      console.log("[check-first-purchase] No first-purchase discount configured");
      return new Response(
        JSON.stringify({ eligible: false, reason: "no_discount_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check minimum subtotal
    if (discount.min_subtotal && subtotal < Number(discount.min_subtotal)) {
      return new Response(
        JSON.stringify({ 
          eligible: false, 
          reason: "min_subtotal_not_met",
          min_required: Number(discount.min_subtotal)
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate discount amount
    let discountAmount = 0;
    let freeShipping = false;
    let finalShipping = shipping_price;

    switch (discount.type) {
      case "order_percent":
        discountAmount = Math.round((subtotal * Number(discount.value) / 100) * 100) / 100;
        break;
      case "order_fixed":
        discountAmount = Math.min(Number(discount.value), subtotal);
        break;
      case "free_shipping":
        freeShipping = true;
        finalShipping = 0;
        break;
    }

    console.log("[check-first-purchase] Eligible for first purchase discount:", discount.name);

    return new Response(
      JSON.stringify({
        eligible: true,
        discount_id: discount.id,
        discount_name: discount.name,
        discount_code: discount.code || "PRIMEIRA_COMPRA",
        discount_type: discount.type,
        discount_value: Number(discount.value),
        discount_amount: discountAmount,
        free_shipping: freeShipping,
        is_auto_applied: true,
        original_subtotal: subtotal,
        original_shipping: shipping_price,
        final_subtotal: subtotal - discountAmount,
        final_shipping: finalShipping,
        final_total: (subtotal - discountAmount) + finalShipping,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[check-first-purchase] Error:", error);
    return new Response(
      JSON.stringify({ eligible: false, error: "Erro interno" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
