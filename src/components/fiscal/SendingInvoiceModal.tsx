// =============================================
// SendingInvoiceModal — feedback visual durante envio à Sefaz.
//
// Abre quando o usuário dispara emissão (individual ou em lote) e fecha
// automaticamente quando todas as respostas chegam. Bloqueia interação
// com a tela atrás (modal não dismissível) para evitar duplo-clique.
//
// Uso típico (controlado por estado no FiscalInvoiceList):
//   const [sendingState, setSendingState] = useState<SendingState | null>(null);
//   ...
//   setSendingState({ total: 1, done: 0 });
//   // ... await fiscal-submit ...
//   setSendingState({ total: 1, done: 1 });
//   setSendingState(null); // fecha
// =============================================
import { Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

export interface SendingState {
  total: number;
  done: number;
  /** Rótulo opcional para mostrar o item atual (ex.: "Nota 1-291"). */
  currentLabel?: string;
  /** 'send' = enviando à Receita (padrão). 'create' = criando NF a partir de Pedido de Venda. */
  kind?: 'send' | 'create';
}

interface SendingInvoiceModalProps {
  state: SendingState | null;
}

export function SendingInvoiceModal({ state }: SendingInvoiceModalProps) {
  const open = !!state;
  const total = state?.total ?? 0;
  const done = state?.done ?? 0;
  const isBulk = total > 1;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isCreate = state?.kind === 'create';

  const title = isCreate
    ? (isBulk ? 'Criando notas fiscais' : 'Criando nota fiscal')
    : (isBulk ? 'Enviando notas fiscais para a Receita' : 'Enviando nota fiscal para a Receita');
  const description = isCreate
    ? (isBulk
        ? 'Validando os pedidos e gerando as notas. Esta janela fecha sozinha.'
        : 'Validando o pedido e gerando a nota. Esta janela fecha sozinha.')
    : (isBulk
        ? 'Aguarde — esta janela fecha sozinha quando o envio terminar.'
        : 'Aguarde a resposta da Sefaz. Esta janela fecha sozinha.');

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        // Não permite fechar enquanto o envio está em andamento.
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Send className="h-6 w-6 text-primary" />
            <Loader2 className="absolute inset-0 m-auto h-14 w-14 animate-spin text-primary/40" />
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>

          {isBulk && (
            <div className="w-full space-y-2">
              <Progress value={pct} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {done} de {total} processada{total === 1 ? '' : 's'}
                {state?.currentLabel ? ` • ${state.currentLabel}` : ''}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
