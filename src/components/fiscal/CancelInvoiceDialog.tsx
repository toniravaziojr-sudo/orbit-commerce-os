// =============================================
// CancelInvoiceDialog
// Diálogo de cancelamento de NF-e.
// Plano 2026-06-08 — trava por estado do objeto logístico:
//   - Sem objeto OU objeto em 'draft'/'label_created'/'cancelled' → libera cancelamento.
//   - Qualquer outro estado (postado, em trânsito, entregue, devolvido) → bloqueia
//     com mensagem clara em PT-BR (com rastreio e data quando aplicável).
// =============================================
import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, Loader2, PackageX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';
import { differenceInHours, parseISO } from 'date-fns';

interface CancelInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    numero: number;
    serie: number;
    chave_acesso: string | null;
    authorized_at?: string | null;
    created_at: string;
    dest_nome: string;
    source_order_invoice_id?: string | null;
  };
  onSuccess?: () => void;
}

type ShipmentCheck = {
  tracking_code: string | null;
  delivery_status: string | null;
  delivered_at: string | null;
};

const ALLOWED = new Set(['draft', 'label_created', 'cancelled']);

function buildBlockMessage(s: ShipmentCheck): string {
  const tracking = s.tracking_code ? ` (rastreio: ${s.tracking_code})` : '';
  const st = String(s.delivery_status ?? '');
  if (st === 'delivered') {
    const dt = s.delivered_at
      ? new Date(s.delivered_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : '';
    return `Não é possível cancelar esta NF: o pedido já foi entregue ao cliente${tracking}${dt ? `, entregue em ${dt}` : ''}. Notas de pedidos entregues não podem ser canceladas — utilize uma NF de devolução se for o caso.`;
  }
  if (st === 'returned' || st === 'returning') {
    return `Não é possível cancelar esta NF: o pedido foi devolvido${tracking}. Registre uma NF de devolução em vez de cancelar a original.`;
  }
  return `Não é possível cancelar esta NF: o pedido já foi despachado e está em rota de entrega${tracking}. Para cancelar a NF, primeiro cancele o objeto de postagem no módulo de Logística.`;
}

export function CancelInvoiceDialog({ open, onOpenChange, invoice, onSuccess }: CancelInvoiceDialogProps) {
  const [justificativa, setJustificativa] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [blockingShipment, setBlockingShipment] = useState<ShipmentCheck | null>(null);

  // Calculate hours since authorization
  const authorizedAt = invoice.authorized_at || invoice.created_at;
  const hoursSinceAuth = differenceInHours(new Date(), parseISO(authorizedAt));
  const isWithin24h = hoursSinceAuth <= 24;

  const charCount = justificativa.length;
  const isValid = charCount >= 15 && charCount <= 255;

  // Pré-validação do estado do objeto logístico ao abrir o diálogo
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setChecking(true);
      setBlockingShipment(null);
      try {
        const orFilters: string[] = [`invoice_id.eq.${invoice.id}`];
        if (invoice.source_order_invoice_id) {
          orFilters.push(`source_pedido_venda_id.eq.${invoice.source_order_invoice_id}`);
        }
        const { data } = await supabase
          .from('shipments')
          .select('tracking_code, delivery_status, delivered_at')
          .or(orFilters.join(','));
        if (!active) return;
        const blocker = (data ?? []).find(s => !ALLOWED.has(String(s.delivery_status ?? '')));
        if (blocker) setBlockingShipment(blocker as ShipmentCheck);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => { active = false; };
  }, [open, invoice.id, invoice.source_order_invoice_id]);

  const handleCancel = async () => {
    if (!isValid || blockingShipment) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-cancel', {
        body: { invoice_id: invoice.id, justificativa },
      });

      if (error) throw error;
      if (!data?.success) {
        // Se a edge function bloqueou por estado do objeto, mostra a mensagem dela
        if (data?.code === 'shipment_blocks_cancel') {
          setBlockingShipment(data.blocking_shipment ?? { tracking_code: null, delivery_status: 'shipped', delivered_at: null });
          return;
        }
        throw new Error(data?.error || 'Erro ao cancelar NF-e');
      }

      toast.success('NF-e cancelada com sucesso');
      onOpenChange(false);
      setJustificativa('');
      onSuccess?.();
    } catch (error) {
      showErrorToast(error, { module: 'fiscal', action: 'cancelar NF-e' });
    } finally {
      setIsLoading(false);
    }
  };

  const isBlocked = !!blockingShipment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancelar NF-e
          </DialogTitle>
          <DialogDescription>
            Cancelar a NF-e {invoice.serie}-{invoice.numero} de {invoice.dest_nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {checking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando o objeto de postagem vinculado...
            </div>
          )}

          {!checking && isBlocked && (
            <Alert variant="destructive">
              <PackageX className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">
                {buildBlockMessage(blockingShipment!)}
              </AlertDescription>
            </Alert>
          )}

          {!checking && !isBlocked && !isWithin24h && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Já se passaram mais de 24 horas desde a autorização. 
                O cancelamento pode ser rejeitado pela SEFAZ. Considere emitir uma NF-e de devolução.
              </AlertDescription>
            </Alert>
          )}

          {!checking && !isBlocked && isWithin24h && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você tem até 24 horas após a autorização para cancelar a NF-e.
                Tempo restante: {24 - hoursSinceAuth}h
              </AlertDescription>
            </Alert>
          )}

          {!checking && !isBlocked && (
            <div className="space-y-2">
              <Label htmlFor="justificativa">Justificativa do cancelamento</Label>
              <Textarea
                id="justificativa"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo do cancelamento..."
                className="min-h-[100px]"
                maxLength={255}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mínimo 15 caracteres</span>
                <span className={charCount < 15 ? 'text-destructive' : charCount > 200 ? 'text-amber-500' : ''}>
                  {charCount}/255
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {isBlocked ? 'Fechar' : 'Voltar'}
          </Button>
          {!isBlocked && (
            <Button 
              variant="destructive" 
              onClick={handleCancel} 
              disabled={!isValid || isLoading || checking}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
