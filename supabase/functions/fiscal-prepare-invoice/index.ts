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

    // === Modelo Bling (2 registros) ===
    // Se origem é Pedido de Venda, cria uma NOVA NF (snapshot) preservando o pedido intacto.
    // Caso contrário (pendencia/pronta_emitir), valida o próprio registro.
    const isFromPedidoVenda = inv.fiscal_stage === 'pedido_venda';
    let workingInvoiceId = invoice_id as string;
    let workingItems = inv.fiscal_invoice_items || [];
    let snapshotCreated = false;

    if (isFromPedidoVenda) {
      // Clona campos da NF excluindo identificadores/sefaz/timestamps
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        fiscal_invoice_items: _items,
        focus_ref: _fr,
        chave_acesso: _ck,
        numero_nfe: _nn,
        protocolo_autorizacao: _pa,
        data_emissao: _de,
        data_autorizacao: _da,
        xml_url: _xu,
        pdf_url: _pu,
        status_motivo: _sm,
        pendencia_motivos: _pm,
        ...cloneFields
      } = inv as any;

      const newInvoicePayload = {
        ...cloneFields,
        source_order_invoice_id: invoice_id,
        fiscal_stage: 'pendencia', // será ajustado abaixo conforme validação
        status: 'draft',
        focus_ref: null,
        chave_acesso: null,
        numero_nfe: null,
        protocolo_autorizacao: null,
        data_emissao: null,
        data_autorizacao: null,
        xml_url: null,
        pdf_url: null,
        status_motivo: null,
        pendencia_motivos: null,
      };

      const { data: newInv, error: insErr } = await admin
        .from('fiscal_invoices')
        .insert(newInvoicePayload)
        .select('id')
        .single();

      if (insErr || !newInv) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Falha ao criar Nota Fiscal a partir do Pedido: ' + (insErr?.message || 'desconhecido'),
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      workingInvoiceId = newInv.id;
      snapshotCreated = true;

      // Clona itens do pedido para a nova NF
      if (workingItems.length > 0) {
        const itemsClone = workingItems.map(({ id: _iid, invoice_id: _ivid, created_at: _ica, updated_at: _iua, ...rest }: any) => ({
          ...rest,
          invoice_id: newInv.id,
        }));
        const { error: itemsErr } = await admin.from('fiscal_invoice_items').insert(itemsClone);
        if (itemsErr) {
          // rollback: remove a NF recém-criada para evitar lixo
          await admin.from('fiscal_invoices').delete().eq('id', newInv.id);
          return new Response(JSON.stringify({
            success: false,
            error: 'Falha ao copiar itens para a Nota Fiscal: ' + itemsErr.message,
          }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
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
      .eq('id', workingInvoiceId)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      // Se criamos snapshot e o update falhou, faz rollback do snapshot
      if (snapshotCreated) {
        await admin.from('fiscal_invoice_items').delete().eq('invoice_id', workingInvoiceId);
        await admin.from('fiscal_invoices').delete().eq('id', workingInvoiceId);
      }
      return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      fiscal_stage: newStage,
      errors,
      invoice_id: workingInvoiceId,
      source_order_invoice_id: snapshotCreated ? invoice_id : null,
      snapshot_created: snapshotCreated,
      message: snapshotCreated
        ? (newStage === 'pronta_emitir'
            ? 'Nota Fiscal criada a partir do Pedido e marcada como Pronta para Emitir.'
            : `Nota Fiscal criada a partir do Pedido com pendências (${errors.length}). Pedido de Venda permanece inalterado.`)
        : (newStage === 'pronta_emitir'
            ? 'Nota Fiscal preparada e movida como Pronta para Emitir.'
            : `Nota Fiscal movida com pendências (${errors.length}).`),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('[fiscal-prepare-invoice] error:', e);
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Erro inesperado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
