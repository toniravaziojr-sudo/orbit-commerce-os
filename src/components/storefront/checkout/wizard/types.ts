// Tipos compartilhados do CheckoutStepWizard
import type { LucideIcon } from 'lucide-react';
import type { CheckoutFormData } from '../CheckoutForm';

export type PaymentStatus = 'idle' | 'processing' | 'approved' | 'pending_payment' | 'failed';
export type CheckoutStep = 1 | 2 | 3 | 4;
export type ExtendedFormData = CheckoutFormData;

export interface StepDef {
  id: 1 | 2 | 3 | 4;
  label: string;
  icon: LucideIcon;
}
