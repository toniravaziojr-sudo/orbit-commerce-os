import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, Loader2, Printer, ArrowDownLeft, Hash, Search, Download, Send, X, Trash2, Mail, RotateCcw, Truck, Receipt } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFiscalStats, useFiscalInvoices, useFiscalSettings, useCheckInvoiceStatus, useFiscalRealtime, type FiscalInvoice } from '@/hooks/useFiscal';
import { FiscalAlertsCard } from '@/components/fiscal/FiscalAlertsCard';
import { ManualInvoiceDialog, type ManualInvoiceInitialData } from '@/components/fiscal/ManualInvoiceDialog';
import { InvoiceEditor, type InvoiceData } from '@/components/fiscal/InvoiceEditor';
import { CancelInvoiceDialog } from '@/components/fiscal/CancelInvoiceDialog';
import { InvoiceActionsDropdown } from '@/components/fiscal/InvoiceActionsDropdown';
import { FiscalErrorResolver, parseErrorMessage } from '@/components/fiscal/FiscalErrorResolver';
import { CorrectInvoiceDialog } from '@/components/fiscal/CorrectInvoiceDialog';
import { InutilizarNumerosDialog } from '@/components/fiscal/InutilizarNumerosDialog';
import { EntryInvoiceDialog } from '@/components/fiscal/EntryInvoiceDialog';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import { ExportInvoicesButton } from '@/components/fiscal/ExportInvoicesButton';
import { InvoiceTimeline } from '@/components/fiscal/InvoiceTimeline';
import { ConsultaChaveDialog } from '@/components/fiscal/ConsultaChaveDialog';
import { MarketplaceSourceFilter } from '@/components/fiscal/MarketplaceSourceFilter';
import { OrderSourceBadge } from '@/components/orders/OrderSourceBadge';
import { FiscalStatusFilter, orderStatusOptions, invoiceStatusOptions } from '@/components/fiscal/FiscalStatusFilter';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';
import { useAuth } from '@/hooks/useAuth';
import { issueAndDownloadCorreiosContentDeclarationsBatch } from '@/lib/declaracaoConteudo';
import { CorreiosContentDeclarationDialog, type DcDialogTarget } from '@/components/fiscal/CorreiosContentDeclarationDialog';

import { formatDateTimeBR } from "@/lib/date-format";

// Cores explícitas por status fiscal/etapa operacional, conforme regra de negócio aprovada:
// - Pronta para Emitir: laranja
// - Pendência Identificada: amarelo
// - Processando SEFAZ / Aguardando protocolo: amarelo
// - Autorizada: azul
// - Cancelada / Rejeitada / Erro: vermelho
// - Badge auxiliar "Impressa" (verde) é renderizado SEPARADAMENTE quando a DANFE foi impressa.
const COLOR = {
  orange: 'bg-orange-500/15 text-orange-700 border border-orange-500/30 dark:text-orange-300',
  yellow: 'bg-yellow-500/15 text-yellow-800 border border-yellow-500/30 dark:text-yellow-300',
  blue: 'bg-blue-500/15 text-blue-700 border border-blue-500/30 dark:text-blue-300',
  green: 'bg-green-500/15 text-green-700 border border-green-500/30 dark:text-green-300',
  red: 'bg-red-500/15 text-red-700 border border-red-500/30 dark:text-red-300',
  gray: 'bg-muted text-muted-foreground border border-border',
} as const;

const statusConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft: { label: 'Rascunho', className: COLOR.gray, icon: FileText },
  pending: { label: 'Aguardando protocolo', className: COLOR.yellow, icon: Clock },
  processing: { label: 'Processando SEFAZ', className: COLOR.yellow, icon: Clock },
  authorized: { label: 'Autorizada', className: COLOR.blue, icon: CheckCircle },
  rejected: { label: 'Rejeitada', className: COLOR.red, icon: XCircle },
  cancelled: { label: 'Cancelada', className: COLOR.red, icon: XCircle },
  error: { label: 'Erro', className: COLOR.red, icon: XCircle },
};

// Badge da etapa operacional (fiscal_stage). Independente do status fiscal oficial.
const stageConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pedido_venda: { label: 'Pedido de Venda', className: COLOR.gray, icon: FileText },
  pronta_emitir: { label: 'Pronta para Emitir', className: COLOR.orange, icon: CheckCircle },
  pendencia: { label: 'Pendência Identificada', className: COLOR.yellow, icon: AlertTriangle },
  emitida: { label: 'Emitida', className: COLOR.blue, icon: Send },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDocument(doc: string) {
  if (!doc) return '-';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
}

interface FiscalInvoiceListProps {
  mode: 'orders' | 'invoices';
}

