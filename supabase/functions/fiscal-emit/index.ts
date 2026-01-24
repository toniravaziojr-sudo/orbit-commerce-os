import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { emitirNFe, type NuvemFiscalConfig } from "../_shared/nuvem-fiscal-client.ts";
import { buildNFePayload, parseNFeResponse } from "../_shared/nuvem-fiscal-adapter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const clientId = Deno.env.get('NUVEM_FISCAL_CLIENT_ID');
  const clientSecret = Deno.env.get('NUVEM_FISCAL_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ success: false, error: 'Credenciais Nuvem Fiscal não configuradas' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

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

    // Obter invoice_id do body
    const body = await req.json();
    const { invoice_id } = body;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fiscal-emit] Processando NF-e ${invoice_id} para tenant ${tenantId}`);

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

    // Verificar se empresa está sincronizada com Nuvem Fiscal
    if (!settings.nuvem_fiscal_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Empresa não cadastrada na Nuvem Fiscal. Sincronize primeiro em Configurações > Fiscal.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ambiente = (settings.ambiente || 'homologacao') as 'homologacao' | 'producao';
    console.log(`[fiscal-emit] Ambiente: ${ambiente}`);

    // Configurar cliente Nuvem Fiscal
    const nuvemFiscalConfig: NuvemFiscalConfig = {
      clientId,
      clientSecret,
      ambiente,
    };

    // Buscar dados do pedido para destinatário
    let destinatario: any;
    
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
        const cpfCnpj = (order.customer?.cpf || invoice.dest_cpf_cnpj)?.replace(/\D/g, '') || '';
        const isCnpj = cpfCnpj.length === 14;
        
        // Buscar código IBGE do município
        let codigoMunicipio = '';
        if (order.shipping_city && order.shipping_state) {
          const { data: ibge } = await supabaseClient.rpc('get_ibge_municipio_codigo', {
            p_municipio: order.shipping_city,
            p_uf: order.shipping_state
          });
          codigoMunicipio = ibge || '';
        }
        
        destinatario = {
          nome: order.customer?.full_name || order.shipping_name || invoice.dest_nome || 'CONSUMIDOR FINAL',
          cpf: !isCnpj ? cpfCnpj : undefined,
          cnpj: isCnpj ? cpfCnpj : undefined,
          inscricao_estadual: invoice.dest_inscricao_estadual,
          logradouro: order.shipping_street || invoice.dest_endereco_logradouro || '',
          numero: order.shipping_number || invoice.dest_endereco_numero || 'S/N',
          complemento: order.shipping_complement || invoice.dest_endereco_complemento,
          bairro: order.shipping_neighborhood || invoice.dest_endereco_bairro || '',
          municipio: order.shipping_city || invoice.dest_endereco_municipio || '',
          codigo_municipio: codigoMunicipio,
          uf: order.shipping_state || invoice.dest_endereco_uf || '',
          cep: (order.shipping_postal_code || invoice.dest_endereco_cep || '').replace(/\D/g, ''),
          telefone: order.customer?.phone || invoice.dest_telefone,
          email: order.customer?.email || invoice.dest_email,
        };
      }
    }

    // Fallback para dados da invoice
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
        municipio: invoice.dest_endereco_municipio || '',
        codigo_municipio: invoice.dest_endereco_municipio_codigo || '',
        uf: invoice.dest_endereco_uf || '',
        cep: (invoice.dest_endereco_cep || '').replace(/\D/g, ''),
        telefone: invoice.dest_telefone,
        email: invoice.dest_email,
      };
    }

    // Validar campos obrigatórios
    const camposObrigatorios = [
      { campo: 'bairro', valor: destinatario.bairro, nome: 'Bairro do destinatário' },
      { campo: 'logradouro', valor: destinatario.logradouro, nome: 'Logradouro do destinatário' },
      { campo: 'municipio', valor: destinatario.municipio, nome: 'Cidade do destinatário' },
      { campo: 'uf', valor: destinatario.uf, nome: 'UF do destinatário' },
      { campo: 'cep', valor: destinatario.cep, nome: 'CEP do destinatário' },
    ];

    const camposFaltando = camposObrigatorios.filter(c => !c.valor || c.valor.trim() === '');
    
    if (camposFaltando.length > 0) {
      const faltando = camposFaltando.map(c => c.nome).join(', ');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Campos obrigatórios não preenchidos: ${faltando}. Verifique os dados de endereço.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar dados do emitente
    const emitente = {
      cnpj: settings.cnpj?.replace(/\D/g, ''),
      razao_social: settings.razao_social,
      nome_fantasia: settings.nome_fantasia,
      inscricao_estadual: settings.inscricao_estadual,
      crt: String(settings.crt || 1),
      logradouro: settings.endereco_logradouro,
      numero: settings.endereco_numero,
      complemento: settings.endereco_complemento,
      bairro: settings.endereco_bairro,
      cidade: settings.endereco_municipio,
      codigo_municipio: settings.endereco_municipio_codigo,
      uf: settings.endereco_uf,
      cep: settings.endereco_cep?.replace(/\D/g, ''),
    };

    // Converter itens para formato Nuvem Fiscal
    const nfeItems = items.map((item, index) => ({
      numero_item: item.numero_item || index + 1,
      codigo_produto: item.codigo_produto || item.product_id?.substring(0, 60) || `PROD${index + 1}`,
      descricao: item.descricao || 'PRODUTO',
      cfop: item.cfop || (emitente.uf === destinatario.uf ? '5102' : '6102'),
      ncm: item.ncm || '00000000',
      unidade: item.unidade || 'UN',
      quantidade: item.quantidade || 1,
      valor_unitario: item.valor_unitario || 0,
      valor_total: item.valor_total || 0,
      valor_desconto: item.valor_desconto,
      origem: item.origem || '0',
      csosn: item.csosn || '102',
      cst_pis: item.cst_pis || '07',
      cst_cofins: item.cst_cofins || '07',
    }));

    // Preparar payment
    const payment = invoice.order_id ? { 
      forma: 'other', 
      valor: invoice.valor_total || 0 
    } : undefined;

    // Montar payload NF-e
    const nfePayload = buildNFePayload(
      {
        id: invoice_id,
        natureza_operacao: invoice.natureza_operacao || 'VENDA DE MERCADORIA',
        tipo_operacao: invoice.tipo_operacao || 'saida',
        finalidade: invoice.finalidade || '1',
        valor_produtos: invoice.valor_produtos || 0,
        valor_frete: invoice.valor_frete || 0,
        valor_desconto: invoice.valor_desconto || 0,
        valor_total: invoice.valor_total || 0,
        informacoes_complementares: invoice.informacoes_complementares,
        numero: invoice.numero || settings.numero_nfe_atual || 1,
        serie: invoice.serie || settings.serie_nfe || 1,
      },
      emitente,
      destinatario,
      nfeItems,
      ambiente,
      payment
    );

    console.log(`[fiscal-emit] Enviando NF-e para Nuvem Fiscal...`);

    // Enviar para Nuvem Fiscal
    const result = await emitirNFe(nuvemFiscalConfig, nfePayload);
    
    if (!result.success) {
      // Atualizar status para rejected
      await supabaseClient
        .from('fiscal_invoices')
        .update({
          status: 'rejected',
          mensagem_sefaz: result.error,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice_id);

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = parseNFeResponse(result.data);

    console.log(`[fiscal-emit] Resposta Nuvem Fiscal:`, JSON.stringify(parsed));

    // Mapear status
    const statusMap: Record<string, string> = {
      'autorizado': 'authorized',
      'processando': 'processing',
      'pendente': 'pending',
      'erro': 'rejected',
      'rejeitado': 'rejected',
      'cancelado': 'cancelled',
    };
    const internalStatus = statusMap[parsed.status] || 'processing';

    // Atualizar NF-e com dados da resposta
    const updateData: any = {
      status: internalStatus,
      nuvem_fiscal_id: result.data?.id,
      mensagem_sefaz: parsed.mensagem,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Se autorizado
    if (parsed.status === 'autorizado' && parsed.chave) {
      updateData.chave_acesso = parsed.chave;
      updateData.numero = parsed.numero;
      updateData.serie = parsed.serie;
      updateData.protocolo = parsed.protocolo;
      updateData.xml_url = parsed.xml_url;
      updateData.danfe_url = parsed.pdf_url;
      updateData.authorized_at = new Date().toISOString();

      // Atualizar numeração
      await supabaseClient
        .from('fiscal_settings')
        .update({ numero_nfe_atual: (parsed.numero || 0) + 1 })
        .eq('tenant_id', tenantId);

      // Verificar auto-create shipment
      if (invoice.order_id && settings.auto_create_shipment) {
        console.log(`[fiscal-emit] Auto-creating shipment for order ${invoice.order_id}`);
        
        try {
          const shipResponse = await fetch(`${supabaseUrl}/functions/v1/shipping-create-shipment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ order_id: invoice.order_id }),
          });
          
          const shipResult = await shipResponse.json();
          console.log(`[fiscal-emit] Shipment result:`, JSON.stringify(shipResult));
          
          if (shipResult.success && shipResult.tracking_code) {
            await supabaseClient
              .from('orders')
              .update({ 
                status: 'shipped',
                shipped_at: new Date().toISOString()
              })
              .eq('id', invoice.order_id);
          } else {
            await supabaseClient
              .from('orders')
              .update({ status: 'processing' })
              .eq('id', invoice.order_id);
          }
        } catch (shipError) {
          console.error(`[fiscal-emit] Shipment error:`, shipError);
          await supabaseClient
            .from('orders')
            .update({ status: 'processing' })
            .eq('id', invoice.order_id);
        }
      } else if (invoice.order_id) {
        await supabaseClient
          .from('orders')
          .update({ status: 'processing' })
          .eq('id', invoice.order_id);
      }
      
      // Enviar email se habilitado
      if (settings.enviar_email_nfe !== false) {
        console.log(`[fiscal-emit] Sending NF-e email for invoice ${invoice_id}`);
        fetch(`${supabaseUrl}/functions/v1/fiscal-send-nfe-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ invoice_id, tenant_id: tenantId }),
        }).catch(err => console.error('[fiscal-emit] Email error:', err));
      }
    }

    await supabaseClient
      .from('fiscal_invoices')
      .update(updateData)
      .eq('id', invoice_id);

    // Registrar evento
    await supabaseClient
      .from('fiscal_invoice_events')
      .insert({
        invoice_id,
        tenant_id: tenantId,
        event_type: parsed.status === 'autorizado' ? 'authorized' : 'submitted',
        event_data: { nuvem_fiscal_response: result, parsed },
      });

    console.log(`[fiscal-emit] NF-e ${invoice_id} processada com status: ${parsed.status}`);

    return new Response(
      JSON.stringify({
        success: parsed.status !== 'erro' && parsed.status !== 'rejeitado',
        status: internalStatus,
        nuvem_fiscal_status: parsed.status,
        chave_acesso: parsed.chave,
        numero: parsed.numero,
        serie: parsed.serie,
        protocolo: parsed.protocolo,
        mensagem: parsed.mensagem,
        erros: parsed.erros,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fiscal-emit] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
