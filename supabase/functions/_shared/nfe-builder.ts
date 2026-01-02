/**
 * Construtor de XML NF-e
 * 
 * Gera o XML da NF-e conforme layout 4.00
 * Manual: http://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=z/rOPh6LjfE=
 */

import { generateAccessKey, type AccessKeyParams } from './access-key.ts';
import { getUfCode, NFE_NAMESPACES } from './sefaz-endpoints.ts';

export interface NFeEmitente {
  CNPJ: string;
  xNome: string;
  xFant?: string;
  IE: string;
  CRT: number; // 1=Simples Nacional, 2=Simples excesso, 3=Regime Normal
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
}

export interface NFeDestinatario {
  CPF?: string;
  CNPJ?: string;
  idEstrangeiro?: string;
  xNome: string;
  indIEDest: number; // 1=Contribuinte, 2=Isento, 9=Não contribuinte
  IE?: string;
  email?: string;
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
}

export interface NFeItem {
  nItem: number;
  cProd: string;
  cEAN: string;
  xProd: string;
  NCM: string;
  CFOP: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  cEANTrib: string;
  uTrib: string;
  qTrib: number;
  vUnTrib: number;
  indTot: number; // 0=Não compõe total, 1=Compõe total
  // Impostos
  ICMS: {
    orig: number;
    CST?: string;
    CSOSN?: string;
    // Campos adicionais conforme CST/CSOSN
  };
  PIS: {
    CST: string;
    vBC?: number;
    pPIS?: number;
    vPIS?: number;
  };
  COFINS: {
    CST: string;
    vBC?: number;
    pCOFINS?: number;
    vCOFINS?: number;
  };
}

export interface NFeTransporte {
  modFrete: number; // 0=Emitente, 1=Dest, 2=Terceiros, 9=Sem frete
  transporta?: {
    CNPJ?: string;
    CPF?: string;
    xNome?: string;
    IE?: string;
    xEnder?: string;
    xMun?: string;
    UF?: string;
  };
  vol?: {
    qVol?: number;
    esp?: string;
    marca?: string;
    nVol?: string;
    pesoL?: number;
    pesoB?: number;
  }[];
}

export interface NFePagamento {
  indPag?: number; // 0=À vista, 1=A prazo
  tPag: string; // 01=Dinheiro, 02=Cheque, 03=Cartão Crédito, etc
  vPag: number;
  // Campos para cartão
  tpIntegra?: number;
  CNPJ?: string;
  tBand?: string;
  cAut?: string;
}

export interface NFeData {
  // Identificação
  cUF: string;
  natOp: string;
  serie: number;
  nNF: number;
  dhEmi: Date;
  dhSaiEnt?: Date;
  tpNF: number; // 0=Entrada, 1=Saída
  idDest: number; // 1=Interna, 2=Interestadual, 3=Exterior
  cMunFG: string;
  tpImp: number; // 1=Retrato, 2=Paisagem
  tpEmis: number; // 1=Normal, 2=Contingência FS-IA, etc
  finNFe: number; // 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
  indFinal: number; // 0=Normal, 1=Consumidor final
  indPres: number; // 0=Não se aplica, 1=Presencial, etc
  // Participantes
  emit: NFeEmitente;
  dest: NFeDestinatario;
  // Itens
  det: NFeItem[];
  // Totais (calculados automaticamente se não informados)
  total?: {
    vBC?: number;
    vICMS?: number;
    vProd?: number;
    vFrete?: number;
    vSeg?: number;
    vDesc?: number;
    vOutro?: number;
    vNF?: number;
  };
  // Transporte
  transp: NFeTransporte;
  // Pagamento
  pag: NFePagamento[];
  // Informações adicionais
  infAdic?: {
    infAdFisco?: string;
    infCpl?: string;
  };
  // Ambiente (1=Produção, 2=Homologação)
  tpAmb: number;
}

/**
 * Escapa caracteres especiais para XML
 */
function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formata número com casas decimais
 */
function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * Formata data para ISO 8601 com timezone
 */
