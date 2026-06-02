// =============================================================
// MOTOR ÚNICO DE PRÉ-FLIGHT — NF, Declaração de Conteúdo e Remessa
// =============================================================
// Fonte ÚNICA das regras de campos obrigatórios para emissão de:
//   • Nota Fiscal Eletrônica (NF-e)
//   • Declaração de Conteúdo dos Correios (DC)
//   • Pré-postagem / Remessa (Correios e similares)
//
// Por que existe: as 3 emissões compartilham ~80% dos requisitos
// (destinatário, endereço, peso, emitente). Antes, cada módulo
// implementava sua própria checagem, em momento diferente,
// resultando em PVs duplicados/manuais que só falhavam na ponta.
//
// Regras consolidadas a partir de:
//   - docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md
//   - docs/especificacoes/erp/rascunhos-logisticos.md
//   - docs/especificacoes/erp/erp-fiscal.md
//   - mem://features/fiscal/mandatory-data-enforcement-standard
//   - mem://constraints/shipment-mirrors-pedido-venda-em-aberto
//   - mem://constraints/correios-cws-prepostagem-payload-and-error-parser
//
// Anti-regressão:
//   - mem://constraints/preflight-fiscal-logistico-portao-unico
//   - Proibido qualquer módulo criar checagem isolada destas regras.
//     Todos os pontos de gravação/emissão consomem este motor.
// =============================================================

export type PreflightScope = "nf" | "dc" | "shipment" | "emitente";

export interface PreflightIssue {
  scope: PreflightScope;
  field: string;
  message: string; // PT-BR, voltado ao operador
  severity: "block" | "warn";
}

export interface PreflightDestinatario {
  nome?: string | null;
  cpf_cnpj?: string | null;
  telefone?: string | null;
  email?: string | null;
  endereco?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    municipio?: string | null;
    uf?: string | null;
    municipio_codigo?: string | null;
  } | null;
}

export interface PreflightItem {
  descricao?: string | null;
  codigo_produto?: string | null;
  product_id?: string | null;
  quantidade?: number | null;
  valor_unitario?: number | null;
  peso_unitario_g?: number | null; // gramas
  ncm?: string | null;
}

export interface PreflightEmitente {
  razao_social?: string | null;
  cnpj?: string | null;
  ie?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
}

export interface PreflightPackage {
  weight_grams?: number | null;
  height_cm?: number | null;
  width_cm?: number | null;
  depth_cm?: number | null;
  carrier?: string | null;
  service?: string | null;
}

export interface PreflightInput {
  scopes: PreflightScope[]; // quais escopos validar
  destinatario?: PreflightDestinatario;
  itens?: PreflightItem[];
  emitente?: PreflightEmitente;
  package?: PreflightPackage;
  // Vínculo fiscal já existente (para validar a Remessa)
  fiscalLink?: { hasNfe?: boolean; hasDC?: boolean };
}

export interface PreflightResult {
  ok: boolean;
  issues: PreflightIssue[];
  blockingIssues: PreflightIssue[];
  // Mensagem PT-BR consolidada pronta para toast/log
  message: string;
}

// ---------- Helpers ----------

const onlyDigits = (v?: string | null) => String(v ?? "").replace(/\D/g, "");
const isFilled = (v?: string | null) => !!String(v ?? "").trim();

function isValidCpfCnpj(v?: string | null): boolean {
  const d = onlyDigits(v);
  return d.length === 11 || d.length === 14;
}

function isValidPhoneBR(v?: string | null): boolean {
  const d = onlyDigits(v);
  // 10 (fixo c/ DDD) ou 11 (celular c/ DDD). Com DDI 55 → 12 ou 13.
  return d.length === 10 || d.length === 11 || d.length === 12 || d.length === 13;
}

function isValidCEP(v?: string | null): boolean {
  return onlyDigits(v).length === 8;
}

function isValidUF(v?: string | null): boolean {
  return /^[A-Z]{2}$/.test(String(v ?? "").trim().toUpperCase());
}

// ---------- Validadores por escopo ----------

