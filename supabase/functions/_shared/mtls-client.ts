/**
 * Cliente HTTPS com suporte a mTLS para comunicação com SEFAZ
 * 
 * Usa Deno.createHttpClient para estabelecer conexões com certificado de cliente
 */

export interface SoapMtlsConfig {
  url: string;
  soapAction: string;
  certPem: string;      // Certificado do cliente em PEM
  keyPem: string;       // Chave privada do cliente em PEM
  timeout?: number;     // Timeout em ms (default: 60000)
}

export interface SoapMtlsResponse {
  success: boolean;
  statusCode: number;
  body: string;
  error?: string;
}

/**
 * Envia requisição SOAP com mTLS para SEFAZ
 * 
 * Usa Deno.createHttpClient que suporta certificados de cliente para mTLS
 */
export async function sendSoapRequestMtls(
  config: SoapMtlsConfig,
  soapEnvelope: string
): Promise<SoapMtlsResponse> {
  const { url, soapAction, certPem, keyPem, timeout = 60000 } = config;

  console.log(`[mtls-client] Sending SOAP request to: ${url}`);
  console.log(`[mtls-client] SOAPAction: ${soapAction}`);
  console.log(`[mtls-client] Certificate PEM length: ${certPem.length}`);
  console.log(`[mtls-client] Private Key PEM length: ${keyPem.length}`);

  try {
    // Criar cliente HTTP com certificado de cliente para mTLS
    // @ts-ignore - Deno.createHttpClient existe mas pode não estar nos tipos
    const httpClient = Deno.createHttpClient({
      key: keyPem,
      cert: certPem,
    });

    console.log(`[mtls-client] HTTP client created with mTLS config`);

    // Configurar timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': soapAction,
        },
        body: soapEnvelope,
        signal: controller.signal,
        // @ts-ignore - client option para usar o httpClient com mTLS
        client: httpClient,
      });

      clearTimeout(timeoutId);

      const body = await response.text();

      console.log(`[mtls-client] Response status: ${response.status}`);
      console.log(`[mtls-client] Response body length: ${body.length}`);

      return {
        success: response.ok,
        statusCode: response.status,
        body,
      };
    } finally {
      clearTimeout(timeoutId);
      // Fechar o cliente HTTP
      httpClient.close();
    }
  } catch (error: any) {
    console.error(`[mtls-client] Error:`, error);

    if (error.name === 'AbortError') {
      return {
        success: false,
        statusCode: 408,
        body: '',
        error: 'Timeout na comunicação com SEFAZ',
      };
    }

    // Verificar se é erro de certificado
    if (error.message?.includes('certificate') || error.message?.includes('TLS')) {
      return {
        success: false,
        statusCode: 0,
        body: '',
        error: `Erro de certificado TLS: ${error.message}. Verifique se o certificado A1 é válido e está dentro da validade.`,
      };
    }

    return {
      success: false,
      statusCode: 0,
      body: '',
      error: error.message || 'Erro desconhecido na comunicação mTLS',
    };
  }
}

/**
 * Verifica se o ambiente suporta mTLS via Deno.createHttpClient
 */
export function isMtlsSupported(): boolean {
  // @ts-ignore
  return typeof Deno !== 'undefined' && typeof Deno.createHttpClient === 'function';
}
