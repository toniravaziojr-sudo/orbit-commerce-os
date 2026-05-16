// =============================================
// DECLARAÇÃO DE CONTEÚDO DOS CORREIOS (DC) — motor único
// NÃO é documento fiscal. NÃO chama Focus/Sefaz. NÃO altera fiscal_stage.
// Suporta:
//   - Geração individual (1 pedido = 1 PDF de 1+ páginas)
//   - Geração em massa (N pedidos = 1 PDF multipágina, 1 declaração por página)
// Cada declaração é registrada individualmente em `shipping_content_declarations`,
// mantendo histórico individual mesmo quando o download é unificado.
// =============================================
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface IssueArgs {
  tenantId?: string;
  orderId?: string | null;
  fiscalInvoiceId?: string | null;
  source?: 'manual' | 'gateway' | 'shipment';
  reason: string;
  responsibilityAcknowledged: true;
  volumesCount?: number;
  totalWeightGrams?: number; // override obrigatório quando o pedido não tem peso
  emissionCity?: string | null;
}

interface SnapshotItem {
  descricao: string;
  codigo?: string | null;
  quantidade: number;
  unidade?: string | null;
  valor_unitario: number;
  subtotal: number;
}

export interface DeclarationRecord {
  id: string;
  dc_number: string;
  reason: string;
  total_value_cents: number;
  total_weight_grams: number | null;
  volumes_count: number;
  emission_city: string | null;
  sender_snapshot: any;
  recipient_snapshot: any;
  items_snapshot: SnapshotItem[];
  issued_at: string;
}

