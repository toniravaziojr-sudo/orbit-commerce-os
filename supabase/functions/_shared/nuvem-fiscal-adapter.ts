/**
 * Adaptador para converter dados internos para formato Nuvem Fiscal
 */

import type {
  NuvemFiscalEmpresaPayload,
  NuvemFiscalNFePayload,
  NuvemFiscalNFeItem,
  NuvemFiscalCertificadoPayload,
} from './nuvem-fiscal-client.ts';

// Mapeamento de CRT para regime tributário Nuvem Fiscal
const CRT_TO_REGIME: Record<string, string> = {
  '1': 'simples_nacional',
  '2': 'simples_nacional_excesso',
  '3': 'lucro_presumido', // ou lucro_real, depende do caso
};

// Mapeamento de CRT para código numérico (usado no XML)
const CRT_TO_CODE: Record<string, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
};

// Mapeamento de forma de pagamento
const PAYMENT_METHOD_MAP: Record<string, string> = {
  'credit_card': '03',
  'debit_card': '04',
  'pix': '17',
  'boleto': '15',
  'cash': '01',
  'store_credit': '05',
  'other': '99',
};

// Mapeamento de UF para código
const UF_TO_CODE: Record<string, string> = {
  'AC': '12', 'AL': '27', 'AP': '16', 'AM': '13', 'BA': '29',
  'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
  'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
  'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
  'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
  'SE': '28', 'TO': '17',
};

/**
 * Remove caracteres não numéricos
 */
function onlyNumbers(str: string | null | undefined): string {
  return (str || '').replace(/\D/g, '');
}

/**
 * Converte fiscal_settings para payload de empresa Nuvem Fiscal
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
    codigo_municipio?: string | null;
    uf: string;
    cep: string;
    telefone?: string | null;
    email?: string | null;
  }
): NuvemFiscalEmpresaPayload {
  return {
    cpf_cnpj: onlyNumbers(settings.cnpj),
    razao_social: settings.razao_social.toUpperCase(),
    nome_fantasia: settings.nome_fantasia?.toUpperCase(),
    inscricao_estadual: settings.inscricao_estadual ? onlyNumbers(settings.inscricao_estadual) : undefined,
    inscricao_municipal: settings.inscricao_municipal ? onlyNumbers(settings.inscricao_municipal) : undefined,
    regime_tributario: CRT_TO_REGIME[settings.crt || '1'] as any,
    optante_simples_nacional: settings.crt === '1' || settings.crt === '2',
    endereco: {
      logradouro: settings.logradouro.toUpperCase(),
      numero: settings.numero,
      complemento: settings.complemento?.toUpperCase(),
      bairro: settings.bairro.toUpperCase(),
      codigo_municipio: settings.codigo_municipio || '',
      cidade: settings.cidade.toUpperCase(),
      uf: settings.uf.toUpperCase(),
      cep: onlyNumbers(settings.cep),
      codigo_pais: '1058',
      pais: 'BRASIL',
    },
    telefone: settings.telefone ? onlyNumbers(settings.telefone) : undefined,
    email: settings.email || undefined,
  };
}

/**
 * Converte certificado para payload Nuvem Fiscal
 */
export function buildCertificadoPayload(
  pfxBase64: string,
  password: string
): NuvemFiscalCertificadoPayload {
  return {
    certificado: pfxBase64,
    password: password,
  };
}

/**
 * Converte invoice e items para payload NF-e Nuvem Fiscal
 */