function formatDateTime(date: Date): string {
  const offset = -3; // Brazil timezone (BRT)
  const d = new Date(date.getTime() + offset * 60 * 60 * 1000);
  const iso = d.toISOString().replace('Z', '');
  return `${iso.substring(0, 19)}-03:00`;
}

/**
 * Remove caracteres não numéricos
 */
function onlyNumbers(str: string): string {
  return str.replace(/\D/g, '');
}

/**
 * Gera o XML do item (det)
 */
function buildItemXml(item: NFeItem): string {
  const icmsXml = item.ICMS.CSOSN 
    ? buildIcmsSimples(item.ICMS)
    : buildIcmsNormal(item.ICMS);

  return `
    <det nItem="${item.nItem}">
      <prod>
        <cProd>${escapeXml(item.cProd)}</cProd>
        <cEAN>${item.cEAN || 'SEM GTIN'}</cEAN>
        <xProd>${escapeXml(item.xProd)}</xProd>
        <NCM>${item.NCM}</NCM>
        <CFOP>${item.CFOP}</CFOP>
        <uCom>${escapeXml(item.uCom)}</uCom>
        <qCom>${formatDecimal(item.qCom, 4)}</qCom>
        <vUnCom>${formatDecimal(item.vUnCom, 10)}</vUnCom>
        <vProd>${formatDecimal(item.vProd, 2)}</vProd>
        <cEANTrib>${item.cEANTrib || 'SEM GTIN'}</cEANTrib>
        <uTrib>${escapeXml(item.uTrib || item.uCom)}</uTrib>
        <qTrib>${formatDecimal(item.qTrib || item.qCom, 4)}</qTrib>
        <vUnTrib>${formatDecimal(item.vUnTrib || item.vUnCom, 10)}</vUnTrib>
        <indTot>${item.indTot}</indTot>
      </prod>
      <imposto>
        ${icmsXml}
        <PIS>
          <PISOutr>
            <CST>${item.PIS.CST}</CST>
            <vBC>${formatDecimal(item.PIS.vBC || 0, 2)}</vBC>
            <pPIS>${formatDecimal(item.PIS.pPIS || 0, 4)}</pPIS>
            <vPIS>${formatDecimal(item.PIS.vPIS || 0, 2)}</vPIS>
          </PISOutr>
        </PIS>
        <COFINS>
          <COFINSOutr>
            <CST>${item.COFINS.CST}</CST>
            <vBC>${formatDecimal(item.COFINS.vBC || 0, 2)}</vBC>
            <pCOFINS>${formatDecimal(item.COFINS.pCOFINS || 0, 4)}</pCOFINS>
            <vCOFINS>${formatDecimal(item.COFINS.vCOFINS || 0, 2)}</vCOFINS>
          </COFINSOutr>
        </COFINS>
      </imposto>
    </det>`;
}

/**
 * Gera XML do ICMS para Simples Nacional
 */
function buildIcmsSimples(icms: NFeItem['ICMS']): string {
  return `
        <ICMS>
          <ICMSSN${icms.CSOSN === '102' ? '102' : '900'}>
            <orig>${icms.orig}</orig>
            <CSOSN>${icms.CSOSN}</CSOSN>
          </ICMSSN${icms.CSOSN === '102' ? '102' : '900'}>
        </ICMS>`;
}

/**
 * Gera XML do ICMS para Regime Normal
 */
function buildIcmsNormal(icms: NFeItem['ICMS']): string {
  // CST 00, 10, 20, 40, 41, 50, 51, 60, 70, 90
  const cst = icms.CST || '00';
  
  if (['40', '41', '50'].includes(cst)) {
    return `
        <ICMS>
          <ICMS40>
            <orig>${icms.orig}</orig>
            <CST>${cst}</CST>
          </ICMS40>
        </ICMS>`;
  }

  return `
        <ICMS>
          <ICMS00>
            <orig>${icms.orig}</orig>
            <CST>${cst}</CST>
            <modBC>0</modBC>
            <vBC>0.00</vBC>
            <pICMS>0.00</pICMS>
            <vICMS>0.00</vICMS>
          </ICMS00>
        </ICMS>`;
}

