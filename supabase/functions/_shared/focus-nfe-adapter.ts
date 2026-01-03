/**
 * Adaptador para converter dados internos para formato Focus NFe
 */

import type { 
  FocusEmpresaPayload, 
  FocusNFePayload, 
  FocusNFeItem 
} from './focus-nfe-client.ts';

// Mapeamento de CRT para regime_tributario Focus NFe
const CRT_TO_REGIME: Record<string, number> = {
  '1': 1, // Simples Nacional
  '2': 2, // Simples Nacional - Excesso
  '3': 3, // Regime Normal (Lucro Presumido/Real)
};

// Mapeamento de forma de pagamento para código Focus NFe
const PAYMENT_METHOD_MAP: Record<string, string> = {
  'credit_card': '03',
  'debit_card': '04',
  'pix': '17',
  'boleto': '15',
  'cash': '01',
  'store_credit': '05',
  'other': '99',
};

/**
 * Remove caracteres não numéricos
 */
function onlyNumbers(str: string | null | undefined): string {
  return (str || '').replace(/\D/g, '');
}

/**
 * Converte fiscal_settings para payload de empresa Focus NFe
 */
export function buildEmpresaPayload(
  settings: {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string | null;
    inscricao_estadual?: string | null;
    inscricao_municipal?: string | null;
    crt?: string | null;
    logradouro: string;
    numero: string;
    complemento?: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string | null;
    email?: string | null;
  },
  certificado?: {
    pfxBase64: string;
    password: string;
  }
): FocusEmpresaPayload {
  const payload: FocusEmpresaPayload = {
    cnpj: onlyNumbers(settings.cnpj),
    nome: settings.razao_social.toUpperCase(), // Focus NFe usa 'nome' para razão social
    nome_fantasia: settings.nome_fantasia?.toUpperCase() || undefined,
    inscricao_estadual: settings.inscricao_estadual ? onlyNumbers(settings.inscricao_estadual) : undefined,
    inscricao_municipal: settings.inscricao_municipal ? onlyNumbers(settings.inscricao_municipal) : undefined,
    regime_tributario: CRT_TO_REGIME[settings.crt || '1'] || 1,
    logradouro: settings.logradouro.toUpperCase(),
    numero: settings.numero,
    complemento: settings.complemento?.toUpperCase() || undefined,
    bairro: settings.bairro.toUpperCase(),
    municipio: settings.cidade.toUpperCase(), // Nome do município, não código IBGE
    uf: settings.uf.toUpperCase(),
    cep: onlyNumbers(settings.cep),
    telefone: settings.telefone ? onlyNumbers(settings.telefone) : undefined,
    email: settings.email || undefined,
    habilita_nfe: true,
    habilita_nfce: false,
  };
  
  // Adicionar certificado se fornecido
  if (certificado) {
    payload.arquivo_certificado_base64 = certificado.pfxBase64;
    payload.senha_certificado = certificado.password;
  }
  
  return payload;
}

/**
 * Converte invoice e items para payload NF-e Focus NFe
 */