// ----------------- Formatadores -----------------
function formatCpfCnpj(doc?: string | null): string {
  const d = (doc || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc || '-';
}
function formatCep(cep?: string | null): string {
  const d = (cep || '').replace(/\D/g, '');
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2');
  return cep || '-';
}
function formatPhone(phone?: string | null): string {
  if (!phone) return '-';
  const d = phone.replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return phone;
}
function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function formatKgFromGrams(g: number | null): string {
  // Nunca renderiza "-": peso é obrigatório no novo fluxo.
  const grams = g && g > 0 ? g : 0;
  return `${(grams / 1000).toFixed(3).replace('.', ',')} kg`;
}

// Texto de responsabilidade obrigatório (neutro, sem afirmar não-contribuinte automaticamente).
const RESPONSIBILITY_TEXT =
  'Declaro, sob minha responsabilidade, que as informações prestadas são verdadeiras e que a utilização ' +
  'desta Declaração de Conteúdo é adequada para a presente remessa, ciente de que este documento NÃO substitui ' +
  'Nota Fiscal quando a emissão de documento fiscal for obrigatória. Declaro ainda estar ciente das restrições ' +
  'de envio dos Correios, das regras aplicáveis ao transporte postal e da responsabilidade por informações inverídicas.';

const ADDITIONAL_NOTICES = [
  'Este documento NÃO é Nota Fiscal Eletrônica (NF-e), DANFE ou DC-e Sefaz.',
  'O remetente é integralmente responsável pelas informações declaradas.',
  'É proibido o envio de objetos restritos ou proibidos pela legislação postal e aduaneira.',
  'O uso indevido desta declaração pode gerar responsabilidade legal do remetente.',
  'O uso desta declaração para omitir documento fiscal obrigatório ou informação tributária pode gerar responsabilidade legal do remetente.',
];

// ----------------- Render de uma declaração no jsPDF (mesmo doc) -----------------
function renderOneDeclaration(doc: jsPDF, rec: DeclarationRecord, isFirstPage: boolean) {
  const s = rec.sender_snapshot || {};
  const r = rec.recipient_snapshot || {};
  const items = rec.items_snapshot || [];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  if (!isFirstPage) {
    doc.addPage();
    y = margin;
  }

  // ---- Cabeçalho ----
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, pageW - margin * 2, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DECLARAÇÃO DE CONTEÚDO', pageW / 2, y + 6, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Documento de acompanhamento de remessa postal — não é documento fiscal.', pageW / 2, y + 11, { align: 'center' });
  y += 17;

  doc.setFontSize(8);
  const issued = new Date(rec.issued_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  doc.text(`Nº interno: ${rec.dc_number}`, margin, y);
  doc.text(`Emitida em: ${issued}`, pageW - margin, y, { align: 'right' });
  y += 5;

  // ---- Remetente ----
  const drawSectionTitle = (title: string) => {
    doc.setFillColor(235, 235, 235);
    doc.rect(margin, y, pageW - margin * 2, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin + 1.5, y + 3.6);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
  };

  drawSectionTitle('REMETENTE');
  const remNome = s.razao_social || s.nome_fantasia || '(sem razão social)';
  doc.text(`Nome/Razão social: ${remNome}`, margin, y); y += 4;
  doc.text(`CNPJ/CPF: ${formatCpfCnpj(s.cnpj)}`, margin, y); y += 4;
  const remEnd = [
    s.logradouro,
    s.numero ? `nº ${s.numero}` : null,
    s.complemento,
    s.bairro,
  ].filter(Boolean).join(', ');
  doc.text(`Endereço: ${remEnd || '-'}`, margin, y, { maxWidth: pageW - margin * 2 }); y += 4;
  doc.text(`Município/UF: ${s.municipio || '-'} / ${s.uf || '-'}`, margin, y);
  doc.text(`CEP: ${formatCep(s.cep)}`, pageW - margin, y, { align: 'right' });
  y += 4;
  if (s.telefone || s.email) {
    doc.text(`Telefone: ${s.telefone || '-'}`, margin, y);
    if (s.email) doc.text(`E-mail: ${s.email}`, pageW - margin, y, { align: 'right' });
    y += 4;
  }
  y += 1;

  // ---- Destinatário ----
  drawSectionTitle('DESTINATÁRIO');
  doc.text(`Nome: ${r.nome || '-'}`, margin, y); y += 4;
  doc.text(`CPF/CNPJ: ${formatCpfCnpj(r.documento)}`, margin, y); y += 4;
  const destEnd = [
    r.logradouro || r.street,
    (r.numero || r.number) ? `nº ${r.numero || r.number}` : null,
    r.complemento || r.complement,
    r.bairro || r.neighborhood,
  ].filter(Boolean).join(', ');
  doc.text(`Endereço: ${destEnd || '-'}`, margin, y, { maxWidth: pageW - margin * 2 }); y += 4;
  const dMun = r.municipio || r.city || '-';
  const dUf = r.uf || r.state || '-';
  const dCep = r.cep || r.zip_code || r.postal_code;
  doc.text(`Município/UF: ${dMun} / ${dUf}`, margin, y);
  doc.text(`CEP: ${formatCep(dCep)}`, pageW - margin, y, { align: 'right' });
  y += 4;
  if (r.telefone || r.email) {
    doc.text(`Telefone: ${r.telefone || '-'}`, margin, y);
    if (r.email) doc.text(`E-mail: ${r.email}`, pageW - margin, y, { align: 'right' });
    y += 4;
  }
  y += 1;

  // ---- Conteúdo declarado (tabela) ----
  drawSectionTitle('CONTEÚDO DECLARADO');
  doc.setFontSize(8);
  const colDescX = margin;
  const colQtdX = pageW - margin - 70;
  const colVuX = pageW - margin - 35;
  const colTotalX = pageW - margin;

  doc.setFont('helvetica', 'bold');
  doc.text('Descrição', colDescX, y);
  doc.text('Qtd', colQtdX, y, { align: 'right' });
  doc.text('Vlr Unit.', colVuX, y, { align: 'right' });
  doc.text('Total', colTotalX, y, { align: 'right' });
  y += 1.5;
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 3;
  doc.setFont('helvetica', 'normal');

  for (const it of items) {
    if (y > pageH - 70) {
      doc.addPage();
      y = margin;
    }
    const desc = (it.descricao || '').slice(0, 70);
    doc.text(desc, colDescX, y);
    doc.text(String(it.quantidade || 0), colQtdX, y, { align: 'right' });
    doc.text(formatCurrency(it.valor_unitario || 0), colVuX, y, { align: 'right' });
    doc.text(formatCurrency(it.subtotal || 0), colTotalX, y, { align: 'right' });
    y += 4;
  }
  y += 1;
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ---- Totais ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const totalReais = (rec.total_value_cents || 0) / 100;
  doc.text(`Valor total declarado: ${formatCurrency(totalReais)}`, pageW - margin, y, { align: 'right' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Peso total: ${formatKgFromGrams(rec.total_weight_grams)}`, margin, y);
  doc.text(`Volumes: ${rec.volumes_count || 1}`, pageW - margin, y, { align: 'right' });
  y += 6;

  // ---- Motivo informado ----
  if (rec.reason) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Motivo informado pelo remetente:', margin, y); y += 4;
    doc.setFont('helvetica', 'normal');
    const motivoLinhas = doc.splitTextToSize(rec.reason, pageW - margin * 2);
    doc.text(motivoLinhas, margin, y);
    y += motivoLinhas.length * 3.5 + 2;
  }

  // ---- Quebra antes da responsabilidade se faltar espaço ----
  if (y > pageH - 60) {
    doc.addPage();
    y = margin;
  }

  // ---- Responsabilidade + avisos ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Declaração de responsabilidade do remetente', margin, y); y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const respLinhas = doc.splitTextToSize(RESPONSIBILITY_TEXT, pageW - margin * 2);
  doc.text(respLinhas, margin, y);
  y += respLinhas.length * 3.2 + 2;

  doc.setFontSize(7.2);
  for (const notice of ADDITIONAL_NOTICES) {
    const ln = doc.splitTextToSize(`• ${notice}`, pageW - margin * 2);
    doc.text(ln, margin, y);
    y += ln.length * 3 + 0.5;
  }
  y += 4;

  // ---- Local, data e assinatura ----
  if (y > pageH - 22) {
    doc.addPage();
    y = margin;
  }
  const cidadeUf = `${rec.emission_city || s.municipio || '-'} / ${s.uf || '-'}`;
  const dataStr = new Date(rec.issued_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  doc.setFontSize(8.5);
  doc.text(`Local e data: ${cidadeUf}, ${dataStr}`, margin, y); y += 10;
  doc.line(margin, y, pageW - margin - 60, y); y += 4;
  doc.setFontSize(8);
  doc.text('Assinatura do declarante / remetente', margin, y);
}

// ----------------- API pública: individual -----------------
async function callIssueEdge(args: IssueArgs): Promise<{ ok: boolean; error?: string; record?: DeclarationRecord }> {
  const { data, error } = await supabase.functions.invoke('correios-content-declaration-issue', {
    body: {
      tenant_id: args.tenantId,
      order_id: args.orderId ?? null,
      fiscal_invoice_id: args.fiscalInvoiceId ?? null,
      source: args.source ?? 'manual',
      reason: args.reason,
      responsibility_acknowledged: args.responsibilityAcknowledged,
      volumes_count: args.volumesCount ?? 1,
      total_weight_grams: args.totalWeightGrams,
      emission_city: args.emissionCity ?? null,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.success) return { ok: false, error: data?.error || 'Falha ao registrar Declaração de Conteúdo.' };
  return { ok: true, record: data.declaration as DeclarationRecord };
}

function todayFilename(prefix: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${prefix}-${yyyy}-${mm}-${dd}.pdf`;
}

export async function issueAndDownloadCorreiosContentDeclaration(args: IssueArgs): Promise<{
  ok: boolean;
  error?: string;
  dcNumber?: string;
  declarationId?: string;
  filename?: string;
}> {
  try {
    const res = await callIssueEdge(args);
    if (!res.ok || !res.record) return { ok: false, error: res.error };
    const rec = res.record;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    renderOneDeclaration(doc, rec, true);
    const filename = `${rec.dc_number}.pdf`;
    doc.save(filename);
    return { ok: true, dcNumber: rec.dc_number, declarationId: rec.id, filename };
  } catch (e: any) {
    console.error('[issueAndDownloadCorreiosContentDeclaration]', e);
    return { ok: false, error: e?.message || 'Erro ao gerar Declaração de Conteúdo' };
  }
}

// ----------------- API pública: batch (PDF único multipágina) -----------------
export interface BatchTarget {
  tenantId?: string;
  orderId?: string | null;
  fiscalInvoiceId?: string | null;
  weightGrams: number;   // obrigatório
  volumes: number;       // padrão 1
  emissionCity?: string | null;
  label?: string;
}

export async function issueAndDownloadCorreiosContentDeclarationsBatch(params: {
  reason: string;
  responsibilityAcknowledged: true;
  source?: 'manual' | 'gateway' | 'shipment';
  targets: BatchTarget[];
}): Promise<{ ok: number; fail: number; failures: Array<{ label?: string; error: string }>; filename?: string; dcNumbers: string[] }> {
  const records: DeclarationRecord[] = [];
  const failures: Array<{ label?: string; error: string }> = [];

  for (const t of params.targets) {
    const res = await callIssueEdge({
      tenantId: t.tenantId,
      orderId: t.orderId ?? null,
      fiscalInvoiceId: t.fiscalInvoiceId ?? null,
      source: params.source ?? 'manual',
      reason: params.reason,
      responsibilityAcknowledged: true,
      volumesCount: t.volumes,
      totalWeightGrams: t.weightGrams,
      emissionCity: t.emissionCity ?? null,
    });
    if (res.ok && res.record) records.push(res.record);
    else failures.push({ label: t.label, error: res.error || 'Falha desconhecida' });
  }

  if (records.length === 0) {
    return { ok: 0, fail: failures.length, failures, dcNumbers: [] };
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  records.forEach((rec, idx) => renderOneDeclaration(doc, rec, idx === 0));

  const filename =
    records.length === 1 ? `${records[0].dc_number}.pdf` : todayFilename('Declaracoes-Conteudo');
  doc.save(filename);

  return {
    ok: records.length,
    fail: failures.length,
    failures,
    filename,
    dcNumbers: records.map((r) => r.dc_number),
  };
}

// Compat: alias do nome antigo para evitar quebra de import enquanto a UI é atualizada.
// @deprecated use `issueAndDownloadCorreiosContentDeclaration` ou `...Batch`.
export async function generateDeclaracaoConteudoPdf(
  tenantId: string,
  invoiceId: string,
): Promise<{ ok: boolean; error?: string; dcNumber?: string }> {
  return issueAndDownloadCorreiosContentDeclaration({
    tenantId,
    fiscalInvoiceId: invoiceId,
    source: 'manual',
    reason: 'Emissão manual via lista de Pedidos de Venda (compat legacy).',
    responsibilityAcknowledged: true,
  });
}
