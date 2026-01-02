// =============================================
// FISCAL GET STATUS - Consulta status NF-e na SEFAZ
// Usa certificado A1 do tenant para autenticação
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getSefazEndpoint } from "../_shared/sefaz-endpoints.ts";
import { buildConsSitNFeXml } from "../_shared/nfe-builder.ts";
import { loadCertificate, signXml } from "../_shared/xml-signer.ts";
import { 
  buildSoapEnvelope, 
  sendSoapRequest, 
  extractXmlTag 
} from "../_shared/soap-client.ts";
import { loadTenantCertificate } from "../_shared/certificate-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Parse da resposta de consulta de NF-e
 */
interface ConsultaResult {
  cStat: string;
  xMotivo: string;
  nProt?: string;
  dhRecbto?: string;
  chNFe?: string;
  xmlProt?: string;
}

function parseConsultaResponse(soapBody: string): ConsultaResult | null {
  let retConsSitNFe = extractXmlTag(soapBody, 'retConsSitNFe');
  
  if (!retConsSitNFe) {
    const nfeResultMsg = extractXmlTag(soapBody, 'nfeResultMsg');
    if (nfeResultMsg) {
      retConsSitNFe = extractXmlTag(nfeResultMsg, 'retConsSitNFe');
    }
  }
  
  if (!retConsSitNFe) {
    return null;
  }
  
  const cStat = extractXmlTag(retConsSitNFe, 'cStat') || '';
  const xMotivo = extractXmlTag(retConsSitNFe, 'xMotivo') || '';
  
  // Verificar se tem protocolo
  const protNFe = extractXmlTag(retConsSitNFe, 'protNFe');
  
  if (protNFe) {
    const infProt = extractXmlTag(protNFe, 'infProt');
    if (infProt) {
      return {
        cStat: extractXmlTag(infProt, 'cStat') || cStat,
        xMotivo: extractXmlTag(infProt, 'xMotivo') || xMotivo,
        nProt: extractXmlTag(infProt, 'nProt') || undefined,
        dhRecbto: extractXmlTag(infProt, 'dhRecbto') || undefined,
        chNFe: extractXmlTag(infProt, 'chNFe') || undefined,
        xmlProt: protNFe,
      };
    }
  }
  
  return { cStat, xMotivo };
}

