import { useState } from 'react';
import { Hash, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InutilizarNumerosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serie?: number;
  onSuccess?: () => void;
}

export function InutilizarNumerosDialog({ open, onOpenChange, serie = 1, onSuccess }: InutilizarNumerosDialogProps) {
  const [formData, setFormData] = useState({
    serie: String(serie),
    numero_inicial: '',
    numero_final: '',
    justificativa: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const charCount = formData.justificativa.length;
  const isValidJustificativa = charCount >= 15 && charCount <= 255;
  const isValidNumeros = formData.numero_inicial && formData.numero_final &&
    parseInt(formData.numero_inicial) <= parseInt(formData.numero_final);
  const isValid = isValidJustificativa && isValidNumeros;

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-inutilizar', {
        body: {
          serie: formData.serie,
          numero_inicial: parseInt(formData.numero_inicial),
          numero_final: parseInt(formData.numero_final),
          justificativa: formData.justificativa,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao inutilizar numeração');
      }

      toast.success('Numeração inutilizada com sucesso');
      onOpenChange(false);
      setFormData({
        serie: String(serie),
        numero_inicial: '',
        numero_final: '',
        justificativa: '',
      });
      onSuccess?.();
    } catch (error: any) {
      console.error('Error inutilizing numbers:', error);
      toast.error(error.message || 'Erro ao inutilizar numeração');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-amber-500" />
            Inutilizar Numeração
          </DialogTitle>
          <DialogDescription>
            Inutilize números de NF-e que não serão utilizados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              A inutilização é irreversível. Use apenas para números que foram 
              pulados ou não serão utilizados (ex: falha na impressão).
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serie">Série</Label>
              <Input
                id="serie"
                value={formData.serie}
                onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_inicial">Número Inicial</Label>
              <Input
                id="numero_inicial"
                type="number"
                value={formData.numero_inicial}
                onChange={(e) => setFormData({ ...formData, numero_inicial: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_final">Número Final</Label>
              <Input
                id="numero_final"
                type="number"
                value={formData.numero_final}
                onChange={(e) => setFormData({ ...formData, numero_final: e.target.value })}
                placeholder="10"
              />
            </div>
          </div>

          {formData.numero_inicial && formData.numero_final && !isValidNumeros && (
            <p className="text-xs text-destructive">
              O número final deve ser maior ou igual ao número inicial
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa</Label>
            <Textarea
              id="justificativa"
              value={formData.justificativa}
              onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
              placeholder="Informe o motivo da inutilização..."
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
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading} variant="destructive">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Inutilizando...
              </>
            ) : (
              'Inutilizar Numeração'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
