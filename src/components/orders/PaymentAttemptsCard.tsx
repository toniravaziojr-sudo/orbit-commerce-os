// =============================================
// PAYMENT ATTEMPTS CARD - Histórico de tentativas de pagamento
// Exibido nos detalhes do pedido (sidebar)
// =============================================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { History, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { usePaymentTransactions, type PaymentTransaction } from '@/hooks/usePaymentTransactions';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  paid: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  authorized: { label: 'Autorizado', variant: 'default', icon: CheckCircle },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  waiting_payment: { label: 'Aguardando', variant: 'secondary', icon: Clock },
  processing: { label: 'Processando', variant: 'secondary', icon: Clock },
  failed: { label: 'Falhou', variant: 'destructive', icon: XCircle },
  declined: { label: 'Recusado', variant: 'destructive', icon: XCircle },
  refused: { label: 'Recusado', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelado', variant: 'outline', icon: AlertCircle },
  canceled: { label: 'Cancelado', variant: 'outline', icon: AlertCircle },
  refunded: { label: 'Estornado', variant: 'outline', icon: AlertCircle },
  expired: { label: 'Expirado', variant: 'outline', icon: AlertCircle },
};

const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  boleto: 'Boleto',
};

const PROVIDER_LABELS: Record<string, string> = {
  pagarme: 'Pagar.me',
  mercadopago: 'Mercado Pago',
  pagbank: 'PagBank',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateString));
}

function TransactionRow({ tx, isLast }: { tx: PaymentTransaction; isLast: boolean }) {
  const statusCfg = STATUS_MAP[tx.status] || { label: tx.status, variant: 'outline' as const, icon: AlertCircle };
  const StatusIcon = statusCfg.icon;

  return (
    <>
      <div className="flex items-start gap-3 py-2">
        <div className="mt-0.5">
          <StatusIcon className={`h-4 w-4 ${
            statusCfg.variant === 'default' ? 'text-green-600' :
            statusCfg.variant === 'destructive' ? 'text-destructive' :
            'text-muted-foreground'
          }`} />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={statusCfg.variant} className="text-[10px] h-5">
              {statusCfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(tx.created_at)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {METHOD_LABELS[tx.method] || tx.method} • {PROVIDER_LABELS[tx.provider] || tx.provider}
            </span>
            <span className="font-medium">{formatCurrency(tx.amount / 100)}</span>
          </div>
          {tx.provider_transaction_id && (
            <p className="text-[10px] font-mono text-muted-foreground truncate">
              {tx.provider_transaction_id}
            </p>
          )}
          {tx.error_message && (
            <p className="text-[10px] text-destructive">
              {tx.error_message}
            </p>
          )}
        </div>
      </div>
      {!isLast && <Separator />}
    </>
  );
}

interface PaymentAttemptsCardProps {
  orderId: string;
}

export function PaymentAttemptsCard({ orderId }: PaymentAttemptsCardProps) {
  const { data: transactions = [], isLoading } = usePaymentTransactions(orderId);

  // Não renderiza se não há tentativas
  if (!isLoading && transactions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Tentativas de Pagamento
          {transactions.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 ml-auto">
              {transactions.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-2">Carregando...</p>
        ) : (
          <div className="space-y-0">
            {transactions.map((tx, i) => (
              <TransactionRow key={tx.id} tx={tx} isLast={i === transactions.length - 1} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}