export function FiscalInvoiceList({ mode }: FiscalInvoiceListProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; data: ManualInvoiceInitialData | null; kind: 'pedido' | 'nf' }>({ open: false, data: null, kind: 'pedido' });
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [editingInvoiceError, setEditingInvoiceError] = useState<string | null>(null);
  const [editingInvoiceStatus, setEditingInvoiceStatus] = useState<string | null>(null);
  const [editingInvoiceStage, setEditingInvoiceStage] = useState<string | null>(null);
  const [preparingInvoiceId, setPreparingInvoiceId] = useState<string | null>(null);
  const [submittingInvoiceId, setSubmittingInvoiceId] = useState<string | null>(null);
  const [cancelingInvoice, setCancelingInvoice] = useState<FiscalInvoice | null>(null);
  const [correctingInvoice, setCorrectingInvoice] = useState<FiscalInvoice | null>(null);
  const [inutilizarDialogOpen, setInutilizarDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryDialogChaveAcesso, setEntryDialogChaveAcesso] = useState<string | undefined>();
  const [consultaChaveOpen, setConsultaChaveOpen] = useState(false);
  const [timelineInvoice, setTimelineInvoice] = useState<FiscalInvoice | null>(null);
  const [errorResolverOpen, setErrorResolverOpen] = useState(false);
  const [currentErrors, setCurrentErrors] = useState<any[]>([]);
  const [currentErrorInvoiceId, setCurrentErrorInvoiceId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [marketplaceSource, setMarketplaceSource] = useState<string>('all');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [confirmEmitInvoice, setConfirmEmitInvoice] = useState<FiscalInvoice | null>(null);
  const [emitPrecheckErrors, setEmitPrecheckErrors] = useState<string[]>([]);
  const [generatingDcInvoiceId, setGeneratingDcInvoiceId] = useState<string | null>(null);
  const [isBulkGeneratingDc, setIsBulkGeneratingDc] = useState(false);
  
  const { settings, isLoading: settingsLoading } = useFiscalSettings();
  const { data: stats, isLoading: statsLoading } = useFiscalStats();
  const { data: invoices, isLoading: invoicesLoading, refetch } = useFiscalInvoices({ 
    marketplaceSource: marketplaceSource !== 'all' ? marketplaceSource : undefined,
  });
  const checkStatus = useCheckInvoiceStatus();
  useFiscalRealtime();

  const isLoading = settingsLoading || statsLoading || invoicesLoading;
  const isConfigured = settings?.is_configured;

  // Separate invoices by mode usando fiscal_stage (etapa operacional, não status fiscal).
  // Pedidos de Venda = somente registros em 'pedido_venda'.
  // Notas Fiscais = 'pronta_emitir' | 'pendencia' | 'emitida'.
  // Fallback para registros antigos sem fiscal_stage: trata draft como pedido_venda.
  const modeFilteredInvoices = invoices?.filter(inv => {
    const stage = (inv as any).fiscal_stage || (inv.status === 'draft' ? 'pedido_venda' : 'emitida');
    if (mode === 'orders') return stage === 'pedido_venda';
    return stage === 'pronta_emitir' || stage === 'pendencia' || stage === 'emitida';
  });

  // Apply status filter
  const statusFilteredInvoices = modeFilteredInvoices?.filter(inv => {
    if (statusFilter.length === 0) return true;

    if (mode === 'orders') {
      // Filter by order context status
      const isChargeback = inv.order_status && ['chargeback_detected', 'chargeback_lost'].includes(inv.order_status);
      const isCancelled = inv.order_status && ['cancelled', 'canceled'].includes(inv.order_status);
      
      if (statusFilter.includes('chargeback') && isChargeback) return true;
      if (statusFilter.includes('cancelled') && isCancelled) return true;
      if (statusFilter.includes('ready') && !isChargeback && !isCancelled) return true;
      return false;
    } else {
      // Filter by invoice status
      if (statusFilter.includes('printed') && inv.status === 'authorized' && (inv as any).danfe_printed_at) return true;
      if (statusFilter.includes('authorized') && inv.status === 'authorized' && !(inv as any).danfe_printed_at) return true;
      if (statusFilter.includes('pending') && inv.status === 'pending') return true;
      if (statusFilter.includes('rejected') && inv.status === 'rejected') return true;
      if (statusFilter.includes('canceled') && inv.status === 'cancelled') return true;
      if (statusFilter.includes('devolvido') && (inv as any).nfe_referenciada) return true;
      return false;
    }
  });

  // Apply search and date filters
  const filteredInvoices = statusFilteredInvoices?.filter(inv => {
    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        inv.numero.toString().includes(search) ||
        inv.dest_nome.toLowerCase().includes(search) ||
        inv.dest_cpf_cnpj.replace(/\D/g, '').includes(search.replace(/\D/g, '')) ||
        inv.chave_acesso?.toLowerCase().includes(search) ||
        inv.order_id?.toLowerCase().includes(search) ||
        (inv as any).dest_email?.toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Date filters
    if (startDate) {
      const invDate = new Date(inv.created_at);
      if (invDate < startDate) return false;
    }
    if (endDate) {
      const invDate = new Date(inv.created_at);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (invDate > endOfDay) return false;
    }

    return true;
  });

  // Helper para resolver stage com fallback (backfill já cobre todos os registros existentes,
  // mas mantemos compat para qualquer insert antigo que não tenha setado o campo).
  const stageOf = (inv: any) => inv.fiscal_stage || (inv.status === 'draft' ? 'pedido_venda' : 'emitida');

  // Contadores baseados em fiscal_stage (etapa operacional) + status fiscal oficial.
  const counts = {
    orders: invoices?.filter(i => stageOf(i) === 'pedido_venda').length || 0,
    pronta_emitir: invoices?.filter(i => stageOf(i) === 'pronta_emitir').length || 0,
    pendencia: invoices?.filter(i => stageOf(i) === 'pendencia').length || 0,
    processing: invoices?.filter(i => stageOf(i) === 'emitida' && (i.status === 'pending' || (i.status as any) === 'processing')).length || 0,
    authorized: invoices?.filter(i => i.status === 'authorized' && !(i as any).danfe_printed_at).length || 0,
    printed: invoices?.filter(i => i.status === 'authorized' && (i as any).danfe_printed_at).length || 0,
    pending: invoices?.filter(i => i.status === 'pending').length || 0,
    rejected: invoices?.filter(i => i.status === 'rejected').length || 0,
    canceled: invoices?.filter(i => i.status === 'cancelled').length || 0,
    devolvido: invoices?.filter(i => stageOf(i) === 'emitida' && (i as any).nfe_referenciada).length || 0,
  };

  const handleCheckStatus = async (invoiceId: string) => {
    await checkStatus.mutateAsync(invoiceId);
    refetch();
  };

  const handleEditInvoice = async (invoice: FiscalInvoice) => {
    const { data, error } = await supabase
      .from('fiscal_invoices')
      .select('*, fiscal_invoice_items(*)')
      .eq('id', invoice.id)
      .single();

    if (error || !data) {
      toast.error('Erro ao carregar dados da NF-e');
      return;
    }

    const invoiceData: InvoiceData = {
      id: data.id,
      order_id: data.order_id || undefined,
      numero: data.numero,
      serie: data.serie,
      data_emissao: data.created_at,
      natureza_operacao: data.natureza_operacao,
      cfop: data.cfop || '',
      observacoes: data.observacoes || undefined,
      indicador_presenca: (data as any).indicador_presenca ?? 2,
      informacoes_fisco: (data as any).informacoes_fisco || undefined,
      dest_nome: data.dest_nome,
      dest_cpf_cnpj: data.dest_cpf_cnpj,
      dest_ie: data.dest_inscricao_estadual || undefined,
      dest_tipo_pessoa: data.dest_cpf_cnpj?.replace(/\D/g, '').length === 11 ? 'fisica' : 'juridica',
      dest_consumidor_final: true,
      indicador_ie_dest: (data as any).indicador_ie_dest ?? 9,
      dest_endereco_logradouro: data.dest_endereco_logradouro || '',
      dest_endereco_numero: data.dest_endereco_numero || 'S/N',
      dest_endereco_complemento: data.dest_endereco_complemento || undefined,
      dest_endereco_bairro: data.dest_endereco_bairro || '',
      dest_endereco_municipio: data.dest_endereco_municipio || '',
      dest_endereco_municipio_codigo: data.dest_endereco_municipio_codigo || '',
      dest_endereco_uf: data.dest_endereco_uf || '',
      dest_endereco_cep: data.dest_endereco_cep || '',
      dest_telefone: (data as any).dest_telefone || undefined,
      dest_email: (data as any).dest_email || undefined,
      valor_produtos: data.valor_produtos || 0,
      valor_frete: data.valor_frete || 0,
      valor_seguro: (data as any).valor_seguro || 0,
      valor_outras_despesas: (data as any).valor_outras_despesas || 0,
      valor_desconto: data.valor_desconto || 0,
      valor_total: data.valor_total || 0,
      valor_bc_icms: (data as any).valor_bc_icms || 0,
      valor_icms: (data as any).valor_icms || 0,
      valor_pis: (data as any).valor_pis || 0,
      valor_cofins: (data as any).valor_cofins || 0,
      modalidade_frete: (data as any).modalidade_frete || '9',
      transportadora_nome: (data as any).transportadora_nome || undefined,
      transportadora_cnpj: (data as any).transportadora_cnpj || undefined,
      peso_bruto: (data as any).peso_bruto || undefined,
      peso_liquido: (data as any).peso_liquido || undefined,
      quantidade_volumes: (data as any).quantidade_volumes || undefined,
      especie_volumes: (data as any).especie_volumes || undefined,
      pagamento_indicador: (data as any).pagamento_indicador ?? 0,
      pagamento_meio: (data as any).pagamento_meio || '99',
      pagamento_valor: (data as any).pagamento_valor || data.valor_total || 0,
      items: (data.fiscal_invoice_items || []).map((item: any) => ({
        id: item.id,
        numero_item: item.numero_item,
        product_id: item.product_id,
        codigo_produto: item.codigo_produto,
        descricao: item.descricao,
        ncm: item.ncm,
        cfop: item.cfop,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        origem: String(item.origem || 0),
        csosn: item.csosn,
        gtin: item.gtin || '',
        gtin_tributavel: item.gtin_tributavel || '',
        cest: item.cest || '',
        valor_desconto: item.valor_desconto || 0,
        icms_base: item.icms_base || 0,
        icms_aliquota: item.icms_aliquota || 0,
        icms_valor: item.icms_valor || 0,
        pis_cst: item.pis_cst || '49',
        pis_base: item.pis_base || 0,
        pis_aliquota: item.pis_aliquota || 0,
        pis_valor: item.pis_valor || 0,
        cofins_cst: item.cofins_cst || '49',
        cofins_base: item.cofins_base || 0,
        cofins_aliquota: item.cofins_aliquota || 0,
        cofins_valor: item.cofins_valor || 0,
      })),
    };

    setEditingInvoice(invoiceData);
    setEditingInvoiceError(data.status_motivo || (Array.isArray((data as any).pendencia_motivos) ? (data as any).pendencia_motivos.join(' • ') : null));
    setEditingInvoiceStatus(data.status || null);
    setEditingInvoiceStage((data as any).fiscal_stage || null);
  };

  const handleSaveInvoice = async (data: InvoiceData) => {
    const { error } = await supabase.functions.invoke('fiscal-update-draft', {
      body: { invoice_id: data.id, data },
    });

    if (error) throw error;

    // Se o registro está em pendência ou pronta_emitir (aba Notas Fiscais),
    // revalidar automaticamente após salvar para atualizar o stage.
    if (editingInvoiceStage === 'pendencia' || editingInvoiceStage === 'pronta_emitir') {
      try {
        const { data: prep } = await supabase.functions.invoke('fiscal-prepare-invoice', {
          body: { invoice_id: data.id },
        });
        if (prep?.success) {
          if (prep.fiscal_stage === 'pronta_emitir') {
            toast.success('Pendências resolvidas. NF está Pronta para Emitir.');
          } else if (prep.fiscal_stage === 'pendencia') {
            toast.warning(`Ainda há ${prep.errors?.length || 0} pendência(s).`);
          }
        }
      } catch (e) {
        console.warn('[handleSaveInvoice] re-prepare falhou', e);
      }
    }
    refetch();
  };

  const handleSubmitInvoice = async (data: InvoiceData) => {
    await handleSaveInvoice(data);
    
    const { error } = await supabase.functions.invoke('fiscal-submit', {
      body: { invoice_id: data.id },
    });

    if (error) throw error;
    toast.success('NF-e enviada para autorização');
    refetch();
  };

  // Cria a Nota Fiscal a partir de um Pedido de Venda: valida localmente e move
  // o registro para a aba Notas Fiscais (Pronta para Emitir ou Pendência).
  // NÃO transmite à SEFAZ. NÃO chama Focus.
  const handlePrepareInvoice = async (invoice: FiscalInvoice) => {
    setPreparingInvoiceId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-prepare-invoice', {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || 'Não foi possível criar a Nota Fiscal');
        return;
      }
      if (data.fiscal_stage === 'pronta_emitir') {
        toast.success('Nota Fiscal criada. Disponível em Notas Fiscais como Pronta para Emitir.');
      } else {
        toast.warning(`Nota Fiscal criada com ${data.errors?.length || 0} pendência(s). Verifique em Notas Fiscais.`);
      }
      refetch();
      // Após criar NF a partir de Pedido de Venda, levar o usuário direto à aba Notas Fiscais.
      if (mode === 'orders') {
        navigate('/fiscal?tab=notas');
      }
    } catch (e: any) {
      showErrorToast(e, { module: 'fiscal', action: 'criar nota fiscal' });
    } finally {
      setPreparingInvoiceId(null);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!editingInvoice?.id) return;
    
    const { error } = await supabase
      .from('fiscal_invoices')
      .delete()
      .eq('id', editingInvoice.id)
      .eq('status', 'draft');

    if (error) throw error;
    setEditingInvoice(null);
    refetch();
  };

  const handlePrintDanfe = async (invoice: FiscalInvoice) => {
    if (!invoice.danfe_url) {
      toast.error('DANFE não disponível para impressão');
      return;
    }

    try {
      const printWindow = window.open(invoice.danfe_url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
      
      const { error } = await supabase
        .from('fiscal_invoices')
        .update({ 
          danfe_printed_at: new Date().toISOString(),
          printed_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) {
        console.error('Error marking as printed:', error);
      } else {
        toast.success('DANFE enviada para impressão');
        refetch();
      }
    } catch (error) {
      console.error('Error printing DANFE:', error);
    }
  };

  // Duplicação segura — abre diálogo pré-preenchido. O usuário revisa e salva.
  // O salvar cria SEMPRE um rascunho novo e independente:
  //   - sem vínculo com order_id original (não toca estoque/financeiro/remessa/e-mail/automação)
  //   - sem chave/XML/DANFE/protocolo/focus_ref/status terminal
  //   - número novo gerado pelo cursor fiscal (nunca reaproveita número autorizado)
  //   - não chama Focus/Sefaz, não emite, não transmite
  const handleCloneInvoice = async (
    invoice: FiscalInvoice,
    kind: 'pedido' | 'nf' = 'nf'
  ) => {
    try {
      const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*, fiscal_invoice_items(*)')
        .eq('id', invoice.id)
        .single();

      if (error || !data) {
        toast.error('Erro ao carregar dados para duplicação');
        return;
      }

      const items = (data.fiscal_invoice_items || []) as any[];
      if (items.length === 0) {
        toast.error('Não há itens para duplicar');
        return;
      }

      const obsBase = data.observacoes ? `${data.observacoes}\n\n` : '';
      const obsMarca = `Duplicado de ${kind === 'pedido' ? 'pedido de venda' : 'NF'} ${data.serie}-${data.numero}.`;

      // Snapshot financeiro original
      const subtotalItens = items.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0), 0);
      const totalOriginal = Number((data as any).valor_total) || 0;
      const descontoOriginal = Number((data as any).valor_desconto) || 0;
      const freteOriginal = Number((data as any).valor_frete) || 0;
      const seguroOriginal = Number((data as any).valor_seguro) || 0;
      const outrasOriginal = Number((data as any).valor_outras_despesas) || 0;

      // Regra de inferência: preservar total final original mesmo em pedidos antigos sem desconto/ajustes estruturados.
      // total = subtotal - desconto + frete + seguro + outras  =>  diff = subtotal + frete + seguro + outras - desconto - total
      const diff = +(subtotalItens + freteOriginal + seguroOriginal + outrasOriginal - descontoOriginal - totalOriginal).toFixed(2);
      let descontoFinal = descontoOriginal;
      let outrasFinal = outrasOriginal;
      if (Math.abs(diff) > 0.01) {
        if (diff > 0) {
          // Falta desconto para chegar ao total original (subtotal+ajustes > total)
          descontoFinal = +(descontoOriginal + diff).toFixed(2);
        } else {
          // Falta despesa para chegar ao total original (subtotal+ajustes < total)
          outrasFinal = +(outrasOriginal + Math.abs(diff)).toFixed(2);
        }
      }

      const initialData: ManualInvoiceInitialData = {
        natureza_operacao: data.natureza_operacao,
        observacoes: `${obsBase}${obsMarca}`,
        destinatario: {
          nome: data.dest_nome,
          cpf_cnpj: data.dest_cpf_cnpj,
          email: (data as any).dest_email || undefined,
          telefone: (data as any).dest_telefone || undefined,
          endereco: {
            logradouro: data.dest_endereco_logradouro || '',
            numero: data.dest_endereco_numero || 'S/N',
            complemento: data.dest_endereco_complemento || undefined,
            bairro: data.dest_endereco_bairro || '',
            municipio: data.dest_endereco_municipio || '',
            uf: data.dest_endereco_uf || '',
            cep: data.dest_endereco_cep || '',
          },
        },
        // Snapshot do pedido — preço unitário, qtd, descontos por linha NÃO são buscados do catálogo atual.
        itens: items.map((item) => ({
          codigo: item.codigo_produto || '',
          descricao: item.descricao,
          unidade: item.unidade || 'UN',
          quantidade: Number(item.quantidade) || 1,
          valor_unitario: Number(item.valor_unitario) || 0,
          ncm: item.ncm || '',
          cfop: item.cfop || '5102',
          origem: String(item.origem ?? '0'),
          csosn: item.csosn || '102',
          valor_desconto: Number(item.valor_desconto) || 0,
          valor_frete: Number(item.valor_frete) || 0,
          gtin: item.gtin || '',
          gtin_tributavel: item.gtin_tributavel || item.gtin || '',
          cest: item.cest || '',
        })),
        // Totais e ajustes preservados (com inferência quando faltar campo estruturado)
        valor_desconto: descontoFinal,
        valor_frete: freteOriginal,
        valor_seguro: seguroOriginal,
        valor_outras_despesas: outrasFinal,
        modalidade_frete: (data as any).modalidade_frete || '9',
        transportadora_nome: (data as any).transportadora_nome || undefined,
        transportadora_cnpj: (data as any).transportadora_cnpj || undefined,
        peso_bruto: (data as any).peso_bruto != null ? Number((data as any).peso_bruto) : undefined,
        peso_liquido: (data as any).peso_liquido != null ? Number((data as any).peso_liquido) : undefined,
        quantidade_volumes: (data as any).quantidade_volumes != null ? Number((data as any).quantidade_volumes) : undefined,
        pagamento_meio: (data as any).pagamento_meio || undefined,
        informacoes_fisco: (data as any).informacoes_fisco || undefined,
      };

      setDuplicateDialog({ open: true, data: initialData, kind });
    } catch (error: any) {
      console.error('[handleCloneInvoice] error:', error);
      showErrorToast(error, { module: 'fiscal', action: 'duplicar' });
    }
  };

  // Pré-check fiscal antes de permitir abrir o modal de confirmação de emissão.
  // Não chama Focus/Sefaz. Apenas valida dados visíveis localmente.
  const runEmitPrecheck = (invoice: FiscalInvoice): string[] => {
    const errors: string[] = [];
    if (!settings?.is_configured) errors.push('Configuração fiscal incompleta. Conclua em Fiscal → Configurações.');
    // Comparar SEMPRE pelos dígitos, pois um lado pode estar formatado e o outro não.
    // Antes da correção, comparávamos as strings cruas (formatada vs normalizada),
    // gerando "CNPJ não confere" mesmo quando os documentos eram idênticos.
    const certCnpjDigits = String((settings as any)?.certificado_cnpj || '').replace(/\D/g, '');
    const emitCnpjDigits = String((settings as any)?.cnpj || '').replace(/\D/g, '');
    if (certCnpjDigits && emitCnpjDigits && certCnpjDigits !== emitCnpjDigits) {
      errors.push('CNPJ do certificado não confere com o CNPJ do emitente.');
    }
    const doc = (invoice.dest_cpf_cnpj || '').replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) errors.push('CPF/CNPJ do destinatário inválido.');
    if (!invoice.dest_nome) errors.push('Nome do destinatário ausente.');
    if (!invoice.dest_endereco_logradouro || !invoice.dest_endereco_municipio || !invoice.dest_endereco_uf) {
      errors.push('Endereço do destinatário incompleto.');
    }
    if (!invoice.dest_endereco_cep || invoice.dest_endereco_cep.replace(/\D/g, '').length !== 8) {
      errors.push('CEP do destinatário inválido.');
    }
    if (!invoice.valor_total || Number(invoice.valor_total) <= 0) errors.push('Valor total inválido.');
    if (invoice.chave_acesso) errors.push('Esta NF já possui chave de acesso emitida.');
    return errors;
  };

  // Roteia a ação principal do dropdown conforme aba/etapa:
  // - Pedidos de Venda → Criar Nota Fiscal (valida, não transmite)
  // - Notas Fiscais (pronta_emitir) → confirmar e enviar à Receita
  // - Notas Fiscais (pendencia) → orientar a editar
  const requestEmitInvoice = (invoice: FiscalInvoice) => {
    const stage = (invoice as any).fiscal_stage || (invoice.status === 'draft' ? 'pedido_venda' : 'emitida');
    if (mode === 'orders' || stage === 'pedido_venda') {
      handlePrepareInvoice(invoice);
      return;
    }
    if (stage === 'pendencia') {
      toast.warning('Esta NF tem pendências. Edite os dados para revalidar antes de enviar à Receita.');
      handleEditInvoice(invoice);
      return;
    }
    if (stage !== 'pronta_emitir') {
      toast.error('Esta NF não está pronta para envio à Receita.');
      return;
    }
    if (invoice.status !== 'draft') {
      toast.error('Apenas rascunhos prontos podem ser enviados.');
      return;
    }
    const errors = runEmitPrecheck(invoice);
    setEmitPrecheckErrors(errors);
    setConfirmEmitInvoice(invoice);
  };

  const handleQuickSubmit = async (invoice: FiscalInvoice) => {
    setSubmittingInvoiceId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-submit', {
        body: { invoice_id: invoice.id },
      });

      if (error) {
        console.error('[handleQuickSubmit] Infrastructure error:', error);
        const errors = parseErrorMessage(error.message || 'Erro de conexão com o servidor');
        setCurrentErrors(errors);
        setCurrentErrorInvoiceId(invoice.id);
        setErrorResolverOpen(true);
        return;
      }
      
      if (!data?.success) {
        console.log('[handleQuickSubmit] Business error:', data?.error);
        const errors = parseErrorMessage(data?.error || 'Erro desconhecido');
        setCurrentErrors(errors);
        setCurrentErrorInvoiceId(invoice.id);
        setErrorResolverOpen(true);
        return;
      }
      
      toast.success('NF-e enviada para autorização');
      refetch();
    } catch (error: any) {
      console.error('[handleQuickSubmit] Unexpected error:', error);
      const errors = parseErrorMessage(error?.message || 'Erro desconhecido');
      setCurrentErrors(errors);
      setCurrentErrorInvoiceId(invoice.id);
      setErrorResolverOpen(true);
    } finally {
      setSubmittingInvoiceId(null);
    }
  };

  const handleRetrySubmit = () => {
    setErrorResolverOpen(false);
    if (currentErrorInvoiceId) {
      const invoice = invoices?.find(i => i.id === currentErrorInvoiceId);
      if (invoice) {
        handleQuickSubmit(invoice);
      }
    }
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (!filteredInvoices) return;
    if (selectedInvoices.size === filteredInvoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)));
    }
  };

  const handleSelectInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const clearSelection = () => {
    setSelectedInvoices(new Set());
  };

  // Bulk action principal:
  // - Em Pedidos de Venda → cria N Notas Fiscais (valida, não transmite)
  // - Em Notas Fiscais → envia à Receita as que estão Pronta para Emitir
  const handleBulkSubmit = async () => {
    const selected = (filteredInvoices || []).filter(inv => selectedInvoices.has(inv.id));
    if (selected.length === 0) return;

    setIsBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;
    const isOrders = mode === 'orders';

    const targets = isOrders
      ? selected.filter(i => stageOf(i) === 'pedido_venda')
      : selected.filter(i => stageOf(i) === 'pronta_emitir' && i.status === 'draft');

    if (targets.length === 0) {
      setIsBulkProcessing(false);
      toast.error(isOrders
        ? 'Nenhum pedido elegível para criar Nota Fiscal.'
        : 'Nenhuma NF Pronta para Emitir foi selecionada.');
      return;
    }

    for (const invoice of targets) {
      try {
        const fnName = isOrders ? 'fiscal-prepare-invoice' : 'fiscal-submit';
        const { data, error } = await supabase.functions.invoke(fnName, {
          body: { invoice_id: invoice.id },
        });
        if (error || !data?.success) errorCount++;
        else successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsBulkProcessing(false);
    clearSelection();
    refetch();

    // Resumo único: evita o "sucesso falso" quando havia falhas no lote.
    const total = targets.length;
    if (successCount === total) {
      toast.success(isOrders
        ? `${successCount} Nota(s) Fiscal(is) criada(s) com sucesso.`
        : `${successCount} NF-e(s) emitida(s) com sucesso.`);
    } else if (successCount > 0) {
      toast.warning(isOrders
        ? `${successCount} de ${total} criada(s). ${errorCount} com erro — verifique em Notas Fiscais.`
        : `${successCount} de ${total} emitida(s). ${errorCount} com erro — verifique cada NF.`);
    } else {
      toast.error(isOrders
        ? `Nenhuma Nota Fiscal foi criada. ${errorCount} erro(s).`
        : `Nenhuma NF-e foi emitida. ${errorCount} erro(s).`);
    }

    // Após criar NFs em lote a partir de Pedidos de Venda, redireciona para Notas Fiscais.
    if (isOrders && successCount > 0) {
      navigate('/fiscal?tab=notas');
    }
  };

  const handleBulkPrint = async () => {
    const authorized = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.status === 'authorized' && inv.danfe_url
    );
    
    if (authorized.length === 0) {
      toast.error('Nenhuma NF-e autorizada com DANFE disponível');
      return;
    }

    authorized.forEach((invoice, index) => {
      setTimeout(() => {
        window.open(invoice.danfe_url, '_blank');
      }, index * 300);
    });

    const ids = authorized.map(inv => inv.id);
    await supabase
      .from('fiscal_invoices')
      .update({ 
        danfe_printed_at: new Date().toISOString(),
        printed_at: new Date().toISOString()
      })
      .in('id', ids);

    clearSelection();
    refetch();
    toast.success(`${authorized.length} DANFE(s) abertas para impressão`);
  };

  const handleBulkDownloadXml = async () => {
    const authorized = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.status === 'authorized' && (inv.xml_url || inv.xml_autorizado)
    );
    
    if (authorized.length === 0) {
      toast.error('Nenhuma NF-e autorizada com XML disponível');
      return;
    }

    authorized.forEach((invoice, index) => {
      setTimeout(() => {
        const xmlUrl = invoice.xml_url || invoice.xml_autorizado;
        if (!xmlUrl) return;
        
        const link = document.createElement('a');
        link.href = xmlUrl;
        link.download = `nfe_${invoice.serie}_${invoice.numero}.xml`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 300);
    });

    toast.success(`Baixando ${authorized.length} XML(s)`);
    clearSelection();
  };

  // Bulk resend email
  const handleBulkResendEmail = async () => {
    const authorized = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.status === 'authorized'
    );
    
    if (authorized.length === 0) {
      toast.error('Nenhuma NF-e autorizada selecionada');
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const invoice of authorized) {
      try {
        const { error } = await supabase.functions.invoke('fiscal-send-nfe-email', {
          body: { invoice_id: invoice.id, tenant_id: invoice.tenant_id },
        });
        if (error) { errorCount++; } else { successCount++; }
      } catch {
        errorCount++;
      }
    }

    setIsBulkProcessing(false);
    clearSelection();

    if (successCount > 0) toast.success(`${successCount} email(s) reenviado(s)`);
    if (errorCount > 0) toast.error(`${errorCount} email(s) com erro no reenvio`);
  };

  // Individual: Emitir Devolução (opens EntryInvoiceDialog pre-filled)
  const handleEmitirDevolucao = (invoice: FiscalInvoice) => {
    if (invoice.chave_acesso) {
      setEntryDialogChaveAcesso(invoice.chave_acesso);
      setEntryDialogOpen(true);
    } else {
      toast.error('NF-e sem chave de acesso');
    }
  };

  // Create a new empty invoice draft and open the editor
  const handleCreateNewInvoice = async () => {
    setIsCreatingInvoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-create-manual', {
        body: {
          natureza_operacao: 'VENDA DE MERCADORIA',
          destinatario: {
            nome: 'CONSUMIDOR',
            cpf_cnpj: '',
            endereco: { logradouro: '', numero: 'S/N', bairro: '', municipio: '', uf: '', cep: '' },
          },
          itens: [{
            numero_item: 1,
            codigo: '',
            descricao: 'PRODUTO',
            ncm: '00000000',
            cfop: '5102',
            unidade: 'UN',
            quantidade: 1,
            valor_unitario: 0,
            origem: '0',
            csosn: '102',
          }],
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar NF-e');

      // Open the full editor with the new draft
      const invoice = data.invoice;
      if (invoice) {
        await handleEditInvoice(invoice);
      }
      refetch();
    } catch (error: any) {
      showErrorToast(error, { module: 'fiscal', action: 'criar NF-e' });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // Individual: Reenviar por Email
  const handleResendEmail = async (invoice: FiscalInvoice) => {
    try {
      const { error } = await supabase.functions.invoke('fiscal-send-nfe-email', {
        body: { invoice_id: invoice.id, tenant_id: invoice.tenant_id },
      });
      if (error) throw error;
      toast.success('Email reenviado com sucesso');
    } catch (error: any) {
      showErrorToast(error, { module: 'fiscal', action: 'reenviar email' });
    }
  };

  // Delete single draft
  const handleDeleteDraft = async (invoice: FiscalInvoice) => {
    if (invoice.status !== 'draft') {
      toast.error('Apenas rascunhos podem ser excluídos');
      return;
    }

    try {
      await supabase
        .from('fiscal_invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);

      const { error } = await supabase
        .from('fiscal_invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;
      toast.success('Rascunho excluído');
      refetch();
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      toast.error('Erro ao excluir rascunho');
    }
  };

  // Bulk delete drafts
  const handleBulkDelete = async () => {
    const drafts = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.status === 'draft'
    );
    
    if (drafts.length === 0) {
      toast.error('Nenhum rascunho selecionado');
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;

    for (const invoice of drafts) {
      try {
        await supabase
          .from('fiscal_invoice_items')
          .delete()
          .eq('invoice_id', invoice.id);

        const { error } = await supabase
          .from('fiscal_invoices')
          .delete()
          .eq('id', invoice.id);

        if (!error) successCount++;
      } catch {
        // Continue with others
      }
    }

    setIsBulkProcessing(false);
    clearSelection();
    refetch();

    if (successCount > 0) {
      toast.success(`${successCount} rascunho(s) excluído(s)`);
    }
  };

  // Get counts for bulk actions
  const selectedDraftsCount = (filteredInvoices || []).filter(
    inv => selectedInvoices.has(inv.id) && inv.status === 'draft'
  ).length;
  
  const selectedAuthorizedCount = (filteredInvoices || []).filter(
    inv => selectedInvoices.has(inv.id) && inv.status === 'authorized'
  ).length;

  // NF-e/DC-e autorizadas selecionadas cujo pedido vai para um gateway (ex: Frenet).
  // Para esses pedidos, o envio à transportadora é feito via gateway_sync_queue
  // (não pelo fluxo de Remessas).
  const selectedGatewayInvoicesCount = (filteredInvoices || []).filter(
    inv => selectedInvoices.has(inv.id)
      && inv.status === 'authorized'
      && inv.order_id
      && inv.resolved_shipping_provider_kind === 'gateway'
  ).length;

  // Declaração de Conteúdo dos Correios — modal de responsabilidade obrigatório.
  // Não é documento fiscal. Não chama Focus/Sefaz. Não altera fiscal_stage.
  // Em massa: gera 1 PDF único multipágina; histórico individual por pedido.
  const [dcDialogOpen, setDcDialogOpen] = useState(false);
  const [dcDialogTargets, setDcDialogTargets] = useState<any[]>([]);
  const [dcDialogLoading, setDcDialogLoading] = useState(false);

  const buildDcTarget = (inv: any): DcDialogTarget => {
    const numero = inv?.numero ? `#${inv.numero}` : `#${String(inv?.id || '').slice(0, 6)}`;
    const cliente = inv?.dest_nome ? ` — ${inv.dest_nome}` : '';
    return {
      id: inv.id,
      label: `Pedido ${numero}${cliente}`,
    };
  };

  const openDcDialogForInvoice = (invoice: any) => {
    setDcDialogTargets([invoice]);
    setDcDialogOpen(true);
  };

  const openDcDialogForBulk = () => {
    const selected = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.fiscal_stage === 'pedido_venda'
    );
    if (selected.length === 0) {
      toast.error('Selecione ao menos um Pedido de Venda.');
      return;
    }
    setDcDialogTargets(selected);
    setDcDialogOpen(true);
  };

  const handleDcDialogConfirm = async (payload: {
    reason: string;
    responsibility_acknowledged: true;
  }) => {
    setDcDialogLoading(true);
    const targets = dcDialogTargets;
    const t = toast.loading(
      targets.length === 1
        ? 'Gerando Declaração de Conteúdo...'
        : `Gerando ${targets.length} Declarações de Conteúdo em PDF único...`,
    );

    const result = await issueAndDownloadCorreiosContentDeclarationsBatch({
      reason: payload.reason,
      responsibilityAcknowledged: true,
      source: 'manual',
      targets: targets.map((inv: any) => ({
        tenantId: inv.tenant_id,
        fiscalInvoiceId: inv.id,
        orderId: inv.order_id ?? null,
        weightGrams: 0, // 0 = backend calcula automaticamente a partir dos itens do pedido
        volumes: Number(inv?.quantidade_volumes) > 0 ? Number(inv.quantidade_volumes) : 1,
        label: inv.dest_nome || `#${inv.numero || ''}`,
      })),
    });

    toast.dismiss(t);
    setDcDialogLoading(false);
    setDcDialogOpen(false);
    setDcDialogTargets([]);

    if (result.fail === 0 && result.ok > 0) {
      toast.success(
        result.ok === 1
          ? `Declaração de Conteúdo gerada com sucesso (${result.dcNumbers[0]}).`
          : `${result.ok} declarações de conteúdo geradas em um único PDF.`,
      );
    } else if (result.ok > 0 && result.fail > 0) {
      toast.warning(`${result.ok} gerada(s), ${result.fail} com falha.`);
    } else {
      toast.error(`Falha ao gerar Declaração de Conteúdo: ${result.failures[0]?.error || 'erro desconhecido'}`);
    }
  };


  // Bulk: Gerar DC-e (Declaração de Conteúdo) — temporariamente indisponível.
  // A integração com o backend de DC-e ainda não foi finalizada para emissão real.
  // O botão permanece visível para descoberta, mas exibe mensagem clara em vez de transmitir.
  const handleBulkEmitDce = async () => {
    toast.error(
      'Declaração de Conteúdo ainda não está disponível para emissão automática nesta etapa. Em breve.',
      { description: 'Use a NF-e tradicional para envios fiscais. A DC-e será habilitada após a finalização da integração com a transportadora.' }
    );
  };

  // Bulk: Enviar pedidos selecionados ao gateway (Frenet etc.) via gateway_sync_queue
  const handleBulkSendToGateway = async () => {
    const selected = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id)
        && inv.status === 'authorized'
        && inv.order_id
        && inv.resolved_shipping_provider_kind === 'gateway'
    );

    if (selected.length === 0) {
      toast.error('Nenhuma NF-e autorizada com transportadora gateway selecionada');
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const inv of selected) {
      try {
        const { data, error } = await supabase.functions.invoke('gateway-attach-fiscal-doc', {
          body: { order_id: inv.order_id, invoice_id: inv.id },
        });
        if (error || !data?.success) errorCount++;
        else successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsBulkProcessing(false);
    clearSelection();
    refetch();

    if (successCount > 0) toast.success(`${successCount} pedido(s) enviado(s) à transportadora`);
    if (errorCount > 0) toast.error(`${errorCount} envio(s) com erro`);
  };

  const cardTitle = mode === 'orders' ? 'Pedidos de Venda' : 'Notas Fiscais';

  return (
    <div className="space-y-6">
      {/* Fiscal Alerts - only for orders mode */}
      {mode === 'orders' && <FiscalAlertsCard />}

      {/* Alert if not configured */}
      {!isConfigured && !settingsLoading && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Configuração Incompleta</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Configure os dados fiscais da sua empresa para começar a emitir NF-e.
                </p>
              </div>
              <Button onClick={() => navigate('/fiscal?tab=configuracoes')}>
                Configurar Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {mode === 'orders' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Pedidos de venda em aberto"
            value={statsLoading ? '...' : counts.orders.toString()}
            icon={FileText}
            variant="warning"
          />
          <StatCard
            title="Prontas para Emitir"
            value={statsLoading ? '...' : (modeFilteredInvoices?.filter(i => {
              const os = i.order_status;
              return !os || !['chargeback_detected', 'chargeback_lost', 'cancelled', 'canceled'].includes(os);
            }).length || 0).toString()}
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Com Pendência"
            value={statsLoading ? '...' : (modeFilteredInvoices?.filter(i => {
              const os = i.order_status;
              return os && ['chargeback_detected', 'chargeback_lost', 'cancelled', 'canceled'].includes(os);
            }).length || 0).toString()}
            icon={AlertTriangle}
            variant="destructive"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Autorizadas"
            value={statsLoading ? '...' : (counts.authorized + counts.printed).toString()}
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Pendentes SEFAZ"
            value={statsLoading ? '...' : counts.pending.toString()}
            icon={Clock}
            variant="primary"
          />
          <StatCard
            title="Rejeitadas"
            value={statsLoading ? '...' : counts.rejected.toString()}
            icon={XCircle}
            variant="destructive"
          />
          <StatCard
            title="Devolvido"
            value={statsLoading ? '...' : counts.devolvido.toString()}
            icon={RotateCcw}
            variant="warning"
          />
          <StatCard
            title="Canceladas"
            value={statsLoading ? '...' : counts.canceled.toString()}
            icon={XCircle}
            variant="default"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {mode === 'orders' ? (
            <Button onClick={() => setManualDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido de Venda
            </Button>
          ) : (
            <Button onClick={handleCreateNewInvoice} disabled={isCreatingInvoice}>
              {isCreatingInvoice ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Nova NF-e
            </Button>
          )}
        </div>
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">{cardTitle}</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar por número, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiscalStatusFilter
                  options={mode === 'orders' ? orderStatusOptions : invoiceStatusOptions}
                  selected={statusFilter}
                  onChange={setStatusFilter}
                />
                <MarketplaceSourceFilter
                  value={marketplaceSource}
                  onChange={setMarketplaceSource}
                />
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(start, end) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                  label="Data"
                />
              </div>
              <ExportInvoicesButton invoices={filteredInvoices || []} isLoading={invoicesLoading} />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredInvoices || filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={mode === 'orders' ? 'Nenhum pedido de venda em aberto' : 'Nenhuma nota fiscal encontrada'}
                description={isConfigured 
                  ? mode === 'orders'
                    ? "Quando houver pedidos aprovados, os rascunhos de pedido de venda aparecerão aqui automaticamente."
                    : "As NF-e aparecerão aqui conforme forem emitidas e processadas."
                  : "Configure sua integração fiscal para emitir NF-e."}
                action={!isConfigured ? {
                  label: "Configurar Integração",
                  onClick: () => navigate('/fiscal?tab=configuracoes'),
                } : undefined}
              />
            ) : (
              <>
                {/* Bulk Actions Bar */}
                {selectedInvoices.size > 0 && (
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selectedInvoices.size} selecionada(s)</Badge>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {selectedDraftsCount > 0 && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={handleBulkSubmit}
                            disabled={isBulkProcessing}
                          >
                            {isBulkProcessing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-2" />
                            )}
                            {mode === 'orders'
                              ? (selectedDraftsCount === 1
                                  ? 'Criar Nota Fiscal'
                                  : `Criar Notas Fiscais (${selectedDraftsCount})`)
                              : (selectedDraftsCount === 1
                                  ? 'Emitir Nota Fiscal'
                                  : `Emitir Notas Fiscais (${selectedDraftsCount})`)}
                          </Button>
                          {mode === 'orders' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={openDcDialogForBulk}
                              disabled={isBulkProcessing}
                              title="Gera um PDF de Declaração de Conteúdo (não fiscal) por pedido selecionado"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              {selectedDraftsCount === 1
                                ? 'Declaração de Conteúdo'
                                : `Declarações de Conteúdo (${selectedDraftsCount})`}
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isBulkProcessing}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir {selectedDraftsCount}
                          </Button>
                        </>
                      )}
                      {selectedAuthorizedCount > 0 && (
                        <>
                          {selectedGatewayInvoicesCount > 0 && (
                            <Button
                              size="sm"
                              onClick={handleBulkSendToGateway}
                              disabled={isBulkProcessing}
                              title="Envia o pedido e a NF-e à transportadora integrada (ex: Frenet)"
                            >
                              {isBulkProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Truck className="h-4 w-4 mr-2" />
                              )}
                              Enviar à transportadora {selectedGatewayInvoicesCount}
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleBulkPrint}
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Imprimir {selectedAuthorizedCount}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleBulkDownloadXml}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            XMLs {selectedAuthorizedCount}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleBulkResendEmail}
                            disabled={isBulkProcessing}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Reenviar Email {selectedAuthorizedCount}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredInvoices.length > 0 && selectedInvoices.size === filteredInvoices.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const status = statusConfig[invoice.status] || statusConfig.draft;
                      const StatusIcon = status.icon;
                      const isPrinted = (invoice as any).danfe_printed_at;
                      
                      return (
                        <TableRow key={invoice.id} className={selectedInvoices.has(invoice.id) ? 'bg-muted/50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedInvoices.has(invoice.id)}
                              onCheckedChange={() => handleSelectInvoice(invoice.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {invoice.serie}-{invoice.numero}
                          </TableCell>
                          <TableCell>
                            <OrderSourceBadge 
                              marketplaceSource={invoice.marketplace_source} 
                              salesChannel={(invoice as any).sales_channel}
                              size="sm"
                            />
                          </TableCell>
                          <TableCell>
                            {formatDateTimeBR(new Date(invoice.created_at))}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {invoice.dest_nome}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatDocument(invoice.dest_cpf_cnpj)}
                          </TableCell>
                          <TableCell>{formatCurrency(invoice.valor_total)}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {invoice.status === 'draft' && invoice.order_status && ['chargeback_detected', 'chargeback_lost'].includes(invoice.order_status) ? (
                                <Badge variant="destructive" className="gap-1 w-fit bg-red-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  Chargeback em andamento
                                </Badge>
                              ) : invoice.status === 'draft' && invoice.order_status && ['cancelled', 'canceled'].includes(invoice.order_status) ? (
                                <Badge variant="destructive" className="gap-1 w-fit">
                                  <XCircle className="h-3 w-3" />
                                  Venda cancelada
                                </Badge>
                              ) : (mode === 'invoices' && (stageOf(invoice) === 'pronta_emitir' || stageOf(invoice) === 'pendencia')) ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${stageConfig[stageOf(invoice)].className}`}>
                                  {(() => { const I = stageConfig[stageOf(invoice)].icon; return <I className="h-3 w-3" />; })()}
                                  {stageConfig[stageOf(invoice)].label}
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${status.className}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </span>
                              )}
                              {mode === 'invoices' && stageOf(invoice) === 'pendencia' && Array.isArray((invoice as any).pendencia_motivos) && (invoice as any).pendencia_motivos.length > 0 && (
                                <p className="text-xs text-destructive max-w-[220px] truncate" title={(invoice as any).pendencia_motivos.join(' • ')}>
                                  {(invoice as any).pendencia_motivos[0]}
                                </p>
                              )}
                              {invoice.status === 'authorized' && isPrinted && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit ${COLOR.green}`}>
                                  <Printer className="h-3 w-3" />
                                  Impressa
                                </span>
                              )}
                              {invoice.status === 'rejected' && invoice.status_motivo && (
                                <p className="text-xs text-destructive max-w-[200px] truncate" title={invoice.status_motivo}>
                                  {invoice.status_motivo}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <InvoiceActionsDropdown
                              invoice={invoice as any}
                              onEdit={() => handleEditInvoice(invoice)}
                              onSubmit={() => requestEmitInvoice(invoice)}
                              onCheckStatus={() => handleCheckStatus(invoice.id)}
                              onViewOrder={() => navigate(`/orders/${invoice.order_id}`)}
                              onCancel={() => setCancelingInvoice(invoice)}
                              onPrint={() => handlePrintDanfe(invoice)}
                              onDuplicate={() => handleCloneInvoice(invoice, mode === 'orders' ? 'pedido' : 'nf')}
                              onCorrect={() => setCorrectingInvoice(invoice)}
                              onViewTimeline={() => setTimelineInvoice(invoice)}
                              onDelete={() => handleDeleteDraft(invoice)}
                              onEmitirDevolucao={() => handleEmitirDevolucao(invoice)}
                              onResendEmail={() => handleResendEmail(invoice)}
                              onGenerateDC={mode === 'orders' ? () => openDcDialogForInvoice(invoice) : undefined}
                              isGeneratingDC={generatingDcInvoiceId === invoice.id}
                              isSubmitting={submittingInvoiceId === invoice.id || preparingInvoiceId === invoice.id}
                              isCheckingStatus={checkStatus.isPending}
                              cloneLabel={mode === 'orders' ? 'Duplicar Pedido de Venda' : 'Duplicar NF'}
                              emitLabel={
                                mode === 'orders'
                                  ? 'Criar Nota Fiscal'
                                  : (stageOf(invoice) === 'pendencia'
                                      ? 'Editar e revalidar'
                                      : settings?.ambiente === 'homologacao'
                                          ? 'Emitir Nota Fiscal (homologação)'
                                          : 'Emitir Nota Fiscal')
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Invoice Dialog */}
      <ManualInvoiceDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} mode="create" />

      {/* Diálogo de duplicação (Pedido de Venda ou NF) — pré-preenchido, sem efeito fiscal/financeiro/logístico. */}
      <ManualInvoiceDialog
        open={duplicateDialog.open}
        onOpenChange={(o) => setDuplicateDialog((s) => ({ ...s, open: o }))}
        mode="duplicate"
        initialData={duplicateDialog.data || undefined}
        title={duplicateDialog.kind === 'pedido' ? 'Duplicar Pedido de Venda' : 'Duplicar NF'}
        description={
          duplicateDialog.kind === 'pedido'
            ? 'Revise os dados copiados do pedido de venda original e ajuste o que precisar antes de salvar. Nenhuma Nota Fiscal é criada nesta etapa.'
            : 'Revise os dados copiados da NF original. Ao salvar, criamos uma nova NF e movemos para a aba Notas Fiscais (Pronta para Emitir ou Pendência), sem transmitir à Receita.'
        }
        submitLabel="Salvar duplicação"
        successMessage={
          duplicateDialog.kind === 'pedido'
            ? 'Pedido de venda duplicado. Disponível na aba Pedidos de Venda.'
            : 'NF duplicada. Validando e movendo para a aba Notas Fiscais...'
        }
        onCreated={async (newId) => {
          if (duplicateDialog.kind === 'nf') {
            // NF duplicada: valida e move para Notas Fiscais (pronta_emitir/pendencia).
            try {
              const { data } = await supabase.functions.invoke('fiscal-prepare-invoice', {
                body: { invoice_id: newId },
              });
              if (data?.success) {
                if (data.fiscal_stage === 'pronta_emitir') {
                  toast.success('NF duplicada e Pronta para Emitir em Notas Fiscais.');
                } else {
                  toast.warning(`NF duplicada com ${data.errors?.length || 0} pendência(s) em Notas Fiscais.`);
                }
              }
            } catch (e) {
              console.warn('[duplicate NF prepare] falhou', e);
            }
            refetch();
          } else {
            // Pedido de venda duplicado: apenas recarrega a lista — não abrir editor de NF.
            refetch();
          }
        }}
      />

      {/* Invoice Editor */}
      {editingInvoice && (
        <InvoiceEditor
          open={!!editingInvoice}
          onOpenChange={(open) => {
            if (!open) {
              setEditingInvoice(null);
              setEditingInvoiceError(null);
              setEditingInvoiceStatus(null);
              setEditingInvoiceStage(null);
            }
          }}
          invoice={editingInvoice}
          onSave={handleSaveInvoice}
          onSubmit={handleSubmitInvoice}
          onDelete={handleDeleteInvoice}
          rejectionError={editingInvoiceError || undefined}
          invoiceStatus={editingInvoiceStatus || undefined}
        />
      )}

      {/* Cancel Invoice Dialog */}
      {cancelingInvoice && (
        <CancelInvoiceDialog
          open={!!cancelingInvoice}
          onOpenChange={(open) => !open && setCancelingInvoice(null)}
          invoice={cancelingInvoice as any}
          onSuccess={() => {
            setCancelingInvoice(null);
            refetch();
          }}
        />
      )}

      {/* Error Resolver Dialog */}
      <FiscalErrorResolver
        open={errorResolverOpen}
        onOpenChange={setErrorResolverOpen}
        errors={currentErrors}
        invoiceId={currentErrorInvoiceId || undefined}
        onRetry={handleRetrySubmit}
      />

      {/* Correct Invoice Dialog (CC-e) */}
      {correctingInvoice && (
        <CorrectInvoiceDialog
          open={!!correctingInvoice}
          onOpenChange={(open) => !open && setCorrectingInvoice(null)}
          invoice={correctingInvoice as any}
          onSuccess={() => refetch()}
        />
      )}

      {/* Inutilizar Números Dialog */}
      <InutilizarNumerosDialog
        open={inutilizarDialogOpen}
        onOpenChange={setInutilizarDialogOpen}
        serie={settings?.serie_nfe}
        onSuccess={() => refetch()}
      />

      {/* Entry Invoice Dialog */}
      <EntryInvoiceDialog
        open={entryDialogOpen}
        onOpenChange={(open) => { setEntryDialogOpen(open); if (!open) setEntryDialogChaveAcesso(undefined); }}
        onSuccess={() => refetch()}
        initialChaveAcesso={entryDialogChaveAcesso}
      />

      {/* Consulta por Chave Dialog */}
      <ConsultaChaveDialog
        open={consultaChaveOpen}
        onOpenChange={setConsultaChaveOpen}
      />

      {/* Invoice Timeline */}
      {timelineInvoice && (
        <InvoiceTimeline
          open={!!timelineInvoice}
          onOpenChange={(open) => !open && setTimelineInvoice(null)}
          invoiceId={timelineInvoice.id}
          invoiceNumber={`${timelineInvoice.serie}-${timelineInvoice.numero}`}
        />
      )}
      {/* Confirmar emissão de NF-e (modo teste em homologação) */}
      <AlertDialog
        open={!!confirmEmitInvoice}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmEmitInvoice(null);
            setEmitPrecheckErrors([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {settings?.ambiente === 'homologacao' ? 'Emitir NF-e de teste?' : 'Emitir NF-e?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {settings?.ambiente === 'homologacao' ? (
                  <p>Esta loja está em modo de teste fiscal. A nota será enviada em homologação e <strong>não terá valor fiscal real</strong>.</p>
                ) : (
                  <p>A NF-e será enviada para autorização da SEFAZ. Esta ação não pode ser desfeita.</p>
                )}
                {confirmEmitInvoice && (
                  <p className="text-muted-foreground">
                    NF {confirmEmitInvoice.serie}-{confirmEmitInvoice.numero} · {confirmEmitInvoice.dest_nome} · {formatCurrency(confirmEmitInvoice.valor_total)}
                  </p>
                )}
                {emitPrecheckErrors.length > 0 && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3">
                    <p className="font-medium text-destructive mb-1">Pendências antes de emitir:</p>
                    <ul className="list-disc pl-5 space-y-0.5 text-destructive">
                      {emitPrecheckErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={emitPrecheckErrors.length > 0}
              onClick={() => {
                if (!confirmEmitInvoice || emitPrecheckErrors.length > 0) return;
                const inv = confirmEmitInvoice;
                setConfirmEmitInvoice(null);
                handleQuickSubmit(inv);
              }}
            >
              {settings?.ambiente === 'homologacao' ? 'Emitir NF-e de teste' : 'Emitir NF-e'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CorreiosContentDeclarationDialog
        open={dcDialogOpen}
        onOpenChange={(v) => { setDcDialogOpen(v); if (!v) { setDcDialogTargets([]); } }}
        targets={dcDialogTargets.map(buildDcTarget)}
        loading={dcDialogLoading}
        onConfirm={handleDcDialogConfirm}
      />
    </div>
  );
}