function validateDestinatario(
  d: PreflightDestinatario | undefined,
  scope: PreflightScope,
  issues: PreflightIssue[],
) {
  const dst = d || {};
  const end = dst.endereco || {};

  if (!isFilled(dst.nome)) {
    issues.push({ scope, field: "dest_nome", severity: "block",
      message: "Nome do destinatário não informado." });
  }
  if (!isValidCpfCnpj(dst.cpf_cnpj)) {
    issues.push({ scope, field: "dest_cpf_cnpj", severity: "block",
      message: "CPF/CNPJ do destinatário inválido ou ausente." });
  }
  // Telefone: obrigatório para DC e Remessa; recomendado para NF
  if (!isValidPhoneBR(dst.telefone)) {
    issues.push({
      scope,
      field: "dest_telefone",
      severity: scope === "nf" ? "warn" : "block",
      message: "Telefone do destinatário ausente ou sem DDD.",
    });
  }
  if (!isValidCEP(end.cep)) {
    issues.push({ scope, field: "dest_endereco_cep", severity: "block",
      message: "CEP do destinatário inválido (precisa ter 8 dígitos)." });
  }
  if (!isFilled(end.logradouro)) {
    issues.push({ scope, field: "dest_endereco_logradouro", severity: "block",
      message: "Rua/logradouro do destinatário não informado." });
  }
  if (!isFilled(end.numero)) {
    issues.push({ scope, field: "dest_endereco_numero", severity: "block",
      message: "Número do endereço do destinatário não informado." });
  }
  if (!isFilled(end.bairro)) {
    issues.push({ scope, field: "dest_endereco_bairro", severity: "block",
      message: "Bairro do destinatário não informado." });
  }
  if (!isFilled(end.municipio)) {
    issues.push({ scope, field: "dest_endereco_municipio", severity: "block",
      message: "Cidade do destinatário não informada." });
  }
  if (!isValidUF(end.uf)) {
    issues.push({ scope, field: "dest_endereco_uf", severity: "block",
      message: "UF do destinatário inválida." });
  }
  // Código IBGE: só relevante para NF (xMun da SEFAZ).
  if (scope === "nf" && !isFilled(end.municipio_codigo)) {
    issues.push({ scope, field: "dest_endereco_municipio_codigo", severity: "warn",
      message: "Código IBGE do município do destinatário não resolvido." });
  }
}

function validateItens(
  itens: PreflightItem[] | undefined,
  scope: PreflightScope,
  issues: PreflightIssue[],
) {
  const lst = itens || [];
  if (lst.length === 0) {
    issues.push({ scope, field: "itens", severity: "block",
      message: "Nenhum item informado." });
    return;
  }
  lst.forEach((it, idx) => {
    const tag = it.descricao || it.codigo_produto || `item ${idx + 1}`;
    if (!isFilled(it.descricao)) {
      issues.push({ scope, field: `itens[${idx}].descricao`, severity: "block",
        message: `Item ${idx + 1}: descrição não informada.` });
    }
    if (!Number.isFinite(Number(it.quantidade)) || Number(it.quantidade) <= 0) {
      issues.push({ scope, field: `itens[${idx}].quantidade`, severity: "block",
        message: `Item "${tag}": quantidade deve ser maior que zero.` });
    }
    if (!Number.isFinite(Number(it.valor_unitario)) || Number(it.valor_unitario) < 0) {
      issues.push({ scope, field: `itens[${idx}].valor_unitario`, severity: "block",
        message: `Item "${tag}": valor unitário inválido.` });
    }
    // NCM obrigatório para NF; recomendado para DC.
    if (scope === "nf") {
      const ncm = onlyDigits(it.ncm);
      if (ncm.length !== 8) {
        issues.push({ scope, field: `itens[${idx}].ncm`, severity: "block",
          message: `Item "${tag}": NCM inválido ou ausente (precisa ter 8 dígitos).` });
      }
    }
    // Peso obrigatório para DC e Shipment.
    if (scope === "dc" || scope === "shipment") {
      const peso = Number(it.peso_unitario_g);
      if (!Number.isFinite(peso) || peso <= 0) {
        issues.push({
          scope,
          field: `itens[${idx}].peso`,
          severity: "block",
          message: `Item "${tag}": peso do produto não cadastrado. Cadastre o peso em Produtos.`,
        });
      }
    }
  });
}

function validateEmitente(
  e: PreflightEmitente | undefined,
  issues: PreflightIssue[],
) {
  const em = e || {};
  if (!isFilled(em.razao_social)) {
    issues.push({ scope: "emitente", field: "razao_social", severity: "block",
      message: "Razão social da loja não cadastrada (Configurações Fiscais)." });
  }
  if (!isValidCpfCnpj(em.cnpj) || onlyDigits(em.cnpj).length !== 14) {
    issues.push({ scope: "emitente", field: "cnpj", severity: "block",
      message: "CNPJ da loja inválido ou ausente (Configurações Fiscais)." });
  }
  if (!isValidPhoneBR(em.telefone)) {
    issues.push({ scope: "emitente", field: "telefone", severity: "block",
      message: "Telefone da loja não cadastrado (Configurações Fiscais)." });
  }
  if (!isValidCEP(em.cep)) {
    issues.push({ scope: "emitente", field: "cep", severity: "block",
      message: "CEP da loja inválido (Configurações Fiscais)." });
  }
  for (const f of [
    ["logradouro", "Rua/logradouro da loja"],
    ["numero", "Número do endereço da loja"],
    ["bairro", "Bairro da loja"],
    ["municipio", "Cidade da loja"],
  ] as const) {
    if (!isFilled((em as any)[f[0]])) {
      issues.push({ scope: "emitente", field: f[0], severity: "block",
        message: `${f[1]} não cadastrado (Configurações Fiscais).` });
    }
  }
  if (!isValidUF(em.uf)) {
    issues.push({ scope: "emitente", field: "uf", severity: "block",
      message: "UF da loja inválida (Configurações Fiscais)." });
  }
}

