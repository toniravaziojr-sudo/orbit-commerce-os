import { errorResponse } from "../_shared/error-response.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendNFe, getNFeStatus, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";
import { buildNFePayload, generateNFeRef, mapFocusStatusToInternal, isDuplicateNumberError } from "../_shared/focus-nfe-adapter.ts";
import { resolveCarrier } from "../_shared/carrier-registry.ts";
import { linkNFeToShipment } from "../_shared/nfe-shipment-link.ts";
import { chargeAfter } from "../_shared/credits/charge-after.ts";
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Detecta chamada interna service_role (auto-emissão automática a partir
    // de fiscal-auto-create-drafts). Nesse caso, body deve conter tenant_id
    // e a checagem de role é dispensada (não há usuário humano envolvido).
    const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;

    const body = await req.json();
    const { invoice_id } = body;

    let tenantId: string;

    if (isServiceRoleCall) {
      if (!body.tenant_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'tenant_id é obrigatório em chamada interna' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tenantId = body.tenant_id;
      console.log(`[fiscal-emit] Chamada interna auto-emit. tenant=${tenantId} invoice=${invoice_id}`);
    } else {
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

      tenantId = profile.current_tenant_id;

      // RBAC: emissão real de NF-e exige owner ou admin do tenant
      const { data: roleRow } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const userRole = roleRow?.role ?? 'viewer';
      if (userRole !== 'owner' && userRole !== 'admin') {
        console.warn(`[fiscal-emit] Bloqueado: role=${userRole} não pode emitir NF-e`);
        return new Response(
          JSON.stringify({ success: false, error: 'Permissão insuficiente para emitir NF-e (requer owner ou admin)', code: 'insufficient_role' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fiscal-emit] Processando NF-e ${invoice_id} para tenant ${tenantId}`);

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

    if (invoice.status !== 'draft' && invoice.status !== 'rejected') {
      return new Response(
        JSON.stringify({ success: false, error: `NF-e não pode ser enviada no status: ${invoice.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gate: só transmite se já estiver "pronta_emitir" (preparada e validada).
    // Rascunhos em "pedido_venda" ou "pendencia" não podem ser transmitidos.
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
    if (!settings.focus_empresa_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Empresa não cadastrada na Focus NFe. Sincronize primeiro em Configurações > Fiscal.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar consistência: CNPJ do certificado deve bater com CNPJ do emitente.
    const cnpjEmit = (settings.cnpj || '').replace(/\D/g, '');
    const cnpjCert = (settings.certificado_cnpj || '').replace(/\D/g, '');
    if (cnpjEmit && cnpjCert && cnpjEmit !== cnpjCert) {
      console.error('[fiscal-emit] CNPJ divergente entre certificado e emitente', { cnpjEmit, cnpjCert });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CNPJ do certificado digital diverge do CNPJ do emitente. Reenvie o certificado correto em Configurações > Fiscal antes de emitir a NF-e.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // Gate de sincronização do emitente — bloqueia emissão se cadastro local
    // estiver mais novo que o snapshot externo.
    const syncGate = await ensureEmitenteSynced(supabaseClient, {
      settings,
      tenantId,
      authHeader,
      logPrefix: '[fiscal-emit]',
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

    const ambiente = (settings.focus_ambiente || settings.ambiente || 'producao') as 'homologacao' | 'producao';

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
      console.warn(`[fiscal-emit] Bloqueado pelo gate ${ambiente}: ${gate.code} — ${gate.error}`);
      return new Response(
        JSON.stringify({ success: false, error: gate.error, code: gate.code }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const gateWarnings = gate.warnings;

    console.log(`[fiscal-emit] Ambiente Focus NFe: ${ambiente}`);

    console.log(`[fiscal-emit] Ambiente Focus NFe: ${ambiente}`);

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

    // Buscar destinatário + dados do pedido (para shipping/carrier)
    let destinatario: any;
    let orderRow: any = null;
    if (invoice.order_id) {
      const { data: order } = await supabaseClient
        .from('orders')
        .select(`*, customer:customers(*)`)
        .eq('id', invoice.order_id)
        .single();

      if (order) {
        orderRow = order;
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
          cep: (order.shipping_postal_code || invoice.dest_endereco_cep || '').replace(/\D/g, ''),
          telefone: order.customer?.phone || invoice.dest_telefone,
          email: order.customer?.email || invoice.dest_email,
        };
      }
    }

    if (!destinatario) {
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
        cep: (invoice.dest_endereco_cep || '').replace(/\D/g, ''),
        telefone: invoice.dest_telefone,
        email: invoice.dest_email,
      };
    }

    const camposObrigatorios = [
      { valor: destinatario.bairro, nome: 'Bairro do destinatário' },
      { valor: destinatario.logradouro, nome: 'Logradouro do destinatário' },
      { valor: destinatario.cidade, nome: 'Cidade do destinatário' },
      { valor: destinatario.uf, nome: 'UF do destinatário' },
      { valor: destinatario.cep, nome: 'CEP do destinatário' },
    ];

    const camposFaltando = camposObrigatorios.filter(c => !c.valor || String(c.valor).trim() === '');
    if (camposFaltando.length > 0) {
      const faltando = camposFaltando.map(c => c.nome).join(', ');
      return new Response(
        JSON.stringify({ success: false, error: `Campos obrigatórios não preenchidos: ${faltando}.` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emitenteUf = (settings.endereco_uf || '').toUpperCase();
    const destUf = (destinatario.uf || '').toUpperCase();

    const nfeItems = items.map((item, index) => ({
      numero_item: item.numero_item || index + 1,
      codigo_produto: item.codigo_produto || item.product_id?.substring(0, 60) || `PROD${index + 1}`,
      descricao: item.descricao || 'PRODUTO',
      cfop: item.cfop || (emitenteUf === destUf ? '5102' : '6102'),
      ncm: item.ncm || '00000000',
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade || 1,
      valor_unitario: item.valor_unitario || 0,
      valor_total: item.valor_total || 0,
      valor_desconto: item.valor_desconto,
      origem: item.origem || '0',
      csosn: item.csosn,
      cst_icms: item.cst_icms,
      cst_pis: item.cst_pis || '07',
      cst_cofins: item.cst_cofins || '07',
      gtin: item.gtin,
      gtin_tributavel: item.gtin_tributavel,
      cest: item.cest,
    }));

    const payment = invoice.order_id ? {
      forma: invoice.pagamento_meio || 'other',
      valor: invoice.valor_total || 0
    } : undefined;

    // ----- Resolução da transportadora (catálogo embutido + dados do pedido) -----
    const carrierNameRaw = invoice.transportadora_nome
      || orderRow?.shipping_carrier
      || null;
    const serviceNameRaw = invoice.transportadora_servico
      || orderRow?.shipping_service_name
      || orderRow?.shipping_method_name
      || null;
    const resolvedCarrier = resolveCarrier({
      carrierName: carrierNameRaw,
      serviceName: serviceNameRaw,
    });

    const freteValor = Number(invoice.valor_frete || orderRow?.shipping_total || 0);
    const freteGratis = !!(orderRow?.free_shipping) || (freteValor === 0 && !!carrierNameRaw);
    const modalidadeInvoice = (() => {
      const m = String(invoice.modalidade_frete || '').trim();
      if (m === '0' || m === '1' || m === '2' || m === '9') return Number(m);
      return undefined;
    })();

    const pesoBrutoKg = Number(invoice.peso_bruto || 0);
    const pesoLiquidoKg = Number(invoice.peso_liquido || 0);
    const qtdVolumes = Number(invoice.quantidade_volumes || 1);

    const transporteInput = carrierNameRaw ? {
      razao_social: resolvedCarrier.razao_social,
      cnpj: resolvedCarrier.cnpj,
      inscricao_estadual: resolvedCarrier.inscricao_estadual,
      endereco: resolvedCarrier.endereco,
      municipio: resolvedCarrier.municipio,
      uf: resolvedCarrier.uf,
      servico: resolvedCarrier.servico || serviceNameRaw,
      modalidade: modalidadeInvoice,
      quantidade_volumes: qtdVolumes > 0 ? qtdVolumes : 1,
      especie_volumes: invoice.especie_volumes || 'VOLUME',
      peso_bruto_kg: pesoBrutoKg > 0 ? pesoBrutoKg : undefined,
      peso_liquido_kg: pesoLiquidoKg > 0 ? pesoLiquidoKg : undefined,
    } : undefined;

    // Reaproveita ref existente, EXCETO quando a nota está rejeitada — nesse caso,
    // Focus NFe devolveria resposta em cache. Geramos novo ref para forçar reenvio à SEFAZ.
    const isRetryRejected = invoice.status === 'rejected' && !!invoice.focus_ref;
    let ref = isRetryRejected
      ? generateNFeRef(invoice_id, 'retry')
      : (invoice.focus_ref || generateNFeRef(invoice_id, 'initial'));
    if (isRetryRejected) {
      console.log(`[fiscal-emit] Retry de rejeitada. Ref anterior=${invoice.focus_ref} -> novo ref=${ref}`);
    }

    // ----- Numeração soberana com retry de duplicidade -----
    // Sempre passamos numero/serie ao Focus para que o número que o sistema
    // mostra ao lojista seja exatamente o número autorizado pela SEFAZ.
    // Se vier rejeição por "número já utilizado", incrementamos e tentamos
    // de novo, mantendo o cursor monotônico. Cap = 20 tentativas.
    const serieNfe = Number(settings.serie_nfe || 1);
    let numeroAtual = Number(invoice.numero || 0);
    if (!numeroAtual || numeroAtual <= 0) {
      // Fallback de segurança (não deveria acontecer — PV/NF já trazem número)
      numeroAtual = Math.max(1, Number(settings.numero_nfe_atual || 1));
    }

    const MAX_NUMBER_RETRIES = 20;
    let result: any = null;
    let usedRef = ref;
    let attempts = 0;

    while (attempts < MAX_NUMBER_RETRIES) {
      attempts += 1;

      const nfePayload = buildNFePayload(
        {
          id: invoice_id,
          natureza_operacao: invoice.natureza_operacao || 'VENDA DE MERCADORIA',
          tipo_operacao: invoice.tipo_operacao || 'saida',
          finalidade: invoice.finalidade || 'normal',
          valor_produtos: invoice.valor_produtos || 0,
          valor_frete: freteValor || 0,
          valor_desconto: invoice.valor_desconto || 0,
          valor_total: invoice.valor_total || 0,
          informacoes_complementares: invoice.informacoes_complementares,
          numero: numeroAtual,
          serie: serieNfe,
          free_shipping: freteGratis,
        },
        destinatario,
        nfeItems,
        { cnpj: settings.cnpj?.replace(/\D/g, '') || '', crt: settings.crt },
        payment,
        transporteInput,
      );

      console.log(`[fiscal-emit] Enviando NF-e numero=${numeroAtual} serie=${serieNfe} ref=${usedRef} (tentativa ${attempts}/${MAX_NUMBER_RETRIES})`);
      result = await sendNFe(focusConfig, usedRef, nfePayload);

      if (result.success) break;

      const dup = isDuplicateNumberError(result.error, result.data);
      if (!dup) break;

      console.warn(`[fiscal-emit] Número ${numeroAtual} duplicado na SEFAZ — avançando cursor e tentando novamente.`);

      // Auditoria estruturada: registra o salto de numeração para rastreabilidade
      // (explica futuras "lacunas" na sequência sem precisar investigar manualmente).
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
            origem: 'fiscal-emit',
          },
        });
      } catch (auditErr) {
        console.warn('[fiscal-emit] Falha ao registrar evento de duplicidade (não bloqueante):', auditErr);
      }

      // Novo ref a cada tentativa para evitar cache da Focus
      usedRef = generateNFeRef(invoice_id, 'retry');

      // Atualiza cursor do tenant em tempo real (monotônico)
      await supabaseClient
        .from('fiscal_settings')
        .update({ numero_nfe_atual: numeroAtual })
        .eq('tenant_id', tenantId)
        .lt('numero_nfe_atual', numeroAtual);
    }

    // Persiste número final usado (mesmo em falha, para auditoria)
    if (numeroAtual !== Number(invoice.numero || 0)) {
      await supabaseClient
        .from('fiscal_invoices')
        .update({ numero: numeroAtual, serie: serieNfe })
        .eq('id', invoice_id);
    }

    const ref_final = usedRef;

    if (!result || !result.success) {
      await supabaseClient
        .from('fiscal_invoices')
        .update({
          status: 'rejected',
          fiscal_stage: 'pendencia',
          pendencia_motivos: [result.error],
          mensagem_sefaz: result.error,
          focus_ref: ref_final,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice_id);

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Focus NFe geralmente retorna 202 (processando) — consultar status
    let statusData = result.data;
    if (statusData?.status === 'processando_autorizacao') {
      // Aguardar 2s e consultar
      await new Promise(r => setTimeout(r, 2000));
      const statusResult = await getNFeStatus(focusConfig, ref_final);
      if (statusResult.success && statusResult.data) {
        statusData = statusResult.data;
      }
    }

    const focusStatus = statusData?.status || 'processando_autorizacao';
    const internalStatus = mapFocusStatusToInternal(focusStatus);

    console.log(`[fiscal-emit] Status Focus NFe: ${focusStatus} -> ${internalStatus}`);

    const updateData: any = {
      status: internalStatus,
      // Rejeição volta para pendência; só documento aceito/protocolado segue como emitida.
      fiscal_stage: internalStatus === 'rejected' ? 'pendencia' : 'emitida',
      focus_ref: ref_final,
      pendencia_motivos: internalStatus === 'rejected'
        ? [statusData?.mensagem_sefaz || statusData?.status_sefaz || 'Nota rejeitada pela SEFAZ.']
        : null,
      mensagem_sefaz: statusData?.mensagem_sefaz,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (focusStatus === 'autorizado' && statusData?.chave_nfe) {
      const baseUrl = ambiente === 'producao'
        ? 'https://api.focusnfe.com.br'
        : 'https://homologacao.focusnfe.com.br';

      updateData.chave_acesso = statusData.chave_nfe;
      updateData.numero = statusData.numero ? parseInt(String(statusData.numero), 10) : undefined;
      updateData.serie = statusData.serie ? parseInt(String(statusData.serie), 10) : undefined;
      updateData.xml_url = statusData.caminho_xml_nota_fiscal ? `${baseUrl}${statusData.caminho_xml_nota_fiscal}` : null;
      updateData.danfe_url = statusData.caminho_danfe ? `${baseUrl}${statusData.caminho_danfe}` : null;
      updateData.authorized_at = new Date().toISOString();

      if (invoice.order_id) {
        await linkNFeToShipment({
          supabaseClient,
          orderId: invoice.order_id,
          invoiceId: invoice_id,
          tenantId,
          chaveAcesso: statusData.chave_nfe,
          autoCreateShipment: !!settings.auto_create_shipment,
          callerModule: 'fiscal-emit',
        });
      }

      if (settings.enviar_email_nfe !== false) {
        fetch(`${supabaseUrl}/functions/v1/fiscal-send-nfe-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ invoice_id, tenant_id: tenantId }),
        }).catch(err => console.error('[fiscal-emit] Email error:', err));
      }

      // WMS Pratika — combinado ancorado na NF (vale para PV manual ou pedido real).
      fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ action: 'send_combined', invoice_id, tenant_id: tenantId }),
      }).catch(err => console.error('[fiscal-emit] WMS Pratika error:', err));
    }

    await supabaseClient
      .from('fiscal_invoices')
      .update(updateData)
      .eq('id', invoice_id);

    // Marca alta da SEFAZ: o cursor numero_nfe_atual nunca recua.
    // Garante que nenhum número já queimado lá fora seja reusado por rascunho.
    await supabaseClient
      .from('fiscal_settings')
      .update({ numero_nfe_atual: numeroAtual + 1 })
      .eq('tenant_id', tenantId)
      .lt('numero_nfe_atual', numeroAtual + 1);

    await supabaseClient
      .from('fiscal_invoice_events')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        event_type: focusStatus === 'autorizado' ? 'authorized' : 'submitted',
        event_data: { focus_response: statusData, ref: ref_final, numero: numeroAtual, serie: serieNfe },
      });

    console.log(`[fiscal-emit] NF-e ${invoice_id} processada — status=${focusStatus}`);

    // Cobrança pós-emissão (apenas se autorizada)
    if (focusStatus === 'autorizado') {
      chargeAfter({
        tenantId,
        serviceKey: "nfe-emit",
        units: { count: 1 },
        jobId: invoice_id,
        feature: "fiscal-emit",
        metadata: { ref: ref_final, chave: statusData?.chave_nfe },
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: focusStatus !== 'erro_autorizacao' && focusStatus !== 'denegado',
        status: internalStatus,
        focus_status: focusStatus,
        chave_acesso: statusData?.chave_nfe,
        numero: statusData?.numero,
        serie: statusData?.serie,
        mensagem: statusData?.mensagem_sefaz,
        erros: statusData?.erros,
        warnings: gateWarnings.length ? gateWarnings : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return errorResponse(error, corsHeaders, { module: 'fiscal', action: 'emit' });
  }
});
