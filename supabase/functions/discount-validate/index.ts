import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface ValidateDiscountRequest {
  store_host: string;
  code: string;
  subtotal: number;
  items?: CartItem[];
  shipping_price?: number;
  customer_email?: string;
}

interface DiscountBreakdown {
  valid: boolean;
  error?: string;
  discount_id?: string;
  discount_name?: string;
  discount_code?: string;
  discount_type?: string;
  discount_value?: number;
  discount_amount: number;
  free_shipping: boolean;
  original_subtotal: number;
  original_shipping: number;
  final_subtotal: number;
  final_shipping: number;
  final_total: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ValidateDiscountRequest = await req.json();
    const { store_host, code, subtotal, shipping_price = 0, customer_email } = body;

    console.log("[discount-validate] Request:", { store_host, code, subtotal, shipping_price, customer_email });

    if (!store_host || !code) {
      return new Response(
        JSON.stringify({ valid: false, error: "store_host e code são obrigatórios", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolver tenant pelo host
    const { data: domain } = await supabase
      .from("tenant_domains")
      .select("tenant_id")
      .eq("domain", store_host.toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    let tenantId = domain?.tenant_id;

    // Se não encontrou por domínio, tentar por slug (host pode ser slug.shops.comandocentral.com.br)
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
      console.log("[discount-validate] Tenant not found for host:", store_host);
      return new Response(
        JSON.stringify({ valid: false, error: "Loja não encontrada", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar cupom pelo código (case-insensitive)
    const { data: discount, error: discountError } = await supabase
      .from("discounts")
      .select("*")
      .eq("tenant_id", tenantId)
      .ilike("code", code.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (discountError) {
      console.error("[discount-validate] DB error:", discountError);
      return new Response(
        JSON.stringify({ valid: false, error: "Erro ao buscar cupom", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!discount) {
      console.log("[discount-validate] Coupon not found:", code);
      return new Response(
        JSON.stringify({ valid: false, error: "Cupom inválido ou não encontrado", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();

    // Verificar data de início
    if (discount.starts_at && new Date(discount.starts_at) > now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Este cupom ainda não está ativo", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar data de fim
    if (discount.ends_at && new Date(discount.ends_at) < now) {
      return new Response(
        JSON.stringify({ valid: false, error: "Este cupom expirou", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar valor mínimo do carrinho
    if (discount.min_subtotal && subtotal < Number(discount.min_subtotal)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `Valor mínimo do pedido: R$ ${Number(discount.min_subtotal).toFixed(2).replace('.', ',')}`, 
          discount_amount: 0, 
          free_shipping: false 
        } as DiscountBreakdown),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar limite total de usos
    if (discount.usage_limit_total) {
      const { data: totalUsage } = await supabase.rpc("get_discount_usage", { p_discount_id: discount.id });
      if (totalUsage >= discount.usage_limit_total) {
        return new Response(
          JSON.stringify({ valid: false, error: "Este cupom atingiu o limite de usos", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Verificar limite por cliente
    if (discount.usage_limit_per_customer && customer_email) {
      const { data: customerUsage } = await supabase.rpc("get_discount_usage_by_customer", { 
        p_discount_id: discount.id, 
        p_email: customer_email 
      });
      if (customerUsage >= discount.usage_limit_per_customer) {
        return new Response(
          JSON.stringify({ valid: false, error: "Você já utilizou este cupom o máximo de vezes permitido", discount_amount: 0, free_shipping: false } as DiscountBreakdown),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Calcular desconto
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

    const finalSubtotal = subtotal - discountAmount;
    const finalTotal = finalSubtotal + finalShipping;

    const response: DiscountBreakdown = {
      valid: true,
      discount_id: discount.id,
      discount_name: discount.name,
      discount_code: discount.code,
      discount_type: discount.type,
      discount_value: Number(discount.value),
      discount_amount: discountAmount,
      free_shipping: freeShipping,
      original_subtotal: subtotal,
      original_shipping: shipping_price,
      final_subtotal: finalSubtotal,
      final_shipping: finalShipping,
      final_total: finalTotal,
    };

    console.log("[discount-validate] Valid coupon response:", response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[discount-validate] Error:", error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro interno", discount_amount: 0, free_shipping: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
