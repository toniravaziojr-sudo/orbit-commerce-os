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
  Trash2,
  ArrowDownLeft,
  RotateCcw
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
  onEmitirDevolucao?: () => void;
  onResendEmail?: () => void;
  /** Reenvia a NF rejeitada à SEFAZ sem abrir edição (mesmos dados). */
  onResend?: () => void;
  /** Gera PDF de Declaração de Conteúdo (documento NÃO fiscal). */
  onGenerateDC?: () => void;
  isSubmitting?: boolean;
  isCheckingStatus?: boolean;
  isGeneratingDC?: boolean;
  /** Rótulo do item de clonagem ("Clonar Pedido" na aba Pedidos, "Clonar NF" na aba Notas Fiscais). */
  cloneLabel?: string;
  /** Rótulo do item de emissão (ex.: "Emitir NF-e de teste" em homologação). */
  emitLabel?: string;
  /** True quando o Pedido de Venda está bloqueado por pendência/cancelado/chargeback — desabilita Criar NF e Declaração de Conteúdo. */
  pedidoBlocked?: boolean;
  /** Mensagem do bloqueio (tooltip). */
  pedidoBlockedReason?: string;
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
  onEmitirDevolucao,
  onResendEmail,
  onResend,
  onGenerateDC,
  isSubmitting,
  isCheckingStatus,
  isGeneratingDC,
  cloneLabel = 'Duplicar NF',
  emitLabel = 'Emitir NF-e',
  pedidoBlocked = false,
  pedidoBlockedReason,
}: InvoiceActionsDropdownProps) {
  const [isDownloadingXml, setIsDownloadingXml] = useState(false);

  const isPrinted = !!invoice.danfe_printed_at;
  const isAuthorized = invoice.status === 'authorized';
  const isDraft = invoice.status === 'draft';
  const isPending = invoice.status === 'pending' || (invoice.status as string) === 'processing';
  const isRejected = invoice.status === 'rejected';
  const isCanceled = invoice.status === 'cancelled';

  // Download via backend (XML ou DANFE individual) — força attachment + nome padrão
  const downloadViaBackend = async (format: 'xml' | 'danfe') => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/fiscal-download-docs`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ invoice_ids: [invoice.id], format }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Falha ao baixar arquivo');
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename="([^"]+)"/);
      const filename = m?.[1] || (format === 'xml' ? 'nota.xml' : 'danfe.pdf');
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objUrl);
      toast.success(format === 'xml' ? 'XML baixado' : 'DANFE baixado');
    } catch (error: any) {
      console.error('Error downloading:', error);
      toast.error(error?.message || 'Erro ao baixar arquivo');
    }
  };

  const handleDownloadDanfe = () => downloadViaBackend('danfe');

  const handleDownloadXml = async () => {
    setIsDownloadingXml(true);
    try { await downloadViaBackend('xml'); } finally { setIsDownloadingXml(false); }
  };

  // Print DANFE (opens print dialog) — segue usando URL direta para preview
  const handlePrintDanfe = async () => {
    if (!invoice.danfe_url) {
      toast.error('DANFE não disponível para impressão');
      return;
    }
    try {
      const printWindow = window.open(invoice.danfe_url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => { printWindow.print(); });
      }
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
              disabled={isSubmitting || pedidoBlocked}
              className={pedidoBlocked ? undefined : "text-green-600"}
              title={pedidoBlocked ? pedidoBlockedReason : undefined}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {emitLabel}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              {cloneLabel}
            </DropdownMenuItem>
            {onGenerateDC && (
              <DropdownMenuItem
                onClick={onGenerateDC}
                disabled={isGeneratingDC || pedidoBlocked}
                title={pedidoBlocked ? pedidoBlockedReason : undefined}
              >
                {isGeneratingDC ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Gerar Declaração de Conteúdo
              </DropdownMenuItem>
            )}
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
            {onResend && (
              <DropdownMenuItem
                onClick={onResend}
                disabled={isSubmitting}
                className="text-green-600"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Reenviar para SEFAZ
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicar como rascunho
            </DropdownMenuItem>
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </>
            )}
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
              {cloneLabel}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEmitirDevolucao}>
              <ArrowDownLeft className="h-4 w-4 mr-2" />
              Emitir Devolução
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onViewTimeline}>
              <History className="h-4 w-4 mr-2" />
              Ver Histórico
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onResendEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Reenviar por Email
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
              {cloneLabel}
            </DropdownMenuItem>
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </>
            )}
          </>
        )}

        {/* View order - available for all */}
        {invoice.order_id && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onViewOrder}>
              <Eye className="h-4 w-4 mr-2" />
              Ver Pedido de Venda
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}