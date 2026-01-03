import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { FiscalInvoice } from '@/hooks/useFiscal';
import { format } from 'date-fns';

interface ExportInvoicesButtonProps {
  invoices: FiscalInvoice[];
  isLoading?: boolean;
}

export function ExportInvoicesButton({ invoices, isLoading }: ExportInvoicesButtonProps) {
  const handleExport = () => {
    if (!invoices || invoices.length === 0) {
      toast.error('Nenhuma NF-e para exportar');
      return;
    }

    try {
      // Create CSV header
      const headers = [
        'Número',
        'Série',
        'Data Emissão',
        'Destinatário',
        'CPF/CNPJ',
        'Valor Total',
        'Status',
        'Chave de Acesso',
        'Protocolo',
      ];

      // Create CSV rows
      const rows = invoices.map(inv => [
        inv.numero,
        inv.serie,
        format(new Date(inv.created_at), 'dd/MM/yyyy HH:mm'),
        `"${inv.dest_nome.replace(/"/g, '""')}"`, // Escape quotes
        inv.dest_cpf_cnpj,
        inv.valor_total.toFixed(2).replace('.', ','),
        getStatusLabel(inv.status),
        inv.chave_acesso || '',
        (inv as any).protocolo || '',
      ]);

      // Combine header and rows
      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      // Add BOM for Excel UTF-8 compatibility
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nfes_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${invoices.length} NF-e(s) exportadas`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Erro ao exportar NF-es');
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleExport}
      disabled={isLoading || !invoices?.length}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </>
      )}
    </Button>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    pending: 'Processando',
    authorized: 'Autorizada',
    rejected: 'Rejeitada',
    canceled: 'Cancelada',
    cancelled: 'Cancelada',
  };
  return labels[status] || status;
}
