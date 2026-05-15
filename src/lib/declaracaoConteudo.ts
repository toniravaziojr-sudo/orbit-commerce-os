// =============================================
// DECLARAÇÃO DE CONTEÚDO DOS CORREIOS (DC) — motor único
// NÃO é documento fiscal. NÃO chama Focus/Sefaz. NÃO altera fiscal_stage.
// Fluxo:
//   1. Chama edge function `correios-content-declaration-issue` (registra +
//      numera + audita + devolve snapshot oficial).
//   2. Gera PDF a partir do snapshot retornado.
// O registro fica em `shipping_content_declarations`.
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

interface DeclarationRecord {
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

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function formatGrams(g: number | null): string {
  if (!g || g <= 0) return '-';
  if (g >= 1000) return `${(g / 1000).toFixed(3).replace('.', ',')} kg`;
  return `${g} g`;
}

function renderPdf(rec: DeclarationRecord): string {
  const s = rec.sender_snapshot || {};
  const r = rec.recipient_snapshot || {};
  const items = rec.items_snapshot || [];

  // A5 landscape — mais próximo do formulário oficial dos Correios
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = margin;

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DECLARAÇÃO DE CONTEÚDO', pageW / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº interno: ${rec.dc_number}`, pageW / 2, y, { align: 'center' });
  y += 3.5;
  const issued = new Date(rec.issued_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  doc.text(`Emitida em: ${issued}`, pageW / 2, y, { align: 'center' });
  y += 6;

  // Remetente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REMETENTE', margin, y); y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const remNome = s.razao_social || s.nome_fantasia || '(sem razão social)';
  doc.text(`Nome/Razão: ${remNome}`, margin, y); y += 3.2;
  doc.text(`CNPJ/CPF: ${formatCpfCnpj(s.cnpj)}`, margin, y); y += 3.2;
  const remEnd = [
    s.logradouro, s.numero ? `nº ${s.numero}` : null, s.complemento, s.bairro,
  ].filter(Boolean).join(', ');
  doc.text(`Endereço: ${remEnd || '-'}`, margin, y); y += 3.2;
  doc.text(`Município/UF: ${s.municipio || '-'} / ${s.uf || '-'}   CEP: ${formatCep(s.cep)}`, margin, y); y += 3.2;
  if (s.telefone) { doc.text(`Telefone: ${s.telefone}`, margin, y); y += 3.2; }
  y += 2;

  // Destinatário
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DESTINATÁRIO', margin, y); y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Nome: ${r.nome || '-'}`, margin, y); y += 3.2;
  doc.text(`CPF/CNPJ: ${formatCpfCnpj(r.documento)}`, margin, y); y += 3.2;
  const destEnd = [
    r.logradouro || r.street, r.numero || r.number ? `nº ${r.numero || r.number}` : null,
    r.complemento || r.complement, r.bairro || r.neighborhood,
  ].filter(Boolean).join(', ');
  doc.text(`Endereço: ${destEnd || '-'}`, margin, y); y += 3.2;
  const dMun = r.municipio || r.city || '-';
  const dUf = r.uf || r.state || '-';
  const dCep = r.cep || r.zip_code || r.postal_code;
  doc.text(`Município/UF: ${dMun} / ${dUf}   CEP: ${formatCep(dCep)}`, margin, y); y += 3.2;
  if (r.telefone) { doc.text(`Telefone: ${r.telefone}`, margin, y); y += 3.2; }
  y += 2;

  // Itens — tabela
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('CONTEÚDO DECLARADO', margin, y); y += 4.5;

  doc.setFontSize(7);
  const colX = { desc: margin, qtd: pageW - margin - 45, vu: pageW - margin - 25, total: pageW - margin };
  doc.text('Descrição', colX.desc, y);
  doc.text('Qtd', colX.qtd, y, { align: 'right' });
  doc.text('Vlr Un.', colX.vu, y, { align: 'right' });
  doc.text('Total', colX.total, y, { align: 'right' });
  y += 1.5;
  doc.line(margin, y, pageW - margin, y);
  y += 3;
  doc.setFont('helvetica', 'normal');

  for (const it of items) {
    if (y > 175) { doc.addPage(); y = margin; }
    const desc = (it.descricao || '').slice(0, 55);
    doc.text(desc, colX.desc, y);
    doc.text(String(it.quantidade || 0), colX.qtd, y, { align: 'right' });
    doc.text(formatCurrency(it.valor_unitario || 0), colX.vu, y, { align: 'right' });
    doc.text(formatCurrency(it.subtotal || 0), colX.total, y, { align: 'right' });
    y += 3.5;
  }
  y += 1;
  doc.line(margin, y, pageW - margin, y); y += 4;

  // Totais
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const totalReais = (rec.total_value_cents || 0) / 100;
  doc.text(`Valor total declarado: ${formatCurrency(totalReais)}`, pageW - margin, y, { align: 'right' });
  y += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Peso total: ${formatGrams(rec.total_weight_grams)}   Volumes: ${rec.volumes_count || 1}`, pageW - margin, y, { align: 'right' });
  y += 6;

  // Cláusula legal + responsabilidade
  if (y > 165) { doc.addPage(); y = margin; }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  const clausula =
    'Declaro que não me enquadro como contribuinte do ICMS conforme art. 4º da Lei Complementar nº 87, de 13/09/1996. ' +
    'Declaração de Conteúdo não substitui Nota Fiscal quando a emissão de NF-e for obrigatória. ' +
    'O remetente é integralmente responsável pelas informações declaradas, na forma da legislação vigente.';
  const linhas = doc.splitTextToSize(clausula, pageW - margin * 2);
  doc.text(linhas, margin, y);
  y += linhas.length * 3 + 4;

  if (rec.reason) {
    doc.setFont('helvetica', 'normal');
    doc.text(`Motivo informado: ${rec.reason}`, margin, y, { maxWidth: pageW - margin * 2 });
    y += 5;
  }

  // Assinatura
  const cidadeUf = `${rec.emission_city || s.municipio || '-'} / ${s.uf || '-'}`;
  const dataStr = new Date(rec.issued_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Local e data: ${cidadeUf}, ${dataStr}`, margin, y); y += 6;
  doc.text('Assinatura do Remetente: ____________________________________________', margin, y);

  const filename = `${rec.dc_number}_${(r.nome || 'destinatario').replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.pdf`;
  doc.save(filename);
  return filename;
}

export async function issueAndDownloadCorreiosContentDeclaration(args: IssueArgs): Promise<{
  ok: boolean;
  error?: string;
  dcNumber?: string;
  declarationId?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('correios-content-declaration-issue', {
      body: {
        tenant_id: args.tenantId,
        order_id: args.orderId ?? null,
        fiscal_invoice_id: args.fiscalInvoiceId ?? null,
        source: args.source ?? 'manual',
        reason: args.reason,
        responsibility_acknowledged: args.responsibilityAcknowledged,
        volumes_count: args.volumesCount ?? 1,
        emission_city: args.emissionCity ?? null,
      },
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.success) return { ok: false, error: data?.error || 'Falha ao registrar Declaração de Conteúdo.' };

    const rec = data.declaration as DeclarationRecord;
    renderPdf(rec);
    return { ok: true, dcNumber: rec.dc_number, declarationId: rec.id };
  } catch (e: any) {
    console.error('[issueAndDownloadCorreiosContentDeclaration]', e);
    return { ok: false, error: e?.message || 'Erro ao gerar Declaração de Conteúdo' };
  }
}

// Compat: alias do nome antigo para evitar quebra de import enquanto a UI é atualizada.
// @deprecated use `issueAndDownloadCorreiosContentDeclaration`.
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
