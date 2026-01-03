import { useState, useEffect } from 'react';
import { FileEdit, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CCeRecord {
  id: string;
  numero_sequencia: number;
  correcao: string;
  protocolo: string | null;
  status: string;
  created_at: string;
}

interface CorrectInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    numero: number;
    serie: number;
    chave_acesso: string | null;
    dest_nome: string;
  };
  onSuccess?: () => void;
}

const ALLOWED_CORRECTIONS = [
  'Razão Social ou Nome do Destinatário',
  'Endereço do Destinatário (logradouro, bairro, cidade, UF, CEP)',
  'CNPJ ou CPF do Destinatário',
  'Inscrição Estadual do Destinatário',
  'Dados do Transportador',
  'Observações/Informações Adicionais',
  'Data de Saída/Entrada',
  'Peso, Volume, Espécie de Mercadoria',
];

const NOT_ALLOWED_CORRECTIONS = [
  'Valores da NF-e (unitário, total, descontos)',
  'Quantidade de mercadorias',
  'Destaque de impostos (ICMS, IPI, etc)',
  'Descrição das mercadorias',
  'CFOP da operação',
  'Data de emissão',
];

export function CorrectInvoiceDialog({ open, onOpenChange, invoice, onSuccess }: CorrectInvoiceDialogProps) {
  const [correcao, setCorrecao] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingCCes, setExistingCCes] = useState<CCeRecord[]>([]);
  const [loadingCCes, setLoadingCCes] = useState(true);

  const charCount = correcao.length;
  const isValid = charCount >= 15 && charCount <= 1000;
  const canAddMore = existingCCes.length < 20;

  // Load existing CC-es
  useEffect(() => {
    if (open && invoice.id) {
      loadExistingCCes();
    }
  }, [open, invoice.id]);

  const loadExistingCCes = async () => {
    setLoadingCCes(true);
    try {
      const { data, error } = await supabase
        .from('fiscal_invoice_cces')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('numero_sequencia', { ascending: false });

      if (error) throw error;
      setExistingCCes(data || []);
    } catch (error) {
      console.error('Error loading CC-es:', error);
    } finally {
      setLoadingCCes(false);
    }
  };

  const handleSubmit = async () => {
    if (!isValid || !canAddMore) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-cce', {
        body: {
          invoice_id: invoice.id,
          correcao,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar carta de correção');
      }

      toast.success('Carta de correção enviada com sucesso');
      setCorrecao('');
      loadExistingCCes();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error sending CC-e:', error);
      toast.error(error.message || 'Erro ao enviar carta de correção');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            Carta de Correção (CC-e)
          </DialogTitle>
          <DialogDescription>
            NF-e {invoice.serie}-{invoice.numero} - {invoice.dest_nome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info about what can/cannot be corrected */}
          <div className="grid md:grid-cols-2 gap-4">
            <Alert className="border-green-500/30 bg-green-500/5">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong className="text-green-700">Pode corrigir:</strong>
                <ul className="text-xs mt-1 space-y-0.5 text-green-700">
                  {ALLOWED_CORRECTIONS.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>NÃO pode corrigir:</strong>
                <ul className="text-xs mt-1 space-y-0.5">
                  {NOT_ALLOWED_CORRECTIONS.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          {/* Existing CC-es */}
          {existingCCes.length > 0 && (
            <div className="space-y-2">
              <Label>Cartas de Correção anteriores ({existingCCes.length}/20)</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {existingCCes.map((cce) => (
                  <Card key={cce.id} className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              #{cce.numero_sequencia}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(cce.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{cce.correcao}</p>
                        </div>
                        <Badge variant={cce.status === 'authorized' ? 'default' : 'secondary'}>
                          {cce.status === 'authorized' ? 'Autorizada' : 'Pendente'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* New correction */}
          {canAddMore ? (
            <div className="space-y-2">
              <Label htmlFor="correcao">Nova correção</Label>
              <Textarea
                id="correcao"
                value={correcao}
                onChange={(e) => setCorrecao(e.target.value)}
                placeholder="Descreva a correção a ser feita na NF-e..."
                className="min-h-[120px]"
                maxLength={1000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mínimo 15 caracteres</span>
                <span className={charCount < 15 ? 'text-destructive' : charCount > 900 ? 'text-amber-500' : ''}>
                  {charCount}/1000
                </span>
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Limite de 20 cartas de correção atingido para esta NF-e.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Fechar
          </Button>
          {canAddMore && (
            <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Carta de Correção'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