export function buildNFePayload(
  invoice: {
    id: string;
    natureza_operacao?: string | null;
    tipo_operacao?: string | null;
    finalidade?: string | null;
    valor_produtos: number;
    valor_frete?: number | null;
    valor_desconto?: number | null;
    valor_total: number;
    informacoes_complementares?: string | null;
  },
  destinatario: {
    nome: string;
    cpf?: string | null;
    cnpj?: string | null;
    inscricao_estadual?: string | null;
    logradouro: string;
    numero: string;
    complemento?: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string | null;
    email?: string | null;
  },
  items: Array<{
    numero_item?: number;
    codigo_produto: string;
    descricao: string;
    cfop: string;
    ncm: string;
    unidade: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    valor_desconto?: number | null;
    origem?: string | null;
    cst_icms?: string | null;
    csosn?: string | null;
    cst_pis?: string | null;
    cst_cofins?: string | null;
  }>,
  emitente: {
    cnpj: string;
  },
  pagamento?: {
    forma: string;
    valor: number;
  }
): FocusNFePayload {
  // Determinar indicador de IE do destinatário
  let indicadorIE = 9; // Não contribuinte (padrão para PF)
  if (destinatario.cnpj) {
    if (destinatario.inscricao_estadual) {
      indicadorIE = 1; // Contribuinte ICMS
    } else {
      indicadorIE = 2; // Isento
    }
  }
  
  // Converter itens
  const focusItems: FocusNFeItem[] = items.map((item, index) => {
    // Determinar CST/CSOSN do ICMS
    const icmsSituacao = item.csosn || item.cst_icms || '102';
    
    // Coerção segura para campos string
    const codigoSeguro = (item.codigo_produto || '').substring(0, 60);
    const descricaoSegura = (item.descricao || 'PRODUTO').toUpperCase().substring(0, 120);
    const unidadeSegura = (item.unidade || 'UN').toUpperCase().substring(0, 6);
    
    return {
      numero_item: item.numero_item || index + 1,
      codigo_produto: codigoSeguro || `PROD${index + 1}`,
      descricao: descricaoSegura,
      cfop: onlyNumbers(item.cfop),
      unidade_comercial: unidadeSegura,
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: roundDecimal(item.valor_unitario, 4),
      valor_bruto: roundDecimal(item.valor_total, 2),
      valor_desconto: item.valor_desconto ? roundDecimal(item.valor_desconto, 2) : undefined,
      codigo_ncm: onlyNumbers(item.ncm).padStart(8, '0'),
      icms_situacao_tributaria: icmsSituacao,
      icms_origem: parseInt(item.origem || '0', 10),
      pis_situacao_tributaria: item.cst_pis || '07',
      cofins_situacao_tributaria: item.cst_cofins || '07',
      unidade_tributavel: unidadeSegura,
      quantidade_tributavel: item.quantidade,
      valor_unitario_tributavel: roundDecimal(item.valor_unitario, 4),
    };
  });
  
  // Determinar tipo de documento (0=Entrada, 1=Saída)
  const tipoDocumento = invoice.tipo_operacao === 'entrada' ? 0 : 1;
  
  // Determinar finalidade (1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução)
  const finalidadeMap: Record<string, number> = {
    'normal': 1,
    'complementar': 2,
    'ajuste': 3,
    'devolucao': 4,
  };
  const finalidade = finalidadeMap[invoice.finalidade || 'normal'] || 1;
  
  // Coerção segura para campos do destinatário (previne crash em null/undefined)
  const nomeSeguro = (destinatario.nome || 'CONSUMIDOR FINAL').toUpperCase().substring(0, 60);
  const logradouroSeguro = (destinatario.logradouro || '').toUpperCase().substring(0, 60);
  const numeroSeguro = (destinatario.numero || 'S/N').substring(0, 60);
  const complementoSeguro = destinatario.complemento ? destinatario.complemento.toUpperCase().substring(0, 60) : undefined;
  const bairroSeguro = (destinatario.bairro || '').toUpperCase().substring(0, 60);
  const cidadeSegura = (destinatario.cidade || '').toUpperCase().substring(0, 60);
  const ufSeguro = (destinatario.uf || '').toUpperCase();

  const payload: FocusNFePayload = {
    natureza_operacao: (invoice.natureza_operacao || 'VENDA DE MERCADORIA').toUpperCase(),
    data_emissao: new Date().toISOString(), // Data de emissão no formato ISO
    tipo_documento: tipoDocumento,
    finalidade_emissao: finalidade,
    consumidor_final: destinatario.cnpj ? 0 : 1,
    presenca_comprador: 2, // Internet
    cnpj_emitente: onlyNumbers(emitente.cnpj),
    
    // Destinatário (com coerção segura)
    nome_destinatario: nomeSeguro,
    cpf_destinatario: destinatario.cpf ? onlyNumbers(destinatario.cpf) : undefined,
    cnpj_destinatario: destinatario.cnpj ? onlyNumbers(destinatario.cnpj) : undefined,
    inscricao_estadual_destinatario: destinatario.inscricao_estadual ? onlyNumbers(destinatario.inscricao_estadual) : undefined,
    logradouro_destinatario: logradouroSeguro,
    numero_destinatario: numeroSeguro,
    complemento_destinatario: complementoSeguro,
    bairro_destinatario: bairroSeguro,
    municipio_destinatario: cidadeSegura,
    uf_destinatario: ufSeguro,
    cep_destinatario: onlyNumbers(destinatario.cep),
    telefone_destinatario: destinatario.telefone ? onlyNumbers(destinatario.telefone) : undefined,
    email_destinatario: destinatario.email || undefined,
    indicador_inscricao_estadual_destinatario: indicadorIE,
    
    // Valores
    valor_produtos: roundDecimal(invoice.valor_produtos, 2),
    valor_total: roundDecimal(invoice.valor_total, 2),
    valor_frete: invoice.valor_frete ? roundDecimal(invoice.valor_frete, 2) : undefined,
    valor_desconto: invoice.valor_desconto ? roundDecimal(invoice.valor_desconto, 2) : undefined,
    
    // Frete (9 = Sem frete para e-commerce)
    modalidade_frete: invoice.valor_frete && invoice.valor_frete > 0 ? 1 : 9,
    
    // Itens
    items: focusItems,
    
    // Informações adicionais
    informacoes_adicionais_contribuinte: invoice.informacoes_complementares?.substring(0, 2000) || undefined,
  };
  
  // Adicionar forma de pagamento
  if (pagamento) {
    payload.formas_pagamento = [{
      forma_pagamento: PAYMENT_METHOD_MAP[pagamento.forma] || '99',
      valor_pagamento: roundDecimal(pagamento.valor, 2),
    }];
  } else {
    // Padrão: pagamento à vista no valor total
    payload.formas_pagamento = [{
      forma_pagamento: '99', // Outros
      valor_pagamento: roundDecimal(invoice.valor_total, 2),
    }];
  }
  
  return payload;
}

/**
 * Arredonda decimal para número de casas especificado
 */
function roundDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Gera referência única para NF-e
 */
export function generateNFeRef(invoiceId: string): string {
  // Usar ID da invoice como referência (Focus NFe aceita até 60 caracteres alfanuméricos)
  return `NFE_${invoiceId.replace(/-/g, '').substring(0, 50)}`;
}

/**
 * Mapeia status Focus NFe para status interno
 */
export function mapFocusStatusToInternal(focusStatus: string): string {
  const statusMap: Record<string, string> = {
    'processando_autorizacao': 'pending',
    'autorizado': 'authorized',
    'cancelado': 'cancelled',
    'erro_autorizacao': 'rejected',
    'denegado': 'rejected',
  };
  
  return statusMap[focusStatus] || 'pending';
}
