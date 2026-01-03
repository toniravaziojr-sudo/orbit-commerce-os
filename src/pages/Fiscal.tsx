import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, XCircle, Settings, RefreshCw, Loader2, Printer, ArrowDownLeft, Hash, Search, History } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useFiscalStats, useFiscalInvoices, useFiscalSettings, useCheckInvoiceStatus, type FiscalInvoice } from '@/hooks/useFiscal';
import { FiscalAlertsCard } from '@/components/fiscal/FiscalAlertsCard';
import { ManualInvoiceDialog } from '@/components/fiscal/ManualInvoiceDialog';
import { InvoiceEditor, type InvoiceData } from '@/components/fiscal/InvoiceEditor';
import { CancelInvoiceDialog } from '@/components/fiscal/CancelInvoiceDialog';
import { InvoiceActionsDropdown } from '@/components/fiscal/InvoiceActionsDropdown';
import { FiscalErrorResolver, parseErrorMessage } from '@/components/fiscal/FiscalErrorResolver';
import { CorrectInvoiceDialog } from '@/components/fiscal/CorrectInvoiceDialog';
import { InutilizarNumerosDialog } from '@/components/fiscal/InutilizarNumerosDialog';
import { EntryInvoiceDialog } from '@/components/fiscal/EntryInvoiceDialog';
import { InvoiceFiltersComponent, type InvoiceFilters } from '@/components/fiscal/InvoiceFilters';
import { ExportInvoicesButton } from '@/components/fiscal/ExportInvoicesButton';
import { InvoiceTimeline } from '@/components/fiscal/InvoiceTimeline';
import { ConsultaChaveDialog } from '@/components/fiscal/ConsultaChaveDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  draft: { label: 'Pronta para Emitir', variant: 'secondary', icon: FileText },
  pending: { label: 'Processando', variant: 'outline', icon: Clock },
  authorized: { label: 'Autorizada', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejeitada', variant: 'destructive', icon: XCircle },
  canceled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
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

type TabStatus = 'draft' | 'authorized' | 'printed' | 'pending' | 'rejected' | 'cancelled';

export default function Fiscal() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabStatus>('draft');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [submittingInvoiceId, setSubmittingInvoiceId] = useState<string | null>(null);
  const [cancelingInvoice, setCancelingInvoice] = useState<FiscalInvoice | null>(null);
  const [correctingInvoice, setCorrectingInvoice] = useState<FiscalInvoice | null>(null);
  const [inutilizarDialogOpen, setInutilizarDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [consultaChaveOpen, setConsultaChaveOpen] = useState(false);
  const [timelineInvoice, setTimelineInvoice] = useState<FiscalInvoice | null>(null);
  const [errorResolverOpen, setErrorResolverOpen] = useState(false);
  const [currentErrors, setCurrentErrors] = useState<any[]>([]);
  const [currentErrorInvoiceId, setCurrentErrorInvoiceId] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<InvoiceFilters>({});
  
  const { settings, isLoading: settingsLoading } = useFiscalSettings();
  const { data: stats, isLoading: statsLoading } = useFiscalStats();
  const { data: invoices, isLoading: invoicesLoading, refetch } = useFiscalInvoices();
  const checkStatus = useCheckInvoiceStatus();

  const isLoading = settingsLoading || statsLoading || invoicesLoading;
  const isConfigured = settings?.is_configured;

  // Auto-create drafts on page load when configured
  useEffect(() => {
    if (isConfigured && !isAutoCreating) {
      autoCreateDrafts();
    }
  }, [isConfigured]);

  const autoCreateDrafts = async () => {
    setIsAutoCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-auto-create-drafts');
      
      if (error) {
        console.error('Error auto-creating drafts:', error);
      } else if (data?.created > 0) {
        toast.success(`${data.created} rascunho(s) criado(s) automaticamente`);
        refetch();
      }
    } catch (error) {
      console.error('Error calling auto-create-drafts:', error);
    } finally {
      setIsAutoCreating(false);
    }
  };

  // Filter invoices by tab, search, and advanced filters
  const filteredInvoices = invoices?.filter(inv => {
    // Filter by tab
    if (activeTab === 'draft' && inv.status !== 'draft') return false;
    if (activeTab === 'authorized' && (inv.status !== 'authorized' || (inv as any).danfe_printed_at)) return false;
    if (activeTab === 'printed' && (inv.status !== 'authorized' || !(inv as any).danfe_printed_at)) return false;
    if (activeTab === 'pending' && inv.status !== 'pending') return false;
    if (activeTab === 'rejected' && inv.status !== 'rejected') return false;
    if (activeTab === 'cancelled' && inv.status !== 'cancelled' && inv.status !== 'canceled') return false;
    
    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        inv.numero.toString().includes(search) ||
        inv.dest_nome.toLowerCase().includes(search) ||
        inv.dest_cpf_cnpj.includes(search) ||
        inv.chave_acesso?.includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Advanced filters
    if (advancedFilters.startDate) {
      const invDate = new Date(inv.created_at);
      if (invDate < advancedFilters.startDate) return false;
    }
    if (advancedFilters.endDate) {
      const invDate = new Date(inv.created_at);
      const endOfDay = new Date(advancedFilters.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      if (invDate > endOfDay) return false;
    }
    if (advancedFilters.minValue && inv.valor_total < advancedFilters.minValue) return false;
    if (advancedFilters.maxValue && inv.valor_total > advancedFilters.maxValue) return false;
    if (advancedFilters.destNome) {
      const searchName = advancedFilters.destNome.toLowerCase();
      if (!inv.dest_nome.toLowerCase().includes(searchName) && 
          !inv.dest_cpf_cnpj.includes(searchName)) return false;
    }
    if (advancedFilters.numero && !inv.numero.toString().includes(advancedFilters.numero)) return false;

    return true;
  });

  // Count by status for tabs
  const counts = {
    draft: invoices?.filter(i => i.status === 'draft').length || 0,
    authorized: invoices?.filter(i => i.status === 'authorized' && !(i as any).danfe_printed_at).length || 0,
    printed: invoices?.filter(i => i.status === 'authorized' && (i as any).danfe_printed_at).length || 0,
    pending: invoices?.filter(i => i.status === 'pending').length || 0,
    rejected: invoices?.filter(i => i.status === 'rejected').length || 0,
    canceled: invoices?.filter(i => i.status === 'canceled' || i.status === 'cancelled').length || 0,
  };

  const handleCheckStatus = async (invoiceId: string) => {
    await checkStatus.mutateAsync(invoiceId);
    refetch();
  };

  const handleEditInvoice = async (invoice: FiscalInvoice) => {
    // Fetch full invoice data with items
    const { data, error } = await supabase
      .from('fiscal_invoices')
      .select('*, fiscal_invoice_items(*)')
      .eq('id', invoice.id)
      .single();

    if (error || !data) {
      toast.error('Erro ao carregar dados da NF-e');
      return;
    }

    // Transform to InvoiceData format
    const invoiceData: InvoiceData = {
      id: data.id,
      order_id: data.order_id || undefined,
      numero: data.numero,
      serie: data.serie,
      data_emissao: data.created_at,
      natureza_operacao: data.natureza_operacao,
      cfop: data.cfop || '',
      observacoes: data.observacoes || undefined,
      dest_nome: data.dest_nome,
      dest_cpf_cnpj: data.dest_cpf_cnpj,
      dest_ie: data.dest_inscricao_estadual || undefined,
      dest_tipo_pessoa: data.dest_cpf_cnpj?.replace(/\D/g, '').length === 11 ? 'fisica' : 'juridica',
      dest_consumidor_final: true,
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
      modalidade_frete: (data as any).modalidade_frete || '9',
      transportadora_nome: (data as any).transportadora_nome || undefined,
      transportadora_cnpj: (data as any).transportadora_cnpj || undefined,
      peso_bruto: (data as any).peso_bruto || undefined,
      peso_liquido: (data as any).peso_liquido || undefined,
      quantidade_volumes: (data as any).quantidade_volumes || undefined,
      especie_volumes: (data as any).especie_volumes || undefined,
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
      })),
    };

    setEditingInvoice(invoiceData);
  };

  const handleSaveInvoice = async (data: InvoiceData) => {
    const { error } = await supabase.functions.invoke('fiscal-update-draft', {
      body: { invoice_id: data.id, data },
    });

    if (error) throw error;
    refetch();
  };

  const handleSubmitInvoice = async (data: InvoiceData) => {
    // First save, then submit
    await handleSaveInvoice(data);
    
    const { error } = await supabase.functions.invoke('fiscal-submit', {
      body: { invoice_id: data.id },
    });

    if (error) throw error;
    toast.success('NF-e enviada para autorização');
    refetch();
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
      // Open PDF in new window for printing
      const printWindow = window.open(invoice.danfe_url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
      
      // Mark as printed in database
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

  const handleDuplicateInvoice = async (invoice: FiscalInvoice) => {
    try {
      // Fetch full invoice data with items
      const { data, error } = await supabase
        .from('fiscal_invoices')
        .select('*, fiscal_invoice_items(*)')
        .eq('id', invoice.id)
        .single();

      if (error || !data) {
        toast.error('Erro ao carregar dados da NF-e');
        return;
      }

      // Create new draft based on this invoice
      const { data: newInvoice, error: createError } = await supabase.functions.invoke('fiscal-create-manual', {
        body: {
          natureza_operacao: data.natureza_operacao,
          dest_nome: data.dest_nome,
          dest_cpf_cnpj: data.dest_cpf_cnpj,
          dest_inscricao_estadual: data.dest_inscricao_estadual,
          dest_endereco_logradouro: data.dest_endereco_logradouro,
          dest_endereco_numero: data.dest_endereco_numero,
          dest_endereco_complemento: data.dest_endereco_complemento,
          dest_endereco_bairro: data.dest_endereco_bairro,
          dest_endereco_municipio: data.dest_endereco_municipio,
          dest_endereco_uf: data.dest_endereco_uf,
          dest_endereco_cep: data.dest_endereco_cep,
          observacoes: data.observacoes,
          items: (data.fiscal_invoice_items || []).map((item: any) => ({
            codigo: item.codigo_produto,
            descricao: item.descricao,
            ncm: item.ncm,
            cfop: item.cfop,
            unidade: item.unidade,
            quantidade: item.quantidade,
            valor_unitario: item.valor_unitario,
            origem: item.origem,
            csosn: item.csosn,
          })),
        },
      });

      if (createError) throw createError;

      toast.success('NF-e duplicada como rascunho');
      refetch();
    } catch (error: any) {
      console.error('Error duplicating invoice:', error);
      toast.error(error.message || 'Erro ao duplicar NF-e');
    }
  };

  const handleQuickSubmit = async (invoice: FiscalInvoice) => {
    setSubmittingInvoiceId(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-submit', {
        body: { invoice_id: invoice.id },
      });

      if (error) throw error;
      
      // Check if the response indicates an error
      if (data && !data.success) {
        // Parse errors and show error resolver
        const errors = parseErrorMessage(data.error || 'Erro desconhecido');
        setCurrentErrors(errors);
        setCurrentErrorInvoiceId(invoice.id);
        setErrorResolverOpen(true);
        return;
      }
      
      toast.success('NF-e enviada para autorização');
      refetch();
    } catch (error: any) {
      console.error('Error submitting invoice:', error);
      
      // Parse errors and show error resolver
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

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fiscal"
        description="Emissão de notas fiscais e integrações fiscais"
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova NF-e
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setManualDialogOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  NF-e de Saída (Venda)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEntryDialogOpen(true)}>
                  <ArrowDownLeft className="h-4 w-4 mr-2" />
                  NF-e de Entrada (Devolução)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setInutilizarDialogOpen(true)}>
                  <Hash className="h-4 w-4 mr-2" />
                  Inutilizar Numeração
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConsultaChaveOpen(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  Consultar por Chave
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => navigate('/settings/fiscal')}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          </div>
        }
      />

      {/* Fiscal Alerts */}
      <FiscalAlertsCard />

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
              <Button onClick={() => navigate('/settings/fiscal')}>
                Configurar Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Prontas para Emitir"
          value={statsLoading ? '...' : counts.draft.toString()}
          icon={FileText}
          variant="warning"
        />
        <StatCard
          title="Autorizadas"
          value={statsLoading ? '...' : stats?.authorized?.toString() || '0'}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Pendentes SEFAZ"
          value={statsLoading ? '...' : stats?.pending?.toString() || '0'}
          icon={Clock}
          variant="primary"
        />
        <StatCard
          title="Rejeitadas"
          value={statsLoading ? '...' : stats?.rejected?.toString() || '0'}
          icon={XCircle}
          variant="destructive"
        />
      </div>

      {/* NF-e List with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Notas Fiscais</CardTitle>
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
                onClick={() => {
                  autoCreateDrafts();
                  refetch();
                }}
                disabled={isAutoCreating}
              >
                <RefreshCw className={`h-4 w-4 ${isAutoCreating ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabStatus)} className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList className="flex flex-wrap h-auto gap-1">
                <TabsTrigger value="draft" className="gap-1">
                  <FileText className="h-3 w-3" />
                  Prontas para Emitir
                  {counts.draft > 0 && <Badge variant="secondary" className="ml-1 bg-amber-500/20 text-amber-600">{counts.draft}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="authorized" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Autorizadas
                  {counts.authorized > 0 && <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-600">{counts.authorized}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="printed" className="gap-1">
                  <Printer className="h-3 w-3" />
                  Emitidas
                  {counts.printed > 0 && <Badge variant="secondary" className="ml-1">{counts.printed}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Pendentes SEFAZ
                  {counts.pending > 0 && <Badge variant="secondary" className="ml-1">{counts.pending}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="rejected" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Rejeitadas
                  {counts.rejected > 0 && <Badge variant="destructive" className="ml-1">{counts.rejected}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="gap-1">
                  Canceladas
                  {counts.canceled > 0 && <Badge variant="secondary" className="ml-1">{counts.canceled}</Badge>}
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <InvoiceFiltersComponent 
                  filters={advancedFilters} 
                  onChange={setAdvancedFilters}
                  onClear={() => setAdvancedFilters({})}
                />
                <ExportInvoicesButton invoices={filteredInvoices || []} isLoading={invoicesLoading} />
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredInvoices || filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={`Nenhuma NF-e ${statusConfig[activeTab]?.label || activeTab}`}
                description={isConfigured 
                  ? activeTab === 'draft' 
                    ? "Quando houver pedidos aprovados, os rascunhos de NF-e aparecerão aqui automaticamente. Você pode editar e emitir quando quiser."
                    : "As NF-e aparecerão aqui conforme forem processadas."
                  : "Configure sua integração fiscal para emitir NF-e automaticamente."}
                action={!isConfigured ? {
                  label: "Configurar Integração",
                  onClick: () => navigate('/settings/fiscal'),
                } : undefined}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
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
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.serie}-{invoice.numero}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
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
                            <Badge variant={status.variant} className="gap-1 w-fit">
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                            {invoice.status === 'authorized' && isPrinted && (
                              <Badge variant="outline" className="gap-1 w-fit text-xs">
                                <Printer className="h-3 w-3" />
                                Impressa
                              </Badge>
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
                            onSubmit={() => handleQuickSubmit(invoice)}
                            onCheckStatus={() => handleCheckStatus(invoice.id)}
                            onViewOrder={() => navigate(`/orders/${invoice.order_id}`)}
                            onCancel={() => setCancelingInvoice(invoice)}
                            onPrint={() => handlePrintDanfe(invoice)}
                            onDuplicate={() => handleDuplicateInvoice(invoice)}
                            onCorrect={() => setCorrectingInvoice(invoice)}
                            onViewTimeline={() => setTimelineInvoice(invoice)}
                            isSubmitting={submittingInvoiceId === invoice.id}
                            isCheckingStatus={checkStatus.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Tabs>
        </CardContent>
      </Card>


      {/* Manual Invoice Dialog */}
      <ManualInvoiceDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />

      {/* Invoice Editor */}
      {editingInvoice && (
        <InvoiceEditor
          open={!!editingInvoice}
          onOpenChange={(open) => !open && setEditingInvoice(null)}
          invoice={editingInvoice}
          onSave={handleSaveInvoice}
          onSubmit={handleSubmitInvoice}
          onDelete={handleDeleteInvoice}
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
        onOpenChange={setEntryDialogOpen}
        onSuccess={() => refetch()}
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
    </div>
  );
}