function validatePackage(p: PreflightPackage | undefined, issues: PreflightIssue[]) {
  const pk = p || {};
  if (!Number.isFinite(Number(pk.weight_grams)) || Number(pk.weight_grams) <= 0) {
    issues.push({ scope: "shipment", field: "weight_grams", severity: "block",
      message: "Peso total da remessa não calculado (verifique os pesos dos produtos)." });
  }
  for (const dim of ["height_cm", "width_cm", "depth_cm"] as const) {
    if (!Number.isFinite(Number(pk[dim])) || Number(pk[dim]) <= 0) {
      issues.push({ scope: "shipment", field: dim, severity: "block",
        message: `Dimensão "${dim.replace("_cm", "")}" da embalagem inválida.` });
    }
  }
  if (!isFilled(pk.carrier)) {
    issues.push({ scope: "shipment", field: "carrier", severity: "block",
      message: "Transportadora não informada na remessa." });
  }
}

function validateFiscalLinkForShipment(
  link: PreflightInput["fiscalLink"],
  issues: PreflightIssue[],
) {
  const hasAny = !!(link?.hasNfe || link?.hasDC);
  if (!hasAny) {
    issues.push({
      scope: "shipment",
      field: "fiscal_link",
      severity: "block",
      message:
        "Este Pedido de Venda não tem Nota Fiscal autorizada nem Declaração de Conteúdo. Emita uma das duas antes de despachar.",
    });
  }
}

// ---------- API pública ----------

export function runPreflight(input: PreflightInput): PreflightResult {
  const issues: PreflightIssue[] = [];

  for (const scope of input.scopes) {
    if (scope === "emitente") {
      validateEmitente(input.emitente, issues);
      continue;
    }
    // NF, DC, Shipment compartilham destinatário e itens
    validateDestinatario(input.destinatario, scope, issues);
    validateItens(input.itens, scope, issues);

    if (scope === "shipment") {
      validatePackage(input.package, issues);
      validateFiscalLinkForShipment(input.fiscalLink, issues);
    }
  }

  const blockingIssues = issues.filter((i) => i.severity === "block");
  const ok = blockingIssues.length === 0;

  let message = "";
  if (!ok) {
    const top = blockingIssues.slice(0, 5).map((i) => `• ${i.message}`).join("\n");
    const extra = blockingIssues.length > 5
      ? `\n…e mais ${blockingIssues.length - 5} pendência(s).`
      : "";
    message =
      `Faltam dados obrigatórios para concluir esta operação:\n${top}${extra}`;
  }

  return { ok, issues, blockingIssues, message };
}

// ---------- Conveniência: builder a partir de fiscal_invoices + itens + products ----------

export interface BuildFromPVInput {
  pv: any; // linha de fiscal_invoices
  items: any[]; // fiscal_invoice_items
  productsByIdOrSku: Record<string, any>; // products (peso, NCM)
  emitente?: PreflightEmitente;
  package?: PreflightPackage;
  fiscalLink?: { hasNfe?: boolean; hasDC?: boolean };
}

export function buildPreflightInputFromPV(
  args: BuildFromPVInput,
  scopes: PreflightScope[],
): PreflightInput {
  const { pv, items, productsByIdOrSku } = args;

  const destinatario: PreflightDestinatario = {
    nome: pv?.dest_nome,
    cpf_cnpj: pv?.dest_cpf_cnpj,
    telefone: pv?.dest_telefone,
    email: pv?.dest_email,
    endereco: {
      cep: pv?.dest_endereco_cep,
      logradouro: pv?.dest_endereco_logradouro,
      numero: pv?.dest_endereco_numero,
      bairro: pv?.dest_endereco_bairro,
      municipio: pv?.dest_endereco_municipio,
      uf: pv?.dest_endereco_uf,
      municipio_codigo: pv?.dest_endereco_municipio_codigo,
    },
  };

  const itens: PreflightItem[] = (items || []).map((i: any) => {
    const lookup = i.product_id
      ? productsByIdOrSku[i.product_id]
      : productsByIdOrSku[i.codigo_produto];
    const peso = lookup?.weight ?? null;
    return {
      descricao: i.descricao,
      codigo_produto: i.codigo_produto,
      product_id: i.product_id || lookup?.id || null,
      quantidade: Number(i.quantidade) || 0,
      valor_unitario: Number(i.valor_unitario) || 0,
      ncm: i.ncm,
      peso_unitario_g: peso,
    };
  });

  return {
    scopes,
    destinatario,
    itens,
    emitente: args.emitente,
    package: args.package,
    fiscalLink: args.fiscalLink,
  };
}
