// =============================================
// FISCAL PREPARE INVOICE
// Valida um rascunho (fiscal_stage='pedido_venda') sem transmitir,
// e move para 'pronta_emitir' ou 'pendencia' conforme resultado.
// NÃO chama Focus/SEFAZ. NÃO emite. NÃO transmite.
// =============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveAddressByCep } from "../_shared/cep-lookup.ts";
import { unbundleFiscalItems } from "../_shared/kit-unbundler-fiscal-items.ts";
import type { FiscalSettingsTax } from "../_shared/fiscal-tax-calculator.ts";


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
      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        fiscal_invoice_items: _items,
        focus_ref: _fr,
        chave_acesso: _ck,
        numero: _numPedido,
        protocolo: _proto,
        xml_autorizado: _xml,
        xml_url: _xu,
        danfe_url: _du,
        status_motivo: _sm,
        pendencia_motivos: _pm,
        submitted_at: _sa,
        authorized_at: _aa,
        cancelled_at: _cl,
        printed_at: _pr,
        danfe_printed_at: _dp,
        ...cloneFields
      } = inv as any;

      // Aloca novo número de NF a partir do cursor próprio (numero_nfe_atual)
      const { data: settingsNum } = await admin
        .from('fiscal_settings')
        .select('numero_nfe_atual, serie_nfe')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const serieNf = settingsNum?.serie_nfe || inv.serie || 1;

      const { getNextFiscalNumber, insertFiscalInvoiceWithRetry, syncFiscalNumberCursor } =
        await import('../_shared/fiscal-numbering.ts');

      const nextNfNumero = await getNextFiscalNumber({
        supabase: admin,
        tenantId,
        serie: serieNf,
        fallbackNumeroAtual: settingsNum?.numero_nfe_atual,
        docClass: 'nf',
      });

      const newInvoicePayload = {
        ...cloneFields,
        source_order_invoice_id: invoice_id,
        fiscal_stage: 'pendencia',
        status: 'draft',
        serie: serieNf,
        focus_ref: null,
        chave_acesso: null,
        protocolo: null,
        xml_autorizado: null,
        xml_url: null,
        danfe_url: null,
        status_motivo: null,
        pendencia_motivos: null,
      };

      const insertResult = await insertFiscalInvoiceWithRetry({
        supabase: admin,
        tenantId,
        serie: serieNf,
        initialNumber: nextNfNumero,
        logPrefix: 'fiscal-prepare-invoice',
        docClass: 'nf',
        buildDraftData: (numeroFiscal: number) => ({
          ...newInvoicePayload,
          numero: numeroFiscal,
        }),
      });

      workingInvoiceId = insertResult.invoice.id;
      snapshotCreated = true;

      await syncFiscalNumberCursor({
        supabase: admin,
        tenantId,
        serie: serieNf,
        currentCursor: insertResult.numero + 1,
        logPrefix: 'fiscal-prepare-invoice',
        docClass: 'nf',
      });

      if (workingItems.length > 0) {
        // ------------------------------------------------------------------
        // DESMEMBRAMENTO DE KITS NO MOMENTO PV → NF
        // Se a configuração "desmembrar_estrutura" estiver ativa, expandimos
        // kits em componentes AQUI (não na criação do Pedido de Venda).
        // O PV original permanece intacto; só o novo registro da NF recebe
        // a lista expandida.
        // ------------------------------------------------------------------
        const { data: settingsForUnbundle } = await admin
          .from('fiscal_settings')
          .select('desmembrar_estrutura, regime_tributario, pis_aliquota_padrao, cofins_aliquota_padrao, icms_aliquota_padrao, pis_cst_padrao, cofins_cst_padrao, cst_padrao, csosn_padrao')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        let itemsForNf: any[] = workingItems.map(
          ({ id: _iid, invoice_id: _ivid, created_at: _ica, ...rest }: any) => ({ ...rest })
        );
        let kitsExpanded = 0;
        const kitsWithoutComponents: string[] = [];

        if (settingsForUnbundle?.desmembrar_estrutura) {
          const taxSettings: FiscalSettingsTax = {
            regime_tributario: settingsForUnbundle.regime_tributario || 'simples_nacional',
            pis_aliquota_padrao: Number(settingsForUnbundle.pis_aliquota_padrao || 0),
            cofins_aliquota_padrao: Number(settingsForUnbundle.cofins_aliquota_padrao || 0),
            icms_aliquota_padrao: Number(settingsForUnbundle.icms_aliquota_padrao || 0),
            pis_cst_padrao: settingsForUnbundle.pis_cst_padrao || '49',
            cofins_cst_padrao: settingsForUnbundle.cofins_cst_padrao || '49',
            cst_padrao: settingsForUnbundle.cst_padrao,
            csosn_padrao: settingsForUnbundle.csosn_padrao,
          };

          const unbundleResult = await unbundleFiscalItems({
            supabase: admin,
            items: itemsForNf,
            taxSettings,
            cfopFallback: inv.cfop || '5102',
          });
          itemsForNf = unbundleResult.items;
          kitsExpanded = unbundleResult.kitsExpanded;
          kitsWithoutComponents.push(...unbundleResult.kitsWithoutComponents);

          if (unbundleResult.unbundled) {
            console.log(
              `[fiscal-prepare-invoice] Desmembrados ${kitsExpanded} kit(s) em ${itemsForNf.length} item(ns) para NF ${workingInvoiceId}`,
            );
          }
        }

        // Recalcula peso bruto a partir dos componentes (quando houver dado)
        // — usado só se algum item carregar _component_weight_grams.
        const componentWeightTotalKg = itemsForNf.reduce((acc: number, it: any) => {
          const g = Number(it._component_weight_grams || 0);
          return acc + (g * Number(it.quantidade || 0)) / 1000;
        }, 0);

        // Remove campos auxiliares antes do INSERT (não existem em fiscal_invoice_items)
        const itemsClone = itemsForNf.map((it: any) => {
          const {
            _from_kit_product_id,
            _from_kit_description,
            _component_weight_grams,
            ...rest
          } = it;
          return { ...rest, invoice_id: workingInvoiceId };
        });

        const { error: itemsErr } = await admin.from('fiscal_invoice_items').insert(itemsClone);
        if (itemsErr) {
          await admin.from('fiscal_invoices').delete().eq('id', workingInvoiceId);
          return new Response(JSON.stringify({
            success: false,
            error: 'Falha ao copiar itens para a Nota Fiscal: ' + itemsErr.message,
          }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Se houve desmembramento, atualiza peso bruto/líquido da NF com base
        // nos componentes (mais preciso que o peso original do kit).
        if (kitsExpanded > 0 && componentWeightTotalKg > 0) {
          await admin
            .from('fiscal_invoices')
            .update({
              peso_bruto: Number(componentWeightTotalKg.toFixed(3)),
              peso_liquido: Number(componentWeightTotalKg.toFixed(3)),
            })
            .eq('id', workingInvoiceId);
        }

        // Registra evento de auditoria do desmembramento (sucesso ou kit sem componentes)
        if (kitsExpanded > 0 || kitsWithoutComponents.length > 0) {
          await admin.from('fiscal_invoice_events').insert({
            invoice_id: workingInvoiceId,
            tenant_id: tenantId,
            event_type: 'kit_unbundled',
            description: kitsExpanded > 0
              ? `Desmembrados ${kitsExpanded} kit(s) em ${itemsClone.length} item(ns) na criação da NF.`
              : 'Kit(s) sem componentes cadastrados — NF criada com o kit inteiro.',
            event_data: {
              kits_expanded: kitsExpanded,
              kits_without_components: kitsWithoutComponents,
              source_pedido_venda_id: invoice_id,
            },
          });
        }
      }

    }

    const { data: settings } = await admin
      .from('fiscal_settings').select('*').eq('tenant_id', tenantId).maybeSingle();

    const errors: string[] = [];
    const warnings: string[] = []; // avisos informativos (não bloqueiam emissão; SEFAZ é o juiz final)

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

    // Resolução automática de IBGE via CEP (ViaCEP/BrasilAPI com cache).
    // Se o registro estiver sem IBGE válido mas tiver CEP, tentamos resolver agora
    // e persistir antes da validação final — evita pendência por base interna defasada.
    let ibgeDest = String(inv.dest_endereco_municipio_codigo || '').replace(/\D/g, '');
    let cepLookup: Awaited<ReturnType<typeof resolveAddressByCep>> = null;
    if (cep.length === 8) {
      cepLookup = await resolveAddressByCep(admin, cep);
      if (cepLookup?.ibge) {
        const cidadeAtual = String(inv.dest_endereco_municipio || '').trim();
        const cidadeOficial = String(cepLookup.cidade || '').trim();
        const ufOficial = String(cepLookup.uf || '').toUpperCase();
        const needIbge = ibgeDest.length !== 7 || ibgeDest !== cepLookup.ibge;
        const needCidade = cidadeOficial && cidadeAtual !== cidadeOficial;
        if (needIbge || needCidade) {
          // Atualiza IBGE + nome oficial do município (evita rejeição SEFAZ por divergência xMun/cMun)
          const patch: any = {
            dest_endereco_municipio_codigo: cepLookup.ibge,
            updated_at: new Date().toISOString(),
          };
          if (needCidade) patch.dest_endereco_municipio = cidadeOficial;
          // UF só é sobrescrita se for igual à do CEP (mismatch vira pendência logo abaixo)
          if (ufOficial && String(inv.dest_endereco_uf || '').toUpperCase() === ufOficial) {
            patch.dest_endereco_uf = ufOficial;
          }
          await admin
            .from('fiscal_invoices')
            .update(patch)
            .eq('id', workingInvoiceId)
            .eq('tenant_id', tenantId);
          ibgeDest = cepLookup.ibge;
          if (needCidade) (inv as any).dest_endereco_municipio = cidadeOficial;
        }
      }
    }

    if (ibgeDest.length !== 7) {
      errors.push('Não foi possível identificar o município do cliente a partir do CEP — confirme o CEP do endereço.');
    }

    // Cross-validação UF: divergência entre UF do CEP e UF do pedido é AVISO informativo,
    // não bloqueio. O lojista vê e pode confirmar com o cliente; SEFAZ valida na emissão.
    if (cepLookup?.uf && inv.dest_endereco_uf) {
      const ufPedido = String(inv.dest_endereco_uf).trim().toUpperCase();
      const ufCep = cepLookup.uf.trim().toUpperCase();
      if (ufPedido && ufCep && ufPedido !== ufCep) {
        warnings.push(`Endereço incompatível com o CEP: o CEP pertence a ${ufCep}, mas o pedido informa ${ufPedido}. Confirme cidade e estado com o cliente antes de despachar.`);
      }
    }

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
        pendencia_avisos: warnings.length > 0 ? warnings : null,
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
