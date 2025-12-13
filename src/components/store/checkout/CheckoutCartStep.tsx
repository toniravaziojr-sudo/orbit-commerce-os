import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2 } from "lucide-react";
import { CartItem } from "@/pages/store/Checkout";

interface CheckoutCartStepProps {
  items: CartItem[];
  tenantSlug: string;
  onUpdate: (items: CartItem[]) => void;
  onNext: () => void;
}

export function CheckoutCartStep({
  items,
  tenantSlug,
  onUpdate,
  onNext,
}: CheckoutCartStepProps) {
  const cartKey = `cart_${tenantSlug}`;

  const updateQuantity = (productId: string, delta: number) => {
    const newItems = items
      .map((item) => {
        if (item.productId === productId) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    onUpdate(newItems);
    localStorage.setItem(cartKey, JSON.stringify({ items: newItems }));
  };

  const removeItem = (productId: string) => {
    const newItems = items.filter((item) => item.productId !== productId);
    onUpdate(newItems);
    localStorage.setItem(cartKey, JSON.stringify({ items: newItems }));
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex gap-4 p-4 border rounded-lg"
          >
            <div className="h-20 w-20 rounded-md bg-muted overflow-hidden flex-shrink-0">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">
                  Sem imagem
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium">{item.name}</h4>
              <p className="text-sm text-muted-foreground">
                {formatPrice(item.price)} cada
              </p>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.productId, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(item.productId, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeItem(item.productId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={items.length === 0}>
          Continuar para Endereço
        </Button>
      </div>
    </div>
  );
}
