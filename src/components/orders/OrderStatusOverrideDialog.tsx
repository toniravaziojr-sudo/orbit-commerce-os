import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OrderStatusOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromLabel: string;
  toLabel: string;
  scope: 'order' | 'payment' | 'shipping';
  onConfirm: () => void;
}

const SCOPE_CONSEQUENCES: Record<OrderStatusOverrideDialogProps['scope'], string[]> = {
  order: [
    'Pode disparar geração automática de rascunho de NFe',
    'Pode recalcular métricas e tags do cliente',
    'Pode notificar o cliente por e-mail/WhatsApp',
    'Será registrado no histórico do pedido como override administrativo',
  ],
  payment: [
    'Pode marcar a data de pagamento e desencadear o fluxo fiscal',
    'Pode recalcular o LTV/contagem de compras do cliente',
    'Será registrado no histórico do pedido como override administrativo',
  ],
  shipping: [
    'Pode atualizar datas de envio/entrega',
    'Pode disparar notificação de envio ao cliente',
    'Será registrado no histórico do pedido como override administrativo',
  ],
};

const SCOPE_TITLE: Record<OrderStatusOverrideDialogProps['scope'], string> = {
  order: 'Forçar alteração de status do pedido',
  payment: 'Forçar alteração de status de pagamento',
  shipping: 'Forçar alteração de status de envio',
};

export function OrderStatusOverrideDialog({
  open,
  onOpenChange,
  fromLabel,
  toLabel,
  scope,
  onConfirm,
}: OrderStatusOverrideDialogProps) {
  const consequences = SCOPE_CONSEQUENCES[scope];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {SCOPE_TITLE[scope]}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className="text-foreground">
                Esta mudança <strong>não segue o fluxo automático</strong>. Você está
                forçando manualmente:
              </p>
              <div className="rounded-md border bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">De:</span>{' '}
                <strong className="text-foreground">{fromLabel}</strong>
                <br />
                <span className="text-muted-foreground">Para:</span>{' '}
                <strong className="text-foreground">{toLabel}</strong>
              </div>
              <p className="text-sm">Possíveis consequências:</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {consequences.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Apenas owners e administradores podem realizar esta operação.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-warning text-warning-foreground hover:bg-warning/90">
            Confirmar override
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
