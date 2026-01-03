import { Clock, FileText, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOrdersPendingInvoice, useCreateDraft, useSubmitInvoice } from '@/hooks/useFiscal';
import { FiscalErrorResolver, parseErrorMessage } from '@/components/fiscal/FiscalErrorResolver';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function PendingOrdersSection() {
  const navigate = useNavigate();
  const { data: pendingOrders, isLoading, refetch } = useOrdersPendingInvoice();
  const createDraft = useCreateDraft();
  const submitInvoice = useSubmitInvoice();
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [errorResolverOpen, setErrorResolverOpen] = useState(false);
  const [currentErrors, setCurrentErrors] = useState<ReturnType<typeof parseErrorMessage>>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);

  const handleEmitNFe = async (orderId: string) => {
    try {
      setProcessingOrderId(orderId);
      setCurrentOrderId(orderId);
      
      // Create draft
      const draftResult = await createDraft.mutateAsync({ orderId });
      
      if (draftResult.invoice?.id) {
        setCurrentInvoiceId(draftResult.invoice.id);
        // Submit for authorization
        await submitInvoice.mutateAsync(draftResult.invoice.id);
        toast.success('NF-e enviada para autorização');
        refetch();
      }
    } catch (error: any) {
      console.error('Error emitting NF-e:', error);
      
      // Parse error message and show resolver
      const errorMessage = error?.message || error?.error || 'Erro desconhecido ao emitir NF-e';
      const parsedErrors = parseErrorMessage(errorMessage);
      
      setCurrentErrors(parsedErrors);
      setErrorResolverOpen(true);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRetry = () => {
    if (currentOrderId) {
      setErrorResolverOpen(false);
      handleEmitNFe(currentOrderId);
    }
  };

  if (isLoading) {
    return null;
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-base font-semibold">Pedidos Aguardando NF-e</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {pendingOrders.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingOrders.slice(0, 5).map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  #{order.order_number}
                </TableCell>
                <TableCell>
                  {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell className="max-w-[180px] truncate">
                  {order.customer_name || order.customer_email || '-'}
                </TableCell>
                <TableCell>{formatCurrency(order.total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      Ver Pedido
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEmitNFe(order.id)}
                      disabled={processingOrderId === order.id}
                    >
                      {processingOrderId === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <FileText className="h-4 w-4 mr-1" />
                      )}
                      Emitir NF-e
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {pendingOrders.length > 5 && (
          <p className="text-sm text-muted-foreground mt-3 text-center">
            E mais {pendingOrders.length - 5} pedido(s) aguardando emissão
          </p>
        )}
      </CardContent>

      {/* Error Resolver Dialog */}
      <FiscalErrorResolver
        open={errorResolverOpen}
        onOpenChange={setErrorResolverOpen}
        errors={currentErrors}
        orderId={currentOrderId || undefined}
        invoiceId={currentInvoiceId || undefined}
        onRetry={handleRetry}
      />
    </Card>
  );
}
