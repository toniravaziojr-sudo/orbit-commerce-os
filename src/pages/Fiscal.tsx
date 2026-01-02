import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, AlertTriangle, CheckCircle, Clock, XCircle, Settings, Eye, Download, RefreshCw, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFiscalStats, useFiscalInvoices, useFiscalSettings, useCheckInvoiceStatus, type FiscalInvoice } from '@/hooks/useFiscal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function Fiscal() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { settings, isLoading: settingsLoading } = useFiscalSettings();
  const { data: stats, isLoading: statsLoading } = useFiscalStats();
  const { data: invoices, isLoading: invoicesLoading, refetch } = useFiscalInvoices(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const checkStatus = useCheckInvoiceStatus();

  const isLoading = settingsLoading || statsLoading || invoicesLoading;
  const isConfigured = settings?.is_configured;

  // Filter invoices by search
  const filteredInvoices = invoices?.filter(inv => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      inv.numero.toString().includes(search) ||
      inv.dest_nome.toLowerCase().includes(search) ||
      inv.dest_cpf_cnpj.includes(search) ||
      inv.chave_acesso?.includes(search)
    );
  });

  const handleCheckStatus = async (invoiceId: string) => {
    await checkStatus.mutateAsync(invoiceId);
    refetch();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Fiscal"
        description="Emissão de notas fiscais e integrações fiscais"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/settings/fiscal')}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          </div>
        }
      />

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

      {/* NF-e List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Notas Fiscais</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar por número, cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="authorized">Autorizadas</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="rejected">Rejeitadas</SelectItem>
                  <SelectItem value="draft">Rascunhos</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredInvoices || filteredInvoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma nota fiscal encontrada"
              description={isConfigured 
                ? "As NF-e emitidas aparecerão aqui. Você pode emitir NF-e a partir da tela de detalhes do pedido."
                : "Configure sua integração fiscal para emitir NF-e automaticamente quando pedidos forem confirmados."}
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
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {invoice.status === 'rejected' && invoice.status_motivo && (
                          <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={invoice.status_motivo}>
                            {invoice.status_motivo}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
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
                          {invoice.status === 'authorized' && invoice.danfe_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(invoice.danfe_url!, '_blank')}
                              title="Download DANFE"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
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
    </div>
  );
}
