/**
 * Cliente HTTP para API Nuvem Fiscal
 * 
 * Documentação: https://dev.nuvemfiscal.com.br/docs/api
 * Versão da API: v2
 */

export interface NuvemFiscalConfig {
  clientId: string;
  clientSecret: string;
  ambiente: 'homologacao' | 'producao';
}

export interface NuvemFiscalEmpresaPayload {
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario?: 'simples_nacional' | 'simples_nacional_excesso' | 'lucro_presumido' | 'lucro_real';
  optante_simples_nacional?: boolean;
  endereco: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    codigo_municipio: string; // Código IBGE
    cidade: string;
    uf: string;
    cep: string;
    codigo_pais?: string;
    pais?: string;
  };
  telefone?: string;
  email?: string;
}

export interface NuvemFiscalCertificadoPayload {
  certificado: string; // Base64
  password: string;
}

export interface NuvemFiscalNFeItem {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  cfop: string;
  ncm: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_bruto: number;
  valor_desconto?: number;
  unidade_tributavel?: string;
  quantidade_tributavel?: number;
  valor_unitario_tributavel?: number;
  icms: {
    situacao_tributaria: string;
    origem: number;
    aliquota?: number;
    valor?: number;
  };
  pis: {
    situacao_tributaria: string;
    aliquota?: number;
    valor?: number;
  };
  cofins: {
    situacao_tributaria: string;
    aliquota?: number;
    valor?: number;
  };
}

export interface NuvemFiscalNFePayload {
  ambiente: 'homologacao' | 'producao';
  infNFe: {
    versao: string;
    ide: {
      cUF: string;
      natOp: string;
      mod: number; // 55=NF-e, 65=NFC-e
      serie: number;
      nNF: number;
      dhEmi: string;
      tpNF: number; // 0=Entrada, 1=Saída
      idDest: number; // 1=Interna, 2=Interestadual, 3=Exterior
      cMunFG: string;
      tpImp: number; // Formato DANFE
      tpEmis: number; // 1=Normal
      finNFe: number; // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
      indFinal: number; // 0=Não, 1=Consumidor final
      indPres: number; // 1=Presencial, 2=Internet
    };
    emit: {
      CNPJ: string;
      xNome: string;
      xFant?: string;
      enderEmit: {
        xLgr: string;
        nro: string;
        xCpl?: string;
        xBairro: string;
        cMun: string;
        xMun: string;
        UF: string;
        CEP: string;
        cPais?: string;
        xPais?: string;
        fone?: string;
      };
      IE: string;
      CRT: number; // 1=Simples, 2=Simples Excesso, 3=Normal
    };
    dest: {
      CPF?: string;
      CNPJ?: string;
      xNome: string;
      enderDest?: {
        xLgr: string;
        nro: string;
        xCpl?: string;
        xBairro: string;
        cMun: string;
        xMun: string;
        UF: string;
        CEP: string;
        cPais?: string;
        xPais?: string;
        fone?: string;
      };
      indIEDest: number; // 1=Contribuinte, 2=Isento, 9=Não Contribuinte
      IE?: string;
      email?: string;
    };
    det: NuvemFiscalNFeItem[];
    total: {
      ICMSTot: {
        vBC: number;
        vICMS: number;
        vICMSDeson?: number;
        vFCP?: number;
        vBCST?: number;
        vST?: number;
        vFCPST?: number;
        vFCPSTRet?: number;
        vProd: number;
        vFrete?: number;
        vSeg?: number;
        vDesc?: number;
        vII?: number;
        vIPI?: number;
        vIPIDevol?: number;
        vPIS: number;
        vCOFINS: number;
        vOutro?: number;
        vNF: number;
      };
    };
    transp: {
      modFrete: number; // 0=Emitente, 1=Destinatário, 9=Sem Frete
    };
    pag: {
      detPag: Array<{
        tPag: string; // 01=Dinheiro, 03=Crédito, 04=Débito, 15=Boleto, 17=PIX
        vPag: number;
      }>;
    };
    infAdic?: {
      infCpl?: string;
    };
  };
}

export interface NuvemFiscalNFeResponse {
  id: string;
  ambiente: string;
  status: 'pendente' | 'autorizado' | 'rejeitado' | 'cancelado' | 'erro';
  motivo?: string;
  chave?: string;
  numero?: number;
  serie?: number;
  data_emissao?: string;
  data_autorizacao?: string;
  protocolo?: string;
  xml_url?: string;
  pdf_url?: string;
  erros?: Array<{ codigo: string; mensagem: string }>;
}

export interface NuvemFiscalEmpresaResponse {
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  regime_tributario?: string;
  certificado?: {
    validade: string;
    subject: string;
  };
  created_at: string;
  updated_at: string;
}

// Token cache
let tokenCache: { token: string; expiresAt: number } | null = null;

function getBaseUrl(): string {
  return 'https://api.nuvemfiscal.com.br';
}

/**
 * Obtém token OAuth2 da Nuvem Fiscal
 */
async function getAccessToken(config: NuvemFiscalConfig): Promise<string> {
  // Check cache
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token;
  }

  const response = await fetch('https://auth.nuvemfiscal.com.br/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'empresa nfe nfce cte mdfe nfse',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao obter token: ${error}`);
  }

  const data = await response.json();
  
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return tokenCache.token;
}

