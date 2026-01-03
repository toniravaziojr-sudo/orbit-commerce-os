import { useState } from 'react';
import { 
  MoreHorizontal, 
  Download, 
  Printer, 
  Mail, 
  XCircle, 
  Edit, 
  FileText, 
  Send, 
  RefreshCw,
  Eye,
  Copy,
  Loader2,
  FileCode,
  FileEdit,
  History,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { FiscalInvoice } from '@/hooks/useFiscal';

interface InvoiceActionsDropdownProps {
  invoice: FiscalInvoice & { 
    danfe_printed_at?: string | null;
    authorized_at?: string | null;
    xml_url?: string | null;
  };
  onEdit?: () => void;
  onSubmit?: () => void;
  onCheckStatus?: () => void;
  onViewOrder?: () => void;
  onCancel?: () => void;
  onPrint?: () => void;
  onDuplicate?: () => void;
  onCorrect?: () => void;
  onViewTimeline?: () => void;
  onDelete?: () => void;
  isSubmitting?: boolean;
  isCheckingStatus?: boolean;
}

export function InvoiceActionsDropdown({
  invoice,
  onEdit,
  onSubmit,
  onCheckStatus,
  onViewOrder,
  onCancel,
  onPrint,
  onDuplicate,
  onCorrect,
  onViewTimeline,
  onDelete,
  isSubmitting,
  isCheckingStatus,
}: InvoiceActionsDropdownProps) {
  const [isDownloadingXml, setIsDownloadingXml] = useState(false);

  const isPrinted = !!invoice.danfe_printed_at;
  const isAuthorized = invoice.status === 'authorized';
  const isDraft = invoice.status === 'draft';
  const isPending = invoice.status === 'pending';
  const isRejected = invoice.status === 'rejected';
  const isCanceled = invoice.status === 'canceled' || invoice.status === 'cancelled';

  // Download DANFE (PDF)
  const handleDownloadDanfe = () => {
    if (invoice.danfe_url) {
      window.open(invoice.danfe_url, '_blank');
    } else {
      toast.error('DANFE não disponível');
    }
  };

  // Download XML
  const handleDownloadXml = async () => {
    const xmlUrl = invoice.xml_url || (invoice as any).xml_autorizado;
    
    if (!xmlUrl) {
      toast.error('XML não disponível');
      return;
    }

    setIsDownloadingXml(true);
    try {
      // Fetch the XML file
      const response = await fetch(xmlUrl);
      if (!response.ok) throw new Error('Erro ao baixar XML');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NFe_${invoice.chave_acesso || invoice.numero}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('XML baixado com sucesso');
    } catch (error) {
      console.error('Error downloading XML:', error);
      // Fallback: open in new tab
      window.open(xmlUrl, '_blank');
    } finally {
      setIsDownloadingXml(false);
    }
  };

  // Print DANFE (opens print dialog)
  const handlePrintDanfe = async () => {
    if (!invoice.danfe_url) {
      toast.error('DANFE não disponível para impressão');
      return;
    }

    try {
      // Open PDF in new window and print
      const printWindow = window.open(invoice.danfe_url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
      
      // Mark as printed
      onPrint?.();
    } catch (error) {
      console.error('Error printing DANFE:', error);
      toast.error('Erro ao imprimir DANFE');
    }
  };

  // Copy access key
  const handleCopyChave = () => {
    if (invoice.chave_acesso) {
      navigator.clipboard.writeText(invoice.chave_acesso);
      toast.success('Chave de acesso copiada');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Draft actions */}
        {isDraft && (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onSubmit}
              disabled={isSubmitting}
              className="text-green-600"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Emitir NF-e
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </>
        )}

        {/* Pending actions */}
        {isPending && (
          <DropdownMenuItem 
            onClick={onCheckStatus}
            disabled={isCheckingStatus}
          >
            {isCheckingStatus ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar Status
          </DropdownMenuItem>
        )}

        {/* Rejected actions */}
        {isRejected && (
          <>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar e Reemitir
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Criar Nova NF-e
            </DropdownMenuItem>
          </>
        )}

        {/* Authorized actions */}
        {isAuthorized && (
          <>
            <DropdownMenuItem onClick={handlePrintDanfe}>
              <Printer className="h-4 w-4 mr-2" />
              {isPrinted ? 'Reimprimir DANFE' : 'Imprimir DANFE'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadDanfe}>
              <Download className="h-4 w-4 mr-2" />
              Baixar DANFE (PDF)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleDownloadXml}
              disabled={isDownloadingXml}
            >
              {isDownloadingXml ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4 mr-2" />
              )}
              Baixar XML
            </DropdownMenuItem>
            {invoice.chave_acesso && (
              <DropdownMenuItem onClick={handleCopyChave}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Chave
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCorrect}>
              <FileEdit className="h-4 w-4 mr-2" />
              Carta de Correção
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar NF-e
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewTimeline}>
              <History className="h-4 w-4 mr-2" />
              Ver Histórico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onCancel}
              className="text-destructive"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar NF-e
            </DropdownMenuItem>
          </>
        )}

        {/* Canceled - show limited options */}
        {isCanceled && (
          <>
            {invoice.chave_acesso && (
              <DropdownMenuItem onClick={handleCopyChave}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Chave
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Criar Nova NF-e
            </DropdownMenuItem>
          </>
        )}

        {/* View order - available for all */}
        {invoice.order_id && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onViewOrder}>
              <Eye className="h-4 w-4 mr-2" />
              Ver Pedido
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
