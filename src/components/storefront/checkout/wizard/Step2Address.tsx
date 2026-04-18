import React from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CepInput } from '@/components/storefront/shared/CepInput';
import { sanitizeCep, isValidCep } from '@/lib/cepUtils';
import { useCepLookup } from '@/hooks/useCepLookup';
import type { CheckoutFormData } from '../CheckoutForm';

interface Step2Props {
  formData: CheckoutFormData;
  errors: Partial<Record<keyof CheckoutFormData, string>>;
  onChange: (field: keyof CheckoutFormData, value: string) => void;
  disabled: boolean;
}

// Step 2: Address
export function Step2Address({ formData, errors, onChange, disabled }: Step2Props) {
  const { lookupCep, isLoading: isLookingUp } = useCepLookup();

  const handleCepLookup = async () => {
    const cep = sanitizeCep(formData.shippingPostalCode);
    if (!isValidCep(cep)) return;
    const result = await lookupCep(cep);
    if (result) {
      if (result.street) onChange('shippingStreet', result.street);
      if (result.neighborhood) onChange('shippingNeighborhood', result.neighborhood);
      if (result.city) onChange('shippingCity', result.city);
      if (result.state) onChange('shippingState', result.state);
    }
  };

  const handleCepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCepLookup();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Endereço de entrega</h2>
        <p className="text-sm text-muted-foreground">Para onde devemos enviar seu pedido?</p>
      </div>

      <div className="grid gap-4">
        <div className="max-w-[250px]">
          <Label htmlFor="shippingPostalCode">CEP *</Label>
          <div className="flex gap-2">
            <CepInput
              id="sf-checkout-step2-cep"
              source="CheckoutStepWizard-Step2"
              value={formData.shippingPostalCode}
              onValueChange={(digits) => onChange('shippingPostalCode', digits)}
              onKeyDown={handleCepKeyDown}
              placeholder="00000000"
              disabled={disabled}
              className={errors.shippingPostalCode ? 'border-destructive' : ''}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCepLookup}
              disabled={disabled || isLookingUp || !isValidCep(sanitizeCep(formData.shippingPostalCode))}
              title="Buscar endereço pelo CEP"
            >
              {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {errors.shippingPostalCode && <p className="text-sm text-destructive mt-1">{errors.shippingPostalCode}</p>}
        </div>

        <div>
          <Label htmlFor="shippingStreet">Rua/Logradouro *</Label>
          <Input
            id="shippingStreet"
            value={formData.shippingStreet}
            onChange={(e) => onChange('shippingStreet', e.target.value)}
            disabled={disabled}
            className={errors.shippingStreet ? 'border-destructive' : ''}
          />
          {errors.shippingStreet && <p className="text-sm text-destructive mt-1">{errors.shippingStreet}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shippingNumber">Número *</Label>
            <Input
              id="shippingNumber"
              value={formData.shippingNumber}
              onChange={(e) => onChange('shippingNumber', e.target.value)}
              disabled={disabled}
              className={errors.shippingNumber ? 'border-destructive' : ''}
            />
            {errors.shippingNumber && <p className="text-sm text-destructive mt-1">{errors.shippingNumber}</p>}
          </div>
          <div>
            <Label htmlFor="shippingComplement">Complemento</Label>
            <Input
              id="shippingComplement"
              value={formData.shippingComplement}
              onChange={(e) => onChange('shippingComplement', e.target.value)}
              placeholder="Apto, bloco, etc."
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shippingNeighborhood">Bairro *</Label>
            <Input
              id="shippingNeighborhood"
              value={formData.shippingNeighborhood}
              onChange={(e) => onChange('shippingNeighborhood', e.target.value)}
              disabled={disabled}
              className={errors.shippingNeighborhood ? 'border-destructive' : ''}
            />
            {errors.shippingNeighborhood && <p className="text-sm text-destructive mt-1">{errors.shippingNeighborhood}</p>}
          </div>
          <div>
            <Label htmlFor="shippingCity">Cidade *</Label>
            <Input
              id="shippingCity"
              value={formData.shippingCity}
              onChange={(e) => onChange('shippingCity', e.target.value)}
              disabled={disabled}
              className={errors.shippingCity ? 'border-destructive' : ''}
            />
            {errors.shippingCity && <p className="text-sm text-destructive mt-1">{errors.shippingCity}</p>}
          </div>
        </div>

        <div className="max-w-[100px]">
          <Label htmlFor="shippingState">Estado *</Label>
          <Input
            id="shippingState"
            value={formData.shippingState}
            onChange={(e) => onChange('shippingState', e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="SP"
            disabled={disabled}
            className={errors.shippingState ? 'border-destructive' : ''}
          />
          {errors.shippingState && <p className="text-sm text-destructive mt-1">{errors.shippingState}</p>}
        </div>
      </div>
    </div>
  );
}