/**
 * Gera o XML do transporte
 */
function buildTranspXml(transp: NFeTransporte): string {
  let xml = `
    <transp>
      <modFrete>${transp.modFrete}</modFrete>`;
  
  if (transp.transporta) {
    xml += `
      <transporta>`;
    if (transp.transporta.CNPJ) {
      xml += `<CNPJ>${onlyNumbers(transp.transporta.CNPJ)}</CNPJ>`;
    } else if (transp.transporta.CPF) {
      xml += `<CPF>${onlyNumbers(transp.transporta.CPF)}</CPF>`;
    }
    if (transp.transporta.xNome) {
      xml += `<xNome>${escapeXml(transp.transporta.xNome)}</xNome>`;
    }
    if (transp.transporta.IE) {
      xml += `<IE>${transp.transporta.IE}</IE>`;
    }
    if (transp.transporta.xEnder) {
      xml += `<xEnder>${escapeXml(transp.transporta.xEnder)}</xEnder>`;
    }
    if (transp.transporta.xMun) {
      xml += `<xMun>${escapeXml(transp.transporta.xMun)}</xMun>`;
    }
    if (transp.transporta.UF) {
      xml += `<UF>${transp.transporta.UF}</UF>`;
    }
    xml += `
      </transporta>`;
  }

  if (transp.vol && transp.vol.length > 0) {
    for (const vol of transp.vol) {
      xml += `
      <vol>`;
      if (vol.qVol !== undefined) xml += `<qVol>${vol.qVol}</qVol>`;
      if (vol.esp) xml += `<esp>${escapeXml(vol.esp)}</esp>`;
      if (vol.marca) xml += `<marca>${escapeXml(vol.marca)}</marca>`;
      if (vol.nVol) xml += `<nVol>${escapeXml(vol.nVol)}</nVol>`;
      if (vol.pesoL !== undefined) xml += `<pesoL>${formatDecimal(vol.pesoL, 3)}</pesoL>`;
      if (vol.pesoB !== undefined) xml += `<pesoB>${formatDecimal(vol.pesoB, 3)}</pesoB>`;
      xml += `
      </vol>`;
    }
  }

  xml += `
    </transp>`;
  
  return xml;
}

/**
 * Gera o XML do pagamento
 */
function buildPagXml(pagamentos: NFePagamento[]): string {
  let xml = `
    <pag>`;
  
  for (const pag of pagamentos) {
    xml += `
      <detPag>
        <tPag>${pag.tPag}</tPag>
        <vPag>${formatDecimal(pag.vPag, 2)}</vPag>`;
    
    // Dados do cartão se aplicável
    if (['03', '04'].includes(pag.tPag) && pag.tpIntegra !== undefined) {
      xml += `
        <card>
          <tpIntegra>${pag.tpIntegra}</tpIntegra>`;
      if (pag.CNPJ) xml += `<CNPJ>${onlyNumbers(pag.CNPJ)}</CNPJ>`;
      if (pag.tBand) xml += `<tBand>${pag.tBand}</tBand>`;
      if (pag.cAut) xml += `<cAut>${pag.cAut}</cAut>`;
      xml += `
        </card>`;
    }
    
    xml += `
      </detPag>`;
  }
  
  xml += `
    </pag>`;
  
  return xml;
}

/**
 * Calcula os totais da NF-e
 */
function calculateTotals(items: NFeItem[], existingTotal?: NFeData['total']): Required<NonNullable<NFeData['total']>> {
  let vProd = 0;
  let vBC = 0;
  let vICMS = 0;

  for (const item of items) {
    if (item.indTot === 1) {
      vProd += item.vProd;
    }
  }

  return {
    vBC: existingTotal?.vBC ?? vBC,
    vICMS: existingTotal?.vICMS ?? vICMS,
    vProd: existingTotal?.vProd ?? vProd,
    vFrete: existingTotal?.vFrete ?? 0,
    vSeg: existingTotal?.vSeg ?? 0,
    vDesc: existingTotal?.vDesc ?? 0,
    vOutro: existingTotal?.vOutro ?? 0,
    vNF: existingTotal?.vNF ?? vProd
  };
}

