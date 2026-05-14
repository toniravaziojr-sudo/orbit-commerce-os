// =============================================
// DECLARAÇÃO DE CONTEÚDO (DC)
// Gera PDF de Declaração de Conteúdo a partir de um registro de Pedido de Venda.
// NÃO é documento fiscal. NÃO chama Focus/Sefaz. NÃO altera fiscal_stage.
// Numeração interna independente da numeração fiscal de NF-e.
// =============================================
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface FiscalSettings {
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco_logradouro?: string | null;
  endereco_numero?: string | null;
  endereco_complemento?: string | null;
  endereco_bairro?: string | null;
  endereco_municipio?: string | null;
  endereco_uf?: string | null;
  endereco_cep?: string | null;
  telefone?: string | null;
  email?: string | null;
}

interface DCInvoiceItem {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  unidade?: string | null;
  codigo_produto?: string | null;
}

interface DCInvoice {
  id: string;
  numero?: number | null;
  dest_nome: string;
  dest_cpf_cnpj: string;
  dest_endereco_logradouro?: string | null;
  dest_endereco_numero?: string | null;
  dest_endereco_complemento?: string | null;
  dest_endereco_bairro?: string | null;
  dest_endereco_municipio?: string | null;
  dest_endereco_uf?: string | null;
  dest_endereco_cep?: string | null;
  dest_telefone?: string | null;
  fiscal_invoice_items: DCInvoiceItem[];
}

function formatCpfCnpj(doc: string): string {
  const d = (doc || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return doc;
}

function formatCep(cep: string): string {
  const d = (cep || '').replace(/\D/g, '');
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2');
  return cep;
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function generateDcNumber(invoiceId: string): string {
  // Numeração interna determinística: derivada do timestamp + sufixo do id da invoice.
  // Não conflita com numeração fiscal de NF-e.
  const ts = Date.now().toString().slice(-8);
  const sufix = invoiceId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `DC-${ts}-${sufix}`;
}

export async function generateDeclaracaoConteudoPdf(
  tenantId: string,
  invoiceId: string,
): Promise<{ ok: boolean; error?: string; dcNumber?: string }> {
  try {
    const [{ data: settings }, { data: inv }] = await Promise.all([
      supabase.from('fiscal_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('fiscal_invoices')
        .select('*, fiscal_invoice_items(descricao, quantidade, valor_unitario, unidade, codigo_produto)')
        .eq('id', invoiceId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ]);

    if (!settings) return { ok: false, error: 'Configurações fiscais (remetente) não encontradas.' };
    if (!inv) return { ok: false, error: 'Pedido de venda não encontrado.' };

    const s = settings as FiscalSettings;
    const i = inv as unknown as DCInvoice;
    const items = i.fiscal_invoice_items || [];
    if (items.length === 0) return { ok: false, error: 'Pedido sem itens.' };

    const dcNumber = generateDcNumber(invoiceId);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = margin;

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('DECLARAÇÃO DE CONTEÚDO', pageW / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nº interno: ${dcNumber}`, pageW / 2, y, { align: 'center' });
    y += 4;
    doc.text(`Emitida em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, pageW / 2, y, { align: 'center' });
    y += 8;

    // Remetente
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('REMETENTE', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const remNome = s.razao_social || s.nome_fantasia || '(sem razão social)';
    doc.text(`Razão Social: ${remNome}`, margin, y); y += 4;
    doc.text(`CNPJ: ${formatCpfCnpj(s.cnpj || '')}`, margin, y); y += 4;
    const remEnd = [
      s.endereco_logradouro, s.endereco_numero ? `nº ${s.endereco_numero}` : null,
      s.endereco_complemento, s.endereco_bairro,
    ].filter(Boolean).join(', ');
    doc.text(`Endereço: ${remEnd || '-'}`, margin, y); y += 4;
    doc.text(`Município/UF: ${s.endereco_municipio || '-'} / ${s.endereco_uf || '-'}   CEP: ${formatCep(s.endereco_cep || '')}`, margin, y); y += 4;
    if (s.telefone) { doc.text(`Telefone: ${s.telefone}`, margin, y); y += 4; }
    if (s.email) { doc.text(`E-mail: ${s.email}`, margin, y); y += 4; }
    y += 4;

    // Destinatário
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DESTINATÁRIO', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nome: ${i.dest_nome}`, margin, y); y += 4;
    doc.text(`CPF/CNPJ: ${formatCpfCnpj(i.dest_cpf_cnpj)}`, margin, y); y += 4;
    const destEnd = [
      i.dest_endereco_logradouro, i.dest_endereco_numero ? `nº ${i.dest_endereco_numero}` : null,
      i.dest_endereco_complemento, i.dest_endereco_bairro,
    ].filter(Boolean).join(', ');
    doc.text(`Endereço: ${destEnd || '-'}`, margin, y); y += 4;
    doc.text(`Município/UF: ${i.dest_endereco_municipio || '-'} / ${i.dest_endereco_uf || '-'}   CEP: ${formatCep(i.dest_endereco_cep || '')}`, margin, y); y += 4;
    if (i.dest_telefone) { doc.text(`Telefone: ${i.dest_telefone}`, margin, y); y += 4; }
    y += 4;

    // Itens
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CONTEÚDO DECLARADO', margin, y);
    y += 6;

    // Tabela manual
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    const colX = { desc: margin, qtd: 120, vu: 145, total: 175 };
    doc.text('Descrição', colX.desc, y);
    doc.text('Qtd', colX.qtd, y, { align: 'right' });
    doc.text('Valor Un.', colX.vu, y, { align: 'right' });
    doc.text('Total', colX.total, y, { align: 'right' });
    y += 2;
    doc.line(margin, y, pageW - margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');

    let totalGeral = 0;
    for (const it of items) {
      const subt = (it.quantidade || 0) * (it.valor_unitario || 0);
      totalGeral += subt;
      const desc = (it.descricao || '').slice(0, 60);
      if (y > 250) {
        doc.addPage();
        y = margin;
      }
      doc.text(desc, colX.desc, y);
      doc.text(String(it.quantidade || 0), colX.qtd, y, { align: 'right' });
      doc.text(formatCurrency(it.valor_unitario || 0), colX.vu, y, { align: 'right' });
      doc.text(formatCurrency(subt), colX.total, y, { align: 'right' });
      y += 5;
    }
    y += 2;
    doc.line(margin, y, pageW - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Valor total declarado: ${formatCurrency(totalGeral)}`, pageW - margin, y, { align: 'right' });
    y += 10;

    // Aviso obrigatório
    if (y > 240) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const aviso = 'Declaração de Conteúdo não substitui Nota Fiscal quando a emissão de NF-e for obrigatória.';
    const linhas = doc.splitTextToSize(aviso, pageW - margin * 2);
    doc.text(linhas, margin, y);
    y += linhas.length * 4 + 10;

    // Assinatura
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Assinatura do Remetente: ____________________________________________', margin, y);
    y += 8;
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, margin, y);

    const filename = `${dcNumber}_${(i.dest_nome || 'destinatario').replace(/[^a-z0-9]/gi, '_').slice(0, 30)}.pdf`;
    doc.save(filename);

    return { ok: true, dcNumber };
  } catch (e: any) {
    console.error('[generateDeclaracaoConteudoPdf]', e);
    return { ok: false, error: e?.message || 'Erro ao gerar PDF' };
  }
}
