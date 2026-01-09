import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Download, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';

export interface ImportReportItem {
  index: number;
  identifier: string;
  status: 'imported' | 'updated' | 'skipped' | 'error';
  error?: string;
}

export interface ImportReportData {
  module: string;
  platform: string;
  totalItems: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  items: ImportReportItem[];
  completedAt: Date;
}

interface ImportReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ImportReportData | null;
}

export function ImportReportDialog({ open, onOpenChange, report }: ImportReportDialogProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'errors'>('all');

  if (!report) return null;

  const errorItems = report.items.filter(item => item.status === 'error');
  const displayItems = activeTab === 'errors' ? errorItems : report.items;

  const getModuleLabel = (module: string) => {
    const labels: Record<string, string> = {
      products: 'Produtos',
      customers: 'Clientes',
      orders: 'Pedidos',
      categories: 'Categorias',
    };
    return labels[module] || module;
  };

  const getStatusIcon = (status: ImportReportItem['status']) => {
    switch (status) {
      case 'imported':
      case 'updated':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: ImportReportItem['status']) => {
    switch (status) {
      case 'imported':
        return <Badge className="bg-green-500/10 text-green-600">Importado</Badge>;
      case 'updated':
        return <Badge className="bg-blue-500/10 text-blue-600">Atualizado</Badge>;
      case 'skipped':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Ignorado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Linha', 'Identificador', 'Status', 'Erro'];
    const rows = report.items.map(item => [
      item.index.toString(),
      item.identifier,
      item.status,
      item.error || '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-importacao-${report.module}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const exportData = {
      module: report.module,
      platform: report.platform,
      completedAt: report.completedAt.toISOString(),
      summary: {
        total: report.totalItems,
        imported: report.imported,
        updated: report.updated,
        skipped: report.skipped,
        failed: report.failed,
      },
      items: report.items,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-importacao-${report.module}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const successRate = report.totalItems > 0 
    ? Math.round(((report.imported + report.updated) / report.totalItems) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório de Importação - {getModuleLabel(report.module)}
          </DialogTitle>
          <DialogDescription>
            Plataforma: {report.platform} • Concluído em:{' '}
            {report.completedAt.toLocaleString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-5 gap-2 py-4 border-y">
          <div className="text-center">
            <div className="text-2xl font-bold">{report.totalItems}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{report.imported}</div>
            <div className="text-xs text-muted-foreground">Importados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{report.updated}</div>
            <div className="text-xs text-muted-foreground">Atualizados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{report.skipped}</div>
            <div className="text-xs text-muted-foreground">Ignorados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{report.failed}</div>
            <div className="text-xs text-muted-foreground">Erros</div>
          </div>
        </div>

        {/* Success rate */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">Taxa de sucesso:</span>
          <Badge 
            variant={successRate >= 90 ? 'default' : successRate >= 70 ? 'secondary' : 'destructive'}
            className="text-sm"
          >
            {successRate}%
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={activeTab === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('all')}
          >
            Todos ({report.items.length})
          </Button>
          <Button
            variant={activeTab === 'errors' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('errors')}
            className={errorItems.length > 0 ? 'text-destructive' : ''}
          >
            Erros ({errorItems.length})
          </Button>
        </div>

        {/* Items list */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
          <div className="space-y-2 pr-4">
            {displayItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {activeTab === 'errors' ? 'Nenhum erro encontrado!' : 'Nenhum item para exibir'}
              </div>
            ) : (
              displayItems.slice(0, 100).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50"
                >
                  {getStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{item.index}</span>
                      <span className="text-sm font-medium truncate">{item.identifier}</span>
                    </div>
                    {item.error && (
                      <p className="text-xs text-destructive mt-1">{item.error}</p>
                    )}
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              ))
            )}
            {displayItems.length > 100 && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                Exibindo 100 de {displayItems.length} itens. Exporte para ver todos.
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <Download className="h-4 w-4 mr-2" />
              Exportar JSON
            </Button>
          </div>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
