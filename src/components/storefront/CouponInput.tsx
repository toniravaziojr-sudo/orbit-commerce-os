import { useState } from "react";
import { Tag, X, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AppliedDiscount {
  discount_id: string;
  discount_name: string;
  discount_code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  free_shipping: boolean;
}

interface CouponInputProps {
  storeHost: string;
  subtotal: number;
  shippingPrice?: number;
  customerEmail?: string;
  appliedDiscount: AppliedDiscount | null;
  onApply: (discount: AppliedDiscount) => void;
  onRemove: () => void;
  compact?: boolean;
  className?: string;
}

export function CouponInput({
  storeHost,
  subtotal,
  shippingPrice = 0,
  customerEmail,
  appliedDiscount,
  onApply,
  onRemove,
  compact = false,
  className,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!code.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discount-validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            store_host: storeHost,
            code: code.trim(),
            subtotal,
            shipping_price: shippingPrice,
            customer_email: customerEmail,
          }),
        }
      );

      const data = await response.json();

      if (!data.valid) {
        setError(data.error || "Cupom inválido");
        return;
      }

      onApply({
        discount_id: data.discount_id,
        discount_name: data.discount_name,
        discount_code: data.discount_code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discount_amount: data.discount_amount,
        free_shipping: data.free_shipping,
      });

      setCode("");
    } catch (err) {
      setError("Erro ao validar cupom");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = () => {
    onRemove();
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  // Applied discount display
  if (appliedDiscount) {
    return (
      <div 
        className={cn("flex items-center justify-between gap-2 p-3 rounded-lg border", className)}
        style={{
          backgroundColor: 'color-mix(in srgb, var(--theme-accent-color, #22c55e) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--theme-accent-color, #22c55e) 30%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4" style={{ color: 'var(--theme-accent-color, #22c55e)' }} />
          <div>
            <span 
              className="text-sm font-medium"
              style={{ color: 'var(--theme-accent-color, #22c55e)' }}
            >
              {appliedDiscount.discount_code}
            </span>
            {!compact && (
              <p 
                className="text-xs"
                style={{ color: 'var(--theme-accent-color, #22c55e)', opacity: 0.85 }}
              >
                {appliedDiscount.free_shipping
                  ? "Frete grátis"
                  : appliedDiscount.discount_type === "order_percent"
                  ? `${appliedDiscount.discount_value}% de desconto`
                  : `R$ ${appliedDiscount.discount_amount.toFixed(2).replace(".", ",")} de desconto`}
              </p>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Input form
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cupom de desconto"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className={cn("pl-9", error && "border-destructive")}
            disabled={isLoading}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleApply}
          disabled={isLoading || !code.trim()}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
