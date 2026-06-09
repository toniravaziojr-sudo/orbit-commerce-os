// ============================================================
// CARRIER REGISTRY — catálogo embutido de transportadoras conhecidas
// ------------------------------------------------------------
// Princípios:
// 1. Nome do serviço (PAC, SEDEX, JADLOG, etc.) é padronizado por todos
//    os integradores (Frenet, Melhor Envio, marketplaces). Usamos isso
//    como chave primária de cruzamento.
// 2. Apenas dados PÚBLICOS e bem conhecidos são registrados aqui.
//    Quando o CNPJ não é seguro/estável o suficiente, deixamos null e
//    o operador edita a NF se a logística exigir.
// 3. Para transportadoras desconhecidas, devolvemos o nome bruto e
//    nenhum CNPJ — emissão segue, mas com aviso de pendência opcional.
// ============================================================

export interface CarrierRecord {
  /** Slug interno estável */
  slug: string;
  /** Razão social oficial */
  razao_social: string;
  /** CNPJ apenas dígitos (null quando não temos certeza) */
  cnpj: string | null;
  /** Inscrição estadual (null quando isenta ou desconhecida) */
  inscricao_estadual?: string | null;
  /** Endereço resumido para o bloco transportador da NF (opcional) */
  endereco?: string | null;
  municipio?: string | null;
  uf?: string | null;
  /** Lista de nomes/aliases que podem chegar de integradores */
  aliases: string[];
  /** Serviços conhecidos desta transportadora (em UPPERCASE) */
  servicos?: string[];
}

/**
 * Catálogo embutido. Apenas Correios tem CNPJ canônico aqui — é a única
 * transportadora cujo CNPJ é amplamente público e estável. As demais
 * ficam com nome+serviço apenas; CNPJ vira pendência opcional.
 */
const REGISTRY: CarrierRecord[] = [
  {
    slug: 'correios',
    razao_social: 'EMPRESA BRASILEIRA DE CORREIOS E TELEGRAFOS',
    cnpj: '34028316000103',
    inscricao_estadual: 'ISENTO',
    endereco: 'SBN QUADRA 01 BLOCO A',
    municipio: 'BRASILIA',
    uf: 'DF',
    aliases: ['correios', 'ect', 'empresa brasileira de correios'],
    servicos: ['PAC', 'SEDEX', 'SEDEX 10', 'SEDEX 12', 'SEDEX HOJE', 'MINI ENVIOS', 'PAC MINI'],
  },
  {
    slug: 'jadlog',
    razao_social: 'JADLOG LOGISTICA S.A.',
    cnpj: null,
    aliases: ['jadlog', 'jad log'],
    servicos: ['JADLOG', 'JADLOG PACKAGE', 'JADLOG .PACKAGE', 'JADLOG ECONOMICO', 'JADLOG COM', 'JADLOG RODOVIARIO'],
  },
  {
    slug: 'loggi',
    razao_social: 'LOGGI TECNOLOGIA LTDA',
    cnpj: null,
    aliases: ['loggi'],
    servicos: ['LOGGI', 'LOGGI EXPRESS', 'LOGGI CORP'],
  },
  {
    slug: 'mercado_envios',
    razao_social: 'MERCADO ENVIOS',
    cnpj: null,
    aliases: ['mercado envios', 'mercadoenvios', 'mercado livre', 'mercadolivre', 'meli', 'ml'],
    servicos: ['MERCADO ENVIOS', 'MERCADO ENVIOS FLEX', 'MERCADO ENVIOS FULL', 'MERCADO ENVIOS COLLECT'],
  },
  {
    slug: 'shopee_xpress',
    razao_social: 'SHOPEE XPRESS',
    cnpj: null,
    aliases: ['shopee xpress', 'shopee express', 'spx', 'shopee'],
    servicos: ['SHOPEE XPRESS', 'SPX', 'SHOPEE EXPRESS'],
  },
  {
    slug: 'total_express',
    razao_social: 'TOTAL EXPRESS LTDA',
    cnpj: null,
    aliases: ['total express', 'totalexpress'],
    servicos: ['TOTAL EXPRESS', 'TOTAL PRIME', 'TOTAL ECONOMICO'],
  },
  {
    slug: 'azul_cargo',
    razao_social: 'AZUL CARGO EXPRESS',
    cnpj: null,
    aliases: ['azul cargo', 'azul cargo express', 'azulcargo'],
    servicos: ['AZUL CARGO', 'AZUL EXPRESSO', 'AZUL AMANHA', 'AZUL E-COMMERCE'],
  },
  {
    slug: 'braspress',
    razao_social: 'BRASPRESS TRANSPORTES URGENTES LTDA',
    cnpj: null,
    aliases: ['braspress'],
    servicos: ['BRASPRESS', 'BRASPRESS RODOVIARIO', 'BRASPRESS AEREO'],
  },
  {
    slug: 'rodonaves',
    razao_social: 'RODONAVES TRANSPORTES E ENCOMENDAS LTDA',
    cnpj: null,
    aliases: ['rodonaves', 'rte', 'rte rodonaves'],
    servicos: ['RODONAVES', 'RTE'],
  },
  {
    slug: 'latam_cargo',
    razao_social: 'LATAM CARGO BRASIL',
    cnpj: null,
    aliases: ['latam cargo', 'latam'],
    servicos: ['LATAM CARGO', 'LATAM EXPRESS'],
  },
];

