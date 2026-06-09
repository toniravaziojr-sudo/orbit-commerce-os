/**
 * Adaptador para converter dados internos para formato Focus NFe
 */

import type { 
  FocusEmpresaPayload, 
  FocusNFePayload, 
  FocusNFeItem 
} from './focus-nfe-client.ts';

// Mapeamento de CRT para regime_tributario Focus NFe
// Códigos oficiais SEFAZ: 1=Simples, 2=Simples Excesso, 3=Regime Normal, 4=MEI
// Aceita string OU número para evitar bugs de tipagem (DB envia integer).
function mapCrtToRegime(crt: string | number | null | undefined): number {
  const n = Number(crt);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 1;
}

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
    crt?: string | number | null;
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
    regime_tributario: mapCrtToRegime(settings.crt),
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
    /** Numeração soberana — quando informada, vai explícita ao Focus */
    numero?: number | null;
    serie?: number | null;
    /** Marcador: pedido tem frete grátis (overrides modalidade) */
    free_shipping?: boolean | null;
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
    gtin?: string | null;
    gtin_tributavel?: string | null;
    cest?: string | null;
  }>,
  emitente: {
    cnpj: string;
    crt?: string | number | null;
  },
  pagamento?: {
    forma: string;
    valor: number;
  },
  transporte?: {
    /** Razão social oficial da transportadora */
    razao_social?: string | null;
    /** CNPJ apenas dígitos (quando conhecido) */
    cnpj?: string | null;
    inscricao_estadual?: string | null;
    endereco?: string | null;
    municipio?: string | null;
    uf?: string | null;
    /** Nome do serviço (PAC, SEDEX, JADLOG, etc.) — vai em obs */
    servico?: string | null;
    /** Override explícito de modalidade (0/1/2/9). Quando ausente, é deduzido. */
    modalidade?: number | null;
    quantidade_volumes?: number | null;
    especie_volumes?: string | null;
    peso_bruto_kg?: number | null;
    peso_liquido_kg?: number | null;
  },
): FocusNFePayload {
  // Frase legal obrigatória para MEI (CRT=4) e Simples Nacional (CRT=1/2),
  // conforme Art. 26 da LC 123/2006 — exigida no campo infCpl (informações
  // adicionais ao contribuinte) para que o destinatário não tome crédito de ICMS.
  const crtNum = Number(emitente.crt);
  let fraseRegime: string | null = null;
  if (crtNum === 4) {
    fraseRegime = 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de ICMS, de ISS e de IPI.';
  } else if (crtNum === 1 || crtNum === 2) {
    fraseRegime = 'Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de ICMS, de ISS e de IPI.';
  }
  // Determinar indicador de IE do destinatário
  let indicadorIE = 9; // Não contribuinte (padrão para PF)
  if (destinatario.cnpj) {
    if (destinatario.inscricao_estadual) {
      indicadorIE = 1; // Contribuinte ICMS
    } else {
      indicadorIE = 2; // Isento
    }
  }
  
  // Calcular rateio de frete e desconto nos itens (SEFAZ exige que a soma dos itens = valor total)
  const valorFreteTotal = invoice.valor_frete && invoice.valor_frete > 0 ? invoice.valor_frete : 0;
  const valorDescontoTotal = invoice.valor_desconto && invoice.valor_desconto > 0 ? invoice.valor_desconto : 0;
  const valorProdutosTotal = items.reduce((sum, item) => sum + (item.valor_total || 0), 0);
  
  // Converter itens com rateio de frete e desconto
  const focusItems: FocusNFeItem[] = items.map((item, index) => {
    // Determinar CST/CSOSN do ICMS
    const icmsSituacao = item.csosn || item.cst_icms || '102';
    
    // Coerção segura para campos string
    const codigoSeguro = (item.codigo_produto || '').substring(0, 60);
    const descricaoSegura = (item.descricao || 'PRODUTO').toUpperCase().substring(0, 120);
    const unidadeSegura = (item.unidade || 'UN').toUpperCase().substring(0, 6);
    
    // Ratear frete proporcionalmente ao valor do item
    let valorFreteItem = 0;
    if (valorFreteTotal > 0 && valorProdutosTotal > 0) {
      const proporcao = item.valor_total / valorProdutosTotal;
      valorFreteItem = roundDecimal(valorFreteTotal * proporcao, 2);
    }
    
    // Ratear desconto proporcionalmente ao valor do item
    let valorDescontoItem = 0;
    if (valorDescontoTotal > 0 && valorProdutosTotal > 0) {
      const proporcao = item.valor_total / valorProdutosTotal;
      valorDescontoItem = roundDecimal(valorDescontoTotal * proporcao, 2);
    }
    
    // Normaliza GTIN: aceita 8/12/13/14 dígitos OU "SEM GTIN" (padrão Sefaz quando produto não tem código de barras)
    const normalizeGtin = (v?: string | null): string => {
      const s = String(v ?? '').trim().toUpperCase();
      if (!s || s === 'SEM GTIN') return 'SEM GTIN';
      const digits = s.replace(/\D/g, '');
      if ([8, 12, 13, 14].includes(digits.length)) return digits;
      return 'SEM GTIN';
    };
    const gtinComercial = normalizeGtin(item.gtin);
    const gtinTributavel = normalizeGtin(item.gtin_tributavel || item.gtin);
    const cestDigits = String(item.cest || '').replace(/\D/g, '').substring(0, 7);

    const focusItem: FocusNFeItem = {
      numero_item: item.numero_item || index + 1,
      codigo_produto: codigoSeguro || `PROD${index + 1}`,
      descricao: descricaoSegura,
      cfop: onlyNumbers(item.cfop),
      unidade_comercial: unidadeSegura,
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: roundDecimal(item.valor_unitario, 4),
      valor_bruto: roundDecimal(item.valor_total, 2),
      valor_desconto: valorDescontoItem > 0 ? valorDescontoItem : undefined,
      codigo_ncm: onlyNumbers(item.ncm).padStart(8, '0'),
      icms_situacao_tributaria: icmsSituacao,
      icms_origem: parseInt(item.origem || '0', 10),
      pis_situacao_tributaria: item.cst_pis || '07',
      cofins_situacao_tributaria: item.cst_cofins || '07',
      unidade_tributavel: unidadeSegura,
      quantidade_tributavel: item.quantidade,
      valor_unitario_tributavel: roundDecimal(item.valor_unitario, 4),
      codigo_barras_comercial: gtinComercial,
      codigo_barras_tributavel: gtinTributavel,
      ...(cestDigits.length === 7 ? { codigo_cest: cestDigits } : {}),
    };
    
    // Adicionar frete rateado se houver
    if (valorFreteItem > 0) {
      (focusItem as any).valor_frete = valorFreteItem;
    }
    
    return focusItem;
  });
  
  // Ajustar último item para garantir que soma = total exato (diferença de arredondamento)
  if (focusItems.length > 0) {
    // Ajuste de frete
    if (valorFreteTotal > 0) {
      const somaFreteItens = focusItems.reduce((sum, item) => sum + ((item as any).valor_frete || 0), 0);
      const diferencaFrete = roundDecimal(valorFreteTotal - somaFreteItens, 2);
      if (diferencaFrete !== 0) {
        const ultimoItem = focusItems[focusItems.length - 1] as any;
        ultimoItem.valor_frete = roundDecimal((ultimoItem.valor_frete || 0) + diferencaFrete, 2);
      }
    }
    
    // Ajuste de desconto
    if (valorDescontoTotal > 0) {
      const somaDescontoItens = focusItems.reduce((sum, item) => sum + (item.valor_desconto || 0), 0);
      const diferencaDesconto = roundDecimal(valorDescontoTotal - somaDescontoItens, 2);
      if (diferencaDesconto !== 0) {
        const ultimoItem = focusItems[focusItems.length - 1];
        ultimoItem.valor_desconto = roundDecimal((ultimoItem.valor_desconto || 0) + diferencaDesconto, 2);
      }
    }
  }
  
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

  // ----- Modalidade de frete -----
  // Regras:
  //  - Override explícito do chamador (transporte.modalidade) prevalece
  //  - Sem despacho (sem transportadora E sem valor de frete) → 9
  //  - Frete grátis com transportadora definida → 0 (emitente absorve)
  //  - Frete cobrado → 1 (destinatário)
  const carrierName = (transporte?.razao_social || '').trim();
  let modalidadeFrete: number;
  if (transporte?.modalidade === 0 || transporte?.modalidade === 1 || transporte?.modalidade === 2 || transporte?.modalidade === 9) {
    modalidadeFrete = transporte.modalidade;
  } else if (!carrierName && valorFreteTotal === 0) {
    modalidadeFrete = 9;
  } else if (invoice.free_shipping || valorFreteTotal === 0) {
    modalidadeFrete = carrierName ? 0 : 9;
  } else {
    modalidadeFrete = 1;
  }

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
    valor_frete: valorFreteTotal > 0 ? roundDecimal(valorFreteTotal, 2) : undefined,
    valor_desconto: invoice.valor_desconto ? roundDecimal(invoice.valor_desconto, 2) : undefined,

    // Frete
    modalidade_frete: modalidadeFrete,

    // Itens
    items: focusItems,

    // Informações adicionais — prefixa a frase legal de regime + nota de frete grátis quando aplicável
    informacoes_adicionais_contribuinte: (() => {
      const userInfo = (invoice.informacoes_complementares || '').trim();
      const parts: string[] = [];
      if (fraseRegime) parts.push(fraseRegime);
      const freteGratis = (invoice.free_shipping || (valorFreteTotal === 0 && !!carrierName && modalidadeFrete === 0));
      if (freteGratis) {
        parts.push('Frete grátis — custo absorvido pelo emitente.');
      }
      if (transporte?.servico && carrierName) {
        parts.push(`Serviço de envio: ${transporte.servico}.`);
      }
      if (userInfo) parts.push(userInfo);
      const combined = parts.join(' ').trim();
      return combined ? combined.substring(0, 2000) : undefined;
    })(),
  };

  // ----- Numeração soberana -----
  if (invoice.numero && Number.isFinite(invoice.numero) && Number(invoice.numero) > 0) {
    payload.numero = Number(invoice.numero);
  }
  if (invoice.serie && Number.isFinite(invoice.serie) && Number(invoice.serie) > 0) {
    payload.serie = Number(invoice.serie);
  }

  // ----- Bloco transportador -----
  if (carrierName) {
    payload.transportador_nome_razao_social = carrierName.toUpperCase().substring(0, 60);
    if (transporte?.cnpj) {
      const cnpjDigits = onlyNumbers(transporte.cnpj);
      if (cnpjDigits.length === 14 || cnpjDigits.length === 11) {
        payload.transportador_cpf_cnpj = cnpjDigits;
      }
    }
    if (transporte?.inscricao_estadual) {
      const ie = transporte.inscricao_estadual.toString().trim().toUpperCase();
      payload.transportador_inscricao_estadual = ie === 'ISENTO' ? 'ISENTO' : onlyNumbers(ie);
    }
    if (transporte?.endereco) {
      payload.transportador_endereco = transporte.endereco.toUpperCase().substring(0, 60);
    }
    if (transporte?.municipio) {
      payload.transportador_municipio = transporte.municipio.toUpperCase().substring(0, 60);
    }
    if (transporte?.uf) {
      payload.transportador_uf = transporte.uf.toUpperCase().substring(0, 2);
    }
  }

  // ----- Volumes -----
  if (transporte?.quantidade_volumes && transporte.quantidade_volumes > 0) {
    payload.quantidade_volumes_transportados = transporte.quantidade_volumes;
    payload.especie_volumes_transportados = (transporte.especie_volumes || 'VOLUME').toUpperCase().substring(0, 20);
  }
  if (transporte?.peso_bruto_kg && transporte.peso_bruto_kg > 0) {
    payload.peso_bruto_total_dos_volumes_transportados = roundDecimal(transporte.peso_bruto_kg, 3);
  }
  if (transporte?.peso_liquido_kg && transporte.peso_liquido_kg > 0) {
    payload.peso_liquido_total_dos_volumes_transportados = roundDecimal(transporte.peso_liquido_kg, 3);
  }

  
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
 * Gera referência única para NF-e.
 *
 * Focus NFe deduplica por `ref`: uma vez recebida uma resposta para um ref,
 * qualquer POST subsequente com o mesmo ref devolve o resultado em cache,
 * SEM reenviar para a SEFAZ. Por isso, em retries de notas rejeitadas
 * geramos um ref novo, mantendo rastreabilidade ao ID da invoice.
 *
 * - Primeira emissão: NFE_<idsemhifen>           (até 54 chars)
 * - Retry de rejeitada: NFE_<idsemhifen>_R<ts>   (ts = base36 do epoch em segundos)
 */
