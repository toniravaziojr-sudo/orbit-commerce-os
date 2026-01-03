/**
 * Cliente HTTP para API Focus NFe
 * 
 * Documentação: https://focusnfe.com.br/doc/
 */

export interface FocusNFeConfig {
  token: string;
  ambiente: 'homologacao' | 'producao';
}

export interface FocusEmpresaPayload {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  regime_tributario: number; // 1=Simples, 2=Simples Excesso, 3=Lucro Presumido/Real
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string;
  email?: string;
  habilita_nfe?: boolean;
  habilita_nfce?: boolean;
  arquivo_certificado_base64?: string;
  senha_certificado?: string;
}

export interface FocusNFeItem {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_bruto: number;
  codigo_ncm: string;
  icms_situacao_tributaria: string;
  icms_origem: number;
  pis_situacao_tributaria: string;
  cofins_situacao_tributaria: string;
  valor_desconto?: number;
  unidade_tributavel?: string;
  quantidade_tributavel?: number;
  valor_unitario_tributavel?: number;
}

export interface FocusNFePayload {
  natureza_operacao: string;
  tipo_documento: number; // 0=Entrada, 1=Saída
  finalidade_emissao: number; // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  consumidor_final: number; // 0=Não, 1=Sim
  presenca_comprador: number; // 0=Não se aplica, 1=Presencial, 2=Internet, 9=Outros
  cnpj_emitente: string;
  
  // Destinatário (PF ou PJ)
  nome_destinatario: string;
  cpf_destinatario?: string;
  cnpj_destinatario?: string;
  inscricao_estadual_destinatario?: string;
  logradouro_destinatario: string;
  numero_destinatario: string;
  complemento_destinatario?: string;
  bairro_destinatario: string;
  municipio_destinatario: string;
  uf_destinatario: string;
  cep_destinatario: string;
  telefone_destinatario?: string;
  email_destinatario?: string;
  indicador_inscricao_estadual_destinatario: number; // 1=Contribuinte, 2=Isento, 9=Não Contribuinte
  
  // Valores
  valor_produtos: number;
  valor_total: number;
  valor_frete?: number;
  valor_desconto?: number;
  
  // Frete
  modalidade_frete: number; // 0=Emitente, 1=Destinatário, 2=Terceiros, 9=Sem Frete
  
  // Itens
  items: FocusNFeItem[];
  
  // Pagamento
  formas_pagamento?: Array<{
    forma_pagamento: string; // 01=Dinheiro, 03=Cartão Crédito, 04=Cartão Débito, 05=Crédito Loja, 15=Boleto, 17=PIX
    valor_pagamento: number;
  }>;
  
  // Informações adicionais
  informacoes_adicionais_contribuinte?: string;
}

export interface FocusNFeResponse {
  cnpj_emitente?: string;
  ref?: string;
  status: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: string;
  serie?: string;
  caminho_xml_nota_fiscal?: string;
  caminho_danfe?: string;
  erros?: Array<{ codigo: string; mensagem: string; campo?: string }>;
}

export interface FocusEmpresaResponse {
  id?: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  regime_tributario?: number;
  habilita_nfe?: boolean;
  habilita_nfce?: boolean;
  certificado_validade?: string;
  erros?: Array<{ codigo: string; mensagem: string; campo?: string }>;
}

function getBaseUrl(ambiente: 'homologacao' | 'producao'): string {
  return ambiente === 'producao' 
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
}

function getAuthHeader(token: string): string {
  // Focus NFe usa Basic Auth com token:senha (senha vazia)
  return 'Basic ' + btoa(token + ':');
}

/**
 * Cadastra ou atualiza uma empresa na Focus NFe
 */
