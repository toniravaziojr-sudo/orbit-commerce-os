import { Loader2, Check, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { handleCpfInput } from '@/lib/formatCpf';
import type { ExtendedFormData } from './types';

interface Step1Props {
  formData: ExtendedFormData;
  errors: Partial<Record<keyof ExtendedFormData, string>>;
  onChange: (field: keyof ExtendedFormData, value: string) => void;
  disabled: boolean;
  isExistingCustomer: boolean;
  isCheckingEmail: boolean;
}

// Step 1: Personal Data
export function Step1PersonalData({
  formData,
  errors,
  onChange,
  disabled,
  isExistingCustomer,
  isCheckingEmail,
}: Step1Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Seus dados</h2>
        <p className="text-sm text-muted-foreground">Informe seus dados para continuar</p>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="customerName">Nome completo *</Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => onChange('customerName', e.target.value)}
            disabled={disabled}
            className={errors.customerName ? 'border-destructive' : ''}
          />
          {errors.customerName && <p className="text-sm text-destructive mt-1">{errors.customerName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customerEmail">E-mail *</Label>
            <div className="relative">
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => onChange('customerEmail', e.target.value)}
                disabled={disabled}
                className={errors.customerEmail ? 'border-destructive' : ''}
              />
              {isCheckingEmail && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {errors.customerEmail && <p className="text-sm text-destructive mt-1">{errors.customerEmail}</p>}
            {isExistingCustomer && !errors.customerEmail && (
              <p className="text-sm mt-1 flex items-center gap-1 sf-accent-icon">
                <Check className="h-3 w-3" /> Bem-vindo de volta!
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="customerPhone">Telefone/WhatsApp *</Label>
            <Input
              id="customerPhone"
              value={formData.customerPhone}
              onChange={(e) => onChange('customerPhone', e.target.value)}
              placeholder="(00) 00000-0000"
              disabled={disabled}
              className={errors.customerPhone ? 'border-destructive' : ''}
            />
            {errors.customerPhone && <p className="text-sm text-destructive mt-1">{errors.customerPhone}</p>}
          </div>
        </div>

        <div className="max-w-xs">
          <Label htmlFor="customerCpf">CPF *</Label>
          <Input
            id="customerCpf"
            value={formData.customerCpf}
            onChange={(e) => onChange('customerCpf', handleCpfInput(e.target.value))}
            placeholder="000.000.000-00"
            disabled={disabled}
            className={errors.customerCpf ? 'border-destructive' : ''}
          />
          {errors.customerCpf && <p className="text-sm text-destructive mt-1">{errors.customerCpf}</p>}
        </div>

        {/* Info about account creation - now on Thank You page */}
        <div className="pt-4 border-t mt-4">
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Após a compra, você poderá criar sua conta</p>
              <p className="text-muted-foreground">E acompanhar seus pedidos em "Minha Conta".</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