export function generateNFeRef(invoiceId: string, attempt: 'initial' | 'retry' = 'initial'): string {
  const base = `NFE_${invoiceId.replace(/-/g, '').substring(0, 50)}`;
  if (attempt === 'retry') {
    const ts = Math.floor(Date.now() / 1000).toString(36).toUpperCase();
    return `${base}_R${ts}`.substring(0, 60);
  }
  return base;
}


/**
 * Mapeia status Focus NFe para status interno (Lote 1.C.1).
 * Máquina oficial: draft, pending, processing, authorized, rejected, cancelled, error.
 * - processando_autorizacao  → processing  (assíncrono Focus)
 * - aguardando_correcao      → pending     (operador precisa corrigir)
 * - autorizado               → authorized
 * - cancelado                → cancelled
 * - erro_autorizacao/denegado→ rejected    (rejeição Sefaz)
 * Default conservador: 'processing' (não confundir com erro técnico).
 */
export function mapFocusStatusToInternal(focusStatus: string): string {
  const statusMap: Record<string, string> = {
    'processando_autorizacao': 'processing',
    'aguardando_correcao': 'pending',
    'autorizado': 'authorized',
    'cancelado': 'cancelled',
    'erro_autorizacao': 'rejected',
    'denegado': 'rejected',
  };

  return statusMap[focusStatus] || 'processing';
}
