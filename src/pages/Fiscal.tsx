import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, XCircle, Settings, Eye, Download, RefreshCw, Loader2, Edit, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFiscalStats, useFiscalInvoices, useFiscalSettings, useCheckInvoiceStatus, type FiscalInvoice } from '@/hooks/useFiscal';
import { PendingOrdersSection } from '@/components/fiscal/PendingOrdersSection';
import { FiscalAlertsCard } from '@/components/fiscal/FiscalAlertsCard';
import { ManualInvoiceDialog } from '@/components/fiscal/ManualInvoiceDialog';
import { InvoiceEditor, type InvoiceData } from '@/components/fiscal/InvoiceEditor';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  draft: { label: 'Rascunho', variant: 'secondary', icon: FileText },
  pending: { label: 'Processando', variant: 'outline', icon: Clock },
  authorized: { label: 'Autorizada', variant: 'default', icon: CheckCircle },
  rejected: { label: 'Rejeitada', variant: 'destructive', icon: XCircle },
  canceled: { label: 'Cancelada', variant: 'destructive', icon: XCircle },
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

type TabStatus = 'all' | 'draft' | 'authorized' | 'printed' | 'pending' | 'rejected' | 'canceled';

export default function Fiscal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  
  const { settings, isLoading: settingsLoading } = useFiscalSettings();
  const { data: stats, isLoading: statsLoading } = useFiscalStats();
  const { data: invoices, isLoading: invoicesLoading, refetch } = useFiscalInvoices();
  const checkStatus = useCheckInvoiceStatus();

  const isLoading = settingsLoading || statsLoading || invoicesLoading;
  const isConfigured = settings?.is_configured;

  // Filter invoices by tab and search
  const filteredInvoices = invoices?.filter(inv => {
    // Filter by tab
    if (activeTab === 'draft' && inv.status !== 'draft') return false;
    if (activeTab === 'authorized' && (inv.status !== 'authorized' || (inv as any).danfe_printed_at)) return false;
    if (activeTab === 'printed' && (inv.status !== 'authorized' || !(inv as any).danfe_printed_at)) return false;
    if (activeTab === 'pending' && inv.status !== 'pending') return false;
    if (activeTab === 'rejected' && inv.status !== 'rejected') return false;
    if (activeTab === 'canceled' && inv.status !== 'canceled') return false;
    
    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        inv.numero.toString().includes(search) ||
        inv.dest_nome.toLowerCase().includes(search) ||
        inv.dest_cpf_cnpj.includes(search) ||
        inv.chave_acesso?.includes(search)
      );
    }
    return true;
  });

  // Count by status for tabs
  const counts = {
    all: invoices?.length || 0,
    draft: invoices?.filter(i => i.status === 'draft').length || 0,
    authorized: invoices?.filter(i => i.status === 'authorized' && !(i as any).danfe_printed_at).length || 0,
    printed: invoices?.filter(i => i.status === 'authorized' && (i as any).danfe_printed_at).length || 0,
    pending: invoices?.filter(i => i.status === 'pending').length || 0,
    rejected: invoices?.filter(i => i.status === 'rejected').length || 0,
    canceled: invoices?.filter(i => i.status === 'canceled').length || 0,
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

  const handleMarkAsPrinted = async (invoiceId: string) => {
    const { error } = await supabase
      .from('fiscal_invoices')
      .update({ danfe_printed_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (error) {
      toast.error('Erro ao marcar como impressa');
      return;
    }
    toast.success('DANFE marcada como impressa');
    refetch();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fiscal"
        description="Emissão de notas fiscais e integrações fiscais"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setManualDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova NF-e
            </Button>
            <Button variant="outline" onClick={() => navigate('/fiscal/products')}>
              <Settings className="h-4 w-4 mr-2" />
              Produtos
            </Button>
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

      {/* Pending Orders for NF-e */}
      {isConfigured && <PendingOrdersSection />}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="NF-e Emitidas (Mês)"
          value={statsLoading ? '...' : stats?.total?.toString() || '0'}
          icon={FileText}
          variant="primary"
        />
        <StatCard
          title="Autorizadas"
          value={statsLoading ? '...' : stats?.authorized?.toString() || '0'}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Pendentes"
          value={statsLoading ? '...' : stats?.pending?.toString() || '0'}
          icon={Clock}
          variant="warning"
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
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabStatus)} className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="gap-1">
                Todas
                <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
              </TabsTrigger>
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
              <TabsTrigger value="canceled" className="gap-1">
                Canceladas
                {counts.canceled > 0 && <Badge variant="secondary" className="ml-1">{counts.canceled}</Badge>}
              </TabsTrigger>
            </TabsList>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !filteredInvoices || filteredInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={activeTab === 'all' ? 'Nenhuma nota fiscal encontrada' : `Nenhuma NF-e ${statusConfig[activeTab]?.label || activeTab}`}
                description={isConfigured 
                  ? activeTab === 'draft' 
                    ? "Notas fiscais em rascunho aparecerão aqui. Você pode editá-las antes de emitir."
                    : "As NF-e emitidas aparecerão aqui."
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
                          <div className="flex items-center justify-end gap-1">
                            {/* Draft: Edit button */}
                            {invoice.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditInvoice(invoice)}
                                title="Editar rascunho"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {/* Pending: Check status button */}
                            {invoice.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCheckStatus(invoice.id)}
                                disabled={checkStatus.isPending}
                                title="Atualizar status"
                              >
                                <RefreshCw className={`h-4 w-4 ${checkStatus.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            {/* Authorized: Download + Mark as printed */}
                            {invoice.status === 'authorized' && (
                              <>
                                {invoice.danfe_url && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => window.open(invoice.danfe_url!, '_blank')}
                                    title="Download DANFE"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                {!isPrinted && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMarkAsPrinted(invoice.id)}
                                    title="Marcar como impressa"
                                  >
                                    <Printer className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {/* View order */}
                            {invoice.order_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/orders/${invoice.order_id}`)}
                                title="Ver pedido"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Integration Card */}
      {isConfigured && (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  Integração Fiscal
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conectado ao <span className="font-medium">Focus NFe</span> • 
                  Ambiente: <span className="font-medium">{settings?.ambiente === 'producao' ? 'Produção' : 'Homologação'}</span> •
                  Série: <span className="font-medium">{settings?.serie_nfe}</span>
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/settings/fiscal')}>
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