/**
 * Cadastra uma nova empresa na Nuvem Fiscal
 */
export async function criarEmpresa(
  config: NuvemFiscalConfig,
  empresa: NuvemFiscalEmpresaPayload
): Promise<{ success: boolean; data?: NuvemFiscalEmpresaResponse; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/empresas`;

    console.log(`[nuvem-fiscal] POST ${url}`);
    console.log(`[nuvem-fiscal] Empresa CNPJ: ${empresa.cpf_cnpj}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(empresa),
    });

    const data = await response.json();
    console.log(`[nuvem-fiscal] Response status: ${response.status}`);

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza uma empresa existente
 */
export async function atualizarEmpresa(
  config: NuvemFiscalConfig,
  cpfCnpj: string,
  empresa: Partial<NuvemFiscalEmpresaPayload>
): Promise<{ success: boolean; data?: NuvemFiscalEmpresaResponse; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/empresas/${cpfCnpj.replace(/\D/g, '')}`;

    console.log(`[nuvem-fiscal] PUT ${url}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(empresa),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca uma empresa pelo CNPJ
 */
export async function buscarEmpresa(
  config: NuvemFiscalConfig,
  cpfCnpj: string
): Promise<{ success: boolean; data?: NuvemFiscalEmpresaResponse; error?: string; notFound?: boolean }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/empresas/${cpfCnpj.replace(/\D/g, '')}`;

    console.log(`[nuvem-fiscal] GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return { success: false, notFound: true, error: 'Empresa não encontrada' };
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Cadastra/atualiza certificado digital de uma empresa
 */
export async function cadastrarCertificado(
  config: NuvemFiscalConfig,
  cpfCnpj: string,
  certificado: NuvemFiscalCertificadoPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/empresas/${cpfCnpj.replace(/\D/g, '')}/certificado`;

    console.log(`[nuvem-fiscal] PUT ${url} (certificado)`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(certificado),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Emite uma NF-e
 */
export async function emitirNFe(
  config: NuvemFiscalConfig,
  nfe: NuvemFiscalNFePayload
): Promise<{ success: boolean; data?: NuvemFiscalNFeResponse; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/nfe`;

    console.log(`[nuvem-fiscal] POST ${url} (emissão NF-e)`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nfe),
    });

    const data = await response.json();
    console.log(`[nuvem-fiscal] Emissão response status: ${response.status}`);

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Consulta status de uma NF-e
 */
export async function consultarNFe(
  config: NuvemFiscalConfig,
  nfeId: string
): Promise<{ success: boolean; data?: NuvemFiscalNFeResponse; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/nfe/${nfeId}`;

    console.log(`[nuvem-fiscal] GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancela uma NF-e autorizada
 */
export async function cancelarNFe(
  config: NuvemFiscalConfig,
  nfeId: string,
  justificativa: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/nfe/${nfeId}/cancelamento`;

    console.log(`[nuvem-fiscal] POST ${url} (cancelamento)`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error?.message || data.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Baixa o XML da NF-e
 */
export async function baixarXmlNFe(
  config: NuvemFiscalConfig,
  nfeId: string
): Promise<{ success: boolean; xml?: string; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/nfe/${nfeId}/xml`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const xml = await response.text();
    return { success: true, xml };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Baixa o PDF (DANFE) da NF-e
 */
export async function baixarPdfNFe(
  config: NuvemFiscalConfig,
  nfeId: string
): Promise<{ success: boolean; pdf?: ArrayBuffer; error?: string }> {
  try {
    const token = await getAccessToken(config);
    const url = `${getBaseUrl()}/nfe/${nfeId}/pdf`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const pdf = await response.arrayBuffer();
    return { success: true, pdf };
  } catch (error: any) {
    console.error(`[nuvem-fiscal] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Sincroniza empresa (cria ou atualiza)
 */
export async function syncEmpresa(
  config: NuvemFiscalConfig,
  empresa: NuvemFiscalEmpresaPayload,
  certificado?: NuvemFiscalCertificadoPayload
): Promise<{ success: boolean; data?: NuvemFiscalEmpresaResponse; error?: string }> {
  const cpfCnpj = empresa.cpf_cnpj.replace(/\D/g, '');
  
  // Verificar se empresa já existe
  const existing = await buscarEmpresa(config, cpfCnpj);
  
  let result;
  if (existing.notFound) {
    // Criar nova empresa
    result = await criarEmpresa(config, empresa);
  } else if (existing.success) {
    // Atualizar empresa existente
    result = await atualizarEmpresa(config, cpfCnpj, empresa);
  } else {
    return existing;
  }

  if (!result.success) {
    return result;
  }

  // Cadastrar certificado se fornecido
  if (certificado) {
    const certResult = await cadastrarCertificado(config, cpfCnpj, certificado);
    if (!certResult.success) {
      console.warn(`[nuvem-fiscal] Erro ao cadastrar certificado: ${certResult.error}`);
      // Não falha a operação, apenas loga
    }
  }

  return result;
}
