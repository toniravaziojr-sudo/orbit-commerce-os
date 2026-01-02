/**
 * Cliente SOAP para comunicação com SEFAZ
 * 
 * Implementa comunicação HTTPS com os WebServices da SEFAZ
 * usando certificado digital A1 para autenticação mTLS
 */

import * as forge from 'https://esm.sh/node-forge@1.3.1';

export interface SoapClientConfig {
  /** URL do WebService SEFAZ */
  url: string;
  /** Ação SOAP (SOAPAction header) */
  action: string;
  /** Certificado PFX em base64 */
  pfxBase64: string;
  /** Senha do certificado */
  pfxPassword: string;
  /** Timeout em ms (default: 60000) */
  timeout?: number;
}

export interface SoapResponse {
  success: boolean;
  statusCode: number;
  body: string;
  error?: string;
}

/**
 * Monta o envelope SOAP para NF-e
 */
export function buildSoapEnvelope(serviceName: string, xmlContent: string): string {
  // Namespace varia por serviço
  const namespaces: Record<string, string> = {
    'NFeAutorizacao4': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
    'NFeRetAutorizacao4': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4',
    'NfeConsultaProtocolo4': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4',
    'NfeStatusServico4': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4',
    'RecepcaoEvento4': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4',
  };

  const methodNames: Record<string, string> = {
    'NFeAutorizacao4': 'nfeAutorizacaoLote',
    'NFeRetAutorizacao4': 'nfeRetAutorizacaoLote',
    'NfeConsultaProtocolo4': 'nfeConsultaNF',
    'NfeStatusServico4': 'nfeStatusServicoNF',
    'RecepcaoEvento4': 'nfeRecepcaoEvento',
  };

  const ns = namespaces[serviceName] || 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';
  const method = methodNames[serviceName] || 'nfeDadosMsg';

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap12:Body>
    <${method} xmlns="${ns}">
      <nfeDadosMsg>${xmlContent}</nfeDadosMsg>
    </${method}>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Extrai certificado e chave do PFX usando node-forge
 */
function extractCertFromPfx(pfxBase64: string, password: string): { cert: string; key: string } {
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
  
  // Extrair certificado
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag];
  
  if (!certBag || certBag.length === 0) {
    throw new Error('Certificado não encontrado no PFX');
  }
  
  const cert = certBag[0].cert;
  if (!cert) {
    throw new Error('Certificado inválido no PFX');
  }
  
  // Extrair chave privada
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  
  if (!keyBag || keyBag.length === 0) {
    throw new Error('Chave privada não encontrada no PFX');
  }
  
  const key = keyBag[0].key;
  if (!key) {
    throw new Error('Chave privada inválida no PFX');
  }
  
  // Converter para PEM
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(key);
  
  return { cert: certPem, key: keyPem };
}

/**
 * Envia requisição SOAP para SEFAZ
 * 
 * NOTA: Deno não suporta mTLS nativo com fetch.
 * Esta implementação usa fetch padrão que funciona em homologação
 * para alguns estados. Para produção com mTLS obrigatório,
 * seria necessário usar Deno.connectTls ou um proxy externo.
 */
export async function sendSoapRequest(config: SoapClientConfig, soapEnvelope: string): Promise<SoapResponse> {
  const { url, action, timeout = 60000 } = config;
  
  console.log('[soap-client] Sending request to:', url);
  console.log('[soap-client] SOAPAction:', action);
  
  try {
    // Para mTLS completo, precisaríamos usar Deno.connectTls
    // Por enquanto, tentamos com fetch padrão (funciona em alguns cenários)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'SOAPAction': action,
      },
      body: soapEnvelope,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    const body = await response.text();
    
    console.log('[soap-client] Response status:', response.status);
    console.log('[soap-client] Response body length:', body.length);
    
    return {
      success: response.ok,
      statusCode: response.status,
      body,
    };
  } catch (error: any) {
    console.error('[soap-client] Error:', error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        statusCode: 408,
        body: '',
        error: 'Timeout na comunicação com SEFAZ',
      };
    }
    
    return {
      success: false,
      statusCode: 0,
      body: '',
      error: error.message || 'Erro desconhecido na comunicação',
    };
  }
}