function normalize(s: string | null | undefined): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResolvedCarrier {
  /** Razão social a ir na NF */
  razao_social: string;
  cnpj: string | null;
  inscricao_estadual: string | null;
  endereco: string | null;
  municipio: string | null;
  uf: string | null;
  servico: string | null;
  /** True quando o registro vem do catálogo (com CNPJ conhecido) */
  matched: boolean;
  /** True quando apenas o nome bate, mas faltam dados sensíveis (CNPJ) */
  partial: boolean;
  /** Slug da transportadora (interno) */
  slug: string | null;
}

/**
 * Resolve a transportadora cruzando nome + serviço informados no pedido
 * com o catálogo embutido.
 *
 * - Match cheio: encontra alias do carrier OU serviço conhecido → devolve
 *   razão social oficial + todos os dados disponíveis.
 * - Match parcial: encontra o carrier mas sem CNPJ no catálogo → devolve
 *   nome oficial, `cnpj=null`, `partial=true`.
 * - Sem match: devolve o nome original do pedido (uppercase trim), sem
 *   CNPJ, `matched=false`.
 *
 * A função NUNCA retorna null — sempre devolve algo emitível.
 */
export function resolveCarrier(input: {
  carrierName?: string | null;
  serviceName?: string | null;
}): ResolvedCarrier {
  const nameNorm = normalize(input.carrierName);
  const serviceNorm = normalize(input.serviceName);

  // 1. Tenta casar pelo nome do serviço (mais específico)
  if (serviceNorm) {
    for (const rec of REGISTRY) {
      const servicos = (rec.servicos || []).map((s) => normalize(s));
      if (servicos.some((s) => s === serviceNorm || serviceNorm.includes(s) || s.includes(serviceNorm))) {
        return buildResolved(rec, input.serviceName);
      }
    }
  }

  // 2. Tenta casar pelo nome da transportadora
  if (nameNorm) {
    for (const rec of REGISTRY) {
      const aliases = rec.aliases.map((a) => normalize(a));
      if (aliases.some((a) => a === nameNorm || nameNorm.includes(a) || a.includes(nameNorm))) {
        return buildResolved(rec, input.serviceName);
      }
    }
  }

  // 3. Sem match — devolve o que veio
  const rawName = (input.carrierName || '').trim().toUpperCase();
  return {
    razao_social: rawName || 'TRANSPORTADORA NAO INFORMADA',
    cnpj: null,
    inscricao_estadual: null,
    endereco: null,
    municipio: null,
    uf: null,
    servico: input.serviceName ? input.serviceName.trim().toUpperCase() : null,
    matched: false,
    partial: false,
    slug: null,
  };
}

function buildResolved(rec: CarrierRecord, serviceLabel?: string | null): ResolvedCarrier {
  return {
    razao_social: rec.razao_social,
    cnpj: rec.cnpj,
    inscricao_estadual: rec.inscricao_estadual ?? null,
    endereco: rec.endereco ?? null,
    municipio: rec.municipio ?? null,
    uf: rec.uf ?? null,
    servico: (serviceLabel || '').trim().toUpperCase() || null,
    matched: true,
    partial: !rec.cnpj,
    slug: rec.slug,
  };
}
