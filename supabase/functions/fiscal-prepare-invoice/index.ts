// =============================================
// FISCAL PREPARE INVOICE
// Valida um rascunho (fiscal_stage='pedido_venda') sem transmitir,
// e move para 'pronta_emitir' ou 'pendencia' conforme resultado.
// NÃO chama Focus/SEFAZ. NÃO emite. NÃO transmite.
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await supabase
      .from('profiles').select('current_tenant_id').eq('id', user.id).single();
    const tenantId = profile?.current_tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: 'No tenant' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ success: false, error: 'invoice_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: inv, error: invErr } = await admin
      .from('fiscal_invoices')
      .select('*, fiscal_invoice_items(*)')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ success: false, error: 'NF não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (inv.chave_acesso || inv.status === 'authorized' || inv.status === 'cancelled') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Esta NF já foi processada na SEFAZ e não pode ser preparada novamente.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: settings } = await admin
      .from('fiscal_settings').select('*').eq('tenant_id', tenantId).maybeSingle();

    const errors: string[] = [];

    // Configuração fiscal
    if (!settings) {
      errors.push('Configurações fiscais não encontradas.');
    } else {
      if (!settings.is_configured) errors.push('Configuração fiscal incompleta.');
      if (!settings.certificado_pfx) errors.push('Certificado digital A1 não configurado.');
      if (settings.certificado_valido_ate && new Date(settings.certificado_valido_ate) < new Date()) {
        errors.push('Certificado digital expirado.');
      }
      if (settings.certificado_cnpj && settings.cnpj &&
          settings.certificado_cnpj.replace(/\D/g, '') !== settings.cnpj.replace(/\D/g, '')) {
        errors.push('CNPJ do certificado não confere com o CNPJ do emitente.');
      }
      if (!settings.serie_nfe) errors.push('Série da NF-e não definida.');
      if (!settings.cnpj) errors.push('CNPJ do emitente ausente.');
      if (!settings.razao_social) errors.push('Razão social do emitente ausente.');
      if (!settings.endereco_municipio_codigo) errors.push('Código IBGE do município do emitente ausente.');
    }

    // Destinatário
    const doc = (inv.dest_cpf_cnpj || '').replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) errors.push('CPF/CNPJ do destinatário inválido.');
    if (!inv.dest_nome) errors.push('Nome do destinatário ausente.');
    if (!inv.dest_endereco_logradouro || !inv.dest_endereco_municipio || !inv.dest_endereco_uf) {
      errors.push('Endereço do destinatário incompleto.');
    }
    const cep = (inv.dest_endereco_cep || '').replace(/\D/g, '');
    if (cep.length !== 8) errors.push('CEP do destinatário inválido.');

    // Itens
    const items = inv.fiscal_invoice_items || [];
    if (items.length === 0) errors.push('NF sem itens.');
    for (const it of items) {
      if (!it.descricao) errors.push(`Item sem descrição.`);
      if (!it.ncm || String(it.ncm).replace(/\D/g, '').length !== 8) {
        errors.push(`Item "${it.descricao || it.codigo_produto || '?'}" sem NCM válido (8 dígitos).`);
      }
      if (!it.cfop) errors.push(`Item "${it.descricao || '?'}" sem CFOP.`);
      if (!it.quantidade || Number(it.quantidade) <= 0) errors.push(`Item "${it.descricao || '?'}" com quantidade inválida.`);
      if (Number(it.valor_unitario) < 0) errors.push(`Item "${it.descricao || '?'}" com valor unitário inválido.`);
    }

    // Valor
    if (!inv.valor_total || Number(inv.valor_total) <= 0) errors.push('Valor total inválido.');

    const newStage = errors.length === 0 ? 'pronta_emitir' : 'pendencia';

    const { error: updateErr } = await admin
      .from('fiscal_invoices')
      .update({
        fiscal_stage: newStage,
        pendencia_motivos: errors.length > 0 ? errors : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      fiscal_stage: newStage,
      errors,
      message: newStage === 'pronta_emitir'
        ? 'Nota Fiscal preparada e movida para a aba Notas Fiscais como Pronta para Emitir.'
        : `Nota Fiscal movida para a aba Notas Fiscais com pendências (${errors.length}).`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[fiscal-prepare-invoice] error:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Erro inesperado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
