import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fiscal-update-draft] Request received');

    // Initialize Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[fiscal-update-draft] Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Parse request body
    const body = await req.json();
    const { invoice_id, data } = body;

    if (!invoice_id || !data) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id e data são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-update-draft] Updating invoice:', invoice_id);

    // Verify invoice belongs to tenant and is a draft
    const { data: existingInvoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .select('id, status, tenant_id')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !existingInvoice) {
      console.error('[fiscal-update-draft] Invoice not found:', invoiceError);
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingInvoice.status !== 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas rascunhos podem ser editados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare invoice data for update
    const invoiceUpdate = {
      natureza_operacao: data.natureza_operacao,
      cfop: data.cfop,
      observacoes: data.observacoes || null,
      // Destinatário
      dest_nome: data.dest_nome,
      dest_cpf_cnpj: data.dest_cpf_cnpj?.replace(/\D/g, ''),
      dest_inscricao_estadual: data.dest_ie || null,
      dest_endereco_logradouro: data.dest_endereco_logradouro,
      dest_endereco_numero: data.dest_endereco_numero || 'S/N',
      dest_endereco_complemento: data.dest_endereco_complemento || null,
      dest_endereco_bairro: data.dest_endereco_bairro,
      dest_endereco_municipio: data.dest_endereco_municipio,
      dest_endereco_municipio_codigo: data.dest_endereco_municipio_codigo,
      dest_endereco_uf: data.dest_endereco_uf,
      dest_endereco_cep: data.dest_endereco_cep?.replace(/\D/g, ''),
      dest_telefone: data.dest_telefone || null,
      dest_email: data.dest_email || null,
      // Valores
      valor_produtos: data.valor_produtos || 0,
      valor_frete: data.valor_frete || 0,
      valor_seguro: data.valor_seguro || 0,
      valor_outras_despesas: data.valor_outras_despesas || 0,
      valor_desconto: data.valor_desconto || 0,
      valor_total: data.valor_total || 0,
      // Transporte
      modalidade_frete: data.modalidade_frete || '9',
      transportadora_nome: data.transportadora_nome || null,
      transportadora_cnpj: data.transportadora_cnpj?.replace(/\D/g, '') || null,
      peso_bruto: data.peso_bruto || null,
      peso_liquido: data.peso_liquido || null,
      quantidade_volumes: data.quantidade_volumes || null,
      especie_volumes: data.especie_volumes || null,
      updated_at: new Date().toISOString(),
    };

    // Update invoice
    const { error: updateError } = await supabase
      .from('fiscal_invoices')
      .update(invoiceUpdate)
      .eq('id', invoice_id);

    if (updateError) {
      console.error('[fiscal-update-draft] Error updating invoice:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar NF-e' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update items if provided
    if (data.items && Array.isArray(data.items)) {
      // Delete existing items
      await supabase
        .from('fiscal_invoice_items')
        .delete()
        .eq('invoice_id', invoice_id);

      // Insert updated items
      const itemsToInsert = data.items.map((item: any, index: number) => ({
        invoice_id,
        numero_item: index + 1,
        codigo_produto: item.codigo_produto || item.product_id || `PROD-${index + 1}`,
        descricao: item.descricao,
        ncm: item.ncm?.replace(/\D/g, '') || '',
        cfop: item.cfop || data.cfop || '5102',
        unidade: item.unidade || 'UN',
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.valor_total || (item.quantidade * item.valor_unitario) || 0,
        origem: parseInt(item.origem, 10) || 0,
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('fiscal_invoice_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('[fiscal-update-draft] Error updating items:', itemsError);
          // Don't fail the whole operation, just log
        }
      }
    }

    // Log the update event
    await supabase.from('fiscal_invoice_events').insert({
      invoice_id,
      tenant_id: tenantId,
      event_type: 'draft_updated',
      description: 'Rascunho atualizado manualmente',
      user_id: user.id,
    });

    // Fetch updated invoice
    const { data: updatedInvoice } = await supabase
      .from('fiscal_invoices')
      .select('*, fiscal_invoice_items(*)')
      .eq('id', invoice_id)
      .single();

    console.log('[fiscal-update-draft] Invoice updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoice: updatedInvoice,
        message: 'Rascunho atualizado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fiscal-update-draft] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
