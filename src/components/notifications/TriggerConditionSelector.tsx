import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RuleType, PaymentCondition, ShippingCondition, TriggerCondition } from "@/hooks/useNotificationRulesV2";

interface TriggerConditionSelectorProps {
  ruleType: RuleType;
  value: TriggerCondition;
  onChange: (condition: TriggerCondition) => void;
}

const paymentConditions: { value: PaymentCondition; label: string }[] = [
  { value: 'payment_approved', label: 'Pagamento aprovado' },
  { value: 'pix_generated', label: 'Pix gerado' },
  { value: 'boleto_generated', label: 'Boleto gerado' },
  { value: 'payment_declined', label: 'Pagamento recusado (cartão)' },
  { value: 'payment_expired', label: 'Pagamento expirado/cancelado' },
];

const shippingConditions: { value: ShippingCondition; label: string }[] = [
  { value: 'posted', label: 'Enviado/Postado' },
  { value: 'in_transit', label: 'A caminho (primeira movimentação)' },
  { value: 'out_for_delivery', label: 'Chegando (em rota de entrega)' },
  { value: 'awaiting_pickup', label: 'Aguardando retirada' },
  { value: 'returning', label: 'Em devolução' },
  { value: 'issue', label: 'Imprevisto (problema/extravio)' },
  { value: 'delivered', label: 'Entregue' },
];

export function TriggerConditionSelector({ ruleType, value, onChange }: TriggerConditionSelectorProps) {
  // Only show for payment and shipping types
  if (ruleType !== 'payment' && ruleType !== 'shipping') {
    return null;
  }

  const conditions = ruleType === 'payment' ? paymentConditions : shippingConditions;
  const defaultValue = ruleType === 'payment' ? 'payment_approved' : 'posted';

  return (
    <div className="space-y-2">
      <Label>Condição *</Label>
      <Select 
        value={value || defaultValue} 
        onValueChange={(v) => onChange(v as TriggerCondition)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione a condição" />
        </SelectTrigger>
        <SelectContent>
          {conditions.map((condition) => (
            <SelectItem key={condition.value} value={condition.value}>
              {condition.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Export conditions for use elsewhere
export { paymentConditions, shippingConditions };
