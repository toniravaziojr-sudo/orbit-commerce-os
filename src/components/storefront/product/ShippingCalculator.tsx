// =============================================
// SHIPPING CALCULATOR - Calculadora de frete
// =============================================

import { useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { sanitizeCep } from '@/lib/cepUtils';
import { Button } from '@/components/ui/button';
import { Truck, Loader2, Package, Clock } from 'lucide-react';

interface ShippingOption {
  carrier: string;
  service: string;
  price: number;
  days: number;
}

interface ShippingCalculatorProps {
  productId?: string;
  isEditing?: boolean;
  className?: string;
}

/**
 * CEP-based shipping calculator
 * Conforme REGRAS.md: "calculadora de frete"
 */
export function ShippingCalculator({
  productId,
  isEditing = false,
  className = '',
}: ShippingCalculatorProps) {
  const [cepDigits, setCepDigits] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCepInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCepDigits(sanitizeCep(e.target.value));
    setError(null);
    setShippingOptions(null);
  };

  const handleCepPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setCepDigits(sanitizeCep(e.clipboardData.getData('text')));
    setError(null);
    setShippingOptions(null);
  };

  const handleCalculate = async () => {
    const cep = sanitizeCep(cepDigits);

    if (cep.length !== 8) {
      setError('CEP inválido');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Simulated shipping options (in production, call real API)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Demo shipping options
    setShippingOptions([
      { carrier: 'PAC', service: 'Correios', price: 18.90, days: 7 },
      { carrier: 'SEDEX', service: 'Correios', price: 32.50, days: 3 },
      { carrier: 'Expresso', service: 'Transportadora', price: 24.90, days: 5 },
    ]);

    setIsLoading(false);
  };

  return (
    <div className={`border rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-5 h-5 text-muted-foreground" />
        <h4 className="font-medium text-sm">Calcular frete</h4>
      </div>

      <div className="flex gap-2">
        <input
          id="sf-product-cep"
          type="text"
          inputMode="numeric"
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={8}
          value={sanitizeCep(cepDigits)}
          onChange={handleCepInputChange}
          onPaste={handleCepPaste}
          className="flex h-10 w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          disabled={isEditing}
        />
        <Button 
          onClick={handleCalculate}
          disabled={isLoading || sanitizeCep(cepDigits).length !== 8 || isEditing}
          size="sm"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Calcular'
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      {/* Shipping options list */}
      {shippingOptions && shippingOptions.length > 0 && (
        <div className="mt-4 space-y-2">
          {shippingOptions.map((option, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{option.carrier}</p>
                  <p className="text-xs text-muted-foreground">{option.service}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">
                  R$ {option.price.toFixed(2).replace('.', ',')}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {option.days} dias úteis
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <a 
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline block mt-2"
      >
        Não sei meu CEP
      </a>
    </div>
  );
}
