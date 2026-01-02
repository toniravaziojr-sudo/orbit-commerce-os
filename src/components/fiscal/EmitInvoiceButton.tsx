import { useState } from 'react';
import { FileText, Loader2, CheckCircle, XCircle, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useValidateOrder, 
  useCreateDraft, 
  useSubmitInvoice, 
  useOrderInvoice,
  useCheckInvoiceStatus,
  type FiscalInvoice 
} from '@/hooks/useFiscal';
import { toast } from 'sonner';

interface EmitInvoiceButtonProps {
  orderId: string;
  orderNumber: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  draft: { label: 'Rascunho', variant: 'secondary', color: 'text-muted-foreground' },
  pending: { label: 'Processando', variant: 'outline', color: 'text-amber-600' },
  authorized: { label: 'Autorizada', variant: 'default', color: 'text-green-600' },
  rejected: { label: 'Rejeitada', variant: 'destructive', color: 'text-destructive' },
  canceled: { label: 'Cancelada', variant: 'destructive', color: 'text-destructive' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function EmitInvoiceButton({ orderId, orderNumber }: EmitInvoiceButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'validate' | 'preview' | 'result'>('validate');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [draftData, setDraftData] = useState<any>(null);
  const [naturezaOperacao, setNaturezaOperacao] = useState('VENDA DE MERCADORIA');
  const [observacoes, setObservacoes] = useState('');
  const [emitResult, setEmitResult] = useState<{ status: string; error?: string; chave?: string } | null>(null);

  const { data: existingInvoice, isLoading: invoiceLoading, refetch: refetchInvoice } = useOrderInvoice(orderId);
  const validateOrder = useValidateOrder();
  const createDraft = useCreateDraft();
  const submitInvoice = useSubmitInvoice();
  const checkStatus = useCheckInvoiceStatus();

  const hasInvoice = !!existingInvoice;
  const invoiceStatus = existingInvoice?.status;

  const handleOpenDialog = async () => {
    setIsOpen(true);
    setStep('validate');
    setValidationErrors([]);
    setValidationWarnings([]);
    setEmitResult(null);

    try {
      const result = await validateOrder.mutateAsync(orderId);
      setValidationErrors(result.errors);
      setValidationWarnings(result.warnings);

      if (result.valid) {
        // Auto-create draft
        const draft = await createDraft.mutateAsync({ 
          orderId, 
          naturezaOperacao,
          observacoes 
        });
        setDraftData(draft);
        setStep('preview');
      }
    } catch (error: any) {
      setValidationErrors([error.message || 'Erro ao validar pedido']);
    }
  };

  const handleEmit = async () => {
    if (!draftData?.invoice?.id) return;

    try {
      const result = await submitInvoice.mutateAsync(draftData.invoice.id);
      setEmitResult({
        status: result.status,
        error: result.error,
        chave: result.chave_acesso,
      });
      setStep('result');
      refetchInvoice();
    } catch (error: any) {
      setEmitResult({
        status: 'error',
        error: error.message || 'Erro ao emitir NF-e',
      });
      setStep('result');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('validate');
    setDraftData(null);
    setEmitResult(null);
  };

  const handleCheckStatus = async () => {
    if (!existingInvoice?.id) return;
    await checkStatus.mutateAsync(existingInvoice.id);
    refetchInvoice();
  };

  // Render badge for existing invoice
  if (hasInvoice) {
    const status = statusConfig[invoiceStatus || 'draft'];
    
    return (
      <div className="flex items-center gap-2">
        <Badge variant={status.variant} className="gap-1">
          <FileText className="h-3 w-3" />
          NF-e {existingInvoice.serie}-{existingInvoice.numero}
        </Badge>
        <span className={`text-sm ${status.color}`}>{status.label}</span>
        
        {invoiceStatus === 'pending' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckStatus}
            disabled={checkStatus.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${checkStatus.isPending ? 'animate-spin' : ''}`} />
          </Button>
        )}
        
        {invoiceStatus === 'authorized' && existingInvoice.danfe_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(existingInvoice.danfe_url!, '_blank')}
          >
            <Download className="h-4 w-4 mr-1" />
            DANFE
          </Button>
        )}
        
        {invoiceStatus === 'rejected' && (
          <Button variant="outline" size="sm" onClick={handleOpenDialog}>
            Tentar Novamente
          </Button>
        )}

        {/* Dialog for retry */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-2xl">
            {/* ... same dialog content as below ... */}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render button to emit
  return (
    <>
      <Button variant="outline" onClick={handleOpenDialog} disabled={invoiceLoading}>
        {invoiceLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        Emitir NF-e
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Emitir NF-e - {orderNumber}
            </DialogTitle>
            <DialogDescription>
              {step === 'validate' && 'Validando requisitos...'}
              {step === 'preview' && 'Revise os dados antes de emitir'}
              {step === 'result' && 'Resultado da emissão'}
            </DialogDescription>
          </DialogHeader>

          {/* Validation Step */}
          {step === 'validate' && (
            <div className="py-6">
              {validateOrder.isPending || createDraft.isPending ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    {validateOrder.isPending ? 'Validando pedido...' : 'Preparando NF-e...'}
                  </p>
                </div>
              ) : validationErrors.length > 0 ? (
                <div className="space-y-4">
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      Não é possível emitir NF-e para este pedido:
                    </AlertDescription>
                  </Alert>
                  <ul className="space-y-2">
                    {validationErrors.map((error, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-destructive">
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && draftData && (
            <div className="space-y-4">
              {validationWarnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {validationWarnings.map((w, i) => <p key={i}>{w}</p>)}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Número</Label>
                  <p className="font-medium">{draftData.invoice.serie}-{draftData.invoice.numero}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">CFOP</Label>
                  <p className="font-medium">{draftData.invoice.cfop}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Destinatário</Label>
                <p className="font-medium">{draftData.invoice.dest_nome}</p>
                <p className="text-sm text-muted-foreground">
                  {draftData.invoice.dest_cpf_cnpj} • {draftData.invoice.dest_endereco_municipio}/{draftData.invoice.dest_endereco_uf}
                </p>
              </div>

              <Separator />

              <div>
                <Label className="text-muted-foreground">Itens ({draftData.invoice.items?.length || 0})</Label>
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {draftData.invoice.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="truncate max-w-[300px]">{item.quantidade}x {item.descricao}</span>
                      <span className="font-medium">{formatCurrency(item.valor_total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="natureza">Natureza da Operação</Label>
                  <Input
                    id="natureza"
                    value={naturezaOperacao}
                    onChange={(e) => setNaturezaOperacao(e.target.value)}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="text-right">
                    <Label className="text-muted-foreground">Total</Label>
                    <p className="text-2xl font-bold">{formatCurrency(draftData.invoice.valor_total)}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes">Observações (opcional)</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais..."
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Result Step */}
          {step === 'result' && emitResult && (
            <div className="py-6">
              {emitResult.status === 'authorized' ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-full bg-green-100 p-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-600">NF-e Autorizada!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Chave de acesso: {emitResult.chave}
                    </p>
                  </div>
                </div>
              ) : emitResult.status === 'pending' ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-full bg-amber-100 p-3">
                    <Loader2 className="h-8 w-8 text-amber-600 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-amber-600">Processando</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      A NF-e está sendo processada. Aguarde alguns instantes e consulte o status.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="rounded-full bg-red-100 p-3">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-600">Erro na Emissão</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {emitResult.error || 'Ocorreu um erro ao emitir a NF-e'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {step === 'validate' && validationErrors.length > 0 && (
              <Button variant="outline" onClick={handleClose}>
                Fechar
              </Button>
            )}
            
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleEmit} disabled={submitInvoice.isPending}>
                  {submitInvoice.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Emitir NF-e
                </Button>
              </>
            )}
            
            {step === 'result' && (
              <Button onClick={handleClose}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
