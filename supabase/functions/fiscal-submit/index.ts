// =============================================
// FISCAL SUBMIT - Envia NF-e diretamente para SEFAZ
// Usa certificado A1 do tenant para assinatura e autenticação
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getSefazEndpoint } from "../_shared/sefaz-endpoints.ts";
import { formatAccessKey } from "../_shared/access-key.ts";
import { buildNFeXml, buildEnviNFeXml, type NFeData, type NFeEmitente, type NFeDestinatario, type NFeItem } from "../_shared/nfe-builder.ts";
import { loadCertificate, signNFeXml } from "../_shared/xml-signer.ts";
import { 
  buildSoapEnvelope, 
  sendSoapRequest, 
  parseAutorizacaoResponse 
} from "../_shared/soap-client.ts";
import { loadTenantCertificate } from "../_shared/certificate-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Formata CNPJ/CPF removendo caracteres não numéricos
 */
function formatDocument(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

/**
 * Monta dados do emitente a partir das configurações fiscais
 */
function buildEmitente(settings: any): NFeEmitente {
  return {
    CNPJ: formatDocument(settings.cnpj),
    xNome: settings.razao_social,
    xFant: settings.nome_fantasia || settings.razao_social,
    IE: formatDocument(settings.inscricao_estadual || ''),
    CRT: settings.crt || 3,
    enderEmit: {
      xLgr: settings.endereco_logradouro,
      nro: settings.endereco_numero || 'S/N',
      xCpl: settings.endereco_complemento || '',
      xBairro: settings.endereco_bairro,
      cMun: settings.endereco_municipio_codigo,
      xMun: settings.endereco_municipio,
      UF: settings.endereco_uf,
      CEP: formatDocument(settings.endereco_cep || ''),
      cPais: '1058',
      xPais: 'BRASIL',
      fone: formatDocument(settings.telefone || ''),
    },
  };
}

/**
 * Monta dados do destinatário a partir da invoice
 */
function buildDestinatario(invoice: any): NFeDestinatario {
  const docNum = formatDocument(invoice.dest_cpf_cnpj);
  const isCpf = docNum.length <= 11;
  
  return {
    CPF: isCpf ? docNum : undefined,
    CNPJ: !isCpf ? docNum : undefined,
    xNome: invoice.dest_nome,
    indIEDest: 9, // Não contribuinte
    enderDest: invoice.dest_endereco_logradouro ? {
      xLgr: invoice.dest_endereco_logradouro || '',
      nro: invoice.dest_endereco_numero || 'S/N',
      xCpl: invoice.dest_endereco_complemento || '',
      xBairro: invoice.dest_endereco_bairro || '',
      cMun: invoice.dest_endereco_municipio_codigo || '',
      xMun: invoice.dest_endereco_municipio || '',
      UF: invoice.dest_endereco_uf || '',
      CEP: formatDocument(invoice.dest_endereco_cep || ''),
      cPais: '1058',
      xPais: 'BRASIL',
    } : undefined,
  };
}

/**
 * Monta lista de produtos a partir dos itens da invoice
 */
function buildProdutos(items: any[], settings: any): NFeItem[] {
  return items.map((item, idx) => ({
    nItem: idx + 1,
    cProd: item.codigo_produto,
    cEAN: 'SEM GTIN',
    xProd: item.descricao,
    NCM: item.ncm,
    CFOP: item.cfop,
    uCom: item.unidade || 'UN',
    qCom: item.quantidade,
    vUnCom: item.valor_unitario,
    vProd: item.valor_total,
    cEANTrib: 'SEM GTIN',
    uTrib: item.unidade || 'UN',
    qTrib: item.quantidade,
    vUnTrib: item.valor_unitario,
    indTot: 1,
    // Tributação
    ICMS: {
      orig: item.origem || 0,
      CSOSN: settings.crt === 1 ? (item.csosn || '102') : undefined,
      CST: settings.crt !== 1 ? (item.cst || '00') : undefined,
    },
    PIS: {
      CST: '99', // Outras operações
      vBC: 0,
      pPIS: 0,
      vPIS: 0,
    },
    COFINS: {
      CST: '99', // Outras operações
      vBC: 0,
      pCOFINS: 0,
      vCOFINS: 0,
    },
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encryptionKey = Deno.env.get('FISCAL_ENCRYPTION_KEY');
    
    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de criptografia não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'invoice_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-submit] Processing invoice:', invoice_id);

    // ============================================
    // 1. Buscar dados necessários
    // ============================================
    
    // Invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('fiscal_invoices')
      .select('*')
      .eq('id', invoice_id)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e não encontrada.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invoice.status !== 'draft') {
      return new Response(
        JSON.stringify({ success: false, error: `NF-e não pode ser emitida. Status atual: ${invoice.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Itens
    const { data: items } = await supabase
      .from('fiscal_invoice_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('numero_item');

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'NF-e sem itens.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Configurações fiscais
    const { data: settings, error: settingsError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configurações fiscais não encontradas.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 2. Carregar e validar certificado
    // ============================================
    
    console.log('[fiscal-submit] Loading certificate...');
    
    let pfxBase64: string;
    let certPassword: string;
    let certificate: Awaited<ReturnType<typeof loadCertificate>>;
    
    try {
      const certData = await loadTenantCertificate(settings, encryptionKey);
      pfxBase64 = certData.pfxBase64;
      certPassword = certData.password;
      
      certificate = await loadCertificate(pfxBase64, certPassword);
      console.log('[fiscal-submit] Certificate loaded successfully');
    } catch (certError: any) {
      console.error('[fiscal-submit] Certificate error:', certError);
      return new Response(
        JSON.stringify({ success: false, error: certError.message || 'Erro ao carregar certificado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 3. Montar dados da NF-e
    // ============================================
    
    const ufEmitente = settings.endereco_uf;
    const ambiente = settings.ambiente === 'producao' ? 1 : 2;
    
    const emitente = buildEmitente(settings);
    const destinatario = buildDestinatario(invoice);
    const produtos = buildProdutos(items, settings);
    
    const nfeData: NFeData = {
      cUF: ufEmitente,
      natOp: invoice.natureza_operacao || 'VENDA DE MERCADORIA',
      serie: invoice.serie,
      nNF: invoice.numero,
      dhEmi: new Date(),
      tpNF: 1, // Saída
      idDest: 1, // Operação interna
      cMunFG: settings.endereco_municipio_codigo,
      tpImp: 1, // DANFE normal
      tpEmis: 1, // Normal
      tpAmb: ambiente,
      finNFe: 1, // Normal
      indFinal: 1, // Consumidor final
      indPres: 2, // Internet
      emit: emitente,
      dest: destinatario,
      det: produtos,
      transp: {
        modFrete: invoice.valor_frete > 0 ? 0 : 9, // 0=Emitente, 9=Sem frete
      },
      pag: [{
        tPag: '99', // Outros (o pagamento já foi processado no e-commerce)
        vPag: invoice.valor_total,
      }],
      total: {
        vProd: invoice.valor_produtos,
        vDesc: invoice.valor_desconto || 0,
        vFrete: invoice.valor_frete || 0,
        vNF: invoice.valor_total,
      },
      infAdic: invoice.observacoes ? {
        infCpl: invoice.observacoes,
      } : undefined,
    };

    // ============================================
    // 4. Construir XML da NF-e
    // ============================================
    
    console.log('[fiscal-submit] Building NF-e XML...');
    const nfeResult = buildNFeXml(nfeData);
    console.log('[fiscal-submit] NF-e XML built, chave:', formatAccessKey(nfeResult.chaveAcesso));

    // ============================================
    // 5. Assinar XML
    // ============================================
    
    console.log('[fiscal-submit] Signing XML...');
    
    let signedNFeXml: string;
    try {
      signedNFeXml = await signNFeXml(nfeResult.xml, certificate);
      console.log('[fiscal-submit] XML signed successfully');
    } catch (signError: any) {
      console.error('[fiscal-submit] Sign error:', signError);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao assinar XML: ${signError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 6. Montar lote de envio
    // ============================================
    
    const idLote = Date.now().toString().slice(-15);
    const enviNFeXml = buildEnviNFeXml(signedNFeXml, idLote);
    
    console.log('[fiscal-submit] Batch XML built, idLote:', idLote);

    // ============================================
    // 7. Atualizar status para pending
    // ============================================
    
    await supabase
      .from('fiscal_invoices')
      .update({ 
        status: 'pending',
        chave_acesso: nfeResult.chaveAcesso,
      })
      .eq('id', invoice_id);

    // Log do envio
    await supabase
      .from('fiscal_invoice_events')
      .insert({
        invoice_id: invoice_id,
        tenant_id: tenantId,
        event_type: 'submitted',
        event_data: { 
          chave_acesso: nfeResult.chaveAcesso,
          id_lote: idLote,
          ambiente: settings.ambiente,
          uf: ufEmitente,
        },
        user_id: user.id,
      });

    // ============================================
    // 8. Enviar para SEFAZ
    // ============================================
    
    const webServiceUrl = getSefazEndpoint(
      ufEmitente, 
      'NFeAutorizacao', 
      settings.ambiente === 'producao' ? 'producao' : 'homologacao'
    );
    
    console.log('[fiscal-submit] SEFAZ URL:', webServiceUrl);
    
    const soapEnvelope = buildSoapEnvelope('NFeAutorizacao4', enviNFeXml);
    
    try {
      const soapResponse = await sendSoapRequest({
        url: webServiceUrl,
        action: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote',
        pfxBase64,
        pfxPassword: certPassword,
      }, soapEnvelope);
      
      console.log('[fiscal-submit] SEFAZ response status:', soapResponse.statusCode);
      
      // Log da resposta
      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice_id,
          tenant_id: tenantId,
          event_type: soapResponse.success ? 'sefaz_response' : 'sefaz_error',
          response_payload: { 
            statusCode: soapResponse.statusCode,
            body: soapResponse.body.substring(0, 5000), // Limitar tamanho
            error: soapResponse.error,
          },
          user_id: user.id,
        });
      
      if (!soapResponse.success) {
        // Reverter status
        await supabase
          .from('fiscal_invoices')
          .update({ status: 'draft' })
          .eq('id', invoice_id);
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: soapResponse.error || `Erro na comunicação com SEFAZ (HTTP ${soapResponse.statusCode})`,
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // ============================================
      // 9. Processar resposta da SEFAZ
      // ============================================
      
      const autResult = parseAutorizacaoResponse(soapResponse.body);
      
      if (!autResult) {
        console.log('[fiscal-submit] Could not parse SEFAZ response');
        
        // Manter como pending para consulta posterior
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'pending',
            message: 'Resposta da SEFAZ não pôde ser interpretada. Consulte o status.',
            chave_acesso: nfeResult.chaveAcesso,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('[fiscal-submit] SEFAZ cStat:', autResult.cStat, 'xMotivo:', autResult.xMotivo);
      
      // Códigos de sucesso
      if (autResult.cStat === '100' || autResult.cStat === '150') {
        // Autorizado!
        const xmlAutorizado = signedNFeXml + (autResult.xmlProt || '');
        
        await supabase
          .from('fiscal_invoices')
          .update({
            status: 'authorized',
            protocolo: autResult.nProt,
            xml_autorizado: xmlAutorizado,
          })
          .eq('id', invoice_id);
        
        // Incrementar número da NF-e atomicamente
        await supabase
          .from('fiscal_settings')
          .update({ numero_nfe_atual: (settings.numero_nfe_atual || 1) + 1 })
          .eq('id', settings.id);
        
        // Update order status to 'dispatched' when NF-e is authorized
        if (invoice.order_id) {
          console.log('[fiscal-submit] Updating order status to dispatched:', invoice.order_id);
          await supabase
            .from('orders')
            .update({ status: 'dispatched' })
            .eq('id', invoice.order_id);
        }
        
        await supabase
          .from('fiscal_invoice_events')
          .insert({
            invoice_id: invoice_id,
            tenant_id: tenantId,
            event_type: 'authorized',
            event_data: {
              cStat: autResult.cStat,
              xMotivo: autResult.xMotivo,
              nProt: autResult.nProt,
              dhRecbto: autResult.dhRecbto,
            },
            user_id: user.id,
          });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'authorized',
            chave_acesso: nfeResult.chaveAcesso,
            protocolo: autResult.nProt,
            message: autResult.xMotivo,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Códigos de processamento (lote recebido, aguardando)
      if (['103', '104', '105'].includes(autResult.cStat)) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            status: 'pending',
            chave_acesso: nfeResult.chaveAcesso,
            message: autResult.xMotivo || 'Lote em processamento. Consulte o status.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Qualquer outro código é rejeição
      await supabase
        .from('fiscal_invoices')
        .update({
          status: 'rejected',
          status_motivo: `[${autResult.cStat}] ${autResult.xMotivo}`,
        })
        .eq('id', invoice_id);
      
      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice_id,
          tenant_id: tenantId,
          event_type: 'rejected',
          event_data: {
            cStat: autResult.cStat,
            xMotivo: autResult.xMotivo,
          },
          user_id: user.id,
        });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'rejected',
          error: `[${autResult.cStat}] ${autResult.xMotivo}`,
          chave_acesso: nfeResult.chaveAcesso,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (sefazError: any) {
      console.error('[fiscal-submit] SEFAZ error:', sefazError);
      
      // Reverter status
      await supabase
        .from('fiscal_invoices')
        .update({ status: 'draft' })
        .eq('id', invoice_id);
      
      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice_id,
          tenant_id: tenantId,
          event_type: 'sefaz_error',
          event_data: { error: sefazError.message },
          user_id: user.id,
        });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro na comunicação com SEFAZ: ${sefazError.message}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-submit] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