export async function syncEmpresa(
  config: FocusNFeConfig,
  empresa: FocusEmpresaPayload,
  empresaId?: string
): Promise<{ success: boolean; data?: FocusEmpresaResponse; error?: string }> {
  const baseUrl = getBaseUrl(config.ambiente);
  const url = empresaId 
    ? `${baseUrl}/v2/empresas/${empresaId}`
    : `${baseUrl}/v2/empresas`;
  
  const method = empresaId ? 'PUT' : 'POST';
  
  console.log(`[focus-nfe] ${method} ${url}`);
  console.log(`[focus-nfe] Empresa CNPJ: ${empresa.cnpj}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': getAuthHeader(config.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(empresa),
    });
    
    const data = await response.json();
    
    console.log(`[focus-nfe] Response status: ${response.status}`);
    console.log(`[focus-nfe] Response:`, JSON.stringify(data).substring(0, 500));
    
    if (!response.ok) {
      const errorMsg = data.erros?.map((e: any) => e.mensagem).join(', ') || 
                       data.mensagem || 
                       `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`[focus-nfe] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca informações de uma empresa na Focus NFe
 */
export async function getEmpresa(
  config: FocusNFeConfig,
  cnpj: string
): Promise<{ success: boolean; data?: FocusEmpresaResponse; error?: string }> {
  const baseUrl = getBaseUrl(config.ambiente);
  const url = `${baseUrl}/v2/empresas/${cnpj}`;
  
  console.log(`[focus-nfe] GET ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(config.token),
      },
    });
    
    if (response.status === 404) {
      return { success: false, error: 'Empresa não encontrada' };
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      const errorMsg = data.erros?.map((e: any) => e.mensagem).join(', ') || 
                       data.mensagem || 
                       `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`[focus-nfe] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Envia NF-e para autorização
 */
export async function sendNFe(
  config: FocusNFeConfig,
  ref: string,
  nfe: FocusNFePayload
): Promise<{ success: boolean; data?: FocusNFeResponse; error?: string }> {
  const baseUrl = getBaseUrl(config.ambiente);
  const url = `${baseUrl}/v2/nfe?ref=${encodeURIComponent(ref)}`;
  
  console.log(`[focus-nfe] POST ${url}`);
  console.log(`[focus-nfe] CNPJ Emitente: ${nfe.cnpj_emitente}`);
  console.log(`[focus-nfe] Destinatário: ${nfe.nome_destinatario}`);
  console.log(`[focus-nfe] Valor Total: ${nfe.valor_total}`);
  console.log(`[focus-nfe] Items: ${nfe.items.length}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(config.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nfe),
    });
    
    const responseText = await response.text();
    console.log(`[focus-nfe] Response status: ${response.status}`);
    console.log(`[focus-nfe] Response:`, responseText.substring(0, 1000));
    
    // Verificar se é erro de autenticação (texto puro)
    if (response.status === 401 || responseText.startsWith('HTTP Basic')) {
      return { 
        success: false, 
        error: 'Token Focus NFe inválido ou não autorizado. Verifique o token configurado.' 
      };
    }
    
    // Tentar parsear JSON
    let data: FocusNFeResponse;
    try {
      data = JSON.parse(responseText);
    } catch {
      return { success: false, error: `Resposta inesperada da Focus NFe: ${responseText.substring(0, 200)}` };
    }
    
    // Focus NFe retorna 202 para processando, 200 para autorizado imediato
    if (response.status === 202 || response.status === 200) {
      return { success: true, data };
    }
    
    const errorMsg = data.erros?.map((e: any) => `${e.campo || ''}: ${e.mensagem}`).join('; ') || 
                     (data as any).mensagem || 
                     `HTTP ${response.status}`;
    return { success: false, error: errorMsg, data };
  } catch (error: any) {
    console.error(`[focus-nfe] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Consulta status de uma NF-e
 */
export async function getNFeStatus(
  config: FocusNFeConfig,
  ref: string
): Promise<{ success: boolean; data?: FocusNFeResponse; error?: string }> {
  const baseUrl = getBaseUrl(config.ambiente);
  const url = `${baseUrl}/v2/nfe/${encodeURIComponent(ref)}`;
  
  console.log(`[focus-nfe] GET ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeader(config.token),
      },
    });
    
    const data = await response.json();
    
    console.log(`[focus-nfe] Response status: ${response.status}`);
    console.log(`[focus-nfe] Status NF-e: ${data.status}`);
    
    if (!response.ok && response.status !== 422) {
      const errorMsg = data.erros?.map((e: any) => e.mensagem).join(', ') || 
                       data.mensagem || 
                       `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`[focus-nfe] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancela uma NF-e autorizada
 */
export async function cancelNFe(
  config: FocusNFeConfig,
  ref: string,
  justificativa: string
): Promise<{ success: boolean; data?: FocusNFeResponse; error?: string }> {
  const baseUrl = getBaseUrl(config.ambiente);
  const url = `${baseUrl}/v2/nfe/${encodeURIComponent(ref)}`;
  
  console.log(`[focus-nfe] DELETE ${url}`);
  console.log(`[focus-nfe] Justificativa: ${justificativa.substring(0, 50)}...`);
  
  // Validar justificativa (15-255 caracteres)
  if (justificativa.length < 15 || justificativa.length > 255) {
    return { 
      success: false, 
      error: 'Justificativa deve ter entre 15 e 255 caracteres' 
    };
  }
  
  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': getAuthHeader(config.token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ justificativa }),
    });
    
    const data = await response.json();
    
    console.log(`[focus-nfe] Response status: ${response.status}`);
    console.log(`[focus-nfe] Response:`, JSON.stringify(data).substring(0, 500));
    
    if (!response.ok && response.status !== 200) {
      const errorMsg = data.erros?.map((e: any) => e.mensagem).join(', ') || 
                       data.mensagem || 
                       `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`[focus-nfe] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtém URL do DANFE em PDF
 */
export async function getDANFe(
  config: FocusNFeConfig,
  ref: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const result = await getNFeStatus(config, ref);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  if (result.data?.caminho_danfe) {
    const baseUrl = getBaseUrl(config.ambiente);
    return { 
      success: true, 
      url: `${baseUrl}${result.data.caminho_danfe}` 
    };
  }
  
  return { success: false, error: 'DANFE não disponível' };
}

/**
 * Obtém URL do XML da NF-e
 */
export async function getNFeXml(
  config: FocusNFeConfig,
  ref: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const result = await getNFeStatus(config, ref);
  
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  if (result.data?.caminho_xml_nota_fiscal) {
    const baseUrl = getBaseUrl(config.ambiente);
    return { 
      success: true, 
      url: `${baseUrl}${result.data.caminho_xml_nota_fiscal}` 
    };
  }
  
  return { success: false, error: 'XML não disponível' };
}
