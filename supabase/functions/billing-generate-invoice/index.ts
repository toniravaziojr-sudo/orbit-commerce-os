import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, year_month } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar mês atual se não especificado
    const targetYearMonth = year_month || new Date().toISOString().slice(0, 7);

    console.log(`[billing-generate-invoice] Gerando fatura ${targetYearMonth} para tenant ${tenant_id}`);

    // Chamar função do banco
    const { data: invoiceId, error: invoiceError } = await supabase
      .rpc('generate_tenant_invoice', {
        p_tenant_id: tenant_id,
        p_year_month: targetYearMonth,
      });

    if (invoiceError) {
      console.error('[billing-generate-invoice] Erro:', invoiceError);
      return new Response(
        JSON.stringify({ success: false, error: invoiceError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar fatura gerada
    const { data: invoice, error: fetchError } = await supabase
      .from('tenant_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError) {
      console.error('[billing-generate-invoice] Erro ao buscar fatura:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Fatura gerada mas não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[billing-generate-invoice] Fatura gerada: ${invoice.id}, total: ${invoice.total_cents}`);

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        year_month: invoice.year_month,
        total_cents: invoice.total_cents,
        status: invoice.status,
        due_date: invoice.due_date,
        line_items: invoice.line_items,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[billing-generate-invoice] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