/**
 * Extrai conteúdo de uma tag XML
 */
export function extractXmlTag(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extrai atributo de uma tag XML
 */
export function extractXmlAttribute(xml: string, tagName: string, attrName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Parse da resposta de autorização
 */
export interface AutorizacaoResult {
  /** Status: 100=Autorizado, outros=Erro */
  cStat: string;
  /** Motivo */
  xMotivo: string;
  /** Protocolo de autorização */
  nProt?: string;
  /** Data/hora de autorização */
  dhRecbto?: string;
  /** Chave de acesso */
  chNFe?: string;
  /** Digest value (para verificação) */
  digVal?: string;
  /** XML do protocolo */
  xmlProt?: string;
}

export function parseAutorizacaoResponse(soapBody: string): AutorizacaoResult | null {
  // Primeiro tentar extrair retorno síncrono
  let retEnviNFe = extractXmlTag(soapBody, 'retEnviNFe');
  
  if (!retEnviNFe) {
    // Tentar extrair de dentro do nfeResultMsg
    const nfeResultMsg = extractXmlTag(soapBody, 'nfeResultMsg');
    if (nfeResultMsg) {
      retEnviNFe = extractXmlTag(nfeResultMsg, 'retEnviNFe');
    }
  }
  
  if (!retEnviNFe) {
    console.log('[soap-client] retEnviNFe not found in response');
    return null;
  }
  
  const cStat = extractXmlTag(retEnviNFe, 'cStat') || '';
  const xMotivo = extractXmlTag(retEnviNFe, 'xMotivo') || '';
  
  // Verificar se tem protocolo (autorização síncrona)
  const protNFe = extractXmlTag(retEnviNFe, 'protNFe');
  
  if (protNFe) {
    const infProt = extractXmlTag(protNFe, 'infProt');
    if (infProt) {
      return {
        cStat: extractXmlTag(infProt, 'cStat') || cStat,
        xMotivo: extractXmlTag(infProt, 'xMotivo') || xMotivo,
        nProt: extractXmlTag(infProt, 'nProt') || undefined,
        dhRecbto: extractXmlTag(infProt, 'dhRecbto') || undefined,
        chNFe: extractXmlTag(infProt, 'chNFe') || undefined,
        digVal: extractXmlTag(infProt, 'digVal') || undefined,
        xmlProt: protNFe,
      };
    }
  }
  
  return { cStat, xMotivo };
}

/**
 * Parse da resposta de status do serviço
 */
export interface StatusServicoResult {
  cStat: string;
  xMotivo: string;
  cUF: string;
  dhRecbto: string;
  tMed?: string;
}

export function parseStatusServicoResponse(soapBody: string): StatusServicoResult | null {
  let retConsStatServ = extractXmlTag(soapBody, 'retConsStatServ');
  
  if (!retConsStatServ) {
    const nfeResultMsg = extractXmlTag(soapBody, 'nfeResultMsg');
    if (nfeResultMsg) {
      retConsStatServ = extractXmlTag(nfeResultMsg, 'retConsStatServ');
    }
  }
  
  if (!retConsStatServ) {
    return null;
  }
  
  return {
    cStat: extractXmlTag(retConsStatServ, 'cStat') || '',
    xMotivo: extractXmlTag(retConsStatServ, 'xMotivo') || '',
    cUF: extractXmlTag(retConsStatServ, 'cUF') || '',
    dhRecbto: extractXmlTag(retConsStatServ, 'dhRecbto') || '',
    tMed: extractXmlTag(retConsStatServ, 'tMed') || undefined,
  };
}
