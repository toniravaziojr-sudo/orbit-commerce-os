import React from 'react';
import { AddressFields } from '@/components/shared/AddressFields';
import type { CheckoutFormData } from '../CheckoutForm';

interface Step2Props {
  formData: CheckoutFormData;
  errors: Partial<Record<keyof CheckoutFormData, string>>;
  onChange: (field: keyof CheckoutFormData, value: string) => void;
  disabled: boolean;
}

// Step 2: Address — usa componente único de endereço guiado (UF/Cidade IBGE oficial).
export function Step2Address({ formData, errors, onChange, disabled }: Step2Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Endereço de entrega</h2>
        <p className="text-sm text-muted-foreground">Para onde devemos enviar seu pedido?</p>
      </div>

      <AddressFields
        idPrefix="sf-checkout-step2"
        disabled={disabled}
        value={{
          postalCode: formData.shippingPostalCode,
          state: formData.shippingState,
          city: formData.shippingCity,
          street: formData.shippingStreet,
          neighborhood: formData.shippingNeighborhood,
          number: formData.shippingNumber,
          complement: formData.shippingComplement,
          ibgeCode: (formData as any).shippingIbgeCode || '',
        }}
        errors={{
          postalCode: errors.shippingPostalCode,
          state: errors.shippingState,
          city: errors.shippingCity,
          street: errors.shippingStreet,
          neighborhood: errors.shippingNeighborhood,
          number: errors.shippingNumber,
        }}
        onChange={(next) => {
          // Aplica delta — usa onChange por campo para preservar contrato existente.
          if (next.postalCode !== formData.shippingPostalCode) onChange('shippingPostalCode', next.postalCode);
          if (next.state !== formData.shippingState) onChange('shippingState', next.state);
          if (next.city !== formData.shippingCity) onChange('shippingCity', next.city);
          if (next.street !== formData.shippingStreet) onChange('shippingStreet', next.street);
          if (next.neighborhood !== formData.shippingNeighborhood) onChange('shippingNeighborhood', next.neighborhood);
          if (next.number !== formData.shippingNumber) onChange('shippingNumber', next.number);
          if (next.complement !== formData.shippingComplement) onChange('shippingComplement', next.complement);
        }}
      />
    </div>
  );
}
