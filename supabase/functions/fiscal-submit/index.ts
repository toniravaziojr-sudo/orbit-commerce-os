import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendNFe, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";
import { buildNFePayload, generateNFeRef, mapFocusStatusToInternal, isDuplicateNumberError } from "../_shared/focus-nfe-adapter.ts";
import { resolveCarrier } from "../_shared/carrier-registry.ts";
import { linkNFeToShipment } from "../_shared/nfe-shipment-link.ts";
import { evaluateEmissionGate } from "../_shared/fiscal-emission-gate.ts";
import { ensureEmitenteSynced } from "../_shared/fiscal-emitente-sync-gate.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Token resolvido depois, junto com o ambiente do tenant.



  try {
    // Autenticar usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter tenant
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // RBAC: submissão real à Sefaz exige owner ou admin do tenant
    const { data: roleRow } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const userRole = roleRow?.role ?? 'viewer';
    if (userRole !== 'owner' && userRole !== 'admin') {
      console.warn(`[fiscal-submit] Bloqueado: role=${userRole} não pode submeter NF-e`);
      return new Response(
        JSON.stringify({ success: false, error: 'Permissão insuficiente para submeter NF-e (requer owner ou admin)', code: 'insufficient_role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Obter invoice_id do body
    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fiscal-submit] Processando NF-e ${invoice_id} para tenant ${tenantId}`);

    // Buscar NF-e
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar status
    if (invoice.status !== 'draft' && invoice.status !== 'rejected') {
      return new Response(
        JSON.stringify({ success: false, error: `NF-e não pode ser enviada no status: ${invoice.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gate: só transmite se já estiver "pronta_emitir".
    if (invoice.fiscal_stage && invoice.fiscal_stage !== 'pronta_emitir' && invoice.fiscal_stage !== 'emitida') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Esta nota ainda não está pronta para envio. Use "Criar Nota Fiscal" antes de transmitir.',
          fiscal_stage: invoice.fiscal_stage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar itens da NF-e
    const { data: items, error: itemsError } = await supabaseClient
      .from('fiscal_invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('numero_item');

    if (itemsError || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Itens da NF-e não encontrados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações fiscais
    const { data: settings, error: settingsError } = await supabaseClient
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se empresa está sincronizada com Focus NFe
    if (!settings.focus_empresa_id && !settings.cnpj) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Empresa não cadastrada na Focus NFe. Sincronize primeiro.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar consistência: CNPJ do certificado deve bater com CNPJ do emitente.
    const cnpjEmit = (settings.cnpj || '').replace(/\D/g, '');
    const cnpjCert = (settings.certificado_cnpj || '').replace(/\D/g, '');
    if (cnpjEmit && cnpjCert && cnpjEmit !== cnpjCert) {
      console.error('[fiscal-submit] CNPJ divergente entre certificado e emitente', { cnpjEmit, cnpjCert });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CNPJ do certificado digital diverge do CNPJ do emitente. Reenvie o certificado correto em Configurações > Fiscal antes de emitir a NF-e.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gate de sincronização do emitente — bloqueia transmissão se cadastro local
    // estiver mais novo que o snapshot externo (raiz da rejeição 481 após mudança
    // de regime tributário).
    const syncGate = await ensureEmitenteSynced(supabaseClient, {
      settings,
      tenantId,
      authHeader,
      logPrefix: '[fiscal-submit]',
    });
    if (!syncGate.ok) {
      return new Response(
        JSON.stringify({ success: false, error: syncGate.error, code: syncGate.code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (syncGate.refreshedSettings) {
      Object.assign(settings, syncGate.refreshedSettings);
    }

    const ambiente = (settings.focus_ambiente || settings.ambiente || 'homologacao') as 'homologacao' | 'producao';

    // Lote 1.E — Gate de produção / alerta de homologação
    const gate = evaluateEmissionGate({
      ambiente,
      webhook_status: settings.webhook_status,
      webhook_environment: settings.webhook_environment,
      webhook_tenant_token: settings.webhook_tenant_token,
      focus_empresa_id: settings.focus_empresa_id,
      certificado_valido_ate: settings.certificado_valido_ate,
      certificado_cnpj: settings.certificado_cnpj,
      cnpj: settings.cnpj,
    });
    if (gate.blocked) {
      console.warn(`[fiscal-submit] Bloqueado pelo gate ${ambiente}: ${gate.code} — ${gate.error}`);
      return new Response(
        JSON.stringify({ success: false, error: gate.error, code: gate.code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const gateWarnings = gate.warnings;

    // Configuração Focus NFe — token resolvido pelo ambiente do tenant
    const tenantTok = await loadFocusTenantToken(supabaseClient, tenantId, ambiente);
    const creds = resolveFocusCredentials({
      ambiente,
      operationKind: 'nfe_op',
      tenantTokenForAmbiente: tenantTok.token,
    });
    if (!creds.ok || !creds.token) {
      return new Response(
        JSON.stringify({ success: false, error: creds.error, code: creds.errorCode }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const focusConfig: FocusNFeConfig = {
      token: creds.token,
      ambiente,
    };

    console.log(`[fiscal-submit] Ambiente: ${focusConfig.ambiente}`);

    // Buscar dados do pedido para destinatário
    let destinatario: any;
    let orderRow: any = null;

    if (invoice.order_id) {
      const { data: order } = await supabaseClient
        .from('orders')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', invoice.order_id)
        .single();

      if (order) {
        orderRow = order;
        // Extrair CPF ou CNPJ do campo unificado dest_cpf_cnpj
        const cpfCnpj = (order.customer?.cpf || invoice.dest_cpf_cnpj)?.replace(/\D/g, '') || '';
        const isCnpj = cpfCnpj.length === 14;
        
        destinatario = {
          nome: order.customer?.full_name || order.shipping_name || invoice.dest_nome || 'CONSUMIDOR FINAL',
          cpf: !isCnpj ? cpfCnpj : undefined,
          cnpj: isCnpj ? cpfCnpj : undefined,
          inscricao_estadual: invoice.dest_inscricao_estadual,
          logradouro: order.shipping_street || invoice.dest_endereco_logradouro || '',
          numero: order.shipping_number || invoice.dest_endereco_numero || 'S/N',
          complemento: order.shipping_complement || invoice.dest_endereco_complemento,
          bairro: order.shipping_neighborhood || invoice.dest_endereco_bairro || '',
          cidade: order.shipping_city || invoice.dest_endereco_municipio || '',
          uf: order.shipping_state || invoice.dest_endereco_uf || '',
          cep: order.shipping_postal_code || invoice.dest_endereco_cep || '',
          telefone: order.customer?.phone || invoice.dest_telefone,
          email: order.customer?.email || invoice.dest_email,
        };
      }
    }

    // Fallback para dados da invoice (usando campos dest_*)
    if (!destinatario) {
      // Extrair CPF ou CNPJ do campo unificado dest_cpf_cnpj
      const cpfCnpj = invoice.dest_cpf_cnpj?.replace(/\D/g, '') || '';
      const isCnpj = cpfCnpj.length === 14;
      
      destinatario = {
        nome: invoice.dest_nome || 'CONSUMIDOR FINAL',
        cpf: !isCnpj ? cpfCnpj : undefined,
        cnpj: isCnpj ? cpfCnpj : undefined,
        inscricao_estadual: invoice.dest_inscricao_estadual,
        logradouro: invoice.dest_endereco_logradouro || '',
        numero: invoice.dest_endereco_numero || 'S/N',
        complemento: invoice.dest_endereco_complemento,
        bairro: invoice.dest_endereco_bairro || '',
        cidade: invoice.dest_endereco_municipio || '',
        uf: invoice.dest_endereco_uf || '',
        cep: invoice.dest_endereco_cep || '',
        telefone: invoice.dest_telefone,
        email: invoice.dest_email,
      };
    }

    // Validar campos obrigatórios do destinatário
    const camposObrigatorios = [
      { campo: 'bairro', valor: destinatario.bairro, nome: 'Bairro do destinatário' },
      { campo: 'logradouro', valor: destinatario.logradouro, nome: 'Logradouro do destinatário' },
      { campo: 'cidade', valor: destinatario.cidade, nome: 'Cidade do destinatário' },
      { campo: 'uf', valor: destinatario.uf, nome: 'UF do destinatário' },
      { campo: 'cep', valor: destinatario.cep, nome: 'CEP do destinatário' },
    ];

    const camposFaltando = camposObrigatorios.filter(c => !c.valor || c.valor.trim() === '');
    
    if (camposFaltando.length > 0) {
      const faltando = camposFaltando.map(c => c.nome).join(', ');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Campos obrigatórios não preenchidos: ${faltando}. Verifique os dados de endereço do pedido.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Converter itens para formato Focus NFe
    const focusItems = items.map((item, index) => ({
      numero_item: item.numero_item || index + 1,
      codigo_produto: item.codigo_produto || item.product_id?.substring(0, 60) || `PROD${index + 1}`,
      descricao: item.descricao || 'PRODUTO',
      cfop: item.cfop || '5102',
      ncm: item.ncm || '00000000',
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade || 1,
      valor_unitario: item.valor_unitario || 0,
      valor_total: item.valor_total || 0,
      valor_desconto: item.valor_desconto,
      origem: item.origem || '0',
      cst_icms: item.cst_icms,
      csosn: item.csosn || '102',
      cst_pis: item.cst_pis || '07',
      cst_cofins: item.cst_cofins || '07',
    }));

    // Resolução de transportadora
    const carrierNameRaw = invoice.transportadora_nome || orderRow?.shipping_carrier || null;
    const serviceNameRaw = invoice.transportadora_servico
      || orderRow?.shipping_service_name
      || orderRow?.shipping_method_name
      || null;
    const resolvedCarrier = resolveCarrier({ carrierName: carrierNameRaw, serviceName: serviceNameRaw });
    const freteValor = Number(invoice.valor_frete || orderRow?.shipping_total || 0);
    const freteGratis = !!(orderRow?.free_shipping) || (freteValor === 0 && !!carrierNameRaw);
    const modalidadeInvoice = (() => {
      const m = String(invoice.modalidade_frete || '').trim();
      if (m === '0' || m === '1' || m === '2' || m === '9') return Number(m);
      return undefined;
    })();
    const transporteInput = carrierNameRaw ? {
      razao_social: resolvedCarrier.razao_social,
      cnpj: resolvedCarrier.cnpj,
      inscricao_estadual: resolvedCarrier.inscricao_estadual,
      endereco: resolvedCarrier.endereco,
      municipio: resolvedCarrier.municipio,
      uf: resolvedCarrier.uf,
      servico: resolvedCarrier.servico || serviceNameRaw,
      modalidade: modalidadeInvoice,
      quantidade_volumes: Number(invoice.quantidade_volumes || 1),
      especie_volumes: invoice.especie_volumes || 'VOLUME',
      peso_bruto_kg: Number(invoice.peso_bruto || 0) > 0 ? Number(invoice.peso_bruto) : undefined,
      peso_liquido_kg: Number(invoice.peso_liquido || 0) > 0 ? Number(invoice.peso_liquido) : undefined,
    } : undefined;

    // Gerar referência única
    // Em retentativa de nota rejeitada, geramos novo ref para evitar resposta em cache do Focus NFe.
    const isRetry = invoice.status === 'rejected' && !!invoice.focus_ref;
    let ref = generateNFeRef(invoice_id, isRetry ? 'retry' : 'initial');
    if (isRetry) {
      console.log(`[fiscal-submit] Retry detectado. Ref anterior=${invoice.focus_ref} -> novo ref=${ref}`);
    }

    // Numeração soberana
    const serieNfe = Number(settings.serie_nfe || 1);
    let numeroAtual = Number(invoice.numero || 0);
    if (!numeroAtual || numeroAtual <= 0) {
      numeroAtual = Math.max(1, Number(settings.numero_nfe_atual || 1));
    }

    // Retry de número duplicado (mesmo motor do fiscal-emit)
    const MAX_NUMBER_RETRIES = 20;
    let result: any = null;
    let attempts = 0;
    while (attempts < MAX_NUMBER_RETRIES) {
      attempts += 1;
      const nfePayload = buildNFePayload(
        {
          id: invoice_id,
          natureza_operacao: invoice.natureza_operacao,
          tipo_operacao: invoice.tipo_operacao || 'saida',
          finalidade: invoice.finalidade,
          valor_produtos: invoice.valor_produtos || 0,
          valor_frete: freteValor || 0,
          valor_desconto: invoice.valor_desconto,
          valor_total: invoice.valor_total || 0,
          informacoes_complementares: invoice.informacoes_complementares,
          numero: numeroAtual,
          serie: serieNfe,
          free_shipping: freteGratis,
        },
        destinatario,
        focusItems,
        { cnpj: settings.cnpj, crt: settings.crt },
        invoice.order_id ? { forma: 'other', valor: invoice.valor_total || 0 } : undefined,
        transporteInput,
      );

      console.log(`[fiscal-submit] Enviando NF-e numero=${numeroAtual} serie=${serieNfe} ref=${ref} (tentativa ${attempts}/${MAX_NUMBER_RETRIES})`);
      result = await sendNFe(focusConfig, ref, nfePayload);
      if (result.success) break;
      if (!isDuplicateNumberError(result.error, result.data)) break;
      console.warn(`[fiscal-submit] Número ${numeroAtual} duplicado na SEFAZ — avançando cursor.`);
      const numeroSkipped = numeroAtual;
      numeroAtual += 1;
      try {
        await supabaseClient.from('fiscal_invoice_events').insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: 'numero_duplicado_sefaz',
          event_data: {
            numero_rejeitado: numeroSkipped,
            numero_proximo: numeroAtual,
            serie: serieNfe,
            attempt: attempts,
            reason: String(result.error || '').slice(0, 500),
            origem: 'fiscal-submit',
          },
        });
      } catch (auditErr) {
        console.warn('[fiscal-submit] Falha ao registrar evento de duplicidade (não bloqueante):', auditErr);
      }
      ref = generateNFeRef(invoice_id, 'retry');
      await supabaseClient
        .from('fiscal_settings')
        .update({ numero_nfe_atual: numeroAtual })
        .eq('tenant_id', tenantId)
        .lt('numero_nfe_atual', numeroAtual);
    }

    if (numeroAtual !== Number(invoice.numero || 0)) {
      await supabaseClient
        .from('fiscal_invoices')
        .update({ numero: numeroAtual, serie: serieNfe })
        .eq('id', invoice_id);
    }


    if (!result.success) {
      // Falha antes de protocolo/autorização não pode manter a nota como emitida.
      await supabaseClient
        .from('fiscal_invoices')
        .update({
          status: 'rejected',
          fiscal_stage: 'pendencia',
          pendencia_motivos: [result.error],
          mensagem_sefaz: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice_id);

      // Registrar log
      await supabaseClient
        .from('fiscal_invoice_events')
        .insert({
          invoice_id,
          tenant_id: tenantId,
          event_type: 'submission_error',
          event_data: { error: result.error, response: result.data },
        });

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar resposta
    const focusStatus = result.data?.status || 'processando_autorizacao';
    const internalStatus = mapFocusStatusToInternal(focusStatus);

    // Atualizar NF-e com dados da resposta
    const updateData: any = {
      status: internalStatus,
      // Só vira emitida quando o provedor já aceitou a transmissão.
      fiscal_stage: internalStatus === 'rejected' ? 'pendencia' : 'emitida',
      focus_ref: ref,
      pendencia_motivos: internalStatus === 'rejected'
        ? [result.data?.mensagem_sefaz || result.data?.status_sefaz || 'Nota rejeitada pela SEFAZ.']
        : null,
      mensagem_sefaz: result.data?.mensagem_sefaz,
      status_sefaz: result.data?.status_sefaz,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Se autorizado imediatamente
    if (focusStatus === 'autorizado' && result.data?.chave_nfe) {
      updateData.chave_acesso = result.data.chave_nfe;
      updateData.numero = result.data.numero;
      updateData.serie = result.data.serie;
      updateData.xml_url = result.data.caminho_xml_nota_fiscal;
      updateData.danfe_url = result.data.caminho_danfe;
      updateData.authorized_at = new Date().toISOString();
      
      // Vincular NF-e ao rascunho logístico e gerenciar remessa
      if (invoice.order_id) {
        const { data: fiscalSettingsShip } = await supabaseClient
          .from('fiscal_settings')
          .select('auto_create_shipment')
          .eq('tenant_id', tenantId)
          .single();

        await linkNFeToShipment({
          supabaseClient,
          orderId: invoice.order_id,
          invoiceId: invoice_id,
          tenantId,
          chaveAcesso: result.data.chave_nfe,
          autoCreateShipment: !!fiscalSettingsShip?.auto_create_shipment,
          callerModule: 'fiscal-submit',
        });
      }
      
      // Send NF-e email to customer if enabled
      const { data: fiscalSettingsEmail } = await supabaseClient
        .from('fiscal_settings')
        .select('enviar_email_nfe')
        .eq('tenant_id', tenantId)
        .single();

      if (fiscalSettingsEmail?.enviar_email_nfe !== false) {
        console.log(`[fiscal-submit] Sending NF-e email for invoice ${invoice_id}`);
        // Fire and forget - don't block the response
        fetch(`${supabaseUrl}/functions/v1/fiscal-send-nfe-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ invoice_id: invoice_id, tenant_id: tenantId }),
        }).catch(err => console.error('[fiscal-submit] Email send error:', err));
      }
    }

    await supabaseClient
      .from('fiscal_invoices')
      .update(updateData)
      .eq('id', invoice_id);

    // Registrar log
    await supabaseClient
      .from('fiscal_invoice_events')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        event_type: focusStatus === 'autorizado' ? 'authorized' : 'submitted',
        event_data: result.data,
      });

    console.log(`[fiscal-submit] NF-e ${ref} enviada com status: ${focusStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        ref,
        status: internalStatus,
        focus_status: focusStatus,
        chave_acesso: result.data?.chave_nfe,
        numero: result.data?.numero,
        serie: result.data?.serie,
        mensagem_sefaz: result.data?.mensagem_sefaz,
        warnings: gateWarnings.length ? gateWarnings : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'submit' });
  }
});
