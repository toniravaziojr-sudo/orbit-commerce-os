// =============================================
// CHECKOUT FORM - Customer data with validation and masks
// =============================================

import { useState } from 'react';
import { sanitizeCep, isValidCep } from '@/lib/cepUtils';
import { useCepLookup } from '@/hooks/useCepLookup';
import { isValidCpf, handleCpfInput } from '@/lib/formatCpf';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CepInput } from '@/components/storefront/shared/CepInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Search, Loader2 } from 'lucide-react';

export interface CheckoutFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement: string;
  shippingNeighborhood: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  notes: string;
}

interface CheckoutFormProps {
  data: CheckoutFormData;
  onChange: (data: CheckoutFormData) => void;
  errors: Partial<Record<keyof CheckoutFormData, string>>;
  disabled?: boolean;
}

// Mask helpers — CPF now uses shared utility

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length > 10) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
}

export function CheckoutForm({ data, onChange, errors, disabled = false }: CheckoutFormProps) {
  const { lookupCep, isLoading: isLookingUp } = useCepLookup();

  const handleChange = (field: keyof CheckoutFormData, value: string) => {
    let nextValue = value;

    if (field === 'customerCpf') nextValue = handleCpfInput(value);
    if (field === 'customerPhone') nextValue = maskPhone(value);
    if (field === 'shippingPostalCode') nextValue = sanitizeCep(value);

    onChange({ ...data, [field]: nextValue });
  };

  const handleCepLookup = async () => {
    const cep = sanitizeCep(data.shippingPostalCode);
    if (!isValidCep(cep)) return;
    const result = await lookupCep(cep);
    if (result) {
      const updates: Partial<CheckoutFormData> = {};
      if (result.street) updates.shippingStreet = result.street;
      if (result.neighborhood) updates.shippingNeighborhood = result.neighborhood;
      if (result.city) updates.shippingCity = result.city;
      if (result.state) updates.shippingState = result.state;
      onChange({ ...data, ...updates });
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
      {/* Customer Info Section */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Seus dados</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="customerName">Nome completo *</Label>
            <Input
              id="customerName"
              value={data.customerName}
              onChange={(e) => handleChange('customerName', e.target.value)}
              className={cn(errors.customerName && 'border-destructive')}
              disabled={disabled}
            />
            {errors.customerName && (
              <p className="text-sm text-destructive mt-1">{errors.customerName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="customerEmail">E-mail *</Label>
            <Input
              id="customerEmail"
              type="email"
              value={data.customerEmail}
              onChange={(e) => handleChange('customerEmail', e.target.value)}
              className={cn(errors.customerEmail && 'border-destructive')}
              disabled={disabled}
            />
            {errors.customerEmail && (
              <p className="text-sm text-destructive mt-1">{errors.customerEmail}</p>
            )}
          </div>

          <div>
            <Label htmlFor="customerPhone">Telefone/WhatsApp *</Label>
            <Input
              id="customerPhone"
              value={data.customerPhone}
              onChange={(e) => handleChange('customerPhone', e.target.value)}
              placeholder="(00) 00000-0000"
              className={cn(errors.customerPhone && 'border-destructive')}
              disabled={disabled}
            />
            {errors.customerPhone && (
              <p className="text-sm text-destructive mt-1">{errors.customerPhone}</p>
            )}
          </div>

          <div>
            <Label htmlFor="customerCpf">CPF *</Label>
            <Input
              id="customerCpf"
              value={data.customerCpf}
              onChange={(e) => handleChange('customerCpf', e.target.value)}
              placeholder="000.000.000-00"
              className={cn(errors.customerCpf && 'border-destructive')}
              disabled={disabled}
            />
            {errors.customerCpf && (
              <p className="text-sm text-destructive mt-1">{errors.customerCpf}</p>
            )}
          </div>
        </div>
      </div>

      {/* Shipping Address Section */}
      <div>
        <h3 className="font-semibold text-lg mb-4">Endereço de entrega</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shippingPostalCode">CEP *</Label>
            <div className="flex gap-2">
              <CepInput
                id="sf-checkout-form-cep"
                source="CheckoutForm"
                value={data.shippingPostalCode}
                onValueChange={(digits) => handleChange('shippingPostalCode', digits)}
                onKeyDown={handleCepKeyDown}
                placeholder="00000000"
                className={cn(errors.shippingPostalCode && 'border-destructive')}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCepLookup}
                disabled={disabled || isLookingUp || !isValidCep(sanitizeCep(data.shippingPostalCode))}
                title="Buscar endereço pelo CEP"
              >
                {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {errors.shippingPostalCode && (
              <p className="text-sm text-destructive mt-1">{errors.shippingPostalCode}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="shippingStreet">Rua/Logradouro *</Label>
            <Input
              id="shippingStreet"
              value={data.shippingStreet}
              onChange={(e) => handleChange('shippingStreet', e.target.value)}
              className={cn(errors.shippingStreet && 'border-destructive')}
              disabled={disabled}
            />
            {errors.shippingStreet && (
              <p className="text-sm text-destructive mt-1">{errors.shippingStreet}</p>
            )}
          </div>

          <div>
            <Label htmlFor="shippingNumber">Número *</Label>
            <Input
              id="shippingNumber"
              value={data.shippingNumber}
              onChange={(e) => handleChange('shippingNumber', e.target.value)}
              className={cn(errors.shippingNumber && 'border-destructive')}
              disabled={disabled}
            />
            {errors.shippingNumber && (
              <p className="text-sm text-destructive mt-1">{errors.shippingNumber}</p>
            )}
          </div>

          <div>
            <Label htmlFor="shippingComplement">Complemento</Label>
            <Input
              id="shippingComplement"
              value={data.shippingComplement}
              onChange={(e) => handleChange('shippingComplement', e.target.value)}
              placeholder="Apto, bloco, etc."
              disabled={disabled}
            />
          </div>

          <div>
            <Label htmlFor="shippingNeighborhood">Bairro *</Label>
            <Input
              id="shippingNeighborhood"
              value={data.shippingNeighborhood}
              onChange={(e) => handleChange('shippingNeighborhood', e.target.value)}
              className={cn(errors.shippingNeighborhood && 'border-destructive')}
              disabled={disabled}
            />
            {errors.shippingNeighborhood && (
              <p className="text-sm text-destructive mt-1">{errors.shippingNeighborhood}</p>
            )}
          </div>

          <div>
            <Label htmlFor="shippingCity">Cidade *</Label>
            <Input
              id="shippingCity"
              value={data.shippingCity}
              onChange={(e) => handleChange('shippingCity', e.target.value)}
              className={cn(errors.shippingCity && 'border-destructive')}
              disabled={disabled}
            />
            {errors.shippingCity && (
              <p className="text-sm text-destructive mt-1">{errors.shippingCity}</p>
            )}
          </div>

          <div>
            <Label htmlFor="shippingState">Estado *</Label>
            <Input
              id="shippingState"
              value={data.shippingState}
              onChange={(e) => handleChange('shippingState', e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SP"
              maxLength={2}
              className={cn(errors.shippingState && 'border-destructive')}
              disabled={disabled}
            />
            {errors.shippingState && (
              <p className="text-sm text-destructive mt-1">{errors.shippingState}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes Section */}
      <div>
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Textarea
          id="notes"
          value={data.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Instruções especiais para entrega..."
          rows={3}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export const initialCheckoutFormData: CheckoutFormData = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerCpf: '',
  shippingStreet: '',
  shippingNumber: '',
  shippingComplement: '',
  shippingNeighborhood: '',
  shippingCity: '',
  shippingState: '',
  shippingPostalCode: '',
  notes: '',
};

// Validation function
export function validateCheckoutForm(data: CheckoutFormData): Partial<Record<keyof CheckoutFormData, string>> {
  const errors: Partial<Record<keyof CheckoutFormData, string>> = {};

  if (!data.customerName.trim()) errors.customerName = 'Nome é obrigatório';
  if (!data.customerEmail.trim()) {
    errors.customerEmail = 'E-mail é obrigatório';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
    errors.customerEmail = 'E-mail inválido';
  }
  
  const phoneDigits = data.customerPhone.replace(/\D/g, '');
  if (!phoneDigits) {
    errors.customerPhone = 'Telefone é obrigatório';
  } else if (phoneDigits.length < 10) {
    errors.customerPhone = 'Telefone inválido';
  }

  if (!data.customerCpf.replace(/\D/g, '')) {
    errors.customerCpf = 'CPF é obrigatório';
  } else if (!isValidCpf(data.customerCpf)) {
    errors.customerCpf = 'CPF inválido. Verifique os números digitados.';
  }

  const cepDigits = sanitizeCep(data.shippingPostalCode);
  if (!cepDigits) {
    errors.shippingPostalCode = 'CEP é obrigatório';
  } else if (!isValidCep(cepDigits)) {
    errors.shippingPostalCode = 'CEP inválido';
  }

  if (!data.shippingStreet.trim()) errors.shippingStreet = 'Rua é obrigatória';
  if (!data.shippingNumber.trim()) errors.shippingNumber = 'Número é obrigatório';
  if (!data.shippingNeighborhood.trim()) errors.shippingNeighborhood = 'Bairro é obrigatório';
  if (!data.shippingCity.trim()) errors.shippingCity = 'Cidade é obrigatória';
  if (!data.shippingState.trim()) {
    errors.shippingState = 'Estado é obrigatório';
  } else if (data.shippingState.length !== 2) {
    errors.shippingState = 'Use a sigla do estado (ex: SP)';
  }

  return errors;
}