// Mapeamento de código IBGE para sigla UF
const UF_CODE_MAP: Record<string, string> = {
  '12': 'AC', '27': 'AL', '16': 'AP', '13': 'AM', '29': 'BA',
  '23': 'CE', '53': 'DF', '32': 'ES', '52': 'GO', '21': 'MA',
  '51': 'MT', '50': 'MS', '31': 'MG', '15': 'PA', '25': 'PB',
  '41': 'PR', '26': 'PE', '22': 'PI', '33': 'RJ', '24': 'RN',
  '43': 'RS', '11': 'RO', '14': 'RR', '42': 'SC', '35': 'SP',
  '28': 'SE', '17': 'TO'
};

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

    console.log('[fiscal-get-status] Checking invoice:', invoice_id);

    // Buscar invoice
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

    // Se não está pendente, retornar status atual
    if (invoice.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: invoice.status,
          chave_acesso: invoice.chave_acesso,
          protocolo: invoice.protocolo,
          danfe_url: invoice.danfe_url,
          message: invoice.status === 'authorized' 
            ? 'NF-e autorizada' 
            : invoice.status_motivo || 'Status atual',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se tem chave de acesso
    if (!invoice.chave_acesso) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'NF-e pendente sem chave de acesso. Tente emitir novamente.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações fiscais
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

    // Carregar certificado
    console.log('[fiscal-get-status] Loading certificate...');
    
    let pfxBase64: string;
    let certPassword: string;
    let certificate: ReturnType<typeof loadCertificate>;
    
    try {
      const certData = await loadTenantCertificate(settings, encryptionKey);
      pfxBase64 = certData.pfxBase64;
      certPassword = certData.password;
      
      certificate = loadCertificate(pfxBase64, certPassword);
    } catch (certError: any) {
      console.error('[fiscal-get-status] Certificate error:', certError);
      return new Response(
        JSON.stringify({ success: false, error: certError.message || 'Erro ao carregar certificado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar XML de consulta
    const ambiente = settings.ambiente === 'producao' ? 1 : 2;
    const consultaXml = buildConsSitNFeXml(invoice.chave_acesso, ambiente);
    
    // Assinar XML de consulta
    const signedConsultaXml = signXml(consultaXml, 'consSitNFe', certificate);

    // Determinar UF a partir da chave de acesso (primeiros 2 dígitos)
    const ufCode = invoice.chave_acesso.substring(0, 2);
    const uf = UF_CODE_MAP[ufCode] || settings.endereco_uf;

    // Obter URL do WebService
    const webServiceUrl = getSefazEndpoint(
      uf, 
      'NfeConsultaProtocolo', 
      settings.ambiente === 'producao' ? 'producao' : 'homologacao'
    );
    
    console.log('[fiscal-get-status] SEFAZ URL:', webServiceUrl);
    
    // Montar e enviar SOAP
    const soapEnvelope = buildSoapEnvelope('NfeConsultaProtocolo4', signedConsultaXml);
    
    const soapResponse = await sendSoapRequest({
      url: webServiceUrl,
      action: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF',
      pfxBase64,
      pfxPassword: certPassword,
    }, soapEnvelope);
    
    console.log('[fiscal-get-status] SEFAZ response status:', soapResponse.statusCode);
    
    // Log da consulta
    await supabase
      .from('fiscal_invoice_events')
      .insert({
        invoice_id: invoice_id,
        tenant_id: tenantId,
        event_type: 'status_query',
        response_payload: { 
          statusCode: soapResponse.statusCode,
          body: soapResponse.body.substring(0, 5000),
        },
        user_id: user.id,
      });

    if (!soapResponse.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'pending',
          error: soapResponse.error || `Erro na comunicação com SEFAZ (HTTP ${soapResponse.statusCode})`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Processar resposta
    const result = parseConsultaResponse(soapResponse.body);
    
    if (!result) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'pending',
          message: 'Não foi possível interpretar resposta da SEFAZ.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fiscal-get-status] SEFAZ cStat:', result.cStat, 'xMotivo:', result.xMotivo);

    // Códigos de sucesso (100=Autorizado, 150=Autorizado fora prazo)
    if (result.cStat === '100' || result.cStat === '150') {
      await supabase
        .from('fiscal_invoices')
        .update({
          status: 'authorized',
          protocolo: result.nProt,
          xml_autorizado: invoice.xml_autorizado 
            ? invoice.xml_autorizado + (result.xmlProt || '')
            : result.xmlProt,
        })
        .eq('id', invoice_id);
      
      await supabase
        .from('fiscal_invoice_events')
        .insert({
          invoice_id: invoice_id,
          tenant_id: tenantId,
          event_type: 'authorized',
          event_data: {
            cStat: result.cStat,
            xMotivo: result.xMotivo,
            nProt: result.nProt,
          },
          user_id: user.id,
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'authorized',
          chave_acesso: invoice.chave_acesso,
          protocolo: result.nProt,
          message: result.xMotivo,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Códigos de processamento (105=Lote em processamento)
    if (result.cStat === '105') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'pending',
          message: result.xMotivo || 'Lote em processamento.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Qualquer outro código é problema/rejeição
    await supabase
      .from('fiscal_invoices')
      .update({
        status: 'rejected',
        status_motivo: `[${result.cStat}] ${result.xMotivo}`,
      })
      .eq('id', invoice_id);

    await supabase
      .from('fiscal_invoice_events')
      .insert({
        invoice_id: invoice_id,
        tenant_id: tenantId,
        event_type: 'rejected',
        event_data: {
          cStat: result.cStat,
          xMotivo: result.xMotivo,
        },
        user_id: user.id,
      });

    return new Response(
      JSON.stringify({ 
        success: false, 
        status: 'rejected',
        error: `[${result.cStat}] ${result.xMotivo}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[fiscal-get-status] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
