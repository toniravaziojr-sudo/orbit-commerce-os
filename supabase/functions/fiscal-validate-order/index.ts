// =============================================
// FISCAL VALIDATE ORDER - Validação pré-emissão de NF-e
// Verifica se pedido tem todos os requisitos para emissão
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-validate-order] Validating order:', order_id, 'tenant:', tenantId);

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // 1. Check fiscal settings
    const { data: fiscalSettings } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!fiscalSettings) {
      result.valid = false;
      result.errors.push('Configurações fiscais não encontradas. Configure em Configurações → Fiscal.');
    } else {
      if (!fiscalSettings.is_configured) {
        result.valid = false;
        result.errors.push('Configurações fiscais incompletas. Verifique todos os campos obrigatórios.');
      }
      
      // Verificar certificado digital (substituído provider_token)
      if (!fiscalSettings.certificado_pfx) {
        result.valid = false;
        result.errors.push('Certificado digital A1 não configurado. Faça o upload em Configurações → Fiscal.');
      } else if (!fiscalSettings.certificado_senha) {
        result.valid = false;
        result.errors.push('Senha do certificado digital não configurada.');
      } else if (fiscalSettings.certificado_valido_ate) {
        // Verificar validade do certificado
        const validUntil = new Date(fiscalSettings.certificado_valido_ate);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (validUntil < now) {
          result.valid = false;
          result.errors.push(`Certificado digital expirado em ${validUntil.toLocaleDateString('pt-BR')}.`);
        } else if (daysUntilExpiry <= 30) {
          result.warnings.push(`Certificado digital expira em ${daysUntilExpiry} dias (${validUntil.toLocaleDateString('pt-BR')}).`);
        }
      }
      
      if (!fiscalSettings.serie_nfe) {
        result.valid = false;
        result.errors.push('Série da NF-e não definida.');
      }
      
      // Verificar dados do emitente
      if (!fiscalSettings.cnpj) {
        result.valid = false;
        result.errors.push('CNPJ do emitente não configurado.');
      }
      if (!fiscalSettings.razao_social) {
        result.valid = false;
        result.errors.push('Razão social do emitente não configurada.');
      }
      if (!fiscalSettings.inscricao_estadual) {
        result.warnings.push('Inscrição estadual não configurada.');
      }
      if (!fiscalSettings.endereco_municipio_codigo) {
        result.valid = false;
        result.errors.push('Código IBGE do município do emitente não configurado.');
      }
    }

    // 2. Check order exists and belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', order_id)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      result.valid = false;
      result.errors.push('Pedido não encontrado.');
      return new Response(
        JSON.stringify({ success: true, ...result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Check if NF already exists for this order
    const { data: existingInvoice } = await supabase
      .from('fiscal_invoices')
      .select('id, status, numero')
      .eq('order_id', order_id)
      .eq('tenant_id', tenantId)
      .neq('status', 'canceled')
      .maybeSingle();

    if (existingInvoice) {
      result.valid = false;
      result.errors.push(`Já existe NF-e ${existingInvoice.numero} para este pedido (status: ${existingInvoice.status}).`);
    }

    // 4. Check customer data
    const customer = order.customer;
    if (!customer) {
      result.valid = false;
      result.errors.push('Pedido sem cliente vinculado.');
    } else {
      if (!customer.cpf && !order.customer_cpf) {
        result.valid = false;
        result.errors.push('Cliente sem CPF/CNPJ cadastrado.');
      }
      if (!customer.full_name) {
        result.valid = false;
        result.errors.push('Cliente sem nome cadastrado.');
      }
    }

    // 5. Check shipping address
    if (!order.shipping_street || !order.shipping_city || !order.shipping_state || !order.shipping_postal_code) {
      result.valid = false;
      result.errors.push('Endereço de entrega incompleto. Campos obrigatórios: rua, cidade, estado, CEP.');
    }

    if (!order.shipping_number) {
      result.warnings.push('Número do endereço não informado. Será usado "S/N".');
    }

    // 6. Check order items and product NCM
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, quantity')
      .eq('order_id', order_id);

    if (!orderItems || orderItems.length === 0) {
      result.valid = false;
      result.errors.push('Pedido sem itens.');
    } else {
      // Get fiscal data for each product
      const productIds = orderItems.map(item => item.product_id).filter(Boolean);
      
      if (productIds.length > 0) {
        const { data: fiscalProducts } = await supabase
          .from('fiscal_products')
          .select('product_id, ncm')
          .in('product_id', productIds);

        const fiscalProductMap = new Map(
          (fiscalProducts || []).map(fp => [fp.product_id, fp])
        );

        for (const item of orderItems) {
          if (!item.product_id) continue;
          
          const fiscalProduct = fiscalProductMap.get(item.product_id);
          if (!fiscalProduct || !fiscalProduct.ncm) {
            result.valid = false;
            result.errors.push(`Produto "${item.product_name}" sem NCM configurado.`);
          }
        }
      }
    }

    // 7. Check order values
    if (!order.total || order.total <= 0) {
      result.valid = false;
      result.errors.push('Pedido com valor total inválido.');
    }

    console.log('[fiscal-validate-order] Validation result:', result);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-validate-order] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