export function buildNFePayload(
  invoice: {
    id: string;
    numero?: number;
    serie?: number;
    natureza_operacao?: string | null;
    tipo_operacao?: string | null;
    finalidade?: string | null;
    valor_produtos: number;
    valor_frete?: number | null;
    valor_desconto?: number | null;
    valor_total: number;
    informacoes_complementares?: string | null;
  },
  emitente: {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string | null;
    inscricao_estadual: string;
    crt: string;
    logradouro: string;
    numero: string;
    complemento?: string | null;
    bairro: string;
    codigo_municipio: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string | null;
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
    codigo_municipio: string;
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
  ambiente: 'homologacao' | 'producao',
  pagamento?: {
    forma: string;
    valor: number;
  }
): NuvemFiscalNFePayload {
  // Determinar indicador de IE do destinatário
  let indIEDest = 9; // Não contribuinte (padrão para PF)
  if (destinatario.cnpj) {
    if (destinatario.inscricao_estadual) {
      indIEDest = 1; // Contribuinte ICMS
    } else {
      indIEDest = 2; // Isento
    }
  }

  // Determinar idDest (destino da operação)
  let idDest = 1; // Interna
  if (emitente.uf !== destinatario.uf) {
    idDest = 2; // Interestadual
  }

  // Construir itens
  const det: NuvemFiscalNFeItem[] = items.map((item, index) => ({
    numero_item: item.numero_item || index + 1,
    codigo_produto: item.codigo_produto,
    descricao: item.descricao.toUpperCase().substring(0, 120),
    cfop: item.cfop,
    ncm: item.ncm,
    unidade_comercial: item.unidade || 'UN',
    quantidade_comercial: item.quantidade,
    valor_unitario_comercial: item.valor_unitario,
    valor_bruto: item.valor_total,
    valor_desconto: item.valor_desconto || undefined,
    unidade_tributavel: item.unidade || 'UN',
    quantidade_tributavel: item.quantidade,
    valor_unitario_tributavel: item.valor_unitario,
    icms: {
      situacao_tributaria: item.csosn || item.cst_icms || '102',
      origem: parseInt(item.origem || '0'),
    },
    pis: {
      situacao_tributaria: item.cst_pis || '49',
    },
    cofins: {
      situacao_tributaria: item.cst_cofins || '49',
    },
  }));

  // Calcular totais
  const vProd = items.reduce((sum, i) => sum + i.valor_total, 0);
  const vDesc = items.reduce((sum, i) => sum + (i.valor_desconto || 0), 0);

  // Construir payload
  const payload: NuvemFiscalNFePayload = {
    ambiente,
    infNFe: {
      versao: '4.00',
      ide: {
        cUF: UF_TO_CODE[emitente.uf] || '35',
        natOp: (invoice.natureza_operacao || 'VENDA DE MERCADORIA').toUpperCase(),
        mod: 55, // NF-e
        serie: invoice.serie || 1,
        nNF: invoice.numero || 1,
        dhEmi: new Date().toISOString(),
        tpNF: invoice.tipo_operacao === 'entrada' ? 0 : 1,
        idDest,
        cMunFG: emitente.codigo_municipio,
        tpImp: 1, // DANFE retrato
        tpEmis: 1, // Normal
        finNFe: parseInt(invoice.finalidade || '1'),
        indFinal: destinatario.cnpj ? 0 : 1, // Consumidor final se PF
        indPres: 2, // Não presencial (internet)
      },
      emit: {
        CNPJ: onlyNumbers(emitente.cnpj),
        xNome: emitente.razao_social.toUpperCase(),
        xFant: emitente.nome_fantasia?.toUpperCase(),
        enderEmit: {
          xLgr: emitente.logradouro.toUpperCase(),
          nro: emitente.numero,
          xCpl: emitente.complemento?.toUpperCase(),
          xBairro: emitente.bairro.toUpperCase(),
          cMun: emitente.codigo_municipio,
          xMun: emitente.cidade.toUpperCase(),
          UF: emitente.uf.toUpperCase(),
          CEP: onlyNumbers(emitente.cep),
          cPais: '1058',
          xPais: 'BRASIL',
          fone: emitente.telefone ? onlyNumbers(emitente.telefone) : undefined,
        },
        IE: onlyNumbers(emitente.inscricao_estadual),
        CRT: CRT_TO_CODE[emitente.crt] || 1,
      },
      dest: {
        CPF: destinatario.cpf ? onlyNumbers(destinatario.cpf) : undefined,
        CNPJ: destinatario.cnpj ? onlyNumbers(destinatario.cnpj) : undefined,
        xNome: destinatario.nome.toUpperCase(),
        enderDest: {
          xLgr: destinatario.logradouro.toUpperCase(),
          nro: destinatario.numero,
          xCpl: destinatario.complemento?.toUpperCase(),
          xBairro: destinatario.bairro.toUpperCase(),
          cMun: destinatario.codigo_municipio,
          xMun: destinatario.cidade.toUpperCase(),
          UF: destinatario.uf.toUpperCase(),
          CEP: onlyNumbers(destinatario.cep),
          cPais: '1058',
          xPais: 'BRASIL',
          fone: destinatario.telefone ? onlyNumbers(destinatario.telefone) : undefined,
        },
        indIEDest,
        IE: destinatario.inscricao_estadual ? onlyNumbers(destinatario.inscricao_estadual) : undefined,
        email: destinatario.email || undefined,
      },
      det,
      total: {
        ICMSTot: {
          vBC: 0,
          vICMS: 0,
          vProd,
          vFrete: invoice.valor_frete || 0,
          vDesc,
          vPIS: 0,
          vCOFINS: 0,
          vNF: invoice.valor_total,
        },
      },
      transp: {
        modFrete: invoice.valor_frete ? 1 : 9, // 1=Destinatário, 9=Sem frete
      },
      pag: {
        detPag: [{
          tPag: PAYMENT_METHOD_MAP[pagamento?.forma || 'other'] || '99',
          vPag: pagamento?.valor || invoice.valor_total,
        }],
      },
      infAdic: invoice.informacoes_complementares ? {
        infCpl: invoice.informacoes_complementares.toUpperCase(),
      } : undefined,
    },
  };

  return payload;
}

/**
 * Converte resposta da Nuvem Fiscal para formato interno
 */
export function parseNFeResponse(response: any): {
  status: string;
  chave?: string;
  numero?: number;
  serie?: number;
  protocolo?: string;
  xml_url?: string;
  pdf_url?: string;
  mensagem?: string;
  erros?: Array<{ codigo: string; mensagem: string }>;
} {
  return {
    status: response.status,
    chave: response.chave,
    numero: response.numero,
    serie: response.serie,
    protocolo: response.protocolo,
    xml_url: response.xml_url,
    pdf_url: response.pdf_url,
    mensagem: response.motivo,
    erros: response.erros,
  };
}
