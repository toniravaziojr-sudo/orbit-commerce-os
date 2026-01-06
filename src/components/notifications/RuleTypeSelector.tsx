import { CreditCard, Truck, ShoppingCart, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTenantType } from "@/hooks/useTenantType";
import type { RuleType } from "@/hooks/useNotificationRulesV2";

interface RuleTypeSelectorProps {
  value: RuleType;
  onChange: (type: RuleType) => void;
  disabled?: boolean;
}

const ruleTypes: { value: RuleType; label: string; description: string; icon: typeof CreditCard }[] = [
  {
    value: 'payment',
    label: 'Pagamento',
    description: 'Pix, boleto, aprovação, recusa',
    icon: CreditCard,
  },
  {
    value: 'shipping',
    label: 'Rastreio',
    description: 'Envio, entrega, problemas',
    icon: Truck,
  },
  {
    value: 'abandoned_checkout',
    label: 'Checkout Abandonado',
    description: 'Recuperação de carrinho',
    icon: ShoppingCart,
  },
  {
    value: 'post_sale',
    label: 'Pós-Vendas',
    description: 'Baseado no primeiro pedido',
    icon: Users,
  },
];

export function RuleTypeSelector({ value, onChange, disabled }: RuleTypeSelectorProps) {
  const { isPlatformTenant } = useTenantType();
  
  // Platform tenant (admin) doesn't see "Rastreio" option - only in creation selector
  const visibleRuleTypes = isPlatformTenant 
    ? ruleTypes.filter(t => t.value !== 'shipping')
    : ruleTypes;

  return (
    <div className="space-y-2">
      <Label>Tipo de Regra *</Label>
      <div className="grid grid-cols-2 gap-3">
        {visibleRuleTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.value;
          
          return (
            <button
              key={type.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type.value)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                isSelected 
                  ? "border-primary bg-primary/5 ring-1 ring-primary" 
                  : "border-border hover:border-primary/50 hover:bg-muted/50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 mt-0.5 shrink-0",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <div>
                <p className={cn(
                  "font-medium text-sm",
                  isSelected ? "text-primary" : "text-foreground"
                )}>
                  {type.label}
                </p>
                <p className="text-xs text-muted-foreground">{type.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
