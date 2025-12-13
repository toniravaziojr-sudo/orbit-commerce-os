import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  tenantId: string;
  onCartUpdate: (count: number) => void;
}

export function CartDrawer({
  open,
  onOpenChange,
  tenantSlug,
  tenantId,
  onCartUpdate,
}: CartDrawerProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);

  const cartKey = `cart_${tenantSlug}`;

  useEffect(() => {
    if (open) {
      const savedCart = localStorage.getItem(cartKey);
      if (savedCart) {
        try {
          const cart = JSON.parse(savedCart);
          setItems(cart.items || []);
        } catch {
          setItems([]);
        }
      }
    }
  }, [open, cartKey]);

  const updateCart = (newItems: CartItem[]) => {
    setItems(newItems);
    localStorage.setItem(cartKey, JSON.stringify({ items: newItems }));
    onCartUpdate(newItems.length);
  };

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
    updateCart(newItems);
  };

  const removeItem = (productId: string) => {
    const newItems = items.filter((item) => item.productId !== productId);
    updateCart(newItems);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handleCheckout = () => {
    onOpenChange(false);
    navigate(`/store/${tenantSlug}/checkout`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Carrinho
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Seu carrinho está vazio</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3">
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
                    <h4 className="font-medium text-sm line-clamp-2">
                      {item.name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price)}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-8 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Subtotal</span>
                <span className="font-bold text-lg">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Frete calculado no checkout
              </p>
              <Button className="w-full" size="lg" onClick={handleCheckout}>
                Finalizar Compra
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
