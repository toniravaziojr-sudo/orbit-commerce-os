import { useState } from 'react';
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  };
  onSuccess?: () => void;
}

export function CancelInvoiceDialog({ open, onOpenChange, invoice, onSuccess }: CancelInvoiceDialogProps) {
  const [justificativa, setJustificativa] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate hours since authorization
  const authorizedAt = invoice.authorized_at || invoice.created_at;
  const hoursSinceAuth = differenceInHours(new Date(), parseISO(authorizedAt));
  const isWithin24h = hoursSinceAuth <= 24;

  const charCount = justificativa.length;
  const isValid = charCount >= 15 && charCount <= 255;

  const handleCancel = async () => {
    if (!isValid) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-cancel', {
        body: {
          invoice_id: invoice.id,
          justificativa,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao cancelar NF-e');
      }

      toast.success('NF-e cancelada com sucesso');
      onOpenChange(false);
      setJustificativa('');
      onSuccess?.();
    } catch (error: any) {
      console.error('Error canceling invoice:', error);
      toast.error(error.message || 'Erro ao cancelar NF-e');
    } finally {
      setIsLoading(false);
    }
  };

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
          {!isWithin24h && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Atenção:</strong> Já se passaram mais de 24 horas desde a autorização. 
                O cancelamento pode ser rejeitado pela SEFAZ. Considere emitir uma NF-e de devolução.
              </AlertDescription>
            </Alert>
          )}

          {isWithin24h && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você tem até 24 horas após a autorização para cancelar a NF-e.
                Tempo restante: {24 - hoursSinceAuth}h
              </AlertDescription>
            </Alert>
          )}

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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Voltar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel} 
            disabled={!isValid || isLoading}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
