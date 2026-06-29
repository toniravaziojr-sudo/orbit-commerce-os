import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ExportInvoicesButton } from '@/components/fiscal/ExportInvoicesButton';
import { InvoiceTimeline } from '@/components/fiscal/InvoiceTimeline';
import { SendingInvoiceModal, type SendingState } from '@/components/fiscal/SendingInvoiceModal';

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
import { issueAndDownloadCorreiosContentDeclarationsBatch, reprintDeclarationByFiscalInvoiceId } from '@/lib/declaracaoConteudo';
import { CorreiosContentDeclarationDialog, type DcDialogTarget } from '@/components/fiscal/CorreiosContentDeclarationDialog';

import { formatDateTimeBR } from "@/lib/date-format";
import {
  buildConcluidoSet,
  derivePedidoStatus,
  getPendenciaMotivos,
  isPedidoBlockedForFiscalActions,
  getPedidoBlockedReason,
  PEDIDO_STATUS_CONFIG,
  type PedidoStatus,
} from '@/lib/fiscal/pedidoStatus';

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
  // Pedidos de Venda abre com filtro "Em aberto" por padrão (mostra só o que
  // precisa de ação). Notas Fiscais abre sem filtro (lista completa).
  const [statusFilter, setStatusFilter] = useState<string[]>(
    mode === 'orders' ? ['em_aberto'] : []
  );
  // Filtro de Tipo de Nota (apenas na aba Notas Fiscais). Padrão = 'all' (todos).
  // 'all' = qualquer tipo. Usuário pode trocar para saída/entrada/transferência/etc.
  const [tipoNotaFilter, setTipoNotaFilter] = useState<string>(
    mode === 'invoices' ? 'all' : 'all'
  );


  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [duplicateDialog, setDuplicateDialog] = useState<{ open: boolean; data: ManualInvoiceInitialData | null; kind: 'pedido' | 'nf' }>({ open: false, data: null, kind: 'pedido' });
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [editingInvoiceError, setEditingInvoiceError] = useState<string | null>(null);
  const [editingInvoiceStatus, setEditingInvoiceStatus] = useState<string | null>(null);
  const [editingInvoiceStage, setEditingInvoiceStage] = useState<string | null>(null);
  const [editingInvoicePendencias, setEditingInvoicePendencias] = useState<string[]>([]);
  const [editingInvoiceAvisos, setEditingInvoiceAvisos] = useState<string[]>([]);
  const [preparingInvoiceId, setPreparingInvoiceId] = useState<string | null>(null);
  const [submittingInvoiceId, setSubmittingInvoiceId] = useState<string | null>(null);
  const [checkingStatusInvoiceId, setCheckingStatusInvoiceId] = useState<string | null>(null);
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
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<FiscalInvoice | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);
  // Estado do objeto de postagem vinculado ao PV em exclusão (para texto do diálogo).
  // Em qualquer estado, o objeto é removido junto com o PV (cascata total).
  type ShipmentImpact = { tracking_code: string | null; delivery_status: string };
  const [linkedShipmentImpact, setLinkedShipmentImpact] = useState<ShipmentImpact | null>(null);
  // Estado do pedido de origem (para bloquear exclusão de PV de pedido pago)
  type PaidOrderBlock = { order_number: string | null; status: string; payment_status: string };
  const [paidOrderBlock, setPaidOrderBlock] = useState<PaidOrderBlock | null>(null);
  const [generatingDcInvoiceId, setGeneratingDcInvoiceId] = useState<string | null>(null);
  const [printingDcInvoiceId, setPrintingDcInvoiceId] = useState<string | null>(null);
  const [isBulkGeneratingDc, setIsBulkGeneratingDc] = useState(false);
  // Mapa de Pedidos de Venda que já possuem Declaração de Conteúdo emitida (status='issued').
  // Usado para alternar o item do menu entre "Gerar" e "Imprimir Declaração de Conteúdo".
  const [dcByInvoiceId, setDcByInvoiceId] = useState<Set<string>>(new Set());
  // Modal central de progresso de envio à Sefaz (individual e em lote).
  const [sendingState, setSendingState] = useState<SendingState | null>(null);


  // Paginação client-side (a consulta já traz tudo do tenant; aqui só fatiamos a tabela).
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Destaque visual da linha recém-salva, com auto-scroll até ela.
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  
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

  // Deriva tipo_nota a partir do registro (compat com NFs antigas sem o campo).
  const deriveTipoNotaFromInvoice = (d: any): 'saida' | 'entrada' | 'remessa' | 'devolucao' | 'transferencia' => {
    if (d?.tipo_nota) return d.tipo_nota;
    const nat = String(d?.natureza_operacao || '').toLowerCase();
    const cfopNum = parseInt(String(d?.cfop || '').replace(/\D/g, ''), 10) || 0;
    if (d?.tipo_documento === 0) return 'entrada';
    if (d?.finalidade_emissao === 4 || nat.includes('devolu')) return 'devolucao';
    if (nat.includes('transfer')) return 'transferencia';
    if ((cfopNum >= 5900 && cfopNum <= 5999) || (cfopNum >= 6900 && cfopNum <= 6999)) return 'remessa';
    return 'saida';
  };

  // Concluído set + helper derivado (fonte única em src/lib/fiscal/pedidoStatus.ts)
  const concluidoSet = buildConcluidoSet((invoices as any[]) || []);
  const pedidoStatusOf = (inv: any) => derivePedidoStatus(inv, concluidoSet);


  // Apply tipo_nota filter (apenas Notas Fiscais; em Pedidos de Venda é sempre saída).
  const tipoFilteredInvoices = mode === 'invoices' && tipoNotaFilter !== 'all'
    ? modeFilteredInvoices?.filter(inv => deriveTipoNotaFromInvoice(inv) === tipoNotaFilter)
    : modeFilteredInvoices;

  // Apply status filter
  const statusFilteredInvoices = tipoFilteredInvoices?.filter(inv => {

    if (statusFilter.length === 0) return true;

    if (mode === 'orders') {
      // 5 status oficiais: em_aberto | pendente | concluido | cancelled | chargeback
      return statusFilter.includes(pedidoStatusOf(inv));
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
  // Busca cobre: número, nome (sem acento), CPF/CNPJ, chave de acesso, pedido,
  // e-mail e telefone do destinatário. Normaliza acentos para que "joao" case "João".
  const normalizeText = (v: unknown) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const filteredInvoices = statusFilteredInvoices?.filter(inv => {
    // Filter by search
    if (searchTerm) {
      const search = normalizeText(searchTerm);
      const searchDigits = onlyDigits(searchTerm);
      const nome = normalizeText((inv as any).dest_nome);
      const email = normalizeText((inv as any).dest_email);
      const chave = normalizeText((inv as any).chave_acesso);
      const orderId = normalizeText((inv as any).order_id);
      const numero = String((inv as any).numero ?? '');
      const docDigits = onlyDigits((inv as any).dest_cpf_cnpj);
      const telDigits = onlyDigits((inv as any).dest_telefone);
      const matchesSearch = (
        (search && numero.includes(search)) ||
        (search && nome.includes(search)) ||
        (search && email.includes(search)) ||
        (search && chave.includes(search)) ||
        (search && orderId.includes(search)) ||
        (searchDigits && docDigits.includes(searchDigits)) ||
        (searchDigits && telDigits.includes(searchDigits))
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

  // ===== Paginação =====
  const totalFiltered = filteredInvoices?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  // Garante que página atual cabe no total atual de páginas
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);
  // Reseta para a página 1 quando qualquer filtro/aba muda
  useEffect(() => {
    setCurrentPage(1);
  }, [mode, searchTerm, statusFilter, tipoNotaFilter, startDate, endDate, marketplaceSource, pageSize]);

  const pagedInvoices = useMemo(() => {
    if (!filteredInvoices) return [] as typeof filteredInvoices;
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Carrega cancellation_reason em lote para os pedidos das NFs canceladas visíveis,
  // evitando N+1. Mapa { order_id: reason }. Renderiza a tarja discreta de cancelamento.
  const cancelledOrderIds = useMemo(() => {
    const ids = new Set<string>();
    (pagedInvoices || []).forEach((i: any) => {
      if (i?.status === 'cancelled' && i?.order_id) ids.add(i.order_id as string);
    });
    return Array.from(ids);
  }, [pagedInvoices]);

  const [cancellationReasonByOrder, setCancellationReasonByOrder] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!cancelledOrderIds.length) return;
    let canceled = false;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, status, cancellation_reason')
        .in('id', cancelledOrderIds);
      if (canceled || !data) return;
      const next: Record<string, string | null> = {};
      (data as any[]).forEach((row) => {
        if (row?.status === 'cancelled') next[row.id] = row.cancellation_reason ?? null;
      });
      setCancellationReasonByOrder((prev) => ({ ...prev, ...next }));
    })();
    return () => { canceled = true; };
  }, [cancelledOrderIds.join('|')]);


  // Carrega o conjunto de Pedidos de Venda visíveis que já possuem Declaração de
  // Conteúdo emitida. Atualiza o mapa local para o item do menu alternar entre
  // "Gerar" e "Imprimir Declaração de Conteúdo".
  useEffect(() => {
    if (mode !== 'orders') return;
    const ids = (pagedInvoices || []).map((i: any) => i.id).filter(Boolean);
    if (!ids.length) return;
    let canceled = false;
    (async () => {
      const { data, error } = await supabase
        .from('shipping_content_declarations')
        .select('fiscal_invoice_id')
        .in('fiscal_invoice_id', ids)
        .eq('status', 'issued');
      if (canceled || error || !data) return;
      setDcByInvoiceId((prev) => {
        const next = new Set(prev);
        (data as any[]).forEach((row) => {
          if (row?.fiscal_invoice_id) next.add(row.fiscal_invoice_id as string);
        });
        return next;
      });
    })();
    return () => {
      canceled = true;
    };
  }, [pagedInvoices, mode]);

  // Quando uma linha for marcada para destaque, leva o usuário até a página correta
  // e rola até a linha. O destaque some após ~2.5s.
  useEffect(() => {
    if (!highlightedInvoiceId || !filteredInvoices) return;
    const idx = filteredInvoices.findIndex((i) => i.id === highlightedInvoiceId);
    if (idx === -1) return;
    const targetPage = Math.floor(idx / pageSize) + 1;
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      return; // efeito roda de novo depois do re-render
    }
    const el = rowRefs.current[highlightedInvoiceId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const timer = setTimeout(() => setHighlightedInvoiceId(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightedInvoiceId, filteredInvoices, currentPage, pageSize]);


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
    setCheckingStatusInvoiceId(invoiceId);
    try {
      await checkStatus.mutateAsync(invoiceId);
      refetch();
    } finally {
      setCheckingStatusInvoiceId(null);
    }
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

    // Deriva tipo_nota quando não persistido (compat com NFs antigas)
    const deriveTipoNota = (d: any): 'saida' | 'entrada' | 'remessa' | 'devolucao' | 'transferencia' => {
      if (d.tipo_nota) return d.tipo_nota;
      const nat = String(d.natureza_operacao || '').toLowerCase();
      const cfopNum = parseInt(String(d.cfop || '').replace(/\D/g, ''), 10) || 0;
      if (d.tipo_documento === 0) return 'entrada';
      if (d.finalidade_emissao === 4 || nat.includes('devolu')) return 'devolucao';
      if (nat.includes('transfer')) return 'transferencia';
      if ((cfopNum >= 5900 && cfopNum <= 5999) || (cfopNum >= 6900 && cfopNum <= 6999)) return 'remessa';
      return 'saida';
    };

    // Deriva data_saida (yyyy-MM-dd) a partir do timestamp hora_saida
    const horaSaidaIso = (data as any).hora_saida as string | null | undefined;
    const dataSaidaStr = horaSaidaIso ? String(horaSaidaIso).split('T')[0] : undefined;

    // Consumidor final é derivado de PF/PJ (regra SEFAZ): PF = sim, PJ = não
    const cpfCnpjDigits = (data.dest_cpf_cnpj || '').replace(/\D/g, '');
    const isFisica = cpfCnpjDigits.length === 11;

    const invoiceData: InvoiceData = {
      id: data.id,
      order_id: data.order_id || undefined,
      numero: data.numero,
      serie: data.serie,
      data_emissao: data.created_at,
      data_saida: dataSaidaStr,
      natureza_operacao: data.natureza_operacao,
      cfop: data.cfop || '',
      observacoes: data.observacoes || undefined,
      tipo_nota: deriveTipoNota(data),
      chave_acesso_referenciada: (data as any).nfe_referenciada || undefined,
      indicador_presenca: (data as any).indicador_presenca ?? 2,
      informacoes_fisco: (data as any).informacoes_fisco || undefined,
      dest_nome: data.dest_nome,
      dest_cpf_cnpj: data.dest_cpf_cnpj,
      dest_ie: data.dest_inscricao_estadual || undefined,
      dest_tipo_pessoa: isFisica ? 'fisica' : 'juridica',
      dest_consumidor_final: isFisica,
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
      transportadora_servico: (data as any).transportadora_servico || undefined,
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
        cst: item.cst,
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

    const pendencias = Array.isArray((data as any).pendencia_motivos)
      ? ((data as any).pendencia_motivos as string[]).filter((s) => typeof s === 'string')
      : [];
    const avisos = Array.isArray((data as any).pendencia_avisos)
      ? ((data as any).pendencia_avisos as string[]).filter((s) => typeof s === 'string')
      : [];
    setEditingInvoice(invoiceData);
    setEditingInvoiceError(data.status_motivo || null);
    setEditingInvoicePendencias(pendencias);
    setEditingInvoiceAvisos(avisos);
    setEditingInvoiceStatus(data.status || null);
    setEditingInvoiceStage((data as any).fiscal_stage || null);
  };

  const handleSaveInvoice = async (data: InvoiceData): Promise<{ silent?: boolean } | void> => {
    // Criação tardia: se ainda não há registro persistido (rascunho em memória),
    // primeiro alocamos a linha via fiscal-create-manual (modo nfe_manual) e
    // só depois aplicamos os dados do formulário com fiscal-update-draft.
    let invoiceId = data.id;
    if (!invoiceId) {
      const { data: created, error: createErr } = await supabase.functions.invoke('fiscal-create-manual', {
        body: {
          mode: 'nfe_manual',
          natureza_operacao: data.natureza_operacao || 'VENDA DE MERCADORIA',
        },
      });
      if (createErr) throw createErr;
      if (!created?.success || !created?.invoice?.id) {
        throw new Error(created?.error || 'Erro ao criar NF-e');
      }
      invoiceId = created.invoice.id;
      // Reflete o id no estado do editor para próximas operações (salvar, emitir, excluir).
      setEditingInvoice((prev) => (prev ? { ...prev, id: invoiceId, numero: created.invoice.numero, serie: created.invoice.serie } : prev));
      data = { ...data, id: invoiceId };
    }

    const { error } = await supabase.functions.invoke('fiscal-update-draft', {
      body: { invoice_id: invoiceId, data },
    });

    if (error) throw error;

    // Se o registro está na aba Notas Fiscais, revalidar automaticamente
    // após salvar para recalcular a etapa operacional. Isso cobre também
    // casos inconsistentes vindos de rejeição anterior marcados como emitida.
    let prepShownToast = false;
    if (editingInvoiceStage && editingInvoiceStage !== 'pedido_venda') {
      try {
        const { data: prep } = await supabase.functions.invoke('fiscal-prepare-invoice', {
          body: { invoice_id: invoiceId },
        });
        if (prep?.success) {
          if (prep.fiscal_stage === 'pronta_emitir') {
            toast.success('Rascunho salvo. Pendências resolvidas — NF está Pronta para Emitir.');
            prepShownToast = true;
          } else if (prep.fiscal_stage === 'pendencia') {
            toast.warning(`Rascunho salvo. Ainda há ${prep.errors?.length || 0} pendência(s).`);
            prepShownToast = true;
          }
        }
      } catch (e) {
        console.warn('[handleSaveInvoice] re-prepare falhou', e);
      }
    }
    refetch();
    // Marca a linha salva para destaque + scroll automático na listagem.
    if (invoiceId) setHighlightedInvoiceId(invoiceId);
    // Sinaliza ao editor para suprimir o toast genérico quando já mostramos um específico.
    return prepShownToast ? { silent: true } : undefined;
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
    setSendingState({ total: 1, done: 0, kind: 'create' });
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
      setSendingState(null);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!editingInvoice?.id) return;

    // Permitido excluir apenas notas sem efeito fiscal (rascunho, rejeitada, cancelada).
    const DELETABLE = new Set(['draft', 'rejected', 'cancelled']);
    if (!DELETABLE.has((editingInvoice as any).status as string)) {
      toast.error('Esta nota tem efeito fiscal e não pode ser excluída. Use Cancelar NF-e.');
      return;
    }

    // Apaga itens primeiro para evitar órfãos caso não haja cascade.
    await supabase.from('fiscal_invoice_items').delete().eq('invoice_id', editingInvoice.id);

    const { error, count } = await supabase
      .from('fiscal_invoices')
      .delete({ count: 'exact' })
      .eq('id', editingInvoice.id);

    if (error) {
      const msg = String(error.message || '');
      if (msg.includes('NF_ALREADY_SUBMITTED_TO_SEFAZ')) {
        toast.error('Esta Nota Fiscal já foi enviada à SEFAZ e não pode ser excluída. Use o cancelamento ou a inutilização.');
        return;
      }
      toast.error(`Não foi possível excluir: ${error.message}`);
      throw error;
    }
    if (!count) {
      toast.error('Nada foi excluído. A nota pode ter sido bloqueada por uma regra do sistema.');
      return;
    }
    toast.success('Nota excluída');
    setEditingInvoice(null);
    refetch();
  };

  // A abertura da DANFE + diálogo de impressão acontece dentro do
  // InvoiceActionsDropdown.handlePrintDanfe (callback do menu). Aqui apenas
  // marcamos como impressa no banco e atualizamos a lista. Nada de window.open
  // — abrir aqui novamente causa 2 abas/janelas da mesma DANFE.
  const handlePrintDanfe = async (invoice: FiscalInvoice) => {
    if (!invoice.danfe_url) {
      toast.error('DANFE não disponível para impressão');
      return;
    }
    try {
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
      console.error('Error marking DANFE as printed:', error);
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
          product_id: item.product_id || null,
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
        transportadora_servico: (data as any).transportadora_servico || undefined,
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
      const ps = pedidoStatusOf(invoice as any);
      if (isPedidoBlockedForFiscalActions(ps)) {
        if (ps === 'pendente') {
          toast.warning('Este pedido tem pendências. Abra "Editar" e resolva antes de criar a Nota Fiscal.');
          handleEditInvoice(invoice);
        } else if (ps === 'cancelado') {
          toast.error('Pedido cancelado — não é possível emitir Nota Fiscal.');
        } else if (ps === 'chargeback_perdido') {
          toast.error('Chargeback perdido — não é possível emitir Nota Fiscal.');
        } else {
          toast.error('Pedido em chargeback — não é possível emitir Nota Fiscal.');
        }
        return;
      }
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
    // Modal central de "Enviando nota fiscal..." — fecha sozinho no finally.
    setSendingState({
      total: 1,
      done: 0,
      currentLabel: `Nota ${invoice.serie}-${invoice.numero}`,
    });
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
      setSendingState(null);
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
      ? selected.filter(i => stageOf(i) === 'pedido_venda' && !isPedidoBlockedForFiscalActions(pedidoStatusOf(i as any)))
      : selected.filter(i => stageOf(i) === 'pronta_emitir' && i.status === 'draft');

    if (targets.length === 0) {
      setIsBulkProcessing(false);
      toast.error(isOrders
        ? 'Nenhum pedido elegível para criar Nota Fiscal.'
        : 'Nenhuma NF Pronta para Emitir foi selecionada.');
      return;
    }

    // Modal central de progresso. Atualiza a cada item processado.
    setSendingState({ total: targets.length, done: 0, kind: isOrders ? 'create' : 'send' });

    try {
      for (const invoice of targets) {
        setSendingState({
          total: targets.length,
          done: successCount + errorCount,
          currentLabel: `Nota ${invoice.serie}-${invoice.numero}`,
          kind: isOrders ? 'create' : 'send',
        });
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
    } finally {
      setIsBulkProcessing(false);
      setSendingState(null);
      clearSelection();
      refetch();
    }


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

  // Helper: chama edge function fiscal-download-docs e força download do arquivo
  const downloadBulkViaBackend = async (ids: string[], format: 'xml' | 'danfe', okMsg: string) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/fiscal-download-docs`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ invoice_ids: ids, format }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Falha ao baixar arquivos');
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename="([^"]+)"/);
      const filename = m?.[1] || (format === 'xml' ? 'notas.zip' : 'notas.pdf');
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objUrl);
      toast.success(okMsg);
    } catch (error: any) {
      console.error('Bulk download error:', error);
      toast.error(error?.message || 'Erro ao baixar arquivos');
    }
  };

  const handleBulkPrint = async () => {
    const authorized = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.status === 'authorized' && inv.danfe_url
    );
    if (authorized.length === 0) { toast.error('Nenhuma NF-e autorizada com DANFE disponível'); return; }
    if (authorized.length > 100) { toast.error('Selecione no máximo 100 notas por vez.'); return; }

    const t = toast.loading(`Gerando PDF único com ${authorized.length} DANFE(s)...`);
    await downloadBulkViaBackend(
      authorized.map(i => i.id), 'danfe',
      `${authorized.length} DANFE(s) baixadas em PDF único.`,
    );
    toast.dismiss(t);

    const ids = authorized.map(inv => inv.id);
    await supabase
      .from('fiscal_invoices')
      .update({ danfe_printed_at: new Date().toISOString(), printed_at: new Date().toISOString() })
      .in('id', ids);

    clearSelection();
    refetch();
  };

  const handleBulkDownloadXml = async () => {
    const authorized = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.status === 'authorized' && (inv.xml_url || inv.xml_autorizado)
    );
    if (authorized.length === 0) { toast.error('Nenhuma NF-e autorizada com XML disponível'); return; }
    if (authorized.length > 100) { toast.error('Selecione no máximo 100 notas por vez.'); return; }

    const t = toast.loading(`Gerando ZIP com ${authorized.length} XML(s)...`);
    await downloadBulkViaBackend(
      authorized.map(i => i.id), 'xml',
      `${authorized.length} XML(s) baixados em ZIP único.`,
    );
    toast.dismiss(t);
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

  // Abre o editor de NF Fiscal em modo "em branco", SEM criar registro no banco.
  // O rascunho só é persistido quando o usuário clicar em Salvar pela primeira vez
  // (ver handleSaveInvoice — criação tardia via fiscal-create-manual modo nfe_manual).
  const handleCreateNewInvoice = () => {
    const emptyInvoice: InvoiceData = {
      // id ausente: sinaliza que ainda não há registro persistido
      numero: 0,
      serie: 0,
      data_emissao: new Date().toISOString(),
      natureza_operacao: 'VENDA DE MERCADORIA',
      cfop: '',
      indicador_presenca: 2,
      dest_nome: '',
      dest_cpf_cnpj: '',
      dest_tipo_pessoa: 'fisica',
      dest_consumidor_final: true,
      indicador_ie_dest: 9,
      dest_endereco_logradouro: '',
      dest_endereco_numero: '',
      dest_endereco_bairro: '',
      dest_endereco_municipio: '',
      dest_endereco_municipio_codigo: '',
      dest_endereco_uf: '',
      dest_endereco_cep: '',
      valor_produtos: 0,
      valor_frete: 0,
      valor_seguro: 0,
      valor_outras_despesas: 0,
      valor_desconto: 0,
      valor_total: 0,
      valor_bc_icms: 0,
      valor_icms: 0,
      valor_pis: 0,
      valor_cofins: 0,
      items: [],
      modalidade_frete: '9',
      pagamento_indicador: 0,
      pagamento_meio: '99',
      pagamento_valor: 0,
    };
    setEditingInvoice(emptyInvoice);
    setEditingInvoiceError(null);
    setEditingInvoicePendencias([]);
    setEditingInvoiceAvisos([]);
    setEditingInvoiceStatus('draft');
    setEditingInvoiceStage('pendencia');
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

  // Excluir nota sem efeito fiscal (rascunho/pronta para emitir, rejeitada ou cancelada).
  // Status com efeito fiscal (autorizada, pendente de transmissão, etc.) NÃO podem ser excluídos.
  const DELETABLE_STATUSES = new Set(['draft', 'rejected', 'cancelled']);

  // Estados terminais do pedido em que a exclusão do PV é permitida
  // (cancelamento, expiração ou reembolso já consumaram o descarte do pedido).
  const ORDER_TERMINAL_DELETABLE = new Set([
    'cancelled', 'cancelled_by_user', 'refunded', 'expired', 'payment_expired',
  ]);

  const handleDeleteDraft = async (invoice: FiscalInvoice) => {
    if (!DELETABLE_STATUSES.has(invoice.status as string)) {
      toast.error('Esta nota tem efeito fiscal e não pode ser excluída. Use Cancelar NF-e.');
      return;
    }
    setLinkedShipmentImpact(null);
    setPaidOrderBlock(null);

    const stage = (invoice as any).fiscal_stage || (invoice.status === 'draft' ? 'pedido_venda' : 'emitida');

    // Para PV raiz vinculado a pedido real: checar se pedido está pago e ativo (bloqueio).
    if (stage === 'pedido_venda' && (invoice as any).order_id && !(invoice as any).source_order_invoice_id) {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('order_number, status, payment_status')
        .eq('id', (invoice as any).order_id)
        .maybeSingle();
      if (orderRow) {
        const status = String((orderRow as any).status || '');
        const paymentStatus = String((orderRow as any).payment_status || '');
        const isPaidLike =
          ['approved', 'paid'].includes(paymentStatus) ||
          ['paid','processing','ready_to_invoice','invoice_pending_sefaz','invoice_authorized',
           'invoice_issued','invoice_rejected','shipped','in_transit','dispatched','delivered',
           'fulfilled','completed','chargeback_detected','chargeback_lost','chargeback_recovered',
           'returning','returned','invoice_cancelled'].includes(status);
        if (isPaidLike && !ORDER_TERMINAL_DELETABLE.has(status)) {
          setPaidOrderBlock({
            order_number: (orderRow as any).order_number?.toString() ?? null,
            status,
            payment_status: paymentStatus,
          });
          setConfirmDeleteInvoice(invoice);
          return;
        }
      }

      // Não bloqueado: busca objeto de postagem para informar cascata
      const { data } = await supabase
        .from('shipments')
        .select('tracking_code, delivery_status')
        .eq('source_pedido_venda_id', invoice.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setLinkedShipmentImpact({
          tracking_code: (data as any).tracking_code ?? null,
          delivery_status: (data as any).delivery_status as string,
        });
      }
    }
    setConfirmDeleteInvoice(invoice);
  };

  const executeDeleteInvoice = async () => {
    const invoice = confirmDeleteInvoice;
    if (!invoice) return;
    setIsDeletingInvoice(true);
    try {
      await supabase
        .from('fiscal_invoice_items')
        .delete()
        .eq('invoice_id', invoice.id);

      const { error } = await supabase
        .from('fiscal_invoices')
        .delete()
        .eq('id', invoice.id);

      if (error) {
        const msg = String(error.message || '');
        const isPv = ((invoice as any).fiscal_stage || (invoice.status === 'draft' ? 'pedido_venda' : 'emitida')) === 'pedido_venda';
        const label = isPv ? 'Pedido de Venda' : 'Nota Fiscal';
        // Bloqueio: pedido pago / origem ativa
        if (msg.includes('PV_FROM_PAID_ORDER_PROTECTED')) {
          toast.error('Este Pedido de Venda pertence a um pedido pago e não pode ser excluído. Cancele o pedido de origem na tela de Pedidos.');
          setConfirmDeleteInvoice(null);
          setLinkedShipmentImpact(null);
          setPaidOrderBlock(null);
          return;
        }
        // Bloqueio: objeto logístico em andamento ou entregue
        if (msg.includes('PV_SHIPMENT_IN_PROGRESS')) {
          toast.error('Este Pedido de Venda tem um objeto de postagem em andamento ou já entregue ao cliente. Cancele o envio no módulo de Logística antes de excluir.');
          setConfirmDeleteInvoice(null);
          setLinkedShipmentImpact(null);
          setPaidOrderBlock(null);
          return;
        }
        // Bloqueio: NF já enviada à SEFAZ
        if (msg.includes('NF_ALREADY_SUBMITTED_TO_SEFAZ')) {
          toast.error('Esta Nota Fiscal já foi enviada à SEFAZ e não pode ser excluída. Use o cancelamento ou a inutilização.');
          setConfirmDeleteInvoice(null);
          setLinkedShipmentImpact(null);
          setPaidOrderBlock(null);
          return;
        }
        throw error;
      }
      toast.success(((invoice as any).fiscal_stage || (invoice.status === 'draft' ? 'pedido_venda' : 'emitida')) === 'pedido_venda' ? 'Pedido de Venda excluído' : 'Nota Fiscal excluída');
      setConfirmDeleteInvoice(null);
      setLinkedShipmentImpact(null);
      setPaidOrderBlock(null);
      refetch();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      const isPv = ((invoice as any).fiscal_stage || (invoice.status === 'draft' ? 'pedido_venda' : 'emitida')) === 'pedido_venda';
      toast.error(isPv ? 'Erro ao excluir Pedido de Venda' : 'Erro ao excluir Nota Fiscal');
    } finally {
      setIsDeletingInvoice(false);
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
    const ps = pedidoStatusOf(invoice);
    if (isPedidoBlockedForFiscalActions(ps)) {
      if (ps === 'pendente') toast.warning('Resolva as pendências do pedido antes de gerar a Declaração de Conteúdo.');
      else if (ps === 'cancelado') toast.error('Pedido cancelado — Declaração de Conteúdo indisponível.');
      else if (ps === 'chargeback_perdido') toast.error('Chargeback perdido — Declaração de Conteúdo indisponível.');
      else toast.error('Pedido em chargeback — Declaração de Conteúdo indisponível.');
      return;
    }
    setDcDialogTargets([invoice]);
    setDcDialogOpen(true);
  };

  const openDcDialogForBulk = () => {
    const selected = (filteredInvoices || []).filter(
      inv => selectedInvoices.has(inv.id) && inv.fiscal_stage === 'pedido_venda'
    );
    const eligible = selected.filter(inv => !isPedidoBlockedForFiscalActions(pedidoStatusOf(inv as any)));
    const blockedCount = selected.length - eligible.length;
    if (eligible.length === 0) {
      toast.error('Nenhum pedido elegível. Pedidos com pendência, cancelados ou em chargeback ficam bloqueados.');
      return;
    }
    if (blockedCount > 0) {
      toast.warning(`${blockedCount} pedido(s) ignorado(s) por pendência/cancelado/chargeback.`);
    }
    setDcDialogTargets(eligible);
    setDcDialogOpen(true);
  };

  const handleDcDialogConfirm = async (payload: {
    reason: string;
    responsibility_acknowledged: true;
  }) => {
    setDcDialogLoading(true);
    const targets = dcDialogTargets;
    const isSingle = targets.length === 1;
    const t = toast.loading(
      isSingle
        ? 'Gerando Declaração de Conteúdo...'
        : `Gerando ${targets.length} Declarações de Conteúdo...`,
    );

    // Geração individual via menu do pedido: apenas registra a Declaração.
    // O usuário imprime depois via "Imprimir Declaração de Conteúdo".
    // Em massa: mantém comportamento atual de baixar um único PDF multipágina.
    const result = await issueAndDownloadCorreiosContentDeclarationsBatch({
      reason: payload.reason,
      responsibilityAcknowledged: true,
      source: 'manual',
      download: !isSingle,
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

    // Marca no mapa local os pedidos que agora possuem Declaração emitida,
    // para o item do menu já alternar para "Imprimir Declaração de Conteúdo".
    if (result.ok > 0) {
      const issuedIds = targets.slice(0, result.ok).map((inv: any) => inv.id).filter(Boolean);
      if (issuedIds.length) {
        setDcByInvoiceId((prev) => {
          const next = new Set(prev);
          issuedIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
    setDcDialogTargets([]);

    if (result.fail === 0 && result.ok > 0) {
      toast.success(
        isSingle
          ? `Declaração de Conteúdo gerada (${result.dcNumbers[0]}). Use "Imprimir Declaração de Conteúdo" quando precisar.`
          : `${result.ok} declarações de conteúdo geradas em um único PDF.`,
      );
    } else if (result.ok > 0 && result.fail > 0) {
      const raw = result.failures[0]?.error || '';
      const msg = raw === 'weight_required'
        ? 'Falta cadastrar o peso de um ou mais produtos. Cadastre o peso na ficha do produto e tente novamente.'
        : raw;
      toast.warning(`${result.ok} gerada(s), ${result.fail} com falha.`, { description: msg || undefined });
    } else {
      const raw = result.failures[0]?.error || 'erro desconhecido';
      const msg = raw === 'weight_required'
        ? 'Falta cadastrar o peso de um ou mais produtos. Cadastre o peso na ficha do produto e tente novamente.'
        : raw;
      toast.error('Não foi possível gerar a Declaração de Conteúdo.', { description: msg });
    }
  };

  // Imprime/baixa novamente a Declaração de Conteúdo já emitida para o pedido.
  const handlePrintContentDeclaration = async (invoice: any) => {
    setPrintingDcInvoiceId(invoice.id);
    const t = toast.loading('Gerando PDF da Declaração de Conteúdo...');
    const result = await reprintDeclarationByFiscalInvoiceId(invoice.id);
    toast.dismiss(t);
    setPrintingDcInvoiceId(null);
    if (result.ok) {
      toast.success(`Declaração ${result.dcNumber || ''} baixada.`);
    } else {
      toast.error(result.error || 'Não foi possível imprimir a Declaração de Conteúdo.');
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
        (() => {
          const all = modeFilteredInvoices || [];
          const cEmAberto = all.filter(i => pedidoStatusOf(i) === 'em_aberto').length;
          const cPendente = all.filter(i => pedidoStatusOf(i) === 'pendente').length;
          const cConcluido = all.filter(i => pedidoStatusOf(i) === 'concluido').length;
          const cCbAndamento = all.filter(i => pedidoStatusOf(i) === 'chargeback_em_andamento').length;
          const cCbPerdido = all.filter(i => pedidoStatusOf(i) === 'chargeback_perdido').length;
          const cCancelado = all.filter(i => pedidoStatusOf(i) === 'cancelado').length;
          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard
                title="Em aberto"
                value={statsLoading ? '...' : cEmAberto.toString()}
                icon={FileText}
                variant="info"
              />
              <StatCard
                title="Pendente"
                value={statsLoading ? '...' : cPendente.toString()}
                icon={AlertTriangle}
                variant="warning"
              />
              <StatCard
                title="Concluído"
                value={statsLoading ? '...' : cConcluido.toString()}
                icon={CheckCircle}
                variant="success"
              />
              <StatCard
                title="Chargeback em andamento"
                value={statsLoading ? '...' : cCbAndamento.toString()}
                icon={AlertTriangle}
                variant="warning"
              />
              <StatCard
                title="Chargeback perdido"
                value={statsLoading ? '...' : cCbPerdido.toString()}
                icon={AlertTriangle}
                variant="destructive"
              />
              <StatCard
                title="Cancelado"
                value={statsLoading ? '...' : cCancelado.toString()}
                icon={XCircle}
                variant="default"
              />
            </div>
          );
        })()
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
            <CardTitle className="text-lg font-semibold">
              {cardTitle}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({totalFiltered} {mode === 'orders' ? (totalFiltered === 1 ? 'pedido' : 'pedidos') : (totalFiltered === 1 ? 'nota' : 'notas')})
              </span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar por número, nome, CPF/CNPJ, e-mail ou telefone..."
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
                {mode === 'invoices' && (
                  <Select value={tipoNotaFilter} onValueChange={setTipoNotaFilter}>
                    <SelectTrigger className="h-9 w-[180px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="remessa">Remessa</SelectItem>
                      <SelectItem value="devolucao">Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                )}

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
                              title="Imprime as Declarações de Conteúdo (já emitidas nativamente em cada Pedido de Venda)"
                            >
                              <Printer className="h-4 w-4 mr-2" />
                              {selectedDraftsCount === 1
                                ? 'Imprimir Declaração de Conteúdo'
                                : `Imprimir Declarações de Conteúdo (${selectedDraftsCount})`}
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
                    {pagedInvoices.map((invoice) => {
                      const status = statusConfig[invoice.status] || statusConfig.draft;
                      const StatusIcon = status.icon;
                      const isPrinted = (invoice as any).danfe_printed_at;
                      const isRowLoading =
                        submittingInvoiceId === invoice.id ||
                        preparingInvoiceId === invoice.id ||
                        checkingStatusInvoiceId === invoice.id;
                      const isHighlighted = highlightedInvoiceId === invoice.id;

                      return (
                        <TableRow
                          key={invoice.id}
                          ref={(el) => { rowRefs.current[invoice.id] = el; }}
                          className={
                            isHighlighted
                              ? 'bg-primary/10 ring-2 ring-primary/40 transition-colors duration-500'
                              : selectedInvoices.has(invoice.id)
                                ? 'bg-muted/50'
                                : ''
                          }
                        >
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
                              {mode === 'orders' ? (() => {
                                const ps = pedidoStatusOf(invoice);
                                const info = PEDIDO_STATUS_CONFIG[ps];
                                const Icon = info.icon;
                                const motivos = getPendenciaMotivos(invoice as any);
                                return (
                                  <>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${info.className}`}>
                                      <Icon className="h-3 w-3" />
                                      {info.label}
                                    </span>
                                    {ps === 'pendente' && motivos.length > 0 && (
                                      <p className="text-xs text-yellow-700 max-w-[220px] truncate" title={motivos.join(' • ')}>
                                        {motivos[0]}
                                      </p>
                                    )}
                                  </>
                                );
                              })() : (mode === 'invoices' && (stageOf(invoice) === 'pronta_emitir' || stageOf(invoice) === 'pendencia')) ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${stageConfig[stageOf(invoice)].className}`}>
                                  {(() => { const I = stageConfig[stageOf(invoice)].icon; return <I className="h-3 w-3" />; })()}
                                  {stageConfig[stageOf(invoice)].label}
                                </span>
                              ) : isRowLoading ? (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${COLOR.yellow}`}>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Processando...
                                </span>
                              ) : invoice.status === 'authorized' && isPrinted ? (
                                // Regra: 1 pílula por linha. NF autorizada + impressa
                                // mostra APENAS "Impressa" (estado mais recente vence).
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${COLOR.green}`}>
                                  <Printer className="h-3 w-3" />
                                  Impressa
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
                              {Array.isArray((invoice as any).pendencia_avisos) && (invoice as any).pendencia_avisos.length > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium w-fit bg-yellow-500/15 text-yellow-800 border border-yellow-500/30 dark:text-yellow-300 max-w-[260px] truncate"
                                  title={(invoice as any).pendencia_avisos.join(' • ')}
                                >
                                  ⚠ {(invoice as any).pendencia_avisos[0]}
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
                            {(() => {
                              const ps = mode === 'orders' ? pedidoStatusOf(invoice) : null;
                              const blocked = ps ? isPedidoBlockedForFiscalActions(ps) : false;
                              const blockedReason = ps ? getPedidoBlockedReason(ps) : undefined;
                              return (
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
                              onResend={() => handleQuickSubmit(invoice)}
                              onGenerateDC={mode === 'orders' ? () => openDcDialogForInvoice(invoice) : undefined}
                              onPrintDC={mode === 'orders' ? () => handlePrintContentDeclaration(invoice) : undefined}
                              hasContentDeclaration={mode === 'orders' ? dcByInvoiceId.has(invoice.id) : false}
                              isGeneratingDC={generatingDcInvoiceId === invoice.id}
                              isPrintingDC={printingDcInvoiceId === invoice.id}
                              isSubmitting={submittingInvoiceId === invoice.id || preparingInvoiceId === invoice.id}
                              isCheckingStatus={checkingStatusInvoiceId === invoice.id}
                              cloneLabel={mode === 'orders' ? 'Duplicar Pedido de Venda' : 'Duplicar NF'}
                              pedidoBlocked={blocked}
                              pedidoBlockedReason={blockedReason}
                              emitLabel={
                                mode === 'orders'
                                  ? 'Criar Nota Fiscal'
                                  : (stageOf(invoice) === 'pendencia'
                                      ? 'Editar e revalidar'
                                      : 'Emitir Nota Fiscal')
                              }
                            />
                              );
                            })()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Rodapé de paginação */}
                {totalFiltered > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t pt-3 mt-2 text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>
                        Mostrando{' '}
                        <span className="font-medium text-foreground">
                          {(currentPage - 1) * pageSize + 1}
                        </span>
                        {' – '}
                        <span className="font-medium text-foreground">
                          {Math.min(currentPage * pageSize, totalFiltered)}
                        </span>
                        {' de '}
                        <span className="font-medium text-foreground">{totalFiltered}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span>Por página:</span>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage <= 1}
                      >
                        Primeira
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        Anterior
                      </Button>
                      <span className="px-2 text-muted-foreground">
                        Página <span className="font-medium text-foreground">{currentPage}</span> de{' '}
                        <span className="font-medium text-foreground">{totalPages}</span>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        Próxima
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages}
                      >
                        Última
                      </Button>
                    </div>
                  </div>
                )}
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
              setEditingInvoicePendencias([]);
              setEditingInvoiceStatus(null);
              setEditingInvoiceStage(null);
            }
          }}
          invoice={editingInvoice}
          onSave={handleSaveInvoice}
          onDelete={handleDeleteInvoice}
          rejectionError={editingInvoiceError || undefined}
          pendenciaMotivos={editingInvoicePendencias}
          pendenciaAvisos={editingInvoiceAvisos}
          invoiceStatus={editingInvoiceStatus || undefined}
          invoiceStage={editingInvoiceStage}
          onPrepare={async (data) => {
            if (!data?.id) return;
            await handlePrepareInvoice({ id: data.id } as any);
          }}
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

      {/* Modal de progresso de envio à Sefaz (individual e em lote) */}
      <SendingInvoiceModal state={sendingState} />

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
      {/* Confirmar emissão de NF-e */}
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
            <AlertDialogTitle>Emitir NF-e?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>A NF-e será enviada para autorização da SEFAZ e terá <strong>valor fiscal real</strong>. Esta ação não pode ser desfeita.</p>
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
              Emitir NF-e
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão de nota sem efeito fiscal */}
      <AlertDialog
        open={!!confirmDeleteInvoice}
        onOpenChange={(open) => {
          if (!open && !isDeletingInvoice) {
            setConfirmDeleteInvoice(null);
            setLinkedShipmentImpact(null);
            setPaidOrderBlock(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paidOrderBlock ? 'Não é possível excluir este Pedido de Venda' : 'Excluir este registro?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {paidOrderBlock ? (
                  <>
                    <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                      Este Pedido de Venda pertence a um pedido pago{paidOrderBlock.order_number ? ` (#${paidOrderBlock.order_number})` : ''} e <strong>não pode ser excluído</strong>.
                    </p>
                    <p>
                      Para descartar, <strong>cancele o pedido de origem</strong> na tela de Pedidos. O Pedido de Venda e o objeto de postagem serão removidos automaticamente.
                    </p>
                    {confirmDeleteInvoice && (
                      <p className="text-muted-foreground">
                        {confirmDeleteInvoice.serie}-{confirmDeleteInvoice.numero} · {confirmDeleteInvoice.dest_nome} · {formatCurrency(confirmDeleteInvoice.valor_total)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      Esta ação <strong>não pode ser desfeita</strong>. O registro será removido permanentemente do sistema.
                    </p>
                    {confirmDeleteInvoice && (
                      <p className="text-muted-foreground">
                        {confirmDeleteInvoice.serie}-{confirmDeleteInvoice.numero} · {confirmDeleteInvoice.dest_nome} · {formatCurrency(confirmDeleteInvoice.valor_total)}
                      </p>
                    )}
                    {confirmDeleteInvoice && (
                      <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
                        O número <strong>#{confirmDeleteInvoice.numero}</strong> ficará disponível para a próxima criação.
                      </p>
                    )}
                    {linkedShipmentImpact && (
                      <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                        Este Pedido de Venda tem um objeto de postagem associado{linkedShipmentImpact.tracking_code ? ` (nº ${linkedShipmentImpact.tracking_code})` : ''}. <strong>Ele será excluído junto.</strong> Se a remessa ficar vazia, também será removida.
                      </p>
                    )}
                    <p className="text-muted-foreground">
                      Só é permitido excluir registros sem efeito fiscal (Pedido de Venda, Pronta para Emitir, Rejeitada ou Cancelada).
                    </p>
                  </>

                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingInvoice}>
              {paidOrderBlock ? 'Entendi' : 'Cancelar'}
            </AlertDialogCancel>
            {!paidOrderBlock && (
              <AlertDialogAction
                disabled={isDeletingInvoice}
                onClick={(e) => { e.preventDefault(); executeDeleteInvoice(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeletingInvoice ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            )}
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
