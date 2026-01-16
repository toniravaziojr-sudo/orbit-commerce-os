// =============================================
// PAYMENT BADGES - Bandeirinhas de formas de pagamento
// Destaque para Pix com desconto conforme REGRAS.md
// =============================================

import React from 'react';
import { CreditCard, QrCode, Banknote, Receipt, Clock } from 'lucide-react';

interface PaymentBadgesProps {
  productPrice: number;
  pixDiscountPercent?: number;
  maxInstallments?: number;
  className?: string;
}

/**
 * Renders payment method badges with Pix discount highlight
 * Conforme REGRAS.md: "bandeirinhas com as formas de pagamento com destaque para pix com desconto"
 */
export function PaymentBadges({
  productPrice,
  pixDiscountPercent = 10,
  maxInstallments = 12,
  className = '',
}: PaymentBadgesProps) {
  const pixPrice = productPrice * (1 - pixDiscountPercent / 100);
  const installmentValue = productPrice / maxInstallments;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Pix com destaque - sempre primeiro */}
      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
          <QrCode className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-green-700">
            R$ {pixPrice.toFixed(2).replace('.', ',')} no Pix
          </p>
          <p className="text-xs text-green-600">
            {pixDiscountPercent}% de desconto
          </p>
        </div>
      </div>

      {/* Outras formas de pagamento */}
      <div className="flex flex-wrap gap-2">
        {/* Cartão de crédito */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted rounded-md">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {maxInstallments}x de R$ {installmentValue.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {/* Boleto */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted rounded-md">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Boleto</span>
        </div>

        {/* Débito */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted rounded-md">
          <Banknote className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Débito</span>
        </div>
      </div>
    </div>
  );
}
