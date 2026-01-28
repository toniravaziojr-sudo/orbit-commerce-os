// =============================================
// PAYMENT RESULT - Shows PIX QR code, Boleto link, or Card status
// =============================================

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, ExternalLink, Loader2, QrCode, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentResult as PaymentResultType } from '@/hooks/useCheckoutPayment';

interface PaymentResultProps {
  result: PaymentResultType;
  method: 'pix' | 'boleto' | 'credit_card';
  onContinue?: () => void;
}

export function PaymentResultDisplay({ result, method, onContinue }: PaymentResultProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Erro ao copiar');
    }
  };

  // PIX Result
  if (method === 'pix' && result.pixQrCode) {
    return (
      <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium">
          <Clock className="h-4 w-4" />
          Aguardando pagamento
        </div>

        <h3 className="text-lg font-semibold">Escaneie o QR Code para pagar</h3>
        
        {result.pixQrCodeUrl ? (
          <div className="flex justify-center">
            <img 
              src={result.pixQrCodeUrl} 
              alt="QR Code PIX" 
              className="w-48 h-48 bg-white p-2 rounded-lg"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-48 h-48 bg-white p-4 rounded-lg flex items-center justify-center">
              <QrCode className="w-32 h-32 text-muted-foreground" />
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Ou copie o código PIX abaixo:
        </p>

        <div className="flex gap-2">
          <code className="flex-1 bg-background p-3 rounded border text-xs break-all text-left">
            {result.pixQrCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(result.pixQrCode!)}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        {result.pixExpiresAt && (
          <p className="text-sm text-muted-foreground">
            Expira em: {new Date(result.pixExpiresAt).toLocaleString('pt-BR')}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          Após o pagamento, você receberá a confirmação por e-mail.
        </p>
      </div>
    );
  }

  // Boleto Result
  if (method === 'boleto' && result.boletoUrl) {
    return (
      <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
          <Clock className="h-4 w-4" />
          Boleto gerado
        </div>

        <h3 className="text-lg font-semibold">Seu boleto foi gerado!</h3>
        
        <p className="text-sm text-muted-foreground">
          Clique no botão abaixo para visualizar e imprimir seu boleto.
        </p>

        <Button
          onClick={() => window.open(result.boletoUrl, '_blank')}
          className="w-full sf-btn-primary"
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Visualizar Boleto
        </Button>

        {result.boletoBarcode && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Código de barras:
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-background p-3 rounded border text-xs break-all text-left font-mono">
                {result.boletoBarcode}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(result.boletoBarcode!)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {result.boletoDueDate && (
          <p className="text-sm text-muted-foreground">
            Vencimento: {new Date(result.boletoDueDate).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
    );
  }

  // Credit Card Result - Approved
  if (method === 'credit_card' && result.cardStatus === 'paid') {
    return (
      <div className="border rounded-lg p-6 bg-green-50 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>

        <h3 className="text-lg font-semibold text-green-800">Pagamento aprovado!</h3>
        
        <p className="text-sm text-green-700">
          Seu pedido #{result.orderNumber} foi confirmado.
        </p>

        {onContinue && (
          <Button onClick={onContinue} className="w-full">
            Continuar
          </Button>
        )}
      </div>
    );
  }

  // Credit Card - Processing
  if (method === 'credit_card' && result.cardStatus === 'processing') {
    return (
      <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4">
        <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
        <h3 className="text-lg font-semibold">Processando pagamento...</h3>
        <p className="text-sm text-muted-foreground">
          Aguarde enquanto processamos seu pagamento.
        </p>
      </div>
    );
  }

  // Fallback - Pending
  return (
    <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-sm font-medium">
        <Clock className="h-4 w-4" />
        Aguardando pagamento
      </div>

      <h3 className="text-lg font-semibold">Pedido #{result.orderNumber}</h3>
      
      <p className="text-sm text-muted-foreground">
        Assim que recebermos a confirmação do pagamento, você será notificado por e-mail.
      </p>

      {onContinue && (
        <Button onClick={onContinue} variant="outline" className="w-full">
          Ver meus pedidos
        </Button>
      )}
    </div>
  );
}
