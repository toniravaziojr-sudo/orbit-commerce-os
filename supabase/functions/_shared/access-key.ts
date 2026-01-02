/**
 * Geração de Chave de Acesso NF-e
 * 
 * A chave de acesso tem 44 dígitos no formato:
 * cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)
 */

import { getUfCode } from './sefaz-endpoints.ts';

export interface AccessKeyParams {
  /** UF do emitente (sigla: SP, RJ, etc) */
  uf: string;
  /** Data de emissão */
  dataEmissao: Date;
  /** CNPJ do emitente (apenas números) */
  cnpj: string;
  /** Modelo do documento (55 = NF-e, 65 = NFC-e) */
  modelo: number;
  /** Série da NF-e */
  serie: number;
  /** Número da NF-e */
  numero: number;
  /** Tipo de emissão (1 = Normal, 2 = Contingência FS-IA, etc) */
  tipoEmissao: number;
  /** Código numérico (8 dígitos) - se não informado, será gerado aleatoriamente */
  codigoNumerico?: string;
}

/**
 * Calcula o dígito verificador da chave de acesso usando módulo 11
 */
export function calculateCheckDigit(chave43: string): number {
  if (chave43.length !== 43) {
    throw new Error(`Chave deve ter 43 dígitos, recebeu ${chave43.length}`);
  }

  // Pesos: 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4... (da direita para esquerda)
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let pesoIndex = 0;

  // Percorre da direita para esquerda
  for (let i = 42; i >= 0; i--) {
    soma += parseInt(chave43[i]) * pesos[pesoIndex];
    pesoIndex = (pesoIndex + 1) % 8;
  }

  const resto = soma % 11;
  
  // Se resto for 0 ou 1, dígito é 0. Caso contrário, dígito = 11 - resto
  return resto <= 1 ? 0 : 11 - resto;
}

/**
 * Gera um código numérico aleatório de 8 dígitos
 */
export function generateRandomCode(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Formata um número com zeros à esquerda
 */
function padLeft(value: number | string, length: number): string {
  return String(value).padStart(length, '0');
}

/**
 * Gera a chave de acesso completa (44 dígitos)
 */
export function generateAccessKey(params: AccessKeyParams): string {
  const {
    uf,
    dataEmissao,
    cnpj,
    modelo,
    serie,
    numero,
    tipoEmissao,
    codigoNumerico = generateRandomCode()
  } = params;

  // Validações
  const cnpjClean = cnpj.replace(/\D/g, '');
  if (cnpjClean.length !== 14) {
    throw new Error(`CNPJ deve ter 14 dígitos, recebeu ${cnpjClean.length}`);
  }

  if (![55, 65].includes(modelo)) {
    throw new Error(`Modelo inválido: ${modelo}. Use 55 (NF-e) ou 65 (NFC-e)`);
  }

  if (serie < 0 || serie > 999) {
    throw new Error(`Série deve estar entre 0 e 999, recebeu ${serie}`);
  }

  if (numero < 1 || numero > 999999999) {
    throw new Error(`Número deve estar entre 1 e 999999999, recebeu ${numero}`);
  }

  if (tipoEmissao < 1 || tipoEmissao > 9) {
    throw new Error(`Tipo de emissão inválido: ${tipoEmissao}`);
  }

  // Monta a chave (43 dígitos sem o DV)
  const cUF = padLeft(getUfCode(uf), 2);
  const AAMM = padLeft(dataEmissao.getFullYear() % 100, 2) + padLeft(dataEmissao.getMonth() + 1, 2);
  const CNPJ = padLeft(cnpjClean, 14);
  const mod = padLeft(modelo, 2);
  const ser = padLeft(serie, 3);
  const nNF = padLeft(numero, 9);
  const tpEmis = padLeft(tipoEmissao, 1);
  const cNF = padLeft(codigoNumerico, 8);

  const chave43 = `${cUF}${AAMM}${CNPJ}${mod}${ser}${nNF}${tpEmis}${cNF}`;

  // Calcula o dígito verificador
  const cDV = calculateCheckDigit(chave43);

  return `${chave43}${cDV}`;
}

/**
 * Valida uma chave de acesso existente
 */
export function validateAccessKey(chave: string): boolean {
  const chaveClean = chave.replace(/\D/g, '');
  
  if (chaveClean.length !== 44) {
    return false;
  }

  const chave43 = chaveClean.substring(0, 43);
  const dvInformado = parseInt(chaveClean[43]);
  const dvCalculado = calculateCheckDigit(chave43);

  return dvInformado === dvCalculado;
}

/**
 * Extrai informações de uma chave de acesso
 */
export function parseAccessKey(chave: string): {
  cUF: number;
  AAMM: string;
  CNPJ: string;
  modelo: number;
  serie: number;
  numero: number;
  tipoEmissao: number;
  codigoNumerico: string;
  digitoVerificador: number;
} {
  const chaveClean = chave.replace(/\D/g, '');
  
  if (chaveClean.length !== 44) {
    throw new Error(`Chave deve ter 44 dígitos, recebeu ${chaveClean.length}`);
  }

  return {
    cUF: parseInt(chaveClean.substring(0, 2)),
    AAMM: chaveClean.substring(2, 6),
    CNPJ: chaveClean.substring(6, 20),
    modelo: parseInt(chaveClean.substring(20, 22)),
    serie: parseInt(chaveClean.substring(22, 25)),
    numero: parseInt(chaveClean.substring(25, 34)),
    tipoEmissao: parseInt(chaveClean.substring(34, 35)),
    codigoNumerico: chaveClean.substring(35, 43),
    digitoVerificador: parseInt(chaveClean.substring(43, 44))
  };
}

/**
 * Formata a chave de acesso para exibição (com espaços a cada 4 dígitos)
 */
export function formatAccessKey(chave: string): string {
  const chaveClean = chave.replace(/\D/g, '');
  return chaveClean.match(/.{1,4}/g)?.join(' ') || chaveClean;
}