export interface BuildNFeResult {
  xml: string;
  chaveAcesso: string;
  nfeId: string;
}

/**
 * Constrói o XML completo da NF-e (sem assinatura)
 */
export function buildNFeXml(data: NFeData): BuildNFeResult {
  // Gera a chave de acesso
  const accessKeyParams: AccessKeyParams = {
    uf: data.cUF,
    dataEmissao: data.dhEmi,
    cnpj: data.emit.CNPJ,
    modelo: 55, // NF-e
    serie: data.serie,
    numero: data.nNF,
    tipoEmissao: data.tpEmis
  };
  
  const chaveAcesso = generateAccessKey(accessKeyParams);
  const nfeId = `NFe${chaveAcesso}`;
  const cDV = chaveAcesso.substring(43, 44);
  const cNF = chaveAcesso.substring(35, 43);

  // Calcula totais
  const totals = calculateTotals(data.det, data.total);

  // Monta o XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="${NFE_NAMESPACES.nfe}">
  <infNFe versao="4.00" Id="${nfeId}">
    <ide>
      <cUF>${getUfCode(data.cUF)}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${escapeXml(data.natOp)}</natOp>
      <mod>55</mod>
      <serie>${data.serie}</serie>
      <nNF>${data.nNF}</nNF>
      <dhEmi>${formatDateTime(data.dhEmi)}</dhEmi>
      ${data.dhSaiEnt ? `<dhSaiEnt>${formatDateTime(data.dhSaiEnt)}</dhSaiEnt>` : ''}
      <tpNF>${data.tpNF}</tpNF>
      <idDest>${data.idDest}</idDest>
      <cMunFG>${data.cMunFG}</cMunFG>
      <tpImp>${data.tpImp}</tpImp>
      <tpEmis>${data.tpEmis}</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${data.tpAmb}</tpAmb>
      <finNFe>${data.finNFe}</finNFe>
      <indFinal>${data.indFinal}</indFinal>
      <indPres>${data.indPres}</indPres>
      <procEmi>0</procEmi>
      <verProc>ComandoCentral 1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${onlyNumbers(data.emit.CNPJ)}</CNPJ>
      <xNome>${escapeXml(data.emit.xNome)}</xNome>
      ${data.emit.xFant ? `<xFant>${escapeXml(data.emit.xFant)}</xFant>` : ''}
      <enderEmit>
        <xLgr>${escapeXml(data.emit.enderEmit.xLgr)}</xLgr>
        <nro>${escapeXml(data.emit.enderEmit.nro)}</nro>
        ${data.emit.enderEmit.xCpl ? `<xCpl>${escapeXml(data.emit.enderEmit.xCpl)}</xCpl>` : ''}
        <xBairro>${escapeXml(data.emit.enderEmit.xBairro)}</xBairro>
        <cMun>${data.emit.enderEmit.cMun}</cMun>
        <xMun>${escapeXml(data.emit.enderEmit.xMun)}</xMun>
        <UF>${data.emit.enderEmit.UF}</UF>
        <CEP>${onlyNumbers(data.emit.enderEmit.CEP)}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${data.emit.enderEmit.fone ? `<fone>${onlyNumbers(data.emit.enderEmit.fone)}</fone>` : ''}
      </enderEmit>
      <IE>${onlyNumbers(data.emit.IE)}</IE>
      <CRT>${data.emit.CRT}</CRT>
    </emit>
    <dest>
      ${data.dest.CNPJ 
        ? `<CNPJ>${onlyNumbers(data.dest.CNPJ)}</CNPJ>`
        : data.dest.CPF 
          ? `<CPF>${onlyNumbers(data.dest.CPF)}</CPF>`
          : data.dest.idEstrangeiro 
            ? `<idEstrangeiro>${data.dest.idEstrangeiro}</idEstrangeiro>`
            : ''
      }
      <xNome>${escapeXml(data.dest.xNome)}</xNome>
      ${data.dest.enderDest ? `
      <enderDest>
        <xLgr>${escapeXml(data.dest.enderDest.xLgr)}</xLgr>
        <nro>${escapeXml(data.dest.enderDest.nro)}</nro>
        ${data.dest.enderDest.xCpl ? `<xCpl>${escapeXml(data.dest.enderDest.xCpl)}</xCpl>` : ''}
        <xBairro>${escapeXml(data.dest.enderDest.xBairro)}</xBairro>
        <cMun>${data.dest.enderDest.cMun}</cMun>
        <xMun>${escapeXml(data.dest.enderDest.xMun)}</xMun>
        <UF>${data.dest.enderDest.UF}</UF>
        <CEP>${onlyNumbers(data.dest.enderDest.CEP)}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${data.dest.enderDest.fone ? `<fone>${onlyNumbers(data.dest.enderDest.fone)}</fone>` : ''}
      </enderDest>` : ''}
      <indIEDest>${data.dest.indIEDest}</indIEDest>
      ${data.dest.IE ? `<IE>${onlyNumbers(data.dest.IE)}</IE>` : ''}
      ${data.dest.email ? `<email>${escapeXml(data.dest.email)}</email>` : ''}
    </dest>
    ${data.det.map(item => buildItemXml(item)).join('')}
    <total>
      <ICMSTot>
        <vBC>${formatDecimal(totals.vBC, 2)}</vBC>
        <vICMS>${formatDecimal(totals.vICMS, 2)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFRemet>0.00</vICMSUFRemet>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${formatDecimal(totals.vProd, 2)}</vProd>
        <vFrete>${formatDecimal(totals.vFrete, 2)}</vFrete>
        <vSeg>${formatDecimal(totals.vSeg, 2)}</vSeg>
        <vDesc>${formatDecimal(totals.vDesc, 2)}</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>${formatDecimal(totals.vOutro, 2)}</vOutro>
        <vNF>${formatDecimal(totals.vNF, 2)}</vNF>
      </ICMSTot>
    </total>
    ${buildTranspXml(data.transp)}
    ${buildPagXml(data.pag)}
    ${data.infAdic ? `
    <infAdic>
      ${data.infAdic.infAdFisco ? `<infAdFisco>${escapeXml(data.infAdic.infAdFisco)}</infAdFisco>` : ''}
      ${data.infAdic.infCpl ? `<infCpl>${escapeXml(data.infAdic.infCpl)}</infCpl>` : ''}
    </infAdic>` : ''}
  </infNFe>
</NFe>`;

  return {
    xml: xml.replace(/^\s*[\r\n]/gm, ''), // Remove linhas vazias
    chaveAcesso,
    nfeId
  };
}

/**
 * Gera o XML do lote de NF-e para envio
 */
export function buildEnviNFeXml(nfeXml: string, idLote: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe xmlns="${NFE_NAMESPACES.nfe}" versao="4.00">
  <idLote>${idLote}</idLote>
  <indSinc>1</indSinc>
  ${nfeXml}
</enviNFe>`;
}

/**
 * Gera o XML de consulta de status do serviço
 */
export function buildConsStatServXml(cUF: string, tpAmb: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ xmlns="${NFE_NAMESPACES.nfe}" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <cUF>${getUfCode(cUF)}</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;
}

/**
 * Gera o XML de consulta de NF-e por chave
 */
export function buildConsSitNFeXml(chaveAcesso: string, tpAmb: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<consSitNFe xmlns="${NFE_NAMESPACES.nfe}" versao="4.00">
  <tpAmb>${tpAmb}</tpAmb>
  <xServ>CONSULTAR</xServ>
  <chNFe>${chaveAcesso}</chNFe>
</consSitNFe>`;
}
