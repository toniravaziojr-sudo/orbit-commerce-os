// =============================================
// REFUND PAYMENT DIALOG — Estorno admin de pagamento (total ou parcial)
// Roteia para edge `payment-refund` que identifica gateway e despacha adapter.
// Acesso: apenas owner/admin (gating também no servidor).
// =============================================

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import type { PaymentTransaction } from '@/hooks/usePaymentTransactions';

const PROVIDER_LABELS: Record<string, string> = {
  pagarme: 'Pagar.me',
  mercadopago: 'Mercado Pago',
  pagbank: 'PagBank',
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

interface RefundPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  transaction: PaymentTransaction;
}

export function RefundPaymentDialog({ open, onOpenChange, orderId, transaction }: RefundPaymentDialogProps) {
  const queryClient = useQueryClient();

  // paid_amount já considera estornos parciais (alguns gateways), mas usamos amount - refunded como base
  const alreadyRefunded = useMemo(() => {
    // refunded_amount não está no tipo PaymentTransaction; recuperamos via amount - paid_amount quando aplicável
    // Para evitar confusão, baseamos em status: se refunded => total estornado; senão => 0
    if (transaction.status === 'refunded') return transaction.amount;
    return 0;
  }, [transaction]);

  const available = Math.max(0, transaction.amount - alreadyRefunded);

  const [amountReais, setAmountReais] = useState<string>(() => (available / 100).toFixed(2));
  const [reason, setReason] = useState('');

  const refundMutation = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(amountReais.replace(',', '.')) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        throw new Error('Informe um valor de estorno válido');
      }
      if (cents > available) {
        throw new Error(`Valor excede o disponível (${formatBRL(available)})`);
      }
      if (!reason.trim() || reason.trim().length < 5) {
        throw new Error('Descreva o motivo do estorno (mínimo 5 caracteres)');
      }

      const { data, error } = await supabase.functions.invoke('payment-refund', {
        body: {
          order_id: orderId,
          transaction_id: transaction.id,
          amount: cents,
          reason: reason.trim(),
        },
      });

      if (error) throw new Error(error.message || 'Falha ao chamar estorno');
      if (!data?.success) {
        throw new Error(data?.error || 'Falha ao processar estorno');
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Estorno solicitado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['payment-transactions', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-details'] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onOpenChange(false);
      setReason('');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao estornar pagamento');
    },
  });

  const providerLabel = PROVIDER_LABELS[transaction.provider] || transaction.provider;
  const isPartial = (() => {
    const cents = Math.round(parseFloat((amountReais || '0').replace(',', '.')) * 100);
    return cents > 0 && cents < available;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!refundMutation.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Estornar pagamento
          </DialogTitle>
          <DialogDescription>
            Estorno via {providerLabel}. Esta ação é irreversível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gateway</span>
              <span className="font-medium">{providerLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor original</span>
              <span className="font-medium">{formatBRL(transaction.amount)}</span>
            </div>
            {alreadyRefunded > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Já estornado</span>
                <span className="font-medium">{formatBRL(alreadyRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Disponível para estorno</span>
              <span className="font-semibold">{formatBRL(available)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-amount">Valor a estornar (R$)</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={(available / 100).toFixed(2)}
              value={amountReais}
              onChange={(e) => setAmountReais(e.target.value)}
              disabled={refundMutation.isPending}
            />
            {isPartial && (
              <p className="text-xs text-muted-foreground">
                Estorno parcial — o saldo restante permanecerá pago.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Motivo do estorno *</Label>
            <Textarea
              id="refund-reason"
              placeholder="Descreva o motivo (será registrado no histórico do pedido)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={refundMutation.isPending}
            />
          </div>

          <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs">
              A ação será registrada como <strong>[OVERRIDE ADMIN]</strong> no histórico
              e atualizará o status de pagamento do pedido.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={refundMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => refundMutation.mutate()}
            disabled={refundMutation.isPending || available <= 0}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {refundMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar estorno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
